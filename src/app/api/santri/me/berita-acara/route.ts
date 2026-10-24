import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSantriSession } from '@/lib/santri-auth';
import { notifyEmaliyahAbsenChanged } from '@/lib/emaliyah-webhook';

// 1. GET: Ambil daftar absen guru untuk kelas santri yang bersangkutan
export async function GET() {
  const session = await getSantriSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Cari status ketua kelas yang aktif
    const ketuaKelas = await prisma.ketuaKelas.findFirst({
      where: {
        santriId: session.santriId,
        isActive: true,
      },
      include: {
        kelas: true
      }
    });

    if (!ketuaKelas) {
      return NextResponse.json({ error: 'Anda bukan ketua kelas aktif' }, { status: 403 });
    }

    // Ambil absen guru untuk kelas ini dalam waktu 1 minggu terakhir, order desc
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const absenPengajarList = await prisma.absenPengajar.findMany({
      where: {
        kelasId: ketuaKelas.kelasId,
        tanggal: {
          gte: oneWeekAgo
        }
      },
      include: {
        user: { select: { nama: true } },
        beritaAcara: true
      },
      orderBy: [
        { tanggal: 'desc' },
        { sesi: 'asc' }
      ]
    });

    return NextResponse.json({
      success: true,
      data: {
        kelas: ketuaKelas.kelas.nama,
        absenList: absenPengajarList
      }
    });
  } catch (error) {
    console.error('Error fetching berita acara santri:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan sistem' }, { status: 500 });
  }
}

// 2. POST: Submit berita acara
export async function POST(request: Request) {
  const session = await getSantriSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Validasi apakah dia ketua kelas
    const ketuaKelas = await prisma.ketuaKelas.findFirst({
      where: {
        santriId: session.santriId,
        isActive: true,
      }
    });

    if (!ketuaKelas) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const { absenPengajarId, konfirmasiHadir, catatan, terlambatMenit } = await request.json();

    if (!absenPengajarId || konfirmasiHadir === undefined) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Upsert Berita Acara (Update jika sudah ada, Create jika belum)
      const ba = await tx.beritaAcara.upsert({
        where: { absenPengajarId },
        update: {
          konfirmasiHadir,
          catatan,
          santriId: session.santriId
        },
        create: {
          absenPengajarId,
          konfirmasiHadir,
          catatan,
          santriId: session.santriId
        }
      });

      // Update waktu keterlambatan di tabel absen guru jika guru hadir
      if (konfirmasiHadir && terlambatMenit !== undefined) {
        await tx.absenPengajar.update({
          where: { id: absenPengajarId },
          data: {
            terlambatMenit: terlambatMenit >= 0 ? Number(terlambatMenit) : null
          }
        });
      }

      return ba;
    });

    // Berita acara dapat mengubah terlambatMenit absen pengajar.
    const absenTerkait = await prisma.absenPengajar.findUnique({
      where: { id: absenPengajarId },
      select: { tanggal: true }
    });
    if (absenTerkait) {
      await notifyEmaliyahAbsenChanged(absenTerkait.tanggal);
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error submit berita acara:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan saat menyimpan' }, { status: 500 });
  }
}
