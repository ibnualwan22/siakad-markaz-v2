import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSantriSession } from '@/lib/santri-auth';
import { calcMapelNilaiAkhir, calcMapelNilaiAkhirUsbuain2, calcAkumulatif, calcAkbarnasGabungan, calcAkbarnasMapelAverage, applyNilaiTambahan } from '@/lib/grade-calculator';
import { getPredikat } from '@/lib/formatters';
import { calculateStatus } from '@/lib/kelulusan';

const programInclude = {
  programMapels: {
    include: { mapel: true },
    orderBy: { urutan: 'asc' as const },
  },
};

function hitungRekap(records: { status: string }[]) {
  return {
    hadir: records.filter((r) => r.status === 'HADIR').length,
    izin: records.filter((r) => r.status === 'IZIN').length,
    sakit: records.filter((r) => r.status === 'SAKIT').length,
    alpha: records.filter((r) => r.status === 'ALPHA').length,
    total: records.length,
  };
}

export async function GET() {
  const session = await getSantriSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const santri = await prisma.santriInternal.findUnique({
      where: { id: session.santriId },
      include: {
        riwayatRecords: {
          orderBy: { dufahNama: 'desc' },
          include: {
            program: { include: programInclude },
            kelas: true,
            dufah: true,
            nilaiList: { include: { mapel: true } },
            riwayatUsbuList: { orderBy: { usbu: 'asc' } },
            absenKelasList: { orderBy: { tanggal: 'desc' } },
            absenSakanList: { orderBy: { tanggal: 'desc' } },
            absenKegiatanList: {
              include: { kategori: true },
              orderBy: { tanggal: 'desc' },
            },
            perizinanList: { orderBy: { createdAt: 'desc' } },
          },
        },
        absenTabirotList: {
          include: { kelompok: true },
          orderBy: { tanggal: 'desc' },
        },
      },
    });

    if (!santri) {
      return NextResponse.json({ error: 'Data santri tidak ditemukan' }, { status: 404 });
    }

    const riwayatResult = santri.riwayatRecords.map((riwayat) => {
      const program = riwayat.program;
      const isAkbarnas = program?.nama_indo.toLowerCase().includes('akbarnas') ?? false;
      const effectiveUsbuainMode = riwayat.jumlah_kolom_usbu ?? riwayat.kelas?.jumlah_kolom_usbu ?? 0;

      // Calculate nilai per mapel
      let nilaiRows: any[] = [];
      if (program) {
        const nilaiMap = new Map<string, any>();
        for (const n of riwayat.nilaiList) {
          nilaiMap.set(n.mapelId, n);
        }

        nilaiRows = program.programMapels.map((pm: any) => {
          const n = nilaiMap.get(pm.mapelId);
          let nilaiAkhir = n?.nilaiAkhir ?? null;

          // Calculate nilaiAkhir if not stored
          if (n && nilaiAkhir === null && !isAkbarnas) {
            if (pm.mapel.jumlah_tes === 3 && effectiveUsbuainMode === 2) {
              nilaiAkhir = calcMapelNilaiAkhirUsbuain2({ u1: n.nilaiUsbu1, u2: n.nilaiUsbu2 });
            } else if (pm.mapel.jumlah_tes === 3 && effectiveUsbuainMode === 1) {
              nilaiAkhir = n.nilaiNihai;
            } else {
              nilaiAkhir = calcMapelNilaiAkhir(
                { u1: n.nilaiUsbu1, u2: n.nilaiUsbu2, n: n.nilaiNihai },
                false
              );
            }
          }

          const tambahan = n?.nilaiTambahan ?? 0;
          const skor = nilaiAkhir !== null ? applyNilaiTambahan(nilaiAkhir, tambahan) : null;

          return {
            mapelId: pm.mapelId,
            namaIndo: pm.mapel.nama_indo,
            namaArab: pm.mapel.nama_arab,
            urutan: pm.urutan,
            jumlahTes: pm.mapel.jumlah_tes,
            nilaiUsbu1: n?.nilaiUsbu1 ?? null,
            nilaiUsbu2: n?.nilaiUsbu2 ?? null,
            nilaiNihai: n?.nilaiNihai ?? null,
            nilaiAkhir,
            nilaiTambahan: tambahan,
            skor,
            predikat: skor !== null ? getPredikat(skor) : null,
            masukAkumulasi: pm.mapel.masuk_akumulasi,
            tampilDiSyahadah: pm.mapel.tampil_di_syahadah,
            bobot: pm.mapel.bobot ?? 1,
          };
        });
      }

      // Calculate akumulatif
      const accRows = nilaiRows.filter((r: any) => r.skor !== null && r.masukAkumulasi);
      const average = calcAkumulatif(
        accRows.map((r: any) => ({ score: r.skor, bobot: r.bobot }))
      );
      const averagePredikat = getPredikat(Math.round(average));

      // Calculate status kelulusan
      const totalMapel = program?.programMapels.length ?? 0;
      const hasCompleteNilai = totalMapel > 0 && nilaiRows.length === totalMapel &&
        nilaiRows.every((r: any) => {
          if (r.jumlahTes === 1) return r.nilaiAkhir !== null;
          if (effectiveUsbuainMode === 1 && r.jumlahTes === 3) return r.nilaiNihai !== null;
          if (effectiveUsbuainMode === 2 && r.jumlahTes === 3) return r.nilaiUsbu1 !== null && r.nilaiUsbu2 !== null;
          return r.nilaiUsbu1 !== null && r.nilaiUsbu2 !== null && r.nilaiNihai !== null;
        });

      const status = hasCompleteNilai
        ? calculateStatus(
            { is_tasmi: riwayat.is_tasmi },
            accRows.map((r: any) => ({ skor: r.skor })),
            program
          )
        : 'BELUM_LENGKAP';

      const canDownloadSyahadah = hasCompleteNilai && status !== 'TIDAK_LULUS';

      return {
        id: riwayat.id,
        dufahNama: riwayat.dufahNama,
        dufahNamaArab: riwayat.dufah?.namaArab ?? null,
        programNama: program?.nama_indo ?? '-',
        programNamaArab: program?.nama_arab ?? '',
        programId: program?.id ?? null,
        kelasNama: riwayat.kelas?.nama ?? '-',
        isTasmi: riwayat.is_tasmi,
        statusKelulusan: status,
        canDownloadSyahadah,
        riwayatId: riwayat.id,
        usbuainMode: effectiveUsbuainMode,

        // Nilai
        nilaiRows,
        average: Math.round(average * 100) / 100,
        averagePredikat,

        // Rekap absensi
        rekapAbsenKelas: hitungRekap(riwayat.absenKelasList),
        rekapAbsenSakan: hitungRekap(riwayat.absenSakanList),
        rekapAbsenKegiatan: hitungRekap(riwayat.absenKegiatanList),
        rekapAbsenTabirot: hitungRekap(santri.absenTabirotList),

        // Detail absensi
        absenKelas: riwayat.absenKelasList.map((a) => ({
          tanggal: a.tanggal,
          sesi: a.sesi,
          status: a.status,
          keterangan: a.keterangan,
        })),
        absenSakan: riwayat.absenSakanList.map((a) => ({
          tanggal: a.tanggal,
          status: a.status,
          keterangan: a.keterangan,
        })),
        absenKegiatan: riwayat.absenKegiatanList.map((a) => ({
          tanggal: a.tanggal,
          status: a.status,
          namaKegiatan: a.kategori.nama,
          keterangan: a.keterangan,
        })),
        absenTabirot: santri.absenTabirotList.map((a) => ({
          tanggal: a.tanggal,
          status: a.status,
          namaKelompok: `${a.kelompok.tempat} (Bulan ke-${a.kelompok.bulanKe})`,
          keterangan: a.keterangan,
        })),

        // Rekap usbu
        rekapUsbu: riwayat.riwayatUsbuList.map((u) => ({
          usbu: u.usbu,
          hadir: u.totalHadir,
          izin: u.totalIzin,
          sakit: u.totalSakit,
          alpha: u.totalAlpha,
          rataRata: u.rataRataNilai,
        })),

        // Perizinan
        perizinan: riwayat.perizinanList.map((p) => ({
          id: p.id,
          nomorTasrih: p.nomorTasrih,
          tipeIzin: p.tipeIzin,
          alasan: p.alasan,
          tanggalMulai: p.tanggalMulai,
          tanggalSelesai: p.tanggalSelesai,
          statusIzin: p.statusIzin,
          tanggalKembali: p.tanggalKembali,
          statusAbsen: p.statusAbsen,
          createdAt: p.createdAt,
        })),
      };
    });

    const riwayatAktif = santri.riwayatRecords[0];
    const getUjianAktif = async () => {
      if (!riwayatAktif || !riwayatAktif.programId) return [];
      const paketAktif = await prisma.paketUjian.findMany({
        where: {
          programId: riwayatAktif.programId,
          sesiGlobal: { isActive: true }
        },
        include: {
          sesiList: {
            where: { riwayatId: riwayatAktif.id }
          },
          _count: { select: { soalPaketList: true } }
        }
      });
      return paketAktif.map((p: any) => ({
        id: p.id,
        nama: p.nama,
        usbuKe: p.usbuKe,
        status: p.sesiList.length > 0 ? p.sesiList[0].status : "BELUM_MULAI"
      })).filter((p: any) => p.status !== "SELESAI" && p.status !== "AUTO_SUBMIT");
    };

    const ujianAktif = await getUjianAktif();

    return NextResponse.json({
      success: true,
      santri: {
        id: santri.id,
        nama: santri.nama,
        gender: santri.gender,
        sakan: santri.sakan,
        kamar: santri.kamar,
        nomorLemari: santri.nomorLemari,
        kategori: santri.kategori,
        isAktif: santri.isAktif,
        tempatLahir: santri.tempat_lahir,
        tanggalLahir: santri.tanggal_lahir,
        alamat: santri.alamat,
      },
      riwayat: riwayatResult,
    });
  } catch (error) {
    console.error('Error fetching santri data:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan sistem' }, { status: 500 });
  }
}
