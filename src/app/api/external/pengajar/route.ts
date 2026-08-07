import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Helper: validasi API key
function validateApiKey(request: Request): boolean {
  const apiKey = request.headers.get('x-api-key');
  const envApiKey = process.env.EXTERNAL_API_KEY;
  return !!envApiKey && apiKey === envApiKey;
}

// Helper: cari periode usbu aktif dari Dufah
async function getActivePeriode() {
  const dufahList = await prisma.dufah.findMany({
    orderBy: { nama: 'desc' }
  });

  for (const d of dufahList) {
    if (d.usbu3Active || d.usbu2Active || d.usbu1Active) {
      // startDate selalu mencoba mengambil dari usbu 1 (awal usbu aktif)
      const startDate = d.usbu1StartDate || d.usbu2StartDate || d.usbu3StartDate;
      
      // endDate mengambil dari usbu terjauh yang aktif
      let endDate = null;
      let usbu = 1;
      
      if (d.usbu3Active && d.usbu3EndDate) {
        endDate = d.usbu3EndDate;
        usbu = 3;
      } else if (d.usbu2Active && d.usbu2EndDate) {
        endDate = d.usbu2EndDate;
        usbu = 2;
      } else if (d.usbu1Active && d.usbu1EndDate) {
        endDate = d.usbu1EndDate;
        usbu = 1;
      }

      if (startDate && endDate) {
        return { startDate, endDate, dufah: d.nama, usbu };
      }
    }
  }
  return null;
}

// ========== GET: Ambil data pengajar + detail keterlambatan ==========
export async function GET(request: Request) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const periode = await getActivePeriode();
    if (!periode) {
      return NextResponse.json(
        { error: 'Tidak ada periode usbu aktif yang ditemukan' },
        { status: 404 }
      );
    }

    const { startDate, endDate, dufah, usbu } = periode;
    const queryEndDate = new Date(endDate);
    queryEndDate.setHours(23, 59, 59, 999);

    // Ambil semua user aktif beserta detail absensi
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        nama: true,
        noHp: true,
        pengajarSesiList: { select: { id: true } },
        pengajarSesiProgramList: { select: { id: true } },
        // Ambil detail absensi untuk periode aktif
        absenPengajarList: {
          where: {
            tanggal: { gte: startDate, lte: queryEndDate },
          },
          select: {
            id: true,
            tanggal: true,
            sesi: true,
            waktuMulai: true,
            waktuSelesai: true,
            materi: true,
            terlambatMenit: true,
            isBadal: true,
            kelas: { select: { nama: true } },
          },
          orderBy: [{ tanggal: 'asc' }, { sesi: 'asc' }],
        },
      }
    });

    const data = users.map(user => ({
      id: user.id,
      nama: user.nama,
      noHp: user.noHp,
      jumlahJadwalMengajar: user.pengajarSesiList.length + user.pengajarSesiProgramList.length,
      jumlahAbsenTerverifikasi: user.absenPengajarList.length,
      absenDetail: user.absenPengajarList.map(a => ({
        id: a.id,
        tanggal: a.tanggal.toISOString().split('T')[0],
        sesi: a.sesi,
        kelas: a.kelas.nama,
        waktuMulai: a.waktuMulai,
        waktuSelesai: a.waktuSelesai,
        materi: a.materi,
        terlambatMenit: a.terlambatMenit ?? 0,
        isBadal: a.isBadal,
      })),
    }));

    return NextResponse.json({
      success: true,
      periode: {
        dari: startDate.toISOString().split('T')[0],
        sampai: endDate.toISOString().split('T')[0],
        dufah,
        usbu,
      },
      data,
    });
  } catch (error) {
    console.error('Error fetching external pengajar data:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan sistem' }, { status: 500 });
  }
}

// ========== PUT: Update keterlambatan dari website eksternal ==========
export async function PUT(request: Request) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, terlambatMenit } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID absen pengajar wajib diisi' }, { status: 400 });
    }

    if (terlambatMenit === undefined || terlambatMenit === null) {
      return NextResponse.json({ error: 'terlambatMenit wajib diisi' }, { status: 400 });
    }

    const existing = await prisma.absenPengajar.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Data absen pengajar tidak ditemukan' }, { status: 404 });
    }

    const updated = await prisma.absenPengajar.update({
      where: { id },
      data: { terlambatMenit: Number(terlambatMenit) },
      select: {
        id: true,
        tanggal: true,
        sesi: true,
        terlambatMenit: true,
        user: { select: { nama: true } },
        kelas: { select: { nama: true } },
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        pengajar: updated.user.nama,
        kelas: updated.kelas.nama,
        tanggal: updated.tanggal.toISOString().split('T')[0],
        sesi: updated.sesi,
        terlambatMenit: updated.terlambatMenit,
      }
    });
  } catch (error) {
    console.error('Error updating terlambat menit:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan sistem' }, { status: 500 });
  }
}
