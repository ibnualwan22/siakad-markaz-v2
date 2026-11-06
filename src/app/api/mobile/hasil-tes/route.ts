import { NextResponse } from 'next/server';
import { getSantriSession } from '@/lib/santri-auth';
import prisma from '@/lib/prisma';
import { getActiveDufahName } from '@/lib/absensi';
import { calcMapelNilaiAkhir, calcAkumulatif } from '@/lib/grade-calculator';

export async function GET(request: Request) {
  try {
    const session = await getSantriSession();
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'Silakan masuk ke SIAKAD Markaz Arabiyah.' },
        { status: 401, headers: { 'Cache-Control': 'private, no-store' } }
      );
    }

    // Ambil data dufah yang sedang aktif
    const activeDufah = await getActiveDufahName();

    if (!activeDufah) {
      return NextResponse.json(
        { success: false, message: 'Tidak ada Dufah aktif saat ini.' },
        { status: 404 }
      );
    }

    // Ambil data lengkap terkait RiwayatSantri pada Dufah aktif
    const dataRiwayatList = await prisma.riwayatSantri.findMany({
      where: {
        dufahNama: activeDufah,
        santriId: session.santriId,
      },
      include: {
        santri: true,
        kelas: true,
        program: {
          include: {
            programMapels: {
              include: { mapel: true }
            }
          }
        },
        // Hasil Tes Per Usbu' (Nilai List terhubung ke Mapel)
        nilaiList: {
          include: {
            mapel: true
          }
        },
        // Rekap Absen Rutinan (per Usbu) untuk mengambil rata-rata nilai
        riwayatUsbuList: {
          orderBy: {
            usbu: 'asc'
          }
        }
      }
    });

    if (!dataRiwayatList || dataRiwayatList.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Data santri tidak ditemukan untuk Dufah aktif.' },
        { status: 404 }
      );
    }

    // Mengelompokkan data berdasarkan kelas
    const groupedData: Record<string, any> = {};

    dataRiwayatList.forEach((dataRiwayat) => {
      const kelasName = dataRiwayat.kelas?.nama || 'Tanpa Kelas';
      const isAkbarnas = dataRiwayat.program?.nama_indo?.toLowerCase().includes("akbarnas") ?? false;

      if (!groupedData[kelasName]) {
        groupedData[kelasName] = {
          kelas: kelasName,
          santri: []
        };
      }

      // ─── Compute akumulatif per-usbu menggunakan grade-calculator ───
      const computeAkumulatifPerUsbu = (key: 'nilaiUsbu1' | 'nilaiUsbu2' | 'nilaiNihai') => {
        const items: { score: number; bobot: number }[] = [];
        dataRiwayat.nilaiList.forEach((n: any) => {
          if (n.mapel.masuk_akumulasi !== false) {
            const score = n[key];
            if (score !== null && score !== undefined) {
              const bobot = n.mapel.bobot_usbu ?? n.mapel.bobot ?? 1;
              items.push({ score, bobot });
            }
          }
        });
        return items.length > 0 ? calcAkumulatif(items) : null;
      };

      // ─── Compute akumulatif "Semua Usbu'" (nilaiAkhir × bobot syahadah) ───
      const computeAkumulatifAll = () => {
        const items: { score: number; bobot: number }[] = [];
        dataRiwayat.nilaiList.forEach((n: any) => {
          if (n.mapel.masuk_akumulasi !== false) {
            // Recalculate nilaiAkhir menggunakan grade-calculator
            const nilaiAkhir = calcMapelNilaiAkhir(
              { u1: n.nilaiUsbu1, u2: n.nilaiUsbu2, n: n.nilaiNihai },
              isAkbarnas
            );
            if (nilaiAkhir !== null) {
              const bobot = n.mapel.bobot ?? 1;
              items.push({ score: nilaiAkhir, bobot });
            }
          }
        });
        return items.length > 0 ? calcAkumulatif(items) : null;
      };

      // ─── Compute nilai_akhir per-mapel ───
      const nilaiPerMapel = dataRiwayat.nilaiList.map((n: any) => {
        const nilaiAkhirComputed = calcMapelNilaiAkhir(
          { u1: n.nilaiUsbu1, u2: n.nilaiUsbu2, n: n.nilaiNihai },
          isAkbarnas
        );

        return {
          mapel: n.mapel.nama_indo,
          bobot: n.mapel.bobot ?? 1,
          masuk_akumulasi: n.mapel.masuk_akumulasi ?? true,
          nilai_usbu_1: n.nilaiUsbu1,
          nilai_usbu_2: n.nilaiUsbu2,
          nilai_nihai: n.nilaiNihai,
          // nilai_akhir computed secara konsisten via grade-calculator
          nilai_akhir: nilaiAkhirComputed,
        };
      });

      groupedData[kelasName].santri.push({
        id_riwayat: dataRiwayat.id,
        id_santri: dataRiwayat.santri.id,
        nama: dataRiwayat.santri.nama,
        gender: dataRiwayat.santri.gender || '-',
        tempat_lahir: dataRiwayat.santri.tempat_lahir,
        tanggal_lahir: dataRiwayat.santri.tanggal_lahir,
        akademik: {
          program: dataRiwayat.program?.nama_indo || '-',
          is_akbarnas: isAkbarnas,
          status_kelulusan: dataRiwayat.status_kelulusan,
        },
        nilai_per_mapel: nilaiPerMapel,
        rata_rata_per_usbu: [
          { usbu: 1, label: "Usbu' 1", rata_rata_nilai: computeAkumulatifPerUsbu('nilaiUsbu1') },
          { usbu: 2, label: "Usbu' 2", rata_rata_nilai: computeAkumulatifPerUsbu('nilaiUsbu2') },
          { usbu: 3, label: "Usbu' 3 (Nihai)", rata_rata_nilai: computeAkumulatifPerUsbu('nilaiNihai') },
          { usbu: 4, label: "Semua Usbu'", rata_rata_nilai: computeAkumulatifAll() }
        ]
      });
    });

    // Mengurutkan kelas berdasarkan abjad (opsional)
    const sortedData = Object.values(groupedData).sort((a: any, b: any) =>
      a.kelas.localeCompare(b.kelas)
    );

    const responseData = {
      success: true,
      active_dufah: activeDufah,
      data: sortedData
    };

    // Academic responses are private and must not be cached.
    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-store',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan sistem internal' },
      { status: 500 }
    );
  }
}

// Menangani request OPTIONS (Preflight) yang otomatis dikirim oleh browser / aplikasi HTTP client
export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Cache-Control': 'private, no-store',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
