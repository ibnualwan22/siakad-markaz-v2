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

    const { searchParams } = new URL(request.url);
    const dufahNama = searchParams.get('dufahNama');

    // A query parameter must never select another santri's private report.
    const whereClause: { santriId: string; dufahNama?: string } = {
      santriId: session.santriId,
    };

    // Kalau param dufahNama dikirim, cari spesifik dufah itu
    if (dufahNama) {
      whereClause.dufahNama = dufahNama;
    }

    // Ambil data dufah yang sedang aktif
    const activeDufah = await getActiveDufahName();

    // Ambil data lengkap terkait RiwayatSantri tersebut
    const dataRiwayatList = await prisma.riwayatSantri.findMany({
      where: whereClause,
      // Kalau dufahNama tidak diisi, otomatis ambil data riwayat yang paling terbaru (Dufah terakhir)
      orderBy: {
        dufahNama: 'desc'
      },
      include: {
        santri: true,
        kelas: true,
        program: true,
        dufah: true,
        // Hasil Tes Per Usbu' (Nilai List terhubung ke Mapel)
        nilaiList: {
          include: {
            mapel: true
          }
        },
        // Rekap Absen Rutinan (per Usbu)
        riwayatUsbuList: {
          orderBy: {
            usbu: 'asc'
          }
        },
        // Rincian Absensi kalau mau ditampilkan history-nya (5 histori terakhir)
        absenKelasList: {
          orderBy: { tanggal: 'desc' },
          take: 5 
        },
        absenSakanList: {
          orderBy: { tanggal: 'desc' },
          take: 5
        },
        // Khusus absen kegiatan, includekan nama kegiatannya
        absenKegiatanList: {
          include: {
            kategori: true
          },
          orderBy: { tanggal: 'desc' },
          take: 5
        }
      }
    });

    if (!dataRiwayatList || dataRiwayatList.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Laporan santri belum tersedia.' },
        { status: 404 }
      );
    }

    // Format (Transform) data agar strukturnya bersih dan mudah dibaca oleh Flutter
    const responseData = {
      success: true,
      active_dufah: activeDufah || 'Tidak Diketahui',
      data: dataRiwayatList.map((dataRiwayat) => ({
        id_riwayat: dataRiwayat.id,
        dufah: dataRiwayat.dufahNama,
        santri: {
          id: dataRiwayat.santri.id,
          nama: dataRiwayat.santri.nama,
          tempat_lahir: dataRiwayat.santri.tempat_lahir,
          tanggal_lahir: dataRiwayat.santri.tanggal_lahir,
        },
        akademik: {
          program: dataRiwayat.program?.nama_indo || '-',
          kelas: dataRiwayat.kelas?.nama || '-',
          is_akbarnas: dataRiwayat.program?.nama_indo?.toLowerCase().includes("akbarnas") ?? false,
          status_kelulusan: dataRiwayat.status_kelulusan,
        },
        nilai_per_mapel: dataRiwayat.nilaiList.map((n) => {
          const isAkbarnas = dataRiwayat.program?.nama_indo?.toLowerCase().includes("akbarnas") ?? false;
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
            nilai_akhir: nilaiAkhirComputed,
          };
        }),
        akumulatif_usbu: (() => {
          const isAkbarnas = dataRiwayat.program?.nama_indo?.toLowerCase().includes("akbarnas") ?? false;
          const computeUsbu = (key: 'nilaiUsbu1' | 'nilaiUsbu2' | 'nilaiNihai') => {
            const items: { score: number; bobot: number }[] = [];
            dataRiwayat.nilaiList.forEach((n) => {
              if (n.mapel.masuk_akumulasi !== false) {
                const score = (n as any)[key];
                if (score !== null && score !== undefined) {
                  items.push({ score, bobot: (n.mapel as any).bobot_usbu ?? n.mapel.bobot ?? 1 });
                }
              }
            });
            return items.length > 0 ? calcAkumulatif(items) : null;
          };
          const computeAll = () => {
            const items: { score: number; bobot: number }[] = [];
            dataRiwayat.nilaiList.forEach((n) => {
              if (n.mapel.masuk_akumulasi !== false) {
                const na = calcMapelNilaiAkhir({ u1: n.nilaiUsbu1, u2: n.nilaiUsbu2, n: n.nilaiNihai }, isAkbarnas);
                if (na !== null) items.push({ score: na, bobot: n.mapel.bobot ?? 1 });
              }
            });
            return items.length > 0 ? calcAkumulatif(items) : null;
          };
          return [
            { usbu: 1, label: "Usbu' 1", rata_rata_nilai: computeUsbu('nilaiUsbu1') },
            { usbu: 2, label: "Usbu' 2", rata_rata_nilai: computeUsbu('nilaiUsbu2') },
            { usbu: 3, label: "Usbu' 3 (Nihai)", rata_rata_nilai: computeUsbu('nilaiNihai') },
            { usbu: 4, label: "Semua Usbu'", rata_rata_nilai: computeAll() },
          ];
        })(),
        rekap_absen_per_usbu: dataRiwayat.riwayatUsbuList.map((u) => ({
          usbu: u.usbu,
          total_hadir: u.totalHadir,
          total_sakit: u.totalSakit,
          total_izin: u.totalIzin,
          total_alpha: u.totalAlpha,
          rata_rata_nilai: u.rataRataNilai
        })),
        histori_absen_terbaru: {
          kelas: dataRiwayat.absenKelasList,
          sakan: dataRiwayat.absenSakanList,
          kegiatan: dataRiwayat.absenKegiatanList.map((a: any) => ({
            id: a.id,
            tanggal: a.tanggal,
            status: a.status,
            nama_kegiatan: a.kategori.nama,
            keterangan: a.keterangan
          }))
        }
      }))
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
