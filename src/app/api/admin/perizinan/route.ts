import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { parseWibDateString } from "@/lib/jadwal-sesi";
import { generateNomorTasrih, processAutoAbsensiIzin } from "@/lib/perizinan-utils";
import { TipeIzin } from "@prisma/client";
import { getActiveDufahName } from "@/lib/absensi";


// Aturan overlap antar tipe izin:
// - HARIAN hanya untuk absen kelas, TABIROT hanya untuk absen ta'birot -> keduanya boleh bareng
// - BERHARI_HARI / KELUAR_PARE mencakup semua jenis absen -> overlap dengan apapun
function isTipeOverlapping(tipeBaru: string, tipeExisting: string): boolean {
  const mencakupSemua = (t: string) => t === "BERHARI_HARI" || t === "KELUAR_PARE";
  if (mencakupSemua(tipeBaru) || mencakupSemua(tipeExisting)) return true;
  return tipeBaru === tipeExisting;
}

// Normalisasi rentang tanggal: HARIAN/TABIROT hanya 1 hari
function getRentang(tipe: string, mulai: Date, selesai: Date | null): { start: Date; end: Date } {
  if (tipe === "HARIAN" || tipe === "TABIROT" || !selesai) {
    return { start: mulai, end: mulai };
  }
  return { start: mulai, end: selesai };
}

function isRentangOverlap(a: { start: Date; end: Date }, b: { start: Date; end: Date }): boolean {
  return a.start <= b.end && b.start <= a.end;
}


// Tandai SELESAI untuk izin yang sudah kedaluwarsa (lazy, dijalankan saat GET)
// - HARIAN/TABIROT: kedaluwarsa jika tanggalMulai < hari ini
// - BERHARI_HARI: kedaluwarsa jika tanggalSelesai < hari ini
// - KELUAR_PARE: kedaluwarsa jika tanggalSelesai diisi dan < hari ini (null = masih berjalan)
async function autoExpireIzin() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.perizinan.updateMany({
    where: {
      statusIzin: { in: ["AKTIF", "MENUNGGU"] },
      OR: [
        {
          tipeIzin: { in: ["HARIAN", "TABIROT"] },
          tanggalMulai: { lt: today },
        },
        {
          tipeIzin: "BERHARI_HARI",
          tanggalSelesai: { lt: today },
        },
        {
          tipeIzin: "KELUAR_PARE",
          tanggalSelesai: { not: null, lt: today },
        },
      ],
    },
    data: { statusIzin: "SELESAI" },
  });
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Lazy auto-expire: tandai SELESAI untuk izin yang sudah lewat tanggalnya
  try { await autoExpireIzin(); } catch (e) { console.error("autoExpireIzin:", e); }

  const { searchParams } = new URL(request.url);
  const tipe = searchParams.get("tipe");
  const status = searchParams.get("status");
  const sakan = searchParams.get("sakan");
  const kelasId = searchParams.get("kelasId");
  const dufahParam = searchParams.get("dufah");

  // Default: filter ke dufah aktif. "ALL" untuk semua dufah (riwayat).
  let dufahFilter: string | null = null;
  if (!dufahParam || dufahParam === "ACTIVE") {
    dufahFilter = await getActiveDufahName();
  } else if (dufahParam !== "ALL") {
    dufahFilter = dufahParam;
  }

  let whereClause: any = {};
  if (tipe && tipe !== "ALL") {
    if (tipe.includes(",")) {
      whereClause.tipeIzin = { in: tipe.split(",") };
    } else {
      whereClause.tipeIzin = tipe;
    }
  }
  
  if (status && status !== "ALL") {
    if (status.includes(",")) {
      whereClause.statusIzin = { in: status.split(",") };
    } else {
      whereClause.statusIzin = status;
    }
  }

  if (kelasId && kelasId !== "ALL") whereClause.riwayat = { kelasId: kelasId };
  if (dufahFilter) {
    whereClause.riwayat = { ...(whereClause.riwayat || {}), dufahNama: dufahFilter };
  }

  try {
    const data = await prisma.perizinan.findMany({
      where: whereClause,
      include: {
        riwayat: {
          include: {
            santri: true,
            kelas: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    // Manual filter for sakan if needed (since it's not directly in DB, but we usually get it from master API)
    // Actually, to display properly, frontend usually maps it with getActiveRiwayatListForAbsen.
    // For now we just return DB records, frontend will merge with master santri.
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch perizinan" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { riwayatIds, tipeIzin, alasan, tanggalMulai, tanggalSelesai, statusAbsen, kategoriHarian } = body;

    if (!riwayatIds || riwayatIds.length === 0 || !tipeIzin || !alasan || !tanggalMulai) {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
    }

    let actualTipeIzin = tipeIzin as TipeIzin;
    if (tipeIzin === "HARIAN" && kategoriHarian === "TABIROT") {
      actualTipeIzin = "TABIROT" as any;
    }

    const tglMulai = parseWibDateString(tanggalMulai);
    const tglSelesai = tanggalSelesai ? parseWibDateString(tanggalSelesai) : null;

    const operations = [];
    const grupTasrihId = crypto.randomUUID();

    const rentangBaru = getRentang(actualTipeIzin, tglMulai, tglSelesai);

    for (const riwayatId of riwayatIds) {
      // Validasi anti-duplikat: cek izin AKTIF/MENUNGGU yang overlap
      const izinExisting = await prisma.perizinan.findMany({
        where: {
          riwayatId,
          statusIzin: { in: ["AKTIF", "MENUNGGU"] },
        },
        select: { tipeIzin: true, tanggalMulai: true, tanggalSelesai: true },
      });

      for (const ex of izinExisting) {
        if (!isTipeOverlapping(actualTipeIzin, ex.tipeIzin)) continue;
        const rentangEx = getRentang(ex.tipeIzin, ex.tanggalMulai, ex.tanggalSelesai);
        if (isRentangOverlap(rentangBaru, rentangEx)) {
          const [santri, izinLengkap] = await Promise.all([
            prisma.riwayatSantri.findUnique({
              where: { id: riwayatId },
              select: { santri: { select: { nama: true } } },
            }),
            prisma.perizinan.findFirst({
              where: {
                riwayatId,
                tipeIzin: ex.tipeIzin,
                statusIzin: { in: ["AKTIF", "MENUNGGU"] },
              },
              select: { createdBy: true },
              orderBy: { createdAt: "desc" },
            }),
          ]);
          let namaPencatat = "admin";
          if (izinLengkap?.createdBy) {
            const userPencatat = await prisma.user.findUnique({
              where: { id: izinLengkap.createdBy },
              select: { nama: true, username: true },
            });
            namaPencatat = userPencatat?.nama || userPencatat?.username || "admin";
          }
          const namaSantri = santri?.santri?.nama || riwayatId;
          const labelTipe: Record<string, string> = {
            HARIAN: "harian",
            TABIROT: "ta'birot",
            BERHARI_HARI: "berhari-hari",
            KELUAR_PARE: "keluar pare",
          };
          return NextResponse.json(
            { error: `Santri atas nama ${namaSantri} telah mendapatkan izin ${labelTipe[ex.tipeIzin] || ex.tipeIzin} oleh ${namaPencatat}` },
            { status: 400 }
          );
        }
      }

      const nomorTasrih = await generateNomorTasrih(tglMulai);
      
      const newIzin = await prisma.perizinan.create({
        data: {
          riwayatId,
          tipeIzin: actualTipeIzin,
          alasan,
          tanggalMulai: tglMulai,
          tanggalSelesai: tglSelesai,
          statusIzin: "AKTIF",
          nomorTasrih,
          createdBy: session.userId,
          isFromPublic: false,
          grupTasrihId,
          statusAbsen: statusAbsen || "IZIN"
        }
      });
      
      operations.push(newIzin);

      // Jalankan proses auto absensi
      await processAutoAbsensiIzin(
        riwayatId, 
        actualTipeIzin, 
        tglMulai, 
        tglSelesai, 
        alasan, 
        nomorTasrih,
        statusAbsen || "IZIN",
        kategoriHarian
      );
    }

    return NextResponse.json({ success: true, count: operations.length, grupTasrihId });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Gagal membuat perizinan" }, { status: 500 });
  }
}
