import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createTauziSession } from '@/lib/tauzi-auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nis } = body;

    if (!nis) {
      return NextResponse.json({ error: 'NIS wajib diisi' }, { status: 400 });
    }

    // 1. Cari santri internal
    const santri = await prisma.santriInternal.findUnique({
      where: { id: nis.trim() },
      include: {
        riwayatRecords: {
          include: { dufah: true, program: true },
          orderBy: { dufahNama: 'desc' },
          take: 1
        }
      }
    });

    if (!santri) {
      return NextResponse.json({ error: 'Santri dengan NIS tersebut tidak ditemukan' }, { status: 404 });
    }

    // 2. Cek apakah ada sesi tauzi yang aktif
    const activeSesiList = await prisma.sesiTauzi.findMany({
      where: { isActive: true },
      take: 1
    });

    if (activeSesiList.length === 0) {
      return NextResponse.json({ error: 'Belum ada sesi tes tauzi yang dibuka saat ini' }, { status: 403 });
    }

    const sesiTauzi = activeSesiList[0];
    let programId = undefined;

    // Cek apakah sudah pernah membuat peserta tauzi di database
    let peserta = await prisma.pesertaTauzi.findUnique({
      where: {
        sesiTauziId_santriId: {
          sesiTauziId: sesiTauzi.id,
          santriId: santri.id
        }
      }
    });

    if (peserta) {
      programId = peserta.programId;
    } else {
      // AMBIL DARI PPDB
      try {
        const PPDB_BASE_URL = process.env.PPDB_BASE_URL || 'https://ppdb.markazarabiyah.site';
        const PPDB_API_KEY = process.env.PPDB_SIAKAD_API_KEY || '';

        const ppdbRes = await fetch(`${PPDB_BASE_URL}/api/integrasi/siakad/status?nis=${santri.id}`, {
          method: 'GET',
          headers: { 'x-api-key': PPDB_API_KEY, 'Accept': 'application/json' },
        });

        if (ppdbRes.ok) {
          const ppdbData = await ppdbRes.json();
          // Cek apakah ada program aktif dari PPDB (menggunakan array dari meta programTersedia yang ditandai atau info masaAktif)
          // Secara default integrasi status memberitahu sisa durasi. Jika tidak ada durasi, mungkin dia santri baru di SIAKAD.
          // Fallback: kita gunakan riwayat terbaru dari DB siakad jika dia pernah punya (Kategori Lama).
          if (ppdbData?.data?.masaAktif?.sisaKoutaBulan > 0) {
            // old santri
            const latestRiwayat = santri.riwayatRecords[0];
            if (latestRiwayat?.programId) {
              programId = latestRiwayat.programId;
            }
          }
        }
      } catch (e) {
        // Fallback jika API down
        console.error("Gagal konek PPDB", e);
      }

      // Fallback santri lama yg API PPDB nya mem-bypass imunify tapi riwayat ada
      if (!programId && santri.riwayatRecords[0]?.programId) {
        programId = santri.riwayatRecords[0].programId;
      }
    }

    // Jika final programId kosong, santri ditolak masuk karena belum tentukan pilihan
    if (!programId) {
      return NextResponse.json({ error: 'Program belum ditentukan. Silakan login ke Portal Siakad Santri untuk memilih Program Tes Tauzi` Anda.' }, { status: 403 });
    }

    // Auto assign peserta jika blm ada
    if (!peserta) {
      peserta = await prisma.pesertaTauzi.create({
        data: {
          sesiTauziId: sesiTauzi.id,
          santriId: santri.id,
          programId: programId,
        }
      });
    }

    await createTauziSession({
      santriId: santri.id,
      nama: santri.nama || 'Santri Baru',
      sesiTauziId: sesiTauzi.id,
      pesertaId: peserta.id,
      programId: programId
    });

    return NextResponse.json({
      success: true,
      requiresProgramSelection: false,
      redirect: '/tauzi/ujian'
    });
  } catch (error) {
    console.error('Error in Tauzi login:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan sistem' }, { status: 500 });
  }
}
