import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dari = searchParams.get("dari");
  const sampai = searchParams.get("sampai");

  if (!dari || !sampai) {
    return NextResponse.json({ error: "Parameter rentang tanggal tidak lengkap" }, { status: 400 });
  }

  // Izinkan akses dari cron internal menggunakan secret header
  const cronSecret = (request as any).headers?.get?.("x-cron-secret") || 
    new Headers(request.headers).get("x-cron-secret");
  const isCronRequest = cronSecret && cronSecret === process.env.CRON_SECRET;

  const session = (isCronRequest
    ? { role: "ADMIN", userId: null, kelasId: null }  // Treat cron sebagai admin
    : await getSession()) as any;

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let isTeacher = false;
    if (session.role !== "ADMIN") {
      const psCount = await prisma.pengajarSesi.count({
        where: { userId: session.userId }
      });
      if (psCount > 0 || session.kelasId) {
        isTeacher = true;
      }
    }

    const whereClause: any = {
      tanggal: {
        gte: new Date(`${dari}T00:00:00Z`),
        lte: new Date(`${sampai}T23:59:59Z`),
      }
    };

    if (isTeacher) {
      whereClause.userId = session.userId;
    }

    const records = await prisma.absenPengajar.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, nama: true, username: true } },
        kelas: { select: { id: true, nama: true, program: { select: { id: true, nama_indo: true } } } },
        pengajarDigantikan: { select: { id: true, nama: true } },
        beritaAcara: true,
      }
    });

    const pengajarSesiProgramList = await prisma.pengajarSesiProgram.findMany({
      where: isTeacher ? { userId: session.userId } : undefined,
      include: { 
        user: { select: { id: true, nama: true, username: true } },
        program: { select: { id: true, nama_indo: true } }
      }
    });

    // Fetch SesiTaqwim untuk mendeteksi kelas Taqwim (masih dipakai untuk label sesi)
    const sesiTaqwimList = await prisma.sesiTaqwim.findMany({ where: { isActive: true } });

    // Fetch kelas-kelas yang punya ketua kelas aktif (beritaAcara aktif)
    const activeKetuaList = await prisma.ketuaKelas.findMany({
      where: { isActive: true },
      select: { kelasId: true }
    });
    const kelasWithKetuaSet = new Set(activeKetuaList.map(k => k.kelasId));

    const formatted = records.map(r => {
      // Cek apakah guru ini di-assign via program level di sesi ini
      const isProgramLevel = pengajarSesiProgramList.some(
        psp => psp.userId === r.userId && psp.programId === r.kelas.program?.id && psp.sesi === r.sesi
      );

      // Gunakan nilai terlambatMenit yang sudah tersimpan di database saat pengajar absen.
      // JANGAN hitung ulang dari jadwal saat ini — perubahan jadwal tidak boleh mempengaruhi
      // rekap yang sudah ada. Nilai null berarti tidak terlambat (sudah dihitung saat submit).
      const terlambatMenit = r.terlambatMenit ?? 0;

      const isTaqwimClass = r.kelas.program?.id && sesiTaqwimList.some(t => t.programId === r.kelas.program!.id);

      return {
        id: r.id,
        pengajar: r.user.nama,
        kelas: isProgramLevel ? `Program ${r.kelas.program?.nama_indo}` : r.kelas.nama,
        tanggal: r.tanggal.toISOString().split("T")[0],
        sesi: isTaqwimClass ? "SESI_TAQWIM" : r.sesi,
        materi: r.materi || "-",
        waktuMulai: r.waktuMulai,
        waktuSelesai: r.waktuSelesai,
        status: "HADIR",
        isBadal: r.isBadal,
        isAsisten: r.isAsisten,
        pengajarDigantikan: r.pengajarDigantikan?.nama || null,
        atribut: {
          nametag: r.atributNametag,
          kopiah: r.atributKopiah,
          bros: r.atributBros,
        },
        terlambatMenit,
        beritaAcara: r.beritaAcara ? {
          id: r.beritaAcara.id,
          konfirmasiHadir: r.beritaAcara.konfirmasiHadir,
          catatan: r.beritaAcara.catatan,
        } : null,
        beritaAcaraAktif: kelasWithKetuaSet.has(r.kelasId),
      };
    });

    const dufahs = await prisma.dufah.findMany();
    
    // Get today's date in WIB to prevent marking future days as ALPHA
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric', month: '2-digit', day: '2-digit'
    });
    const todayStr = formatter.format(new Date());
    const todayDate = new Date(`${todayStr}T00:00:00Z`);

    const activeDates = new Set<string>();
    const startDate = new Date(`${dari}T00:00:00Z`);
    const endDate = new Date(`${sampai}T23:59:59Z`);
    
    let curr = new Date(startDate);
    while (curr <= endDate) {
      const dStr = curr.toISOString().split("T")[0];
      const dDate = new Date(`${dStr}T00:00:00Z`);
      
      let isActive = false;
      for (const d of dufahs) {
        if (d.usbu1Active && d.usbu1StartDate && d.usbu1EndDate) {
          if (dDate >= d.usbu1StartDate && dDate <= d.usbu1EndDate) isActive = true;
        }
        if (d.usbu2Active && d.usbu2StartDate && d.usbu2EndDate) {
          if (dDate >= d.usbu2StartDate && dDate <= d.usbu2EndDate) isActive = true;
        }
        if (d.usbu3Active && d.usbu3StartDate && d.usbu3EndDate) {
          if (dDate >= d.usbu3StartDate && dDate <= d.usbu3EndDate) isActive = true;
        }
      }
      
      // Only mark as active for ALPHA checking if the date has already passed or is today
      if (isActive && dDate <= todayDate) {
        activeDates.add(dStr);
      }
      curr.setDate(curr.getDate() + 1);
    }

    const pengajarSesi = await prisma.pengajarSesi.findMany({
      where: isTeacher ? { userId: session.userId } : undefined,
      include: { 
        user: { select: { id: true, nama: true, username: true } },
        kelas: { select: { nama: true, programId: true } }
      }
    });

    for (const tgl of activeDates) {
      for (const teacher of pengajarSesi) {
        // Jika kelas ini adalah bagian dari program Taqwim, jangan generate ALPHA
        const isTaqwimClass = sesiTaqwimList.some(t => t.programId === teacher.kelas.programId);
        if (isTaqwimClass) continue;

        // Jika kelas sudah diajar (baik oleh guru asli maupun badal), jangan anggap guru asli ALPHA
        const classWasTaught = records.some(r => r.kelasId === teacher.kelasId && r.sesi === teacher.sesi && r.tanggal.toISOString().split("T")[0] === tgl);
        if (!classWasTaught) {
          formatted.push({
            id: `alpha_${teacher.userId}_${teacher.kelasId}_${teacher.sesi}_${tgl}`,
            pengajar: teacher.user.nama,
            kelas: teacher.kelas.nama,
            tanggal: tgl,
            sesi: teacher.sesi,
            materi: "ALPHA (Belum Absen)",
            waktuMulai: "-",
            waktuSelesai: "-",
            status: "ALPHA",
            isBadal: false,
            isAsisten: false,
            pengajarDigantikan: null,
            atribut: { nametag: false, kopiah: false, bros: false },
            terlambatMenit: 0,
            beritaAcara: null,
            beritaAcaraAktif: kelasWithKetuaSet.has(teacher.kelasId),
          });
        }
      }

      // ALPHA detection for Program Level
      for (const teacher of pengajarSesiProgramList) {
        // Cek apakah ada record absen dari guru ini untuk sesi ini pada program ini
        // Kita bandingkan via programId dari relasi kelas di record
        const programWasTaught = records.some(
          r => r.userId === teacher.userId && r.sesi === teacher.sesi && r.kelas.program?.id === teacher.programId && r.tanggal.toISOString().split("T")[0] === tgl
        );
        if (!programWasTaught) {
          formatted.push({
            id: `alpha_${teacher.userId}_PROGRAM_${teacher.programId}_${teacher.sesi}_${tgl}`,
            pengajar: teacher.user.nama,
            kelas: `Program ${teacher.program.nama_indo}`,
            tanggal: tgl,
            sesi: teacher.sesi,
            materi: "ALPHA (Belum Absen)",
            waktuMulai: "-",
            waktuSelesai: "-",
            status: "ALPHA",
            isBadal: false,
            isAsisten: false,
            pengajarDigantikan: null,
            atribut: { nametag: false, kopiah: false, bros: false },
            terlambatMenit: 0,
            beritaAcara: null,
            beritaAcaraAktif: false,
          });
        }
      }
    }

    formatted.sort((a, b) => {
      if (a.tanggal !== b.tanggal) return a.tanggal.localeCompare(b.tanggal);
      if (a.sesi !== b.sesi) return a.sesi.localeCompare(b.sesi);
      return a.pengajar.localeCompare(b.pengajar);
    });

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Error fetching rekap pengajar:", error);
    return NextResponse.json({ error: "Terjadi kesalahan sistem" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const hasEditPerm = await checkPermission("rekap_pengajar_edit");
  if (!hasEditPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, materi, waktuMulai, waktuSelesai, atributKopiah, atributNametag, atributBros, terlambatMenit, isBadal, isAsisten, pengajarBadalId } = body;

    if (!id) {
      return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
    }

    if (id.startsWith("alpha_")) {
      // Format: alpha_{userId}_{kelasId}_{SESI}_{X}_{YYYY-MM-DD}
      // OR Format: alpha_{userId}_PROGRAM_{programId}_{SESI}_{X}_{YYYY-MM-DD}
      // NOTE: SESI_1 splits into two parts when split("_"), so we reconstruct it
      const parts = id.split("_");
      let originalUserId = "", kelasId = "", sesi = "", tanggalStr = "";

      if (parts[2] === "PROGRAM") {
        // parts: ["alpha", userId, "PROGRAM", programId, "SESI", sesiNum, tanggal]
        originalUserId = parts[1];
        const programId = parts[3];
        sesi = `${parts[4]}_${parts[5]}`; // e.g. "SESI_1"
        tanggalStr = parts[6];             // e.g. "2026-06-19"

        const firstClass = await prisma.kelas.findFirst({ where: { programId } });
        if (!firstClass) return NextResponse.json({ error: "Program tidak punya kelas" }, { status: 400 });
        kelasId = firstClass.id;
      } else {
        // parts: ["alpha", userId, kelasId, "SESI", sesiNum, tanggal]
        originalUserId = parts[1];
        kelasId = parts[2];
        sesi = `${parts[3]}_${parts[4]}`; // e.g. "SESI_1"
        tanggalStr = parts[5];             // e.g. "2026-06-19"
      }

      const finalUserId = isBadal && pengajarBadalId ? pengajarBadalId : originalUserId;
      const finalPengajarDigantikanId = isBadal && pengajarBadalId ? originalUserId : null;

      const created = await prisma.absenPengajar.create({
        data: {
          userId: finalUserId,
          kelasId,
          sesi: sesi as any,
          tanggal: new Date(`${tanggalStr}T00:00:00Z`),
          waktuMulai: waktuMulai || "-",
          waktuSelesai: waktuSelesai || "-",
          materi: materi || "Hadir (Input Manual Admin)",
          atributKopiah: Boolean(atributKopiah),
          atributNametag: Boolean(atributNametag),
          atributBros: Boolean(atributBros),
          terlambatMenit: terlambatMenit !== undefined && terlambatMenit !== "" ? Number(terlambatMenit) : null,
          isBadal: Boolean(isBadal),
          isAsisten: Boolean(isAsisten),
          pengajarDigantikanId: finalPengajarDigantikanId,
        }
      });
      return NextResponse.json({ success: true, data: created });
    }

    // Pastikan record ada
    const existing = await prisma.absenPengajar.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Data absen pengajar tidak ditemukan" }, { status: 404 });
    }

    const updated = await prisma.absenPengajar.update({
      where: { id },
      data: {
        materi: materi ?? existing.materi,
        waktuMulai: waktuMulai ?? existing.waktuMulai,
        waktuSelesai: waktuSelesai ?? existing.waktuSelesai,
        atributKopiah: atributKopiah !== undefined ? Boolean(atributKopiah) : existing.atributKopiah,
        atributNametag: atributNametag !== undefined ? Boolean(atributNametag) : existing.atributNametag,
        atributBros: atributBros !== undefined ? Boolean(atributBros) : existing.atributBros,
        terlambatMenit: terlambatMenit !== undefined && terlambatMenit !== "" ? Number(terlambatMenit) : null,
      }
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating absen pengajar:", error);
    return NextResponse.json({ error: "Gagal memperbarui data" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const hasEditPerm = await checkPermission("rekap_pengajar_edit");
  if (!hasEditPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
    }

    const existing = await prisma.absenPengajar.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Data absen pengajar tidak ditemukan" }, { status: 404 });
    }

    await prisma.absenPengajar.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting absen pengajar:", error);
    return NextResponse.json({ error: "Gagal menghapus data" }, { status: 500 });
  }
}

