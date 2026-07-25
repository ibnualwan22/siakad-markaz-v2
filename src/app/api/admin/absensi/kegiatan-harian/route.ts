import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parseWibDateString, getActiveRiwayatListForAbsen } from "@/lib/absensi";
import { getMasterSantriList } from "@/lib/santri-api";
import { sendWhatsAppMessage, formatKegiatanAlphaReport } from "@/lib/whatsapp";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tanggal = searchParams.get("tanggal");
  const kategoriId = searchParams.get("kategoriId");
  const sakan = searchParams.get("sakan") || "ALL";
  const kelasId = searchParams.get("kelasId") || "ALL";

  if (!tanggal || !kategoriId) {
    return NextResponse.json({ error: "Tanggal dan Kategori harus diisi" }, { status: 400 });
  }

  const parsedDate = parseWibDateString(tanggal);
  const santriList = await getActiveRiwayatListForAbsen(kelasId, sakan);
  const santriIds = santriList.map((s) => s.riwayatId);

  const existingAbsen = await prisma.absenKegiatan.findMany({
    where: {
      tanggal: parsedDate,
      kategoriId: kategoriId,
      riwayatId: { in: santriIds },
    },
  });

  const today = new Date();
  today.setHours(0,0,0,0);
  
  const unconfirmedIzin = await prisma.perizinan.findMany({
    where: {
      riwayatId: { in: santriIds },
      statusIzin: "AKTIF",
      tipeIzin: { not: "HARIAN" },
      OR: [
        { tanggalSelesai: { lt: today } },
        { tipeIzin: "KELUAR_PARE", tanggalMulai: { lt: today } }
      ]
    }
  });

  const unconfirmedIds = unconfirmedIzin.map((u: any) => u.riwayatId);

  return NextResponse.json({
    santriList,
    absenData: existingAbsen,
    unconfirmedIds,
  });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { tanggal, kategoriId, absenList } = payload as { 
      tanggal: string, 
      kategoriId: string,
      absenList: { riwayatId: string, status: any, keterangan?: string }[] 
    };

    if (!tanggal || !kategoriId || !absenList || !Array.isArray(absenList)) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }

    const parsedDate = parseWibDateString(tanggal);

    // --- Cek apakah SEBELUM save semua sakan sudah lengkap ---
    // Jika sudah lengkap sebelum save ini, berarti ini re-submit → jangan kirim WA lagi
    const allSakanAlreadyComplete = await checkAllSakanComplete(tanggal, kategoriId, parsedDate);

    // --- AUTO-JIT IZIN LOGIC ---
    const santriIds = absenList.map((a: any) => a.riwayatId);
    const dateZero = new Date(parsedDate);
    dateZero.setHours(0,0,0,0);
    
    const activeIzinRecords = await prisma.perizinan.findMany({
      where: {
        riwayatId: { in: santriIds },
        statusIzin: "AKTIF",
        OR: [
          { tipeIzin: "HARIAN", tanggalMulai: dateZero },
          { tipeIzin: { not: "HARIAN" }, tanggalSelesai: { gte: dateZero } },
          { tipeIzin: "KELUAR_PARE", tanggalMulai: { lte: dateZero } }
        ]
      },
      select: { riwayatId: true, statusAbsen: true, nomorTasrih: true }
    });

    const izinMap = new Map<string, any>();
    for (const i of activeIzinRecords) {
      izinMap.set(i.riwayatId, { status: i.statusAbsen || "IZIN", tasrih: i.nomorTasrih });
    }

    const modifiedAbsenList = absenList.map((absen: any) => {
      if (absen.status === "KOSONG") return absen;

      const activeIzin = izinMap.get(absen.riwayatId);
      if ((absen.status === "ALPHA" || !absen.status) && activeIzin) {
        return {
          ...absen,
          status: activeIzin.status,
          keterangan: (absen.keterangan ? absen.keterangan + " | " : "") + `Auto ${activeIzin.status} [${activeIzin.tasrih}]`
        };
      }
      return absen;
    });
    // ---------------------------

    const toUpsert = modifiedAbsenList.filter((a: any) => a.status !== "KOSONG");
    const toDelete = modifiedAbsenList.filter((a: any) => a.status === "KOSONG");

    // --- Simpan absensi ---
    const operations: any[] = toUpsert.map((absen: any) =>
      prisma.absenKegiatan.upsert({
        where: {
          riwayatId_kategoriId_tanggal: {
            riwayatId: absen.riwayatId,
            tanggal: parsedDate,
            kategoriId: kategoriId,
          },
        },
        update: {
          status: absen.status,
          keterangan: absen.keterangan || null,
        },
        create: {
          riwayatId: absen.riwayatId,
          tanggal: parsedDate,
          kategoriId: kategoriId,
          status: absen.status,
          keterangan: absen.keterangan || null,
        },
      })
    );
    
    if (toDelete.length > 0) {
      operations.push(
        prisma.absenKegiatan.deleteMany({
          where: {
            tanggal: parsedDate,
            kategoriId: kategoriId,
            riwayatId: { in: toDelete.map((d: any) => d.riwayatId) }
          }
        })
      );
    }

    await prisma.$transaction(operations);

    // --- Setelah save, cek lagi apakah sekarang semua sakan sudah lengkap ---
    let waSent = false;
    let waDetail = "";

    if (!allSakanAlreadyComplete) {
      const nowComplete = await checkAllSakanComplete(tanggal, kategoriId, parsedDate);

      if (nowComplete) {
        // Ini submit terakhir yang melengkapi semua sakan → kirim WA
        const waResult = await sendKegiatanAlphaWa(tanggal, kategoriId, parsedDate);
        waSent = waResult.sent;
        waDetail = waResult.detail;
      }
    }

    return NextResponse.json({ 
      success: true, 
      count: operations.length,
      waSent,
      waDetail,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Gagal menyimpan absensi kegiatan" }, { status: 500 });
  }
}

/**
 * Cek apakah semua sakan sudah memiliki setidaknya 1 record absen kegiatan
 * untuk kategori + tanggal tertentu.
 */
async function checkAllSakanComplete(
  tanggalStr: string,
  kategoriId: string,
  parsedDate: Date,
): Promise<boolean> {
  const masterSantriList = await getMasterSantriList();

  // Kumpulkan semua sakan unik dari santri aktif
  const allSakan = new Set<string>();
  for (const ms of masterSantriList) {
    if (ms.isAktif && ms.sakan && ms.sakan !== "-") {
      allSakan.add(ms.sakan);
    }
  }

  if (allSakan.size === 0) return false;

  // Ambil semua record absen kegiatan untuk tanggal+kategori ini
  const absenRecords = await prisma.absenKegiatan.findMany({
    where: {
      tanggal: parsedDate,
      kategoriId,
    },
    select: {
      riwayat: {
        select: {
          santriId: true,
          dufahNama: true,
        },
      },
    },
  });

  // Map santriId -> dufah aktif
  const activeSantriMap = new Map<string, string>();
  for (const ms of masterSantriList) {
    if (ms.isAktif) {
      activeSantriMap.set(ms.id, ms.dufahNama);
    }
  }

  // Tentukan sakan mana yang sudah ada record-nya
  const sakanSudahAbsen = new Set<string>();
  for (const record of absenRecords) {
    const activeDufah = activeSantriMap.get(record.riwayat.santriId);
    if (activeDufah && activeDufah === record.riwayat.dufahNama) {
      const ms = masterSantriList.find(m => m.id === record.riwayat.santriId);
      if (ms && ms.sakan && ms.sakan !== "-") {
        sakanSudahAbsen.add(ms.sakan);
      }
    }
  }

  // Semua sakan sudah absen?
  for (const s of allSakan) {
    if (!sakanSudahAbsen.has(s)) return false;
  }

  return true;
}

/**
 * Kirim daftar santri alpha untuk kegiatan ke nomor WA keamanan/kedisiplinan.
 */
async function sendKegiatanAlphaWa(
  tanggalStr: string,
  kategoriId: string,
  parsedDate: Date,
): Promise<{ sent: boolean; detail: string }> {
  const target = process.env.WA_KEGIATAN_TARGET;
  if (!target) {
    return { sent: false, detail: "WA_KEGIATAN_TARGET belum dikonfigurasi" };
  }

  // Ambil nama kategori
  const kategori = await prisma.kategoriKegiatan.findUnique({
    where: { id: kategoriId },
  });
  if (!kategori) {
    return { sent: false, detail: "Kategori tidak ditemukan" };
  }

  // Ambil semua santri + absen data
  const santriList = await getActiveRiwayatListForAbsen(undefined, "ALL");
  const santriIds = santriList.map((s) => s.riwayatId);

  const absenData = await prisma.absenKegiatan.findMany({
    where: {
      tanggal: parsedDate,
      kategoriId,
      riwayatId: { in: santriIds },
    },
  });

  const absenMap = new Map<string, string>();
  for (const a of absenData) {
    absenMap.set(a.riwayatId, a.status);
  }

  // Filter santri yang ALPHA
  const alphaList = santriList
    .filter((s) => absenMap.get(s.riwayatId) === "ALPHA")
    .map((s) => ({ nama: s.nama, sakan: s.sakan || "-" }));

  if (alphaList.length === 0) {
    return { sent: false, detail: "Tidak ada santri alpha" };
  }

  const message = formatKegiatanAlphaReport(tanggalStr, kategori.nama, alphaList);
  const result = await sendWhatsAppMessage(target, message);

  return { 
    sent: result.success, 
    detail: result.success 
      ? `Daftar ${alphaList.length} santri alpha terkirim` 
      : (result.detail || "Gagal mengirim") 
  };
}
