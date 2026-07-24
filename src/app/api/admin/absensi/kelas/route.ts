import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parseWibDateString, getActiveRiwayatListForAbsen } from "@/lib/absensi";
import { getSession } from "@/lib/auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tanggal = searchParams.get("tanggal");
  const sesi = searchParams.get("sesi");
  const kelasId = searchParams.get("kelasId") || "ALL";

  if (!tanggal || !sesi) {
    return NextResponse.json({ error: "Tanggal dan Sesi harus diisi" }, { status: 400 });
  }

  const parsedDate = parseWibDateString(tanggal);
  const santriList = await getActiveRiwayatListForAbsen(kelasId);
  const santriIds = santriList.map((s) => s.riwayatId);

  const existingAbsen = await prisma.absenKelas.findMany({
    where: {
      tanggal: parsedDate,
      sesi: sesi as any,
      riwayatId: { in: santriIds },
    },
  });

  const userSession = (await getSession()) as any;
  let absenPengajarData = null;
  if (userSession && userSession.role !== "ADMIN") {
     let actualKelasId = kelasId;
     if (actualKelasId && actualKelasId.startsWith("PROGRAM_")) {
        const programId = actualKelasId.replace("PROGRAM_", "");
        const firstClass = await prisma.kelas.findFirst({ where: { programId } });
        if (firstClass) actualKelasId = firstClass.id;
     }

     const whereCondition: any = {
       userId: userSession.userId,
       tanggal: parsedDate,
       sesi: sesi as any
     };

     if (actualKelasId && actualKelasId !== "ALL" && actualKelasId !== "UNASSIGNED") {
        whereCondition.kelasId = actualKelasId;
     }

     absenPengajarData = await prisma.absenPengajar.findFirst({
       where: whereCondition
     });
  }

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
    absenPengajarData,
    unconfirmedIds,
  });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { tanggal, sesi, kelasId, absenList, absenPengajar } = payload as any;

    if (!tanggal || !sesi || !absenList || !Array.isArray(absenList)) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }

    const parsedDate = parseWibDateString(tanggal);
    const userSession = (await getSession()) as any;

    // GUARD: Jika frontend mengirim data absenPengajar tapi session null/expired,
    // kembalikan 401 agar frontend bisa mengarahkan ke login (mencegah silent failure)
    if (absenPengajar && !userSession) {
      return NextResponse.json(
        { error: "Sesi login telah berakhir. Silakan login ulang untuk menyimpan data pengajar." },
        { status: 401 }
      );
    }

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
      const activeIzin = izinMap.get(absen.riwayatId);
      // Jika disubmit sebagai ALPHA/kosong, tapi dia punya Izin aktif, otomatis inject IZIN
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

    const operations: any[] = modifiedAbsenList.map((absen: any) =>
      prisma.absenKelas.upsert({
        where: {
          riwayatId_tanggal_sesi: {
            riwayatId: absen.riwayatId,
            tanggal: parsedDate,
            sesi: sesi,
          },
        },
        update: {
          status: absen.status,
          keterangan: absen.keterangan || null,
        },
        create: {
          riwayatId: absen.riwayatId,
          tanggal: parsedDate,
          sesi: sesi,
          status: absen.status,
          keterangan: absen.keterangan || null,
        },
      })
    );

    const isTeacherSubmit = userSession && userSession.role !== "ADMIN";
    const isAdminBackupSubmit = userSession && userSession.role === "ADMIN" && payload.targetUserId;

    if ((isTeacherSubmit || isAdminBackupSubmit) && absenPengajar) {
      const targetUserId = isTeacherSubmit ? userSession.userId : payload.targetUserId;
      let actualKelasId = kelasId;

      // Jika kelasId tidak valid (ALL, UNASSIGNED, atau kosong), cari kelasId yang valid
      // berdasarkan assignment pengajar target di sesi yang sedang diabsen
      if (!actualKelasId || actualKelasId === "ALL" || actualKelasId === "UNASSIGNED") {
        // Cari dari PengajarSesiProgram dulu (sesi 7+)
        const psp = await prisma.pengajarSesiProgram.findFirst({
          where: { userId: targetUserId, sesi: sesi as any },
          include: { program: { include: { kelasList: { select: { id: true }, take: 1 } } } }
        });
        if (psp && psp.program.kelasList.length > 0) {
          actualKelasId = psp.program.kelasList[0].id;
        } else {
          // Fallback: cari dari PengajarSesi biasa
          const ps = await prisma.pengajarSesi.findFirst({
            where: { userId: targetUserId, sesi: sesi as any }
          });
          if (ps) actualKelasId = ps.kelasId;
        }
      }

      // Konversi PROGRAM_xxx ke kelas pertama program tersebut
      if (actualKelasId && actualKelasId.startsWith("PROGRAM_")) {
        const programId = actualKelasId.replace("PROGRAM_", "");
        const firstClass = await prisma.kelas.findFirst({
          where: { programId: programId }
        });
        if (firstClass) {
          actualKelasId = firstClass.id;
        } else {
          return NextResponse.json({ error: "Program tidak memiliki kelas satupun" }, { status: 400 });
        }
      }

      // Jika masih tidak ada kelasId yang valid, skip tanpa error
      if (!actualKelasId) {
        await prisma.$transaction(operations);
        return NextResponse.json({ success: true, count: operations.length, note: "Absen santri tersimpan, absen pengajar dilewati (tidak ada kelas yang terdeteksi)" });
      }

      // === Hitung terlambatMenit server-side ===
      let terlambatMenit: number | null = null;
      if (!absenPengajar.isBadal && !absenPengajar.isAsisten && absenPengajar.waktuMulai && absenPengajar.waktuMulai !== "-") {
        // Resolve jadwal buka dari JadwalSesi / SesiTambahanProgram
        const jadwalSesi = await prisma.jadwalSesi.findUnique({ where: { sesi: sesi as any } });
        let jadwalBuka: string | null = jadwalSesi?.jamBuka ?? null;

        // Fallback: SesiTambahanProgram
        if (!jadwalBuka && actualKelasId) {
          const kelas = await prisma.kelas.findUnique({ where: { id: actualKelasId }, select: { programId: true } });
          if (kelas?.programId) {
            const tambahan = await prisma.sesiTambahanProgram.findFirst({
              where: { programId: kelas.programId, sesi: sesi as any, isActive: true }
            });
            if (tambahan) jadwalBuka = tambahan.jamBuka;
          }
        }

        if (jadwalBuka) {
          const [hM, mM] = absenPengajar.waktuMulai.split(":").map(Number);
          const [hB, mB] = jadwalBuka.split(":").map(Number);
          const diff = (hM * 60 + mM) - (hB * 60 + mB);
          if (diff > 5) terlambatMenit = diff - 5; // Grace period 5 menit
        }
      }

      operations.push(
        prisma.absenPengajar.upsert({
          where: {
            userId_tanggal_sesi_kelasId: {
              userId: targetUserId,
              tanggal: parsedDate,
              sesi: sesi,
              kelasId: actualKelasId,
            }
          },
          update: {
            waktuMulai: absenPengajar.waktuMulai,
            waktuSelesai: absenPengajar.waktuSelesai,
            materi: absenPengajar.materi,
            terlambatMenit,
            atributNametag: absenPengajar.atributNametag,
            atributKopiah: absenPengajar.atributKopiah,
            atributBros: absenPengajar.atributBros,
            kecerdasan: absenPengajar.kecerdasan || null,
            isBadal: absenPengajar.isBadal ?? false,
            isAsisten: absenPengajar.isAsisten ?? false,
            pengajarDigantikanId: absenPengajar.pengajarDigantikanId || null,
          },
          create: {
            userId: targetUserId,
            kelasId: actualKelasId,
            tanggal: parsedDate,
            sesi: sesi,
            waktuMulai: absenPengajar.waktuMulai,
            waktuSelesai: absenPengajar.waktuSelesai,
            materi: absenPengajar.materi,
            terlambatMenit,
            atributNametag: absenPengajar.atributNametag,
            atributKopiah: absenPengajar.atributKopiah,
            atributBros: absenPengajar.atributBros,
            kecerdasan: absenPengajar.kecerdasan || null,
            isBadal: absenPengajar.isBadal ?? false,
            isAsisten: absenPengajar.isAsisten ?? false,
            pengajarDigantikanId: absenPengajar.pengajarDigantikanId || null,
          }
        })
      );
    }

    await prisma.$transaction(operations);

    return NextResponse.json({ success: true, count: operations.length });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Gagal menyimpan absensi" }, { status: 500 });
  }
}
