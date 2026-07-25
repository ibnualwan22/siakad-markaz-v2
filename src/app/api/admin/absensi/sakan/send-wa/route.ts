import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMasterSantriList } from "@/lib/santri-api";
import { sendWhatsAppMessage, formatSakanStatusReport } from "@/lib/whatsapp";

export async function POST(request: Request) {
  try {
    const { tanggal } = await request.json();

    if (!tanggal) {
      return NextResponse.json({ error: "Tanggal harus diisi" }, { status: 400 });
    }

    const groupId = process.env.WA_GROUP_ID;
    if (!groupId) {
      return NextResponse.json(
        { error: "WA_GROUP_ID belum dikonfigurasi" },
        { status: 500 }
      );
    }

    const parsedDate = new Date(`${tanggal}T00:00:00Z`);

    // Ambil semua santri aktif
    const masterSantriList = await getMasterSantriList();

    // Kumpulkan semua sakan unik dari santri aktif
    const allSakan = new Set<string>();
    for (const ms of masterSantriList) {
      if (ms.isAktif && ms.sakan && ms.sakan !== "-") {
        allSakan.add(ms.sakan);
      }
    }

    // Map santriId -> dufahNama untuk filter riwayat aktif
    const activeSantriMap = new Map<string, string>();
    for (const ms of masterSantriList) {
      if (ms.isAktif) {
        activeSantriMap.set(ms.id, ms.dufahNama);
      }
    }

    // Ambil semua absen sakan untuk tanggal tersebut (termasuk keterangan)
    const absenRecords = await prisma.absenSakan.findMany({
      where: { tanggal: parsedDate },
      select: {
        riwayatId: true,
        status: true,
        keterangan: true,
        riwayat: {
          select: {
            santriId: true,
            dufahNama: true,
          },
        },
      },
    });

    // Tentukan sakan mana yang sudah absen + kumpulkan keterangan per sakan
    const sakanSudahAbsen = new Set<string>();
    const keteranganPerSakan = new Map<string, { nama: string; keterangan: string }[]>();
    const unconfirmedPerSakan = new Map<string, { nama: string }[]>();

    const today = new Date();
    today.setHours(0,0,0,0);
    
    const unconfirmedIzin = await prisma.perizinan.findMany({
      where: {
        statusIzin: "AKTIF",
        tipeIzin: { not: "HARIAN" },
        OR: [
          { tanggalSelesai: { lt: today } },
          { tipeIzin: "KELUAR_PARE", tanggalMulai: { lt: today } }
        ]
      }
    });

    const unconfirmedMap = new Set(unconfirmedIzin.map((u: any) => u.riwayatId));

    for (const record of absenRecords) {
      const activeDufah = activeSantriMap.get(record.riwayat.santriId);
      if (activeDufah && activeDufah === record.riwayat.dufahNama) {
        const ms = masterSantriList.find(m => m.id === record.riwayat.santriId);
        if (ms && ms.sakan && ms.sakan !== "-") {
          // Do not consider sakan as completed if the record is only automatically injected IZIN / SAKIT
          if (record.status !== "IZIN" && record.status !== "SAKIT") {
            sakanSudahAbsen.add(ms.sakan);
          }

          // Kumpulkan keterangan jika ada (strip [TRS-xxx] agar tidak tampil di WA)
          if (record.keterangan && record.keterangan.trim()) {
            if (!keteranganPerSakan.has(ms.sakan)) {
              keteranganPerSakan.set(ms.sakan, []);
            }
            const cleanKeterangan = record.keterangan.trim().replace(/\s*\[TRS-[\d-]+\]\s*/g, "").trim();
            if (cleanKeterangan) {
              keteranganPerSakan.get(ms.sakan)!.push({
                nama: ms.nama,
                keterangan: cleanKeterangan,
              });
            }
          }
          
          // Kumpulkan unconfirmed Izin
          if (unconfirmedMap.has(record.riwayatId)) {
            if (!unconfirmedPerSakan.has(ms.sakan)) {
              unconfirmedPerSakan.set(ms.sakan, []);
            }
            // Cegah duplikat notifikasi unconfirmed jika record absen ganda (walau tidak mungkin krn db constraint)
            if (!unconfirmedPerSakan.get(ms.sakan)!.find(u => u.nama === ms.nama)) {
              unconfirmedPerSakan.get(ms.sakan)!.push({
                nama: ms.nama
              });
            }
          }
        }
      }
    }

    // Format & kirim pesan
    const sakanList = Array.from(allSakan).sort();
    const sudahAbsen = Array.from(sakanSudahAbsen);

    const message = formatSakanStatusReport(
      tanggal,
      sakanList,
      sudahAbsen,
      keteranganPerSakan,
      unconfirmedPerSakan
    );

    // Gunakan wa session id (sesi utama) sesuai request pengguna
    const sessionId = process.env.WA_SESSION_ID;
    const result = await sendWhatsAppMessage(groupId, message, sessionId);

    if (result.success) {
      return NextResponse.json({ success: true, detail: result.detail });
    } else {
      return NextResponse.json(
        { success: false, error: result.detail || "Gagal mengirim pesan WA" },
        { status: 502 }
      );
    }
  } catch (error: any) {
    console.error("Error send-wa:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan sistem", detail: error.message },
      { status: 500 }
    );
  }
}
