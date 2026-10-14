import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendReminderWhatsApp, formatReminderMessage, delay } from "@/lib/whatsapp";
import { getTodayWibString, parseWibDateString } from "@/lib/absensi";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Maksimal 60 detik untuk menghindari timeout Vercel

// Helper: konversi "HH:MM" ke menit
function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

// Helper: dapatkan waktu WIB saat ini dalam menit
function getCurrentWibMinutes(): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const h = parseInt(parts.find((p) => p.type === "hour")?.value || "0");
  const m = parseInt(parts.find((p) => p.type === "minute")?.value || "0");
  return h * 60 + m;
}

// Jeda random antara minMs dan maxMs untuk menghindari spam detection
function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return delay(ms);
}

export async function GET(request: NextRequest) {
  // Validasi secret
  const searchParams = request.nextUrl.searchParams;
  const secret = searchParams.get("secret");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || secret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const todayStr = getTodayWibString();
    const todayDate = parseWibDateString(todayStr);
    const nowMinutes = getCurrentWibMinutes();
    const MAKS_JEDA_MENIT = 120; // Batas maksimal 2 jam setelah sesi tutup

    // ─── 1. Ambil semua jadwal sesi global ───────────────────────────────────
    const globalSesiList = await prisma.jadwalSesi.findMany({
      where: { isActive: true },
    });

    // ─── 2. Ambil semua sesi tambahan program ───────────────────────────────
    const sesiTambahanList = await prisma.sesiTambahanProgram.findMany({
      where: { isActive: true },
    });

    // ─── 3. Tentukan sesi yang sudah LEWAT secara program-aware ─────────────
    // Sesi global digunakan untuk pengajar kelas reguler.
    // Sesi tambahan per-program digunakan untuk pengajar level program.
    // Keduanya diproses TERPISAH agar jam yang berbeda tidak saling menimpa.
    type SesiInfo = { sesi: string; jamTutup: string; toleransiMenit: number };

    // Sesi global yang sudah lewat (untuk pengajar kelas reguler / PengajarSesi)
    const passedGlobalSessions = globalSesiList.filter((s) => {
      const tutupMenit = timeToMinutes(s.jamTutup) + s.toleransiMenit;
      const selisih = nowMinutes - tutupMenit;
      return selisih > 0 && selisih <= MAKS_JEDA_MENIT;
    }).map((s): SesiInfo => ({
      sesi: s.sesi as string,
      jamTutup: s.jamTutup,
      toleransiMenit: s.toleransiMenit,
    }));

    // Sesi tambahan per-program yang sudah lewat (untuk PengajarSesiProgram)
    // Dikelompokkan per-programId agar bisa dicari dengan cepat
    type SesiTambahanInfo = SesiInfo & { programId: string };
    const passedSesiTambahanByProgram = new Map<string, SesiTambahanInfo[]>();
    for (const st of sesiTambahanList) {
      const tutupMenit = timeToMinutes(st.jamTutup) + st.toleransiMenit;
      const selisih = nowMinutes - tutupMenit;
      if (selisih > 0 && selisih <= MAKS_JEDA_MENIT) {
        if (!passedSesiTambahanByProgram.has(st.programId)) {
          passedSesiTambahanByProgram.set(st.programId, []);
        }
        passedSesiTambahanByProgram.get(st.programId)!.push({
          sesi: st.sesi as string,
          jamTutup: st.jamTutup,
          toleransiMenit: st.toleransiMenit,
          programId: st.programId,
        });
      }
    }

    // Untuk backward compatibility: kumpulan semua sesi yang perlu dicek
    // (gabungan global + tambahan, de-duplikasi hanya untuk keperluan logging)
    const allPassedSesiKeys = new Set<string>([
      ...passedGlobalSessions.map(s => s.sesi),
      ...Array.from(passedSesiTambahanByProgram.values()).flat().map(s => s.sesi),
    ]);

    if (passedGlobalSessions.length === 0 && passedSesiTambahanByProgram.size === 0) {
      return NextResponse.json({
        success: true,
        message: "Tidak ada sesi yang perlu dicek saat ini.",
        nowMinutes,
      });
    }

    // ─── 4. Ambil semua pengajar yang dijadwalkan (PengajarSesi) ─────────────
    const pengajarSesiList = await prisma.pengajarSesi.findMany({
      include: {
        user: { select: { id: true, nama: true, noHp: true } },
        kelas: { select: { id: true, nama: true } },
      },
    });

    // ─── 5. Ambil semua pengajar level program (PengajarSesiProgram) ─────────
    const pengajarSesiProgramList = await prisma.pengajarSesiProgram.findMany({
      include: {
        user: { select: { id: true, nama: true, noHp: true } },
        program: {
          select: {
            id: true,
            nama_indo: true,
            kelasList: { select: { id: true } },
          },
        },
      },
    });

    // ─── 6. Ambil semua AbsenPengajar hari ini ───────────────────────────────
    const absenPengajarHariIni = await prisma.absenPengajar.findMany({
      where: { tanggal: todayDate },
      select: { userId: true, sesi: true },
    });

    const sudahAbsenSet = new Set(
      absenPengajarHariIni.map((a) => `${a.userId}_${a.sesi}`)
    );

    // ─── 6b. Cek badal hari ini — pengajar yang jadwalnya sudah dicover badal tidak perlu di-reminder ──
    // Badal tercatat sebagai AbsenPengajar dengan isBadal=true:
    //  - dicatat admin  -> pengajarDigantikanId terisi (langsung tahu siapa yang digantikan)
    //  - dicatat pengajar via mode badal -> pengajarDigantikanId kosong, cari pengajar
    //    terjadwal untuk kelas+sesi tersebut dari PengajarSesi / PengajarSesiProgram
    const badalHariIni = await prisma.absenPengajar.findMany({
      where: { tanggal: todayDate, isBadal: true },
      select: { userId: true, sesi: true, kelasId: true, pengajarDigantikanId: true },
    });

    const sudahDibadalkanSet = new Set<string>();
    for (const b of badalHariIni) {
      if (b.pengajarDigantikanId) {
        sudahDibadalkanSet.add(`${b.pengajarDigantikanId}_${b.sesi}`);
      } else {
        const terjadwal = pengajarSesiList.find(
          (ps) => ps.kelas.id === b.kelasId && ps.sesi === b.sesi
        );
        if (terjadwal) {
          sudahDibadalkanSet.add(`${terjadwal.user.id}_${b.sesi}`);
        } else {
          const terjadwalProgram = pengajarSesiProgramList.find(
            (psp) => psp.sesi === b.sesi && psp.program.kelasList.some((k) => k.id === b.kelasId)
          );
          if (terjadwalProgram) {
            sudahDibadalkanSet.add(`${terjadwalProgram.user.id}_${b.sesi}`);
          }
        }
      }
    }

    // ─── 7. Ambil semua ReminderLog hari ini yang SUKSES ─────────────────────
    const reminderLogsHariIni = await prisma.reminderLog.findMany({
      where: { 
        tanggal: todayDate,
        success: true // Hanya ambil yang sukses agar yang gagal bisa di-retry
      },
      select: { userId: true, sesi: true },
    });

    const sudahDikirimSet = new Set(
      reminderLogsHariIni.map((r) => `${r.userId}_${r.sesi}`)
    );

    // ─── 8. Proses pengiriman reminder ───────────────────────────────────────
    let totalKirim = 0;
    let totalSkip = 0;
    const errors: string[] = [];

    // --- A. Pengajar kelas reguler (PengajarSesi) → gunakan sesi GLOBAL ---
    for (const sesiInfo of passedGlobalSessions) {
      const sesiLabel = `Sesi ${sesiInfo.sesi.replace("SESI_", "")}`;

      const pengajarSesiIni = pengajarSesiList.filter(
        (ps) => ps.sesi === sesiInfo.sesi
      );

      for (const ps of pengajarSesiIni) {
        const key = `${ps.user.id}_${ps.sesi}`;

        if (sudahAbsenSet.has(key)) { totalSkip++; continue; }
        if (sudahDibadalkanSet.has(key)) { totalSkip++; continue; }
        if (sudahDikirimSet.has(key)) { totalSkip++; continue; }
        if (!ps.user.noHp) { totalSkip++; continue; }

        const pesan = formatReminderMessage(ps.user.nama, sesiLabel, ps.kelas.nama);
        const result = await sendReminderWhatsApp(ps.user.noHp, pesan);

        try {
          await prisma.reminderLog.upsert({
            where: {
              userId_tanggal_sesi: {
                userId: ps.user.id,
                tanggal: todayDate,
                sesi: ps.sesi as any,
              }
            },
            update: { success: result.success, sentAt: new Date() },
            create: {
              userId: ps.user.id,
              tanggal: todayDate,
              sesi: ps.sesi as any,
              success: result.success,
            },
          });
          if (result.success) sudahDikirimSet.add(key);
        } catch { /* Abaikan error upsert */ }

        if (result.success) {
          totalKirim++;
        } else {
          errors.push(`Gagal kirim ke ${ps.user.nama} (${ps.sesi}): ${result.detail}`);
        }

        await randomDelay(3000, 5000);
      }
    }

    // --- B. Pengajar level program (PengajarSesiProgram) → gunakan sesi TAMBAHAN per-program ---
    // Setiap pengajar dicek berdasarkan jam sesi tambahan PROGRAM MEREKA SENDIRI,
    // sehingga jika Sesi 7 di program mereka jam 20:10, reminder dikirim pada jam 20:10+
    // meskipun Sesi 7 global berbeda jamnya.
    for (const psp of pengajarSesiProgramList) {
      const programId = psp.program.id;
      const sesiProgramLewat = passedSesiTambahanByProgram.get(programId) || [];

      // Jika tidak ada sesi tambahan yang lewat untuk program ini,
      // fallback ke sesi global yang lewat (agar program yang tidak punya sesi tambahan tetap terkirim)
      const sesiToCheck = sesiProgramLewat.length > 0
        ? sesiProgramLewat.filter(s => s.sesi === psp.sesi)
        : passedGlobalSessions.filter(s => s.sesi === psp.sesi);

      if (sesiToCheck.length === 0) continue;

      const key = `${psp.user.id}_${psp.sesi}`;
      if (sudahAbsenSet.has(key)) { totalSkip++; continue; }
      if (sudahDibadalkanSet.has(key)) { totalSkip++; continue; }
      if (sudahDikirimSet.has(key)) { totalSkip++; continue; }
      if (!psp.user.noHp) { totalSkip++; continue; }

      const sesiLabel = `Sesi ${psp.sesi.replace("SESI_", "")}`;
      const kelasNama = `Program ${psp.program.nama_indo}`;
      const pesan = formatReminderMessage(psp.user.nama, sesiLabel, kelasNama);
      const result = await sendReminderWhatsApp(psp.user.noHp, pesan);

      try {
        await prisma.reminderLog.upsert({
          where: {
            userId_tanggal_sesi: {
              userId: psp.user.id,
              tanggal: todayDate,
              sesi: psp.sesi as any,
            }
          },
          update: { success: result.success, sentAt: new Date() },
          create: {
            userId: psp.user.id,
            tanggal: todayDate,
            sesi: psp.sesi as any,
            success: result.success,
          },
        });
        if (result.success) sudahDikirimSet.add(key);
      } catch { /* Abaikan error upsert */ }

      if (result.success) {
        totalKirim++;
      } else {
        errors.push(`Gagal kirim ke ${psp.user.nama} (${psp.sesi}): ${result.detail}`);
      }

      await randomDelay(3000, 5000);
    }

    return NextResponse.json({
      success: true,
      tanggal: todayStr,
      sesiDicek: Array.from(allPassedSesiKeys),
      totalKirim,
      totalSkip,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("[wa-reminder-pengajar] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
