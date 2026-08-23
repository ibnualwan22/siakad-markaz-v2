import { cache } from "react";
import prisma from "@/lib/prisma";
import { calculateStatus } from "@/lib/kelulusan";
import { formatDateIndo, getPredikat, getPredikatTurats, translateDateToArabic } from "@/lib/formatters";
import { getMasterSantriById, getMasterSantriList } from "@/lib/santri-api";
import { getActiveDufahName } from "@/lib/absensi";
import { calcAkbarnasGabungan, calcAkbarnasMapelAverage, calcAkumulatif, calcMapelNilaiAkhir, calcMapelNilaiAkhirUsbuain2, applyNilaiTambahan } from "@/lib/grade-calculator";

const programInclude = {
  programMapels: {
    include: {
      mapel: true,
    },
    orderBy: {
      urutan: "asc" as const,
    },
  },
  kelasList: {
    orderBy: {
      nama: "asc" as const,
    },
  },
};

async function checkMartabahUla(programId: string, dufahNama: string, riwayatId: string, isUsbuain: boolean = false): Promise<boolean> {
  // Ambil semua anak di cohort ini
  const whereClause: any = { dufahNama };
  if (!isUsbuain) {
    whereClause.programId = programId;
  }

  const riwayatListRaw = await prisma.riwayatSantri.findMany({
    where: whereClause,
    include: {
      kelas: true,
      nilaiList: {
        include: { mapel: true },
      },
      program: {
        include: {
          programMapels: {
            include: { mapel: true },
          },
        },
      },
    },
  });

  const riwayatList = isUsbuain 
    ? riwayatListRaw.filter((r: any) => (r.jumlah_kolom_usbu ?? r.kelas?.jumlah_kolom_usbu ?? 0) > 0 && !r.program?.nama_indo.toLowerCase().includes("akbarnas"))
    : riwayatListRaw;

  if (riwayatList.length === 0) {
    return false;
  }

  let highestAverage = -1;
  let topRiwayatId: string | null = null;

  for (const riwayat of riwayatList) {
    const program = riwayat.program;
    if (!program) continue;

    const accumulativeNilai = riwayat.nilaiList.filter((n: any) => {
      const pm = program.programMapels.find((p: any) => p.mapelId === n.mapelId);
      return pm?.mapel.masuk_akumulasi !== false;
    });

    const status = calculateStatus(
      { is_tasmi: riwayat.is_tasmi },
      accumulativeNilai.map((n: any) => ({ skor: n.nilaiAkhir || 0 })),
      program
    );

    // Kriteria: HANYA LULUS murni yang boleh menjadi Martabah Ula (Musyarokah TIDAK BOLEH)
    if (status !== "LULUS") continue;

    // Periksa kelengkapan nilai HANYA untuk mapel yang masuk_akumulasi
    let isComplete = true;
    for (const pm of program.programMapels) {
      if (pm.mapel.masuk_akumulasi !== false) {
        const hasNilai = riwayat.nilaiList.find((n: any) => n.mapelId === pm.mapelId && n.nilaiAkhir !== null);
        if (!hasNilai) {
          isComplete = false;
          break;
        }
      }
    }

    if (!isComplete) continue;

    const accItems: { score: number; bobot: number }[] = [];
    for (const nilai of riwayat.nilaiList) {
      const pm = program.programMapels.find((p: any) => p.mapelId === nilai.mapelId);
      if (!pm || pm.mapel.masuk_akumulasi === false) continue;

      const base = nilai.nilaiAkhir;
      if (base === null) continue;

      const score = applyNilaiTambahan(base, nilai.nilaiTambahan ?? 0);
      accItems.push({ score, bobot: pm.mapel.bobot ?? 1 });
    }

    const avg = calcAkumulatif(accItems);
    if (avg > highestAverage) {
      highestAverage = avg;
      topRiwayatId = riwayat.id;
    }
  }

  return topRiwayatId === riwayatId;
}

function buildDefaultTemplate() {
  const today = new Date();

  return {
    id: 0,
    tgl_cetak_indo: formatDateIndo(today),
    tgl_cetak_arab: translateDateToArabic(today),
    tgl_mulai_indo: null,
    tgl_mulai_arab: null,
    tgl_selesai_indo: null,
    tgl_selesai_arab: null,
    nama_mudir_indo: "Nama Mudir",
    nama_mudir_arab: "اسم المدير",
    jabatan_mudir_indo: "Mudir Markaz Arabiyah",
    jabatan_mudir_arab: "مدير مركز العربية",
    teks_dufah_akbarnas_arab: null,
    teks_dufah_arab: null,
    // Turats defaults
    nama_mudir_turats: "Ustadz Abdul Wahhab, M.Pd.",
    jabatan_mudir_turats: "Direktur Markaz Turats",
    tgl_cetak_turats: null,
    tgl_mulai_turats: null,
    tgl_selesai_turats: null,
  };
}

function serializeProgram(program: {
  id: string;
  nama_indo: string;
  nama_arab: string;
  kkm: number;
  kategori?: string;
  programMapels: Array<{
    urutan: number;
    mapel: {
      id: string;
      nama_indo: string;
      nama_arab: string;
      jumlah_tes: number;
      tampil_di_syahadah: boolean;
      masuk_akumulasi: boolean;
      bobot: number;
      bobot_usbu: number;
      bulan_aktif: number;
      jumlah_tes_b2: number | null;
    };
  }>;
  kelasList?: Array<{
    id: string;
    nama: string;
  }>;
}) {
  return {
    id: program.id,
    nama_indo: program.nama_indo,
    nama_arab: program.nama_arab,
    kkm: program.kkm,
    kategori: program.kategori ?? "REGULER",
    mapelList: program.programMapels.map((pm) => ({
      id: pm.mapel.id,
      nama_indo: pm.mapel.nama_indo,
      nama_arab: pm.mapel.nama_arab,
      urutan: pm.urutan,
      jumlah_tes: pm.mapel.jumlah_tes,
      tampil_di_syahadah: pm.mapel.tampil_di_syahadah,
      masuk_akumulasi: pm.mapel.masuk_akumulasi,
      bobot: pm.mapel.bobot,
      bobot_usbu: pm.mapel.bobot_usbu,
      bulan_aktif: pm.mapel.bulan_aktif,
      jumlah_tes_b2: pm.mapel.jumlah_tes_b2,
    })),
    kelasList: program.kelasList ?? [],
  };
}

export async function getProgramCatalog() {
  const programList = await prisma.program.findMany({
    include: programInclude,
    orderBy: {
      nama_indo: "asc",
    },
  });

  return programList.map(serializeProgram);
}

export async function getTemplateData() {
  const template = await prisma.syahadahTemplate.findFirst({
    orderBy: {
      id: "asc",
    },
  });

  return template ?? buildDefaultTemplate();
}

export const getDashboardSantriRows = cache(async function getDashboardSantriRows() {
  const [masterSantriList, initialRiwayatList, activeDufahName] = await Promise.all([
    getMasterSantriList(),
    prisma.riwayatSantri.findMany({
      include: {
        program: {
          include: programInclude,
        },
        kelas: true,
        nilaiList: true,
      },
    }),
    getActiveDufahName(),
  ]);

  let riwayatList = [...initialRiwayatList];
  const toCreate: any[] = [];

  for (const masterSantri of masterSantriList) {
    if (!masterSantri.isAktif && !masterSantri.isCheckedOut) continue;
    const currentRiwayat = riwayatList.find(r => r.santriId === masterSantri.id && r.dufahNama === masterSantri.dufahNama);
    if (!currentRiwayat) {
      const historicalAkbarnas = riwayatList.filter(
        r => r.santriId === masterSantri.id && r.program?.nama_indo.toLowerCase().includes("akbarnas")
      );
      if (historicalAkbarnas.length === 1) {
        const prev = historicalAkbarnas[0];
        toCreate.push({
          santriId: masterSantri.id,
          dufahNama: masterSantri.dufahNama,
          programId: prev.programId,
          kelasId: prev.kelasId,
          is_tasmi: prev.is_tasmi,
          status_kelulusan: "BELUM_LULUS"
        });
      }
    }
  }

  if (toCreate.length > 0) {
    await prisma.riwayatSantri.createMany({ data: toCreate, skipDuplicates: true });
    const newRiwayats = await prisma.riwayatSantri.findMany({
      where: {
        OR: toCreate.map(tc => ({ santriId: tc.santriId, dufahNama: tc.dufahNama }))
      },
      include: {
        program: {
          include: programInclude,
        },
        kelas: true,
        nilaiList: true,
      },
    });
    riwayatList = [...riwayatList, ...newRiwayats];
  }

  // Map riwayat by santriId + dufahNama
  const riwayatMap = new Map<string, typeof riwayatList[0]>();
  for (const riwayat of riwayatList) {
    riwayatMap.set(`${riwayat.santriId}_${riwayat.dufahNama}`, riwayat);
  }

  return masterSantriList
    .map((masterSantri) => {
      let targetDufah = masterSantri.dufahNama;

      // Jika sistem sedang aktif di Duf'ah X, dan santri ini punya riwayat di Duf'ah X, 
      // prioritaskan riwayat Duf'ah X agar mereka tidak hilang dari kelas saat ini
      // meskipun mereka sudah daftar ulang ke Duf'ah selanjutnya (sehingga masterSantri.dufahNama = Duf'ah selanjutnya).
      if (activeDufahName && riwayatMap.has(`${masterSantri.id}_${activeDufahName}`)) {
        targetDufah = activeDufahName;
      }

      // Find riwayat for the resolved target Dufah
      const riwayat = riwayatMap.get(`${masterSantri.id}_${targetDufah}`);
      const program = riwayat?.program ?? null;
      const kelas = riwayat?.kelas ?? null;
      let nilaiList = riwayat?.nilaiList ?? [];
      const totalMapel = program?.programMapels.length ?? 0;
      const isAkbarnas = program?.nama_indo.toLowerCase().includes("akbarnas");

      if (isAkbarnas && riwayat) {
        // Cari semua riwayat santri ini yg programnya Akbarnas
        const historical = riwayatList.filter(
          r => r.santriId === masterSantri.id &&
            r.program?.nama_indo.toLowerCase().includes("akbarnas")
        );

        // Kumpulkan nilaiList dari semua riwayat
        const allNilaiRecords: any[] = [];
        for (const hist of historical) {
          allNilaiRecords.push(...hist.nilaiList);
        }

        // Use grade-calculator for Akbarnas gabungan
        const gabunganMap = calcAkbarnasGabungan(allNilaiRecords);

        const mergedNilaiList: any[] = [];
        for (const [mapelId, avg] of gabunganMap.entries()) {
          mergedNilaiList.push({
            mapelId,
            nilaiAkhir: avg,
          });
        }

        nilaiList = mergedNilaiList as any[];
      } else if (!isAkbarnas && riwayat) {
        const effectiveUsbuainMode = riwayat.jumlah_kolom_usbu ?? kelas?.jumlah_kolom_usbu ?? 0;
        for (const n of nilaiList) {
          if (n.nilaiAkhir === null && (n.nilaiUsbu1 !== null || n.nilaiUsbu2 !== null || n.nilaiNihai !== null)) {
            const m = program?.programMapels.find((pm: any) => pm.mapelId === n.mapelId)?.mapel;
            if (m?.jumlah_tes === 3 && effectiveUsbuainMode === 2) {
              n.nilaiAkhir = calcMapelNilaiAkhirUsbuain2({ u1: n.nilaiUsbu1, u2: n.nilaiUsbu2 });
            } else if (m?.jumlah_tes === 3 && effectiveUsbuainMode === 1) {
              n.nilaiAkhir = n.nilaiNihai;
            } else {
              n.nilaiAkhir = calcMapelNilaiAkhir(
                { u1: n.nilaiUsbu1, u2: n.nilaiUsbu2, n: n.nilaiNihai },
                false
              );
            }
          }
        }
      }

      const effectiveUsbuainMode = riwayat ? (riwayat.jumlah_kolom_usbu ?? kelas?.jumlah_kolom_usbu ?? 0) : 0;

      const hasCompleteNilai = Boolean(totalMapel > 0 && program?.programMapels.every((pm: any) => {
        const n = nilaiList.find((nl: any) => nl.mapelId === pm.mapelId);
        if (!n) return false;
        if (isAkbarnas) return n.nilaiAkhir !== null;
        const m = pm.mapel;
        if (m?.jumlah_tes === 1) return n.nilaiAkhir !== null;
        // Usbuain modes: check only the relevant columns
        if (effectiveUsbuainMode === 1 && m?.jumlah_tes === 3) return n.nilaiNihai !== null;
        if (effectiveUsbuainMode === 2 && m?.jumlah_tes === 3) return n.nilaiUsbu1 !== null && n.nilaiUsbu2 !== null;
        // Normal 3 kolom
        return n.nilaiUsbu1 !== null && n.nilaiUsbu2 !== null && n.nilaiNihai !== null;
      }));

      const accumulativeNilai = nilaiList.filter((n: any) => {
        const pm = program?.programMapels.find((p: any) => p.mapelId === n.mapelId);
        if (!pm) return false;
        return pm.mapel.masuk_akumulasi !== false;
      });
      const status = calculateStatus(
        {
          is_tasmi: riwayat?.is_tasmi ?? false,
        },
        accumulativeNilai.map((n: any) => ({ skor: (n.nilaiAkhir || 0) + (n.nilaiTambahan || 0) })),
        program,
      );

      const average = calcAkumulatif(
        accumulativeNilai.map((n: any) => {
          const pm = program?.programMapels.find((p: any) => p.mapelId === n.mapelId);
          return { score: (n.nilaiAkhir || 0) + (n.nilaiTambahan || 0), bobot: pm?.mapel.bobot ?? 1 };
        })
      );
      const isTurats = (program as any)?.kategori === "TURATS";
      const averagePredikat = isTurats ? getPredikatTurats(Math.round(average)) : getPredikat(Math.round(average));

      const isUsbuain = !isAkbarnas && effectiveUsbuainMode > 0;

      return {
        id: masterSantri.id,
        nama: masterSantri.nama,
        gender: masterSantri.gender,
        lokasi: `${masterSantri.sakan} / ${masterSantri.kamar} / ${masterSantri.nomorLemari}`,
        programNama: isUsbuain ? "Usbu'ain (Gabungan)" : (program?.nama_indo ?? "Belum diatur"),
        programId: isUsbuain ? "USBUAIN_GROUP" : (program?.id ?? null),
        kelasNama: kelas?.nama ?? "-",
        kelasId: kelas?.id ?? null,
        statusKelulusan: program && hasCompleteNilai ? status : "TIDAK_LULUS",
        isTasmi: riwayat?.is_tasmi ?? false,
        isAktif: masterSantri.isAktif,
        isCheckedOut: masterSantri.isCheckedOut,
        canPrintSyahadah:
          Boolean(program) &&
          hasCompleteNilai &&
          status !== "TIDAK_LULUS",
        canViewIjazah: Boolean(program) && hasCompleteNilai,
        dufahNama: masterSantri.dufahNama,
        riwayatId: riwayat?.id ?? null,
        average,
        averagePredikat,
        programKategori: isUsbuain ? "USBUAIN" : ((program as any)?.kategori ?? "REGULER"),
        bulanKe: masterSantri.bulanKe,
      };
    })
    .sort((left: any, right: any) => left.nama.localeCompare(right.nama, "id"));
});

export async function getSantriFormData(id: string) {
  let riwayatMatch = await prisma.riwayatSantri.findUnique({
    where: { id },
  });

  const santriId = riwayatMatch ? riwayatMatch.santriId : id;

  const [masterSantriRes, programList, santriInternal] = await Promise.all([
    getMasterSantriById(santriId),
    getProgramCatalog(),
    prisma.santriInternal.findUnique({
      where: { id: santriId },
      include: {
        riwayatRecords: {
          include: {
            program: {
              include: programInclude,
            },
            kelas: true,
            nilaiList: {
              include: {
                mapel: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const masterSantri = masterSantriRes ?? (santriInternal ? {
    id: santriInternal.id,
    nama: santriInternal.nama ?? "Tanpa Nama",
    gender: "-",
    sakan: "-",
    kamar: "-",
    nomorLemari: "-",
    dufahNama: riwayatMatch?.dufahNama ?? "-",
    tanggalMulaiDufah: null,
    tanggalSampaiDufah: null,
    isAktif: false,
    kategori: "-",
    tempatLahir: santriInternal.tempat_lahir ?? "",
    tanggalLahir: santriInternal.tanggal_lahir ?? null,
    alamat: santriInternal.alamat ?? "",
  } : null);

  if (!masterSantri) {
    return null;
  }

  // Cari riwayat aktif: jika id adalah riwayatId, gunakan riwayat tersebut.
  // Jika tidak, gunakan dufah masterSantri.
  const activeRiwayat = santriInternal?.riwayatRecords.find(
    (r: any) => riwayatMatch ? r.id === riwayatMatch.id : r.dufahNama === masterSantri.dufahNama
  ) ?? null;

  let activeFlags = { u1: false, u2: false, u3: false };
  const dufah = await prisma.dufah.findUnique({
    where: { nama: masterSantri.dufahNama }
  });
  if (dufah) {
    activeFlags = { u1: dufah.usbu1Active, u2: dufah.usbu2Active, u3: dufah.usbu3Active };
  }

  return {
    masterSantri,
    activeFlags,
    programList,
    internalSantri: santriInternal
      ? {
        id: santriInternal.id,
        tempat_lahir: masterSantri.tempatLahir,
        tanggal_lahir: (masterSantri.tanggalLahir && !isNaN(new Date(masterSantri.tanggalLahir).getTime()))
          ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(masterSantri.tanggalLahir))
          : (masterSantri.tanggalLahir || ""),
        alamat: masterSantri.alamat,
      }
      : null,
    activeRiwayat: activeRiwayat
      ? {
        id: activeRiwayat.id,
        dufahNama: activeRiwayat.dufahNama,
        programId: activeRiwayat.programId,
        kelasId: activeRiwayat.kelasId,
        is_tasmi: activeRiwayat.is_tasmi,
        status_kelulusan: activeRiwayat.status_kelulusan,
        jumlah_kolom_usbu: activeRiwayat.jumlah_kolom_usbu,
        kelas: activeRiwayat.kelas,
        nilaiList: activeRiwayat.nilaiList.map((nilai: any) => ({
          id: nilai.id,
          mapelId: nilai.mapelId,
          mapelNama: nilai.mapel.nama_indo,
          nilaiUsbu1: nilai.nilaiUsbu1,
          nilaiUsbu2: nilai.nilaiUsbu2,
          nilaiNihai: nilai.nilaiNihai,
          nilaiAkhir: nilai.nilaiAkhir,
          skor: nilai.nilaiAkhir ?? 0,
        })),
      } : null,
    allRiwayat: santriInternal?.riwayatRecords ?? [],
  };
}

// Note: id here can be interpreted as santriId. To print older dufah, it needs riwayatId.
// For now, we support the current route which passes santriId to get their current Active certificate,
// or we rewrite it to accept RiwayatId. Let's adjust to find default active riwayat if Santri ID matches,
// otherwise find by RiwayatId directly (to allow printing historical ones).
export async function getCertificateData(id: string) {
  // Check if id is actually a riwayatId
  let riwayat = await prisma.riwayatSantri.findUnique({
    where: { id },
    include: {
      kelas: true,
      santri: true,
      program: {
        include: programInclude,
      },
      nilaiList: {
        include: {
          mapel: true,
        },
      },
    },
  });

  let santriIdToFetch = id;

  // If not found by riwayatId, it must be santriId. Get active riwayat by matching Dufah.
  if (!riwayat) {
    const masterSantriFallback = await getMasterSantriById(id);
    if (!masterSantriFallback) return null;

    riwayat = await prisma.riwayatSantri.findUnique({
      where: { santriId_dufahNama: { santriId: id, dufahNama: masterSantriFallback.dufahNama } },
      include: {
        kelas: true,
        santri: true,
        program: {
          include: programInclude,
        },
        nilaiList: {
          include: {
            mapel: true,
          },
        },
      },
    });
    // No riwayat found for active dufah either
    if (!riwayat) return null;
  } else {
    santriIdToFetch = riwayat.santriId;
  }

  const [masterSantriRes, template] = await Promise.all([
    getMasterSantriById(santriIdToFetch),
    getTemplateData(),
  ]);

  const masterSantri = masterSantriRes ?? {
    id: riwayat.santri.id,
    nama: riwayat.santri.nama ?? "Tanpa Nama",
    gender: "-",
    sakan: "-",
    kamar: "-",
    nomorLemari: "-",
    dufahNama: riwayat.dufahNama,
    tanggalMulaiDufah: null,
    tanggalSampaiDufah: null,
    isAktif: false,
    kategori: "-",
    tempatLahir: riwayat.santri.tempat_lahir ?? "",
    tanggalLahir: riwayat.santri.tanggal_lahir ?? null,
    alamat: riwayat.santri.alamat ?? "",
  };

  const dufahRecord = await prisma.dufah.findUnique({ where: { nama: masterSantri.dufahNama } });
  const dufahNamaArab = dufahRecord?.namaArab || null;

  if (!masterSantri || !riwayat.program) {
    return null;
  }

  let allNilaiList = [...riwayat.nilaiList];
  let allProgramMapels = [...riwayat.program.programMapels];

  if (riwayat.program.nama_indo.toLowerCase().includes("akbarnas")) {
    const historicalRiwayat = await prisma.riwayatSantri.findMany({
      where: {
        santriId: santriIdToFetch,
        program: {
          nama_indo: { contains: "akbarnas", mode: "insensitive" }
        },
        id: { not: riwayat.id }
      },
      include: {
        nilaiList: { include: { mapel: true } }
      },
      orderBy: { dufahNama: 'asc' }
    });

    for (const hist of historicalRiwayat) {
      allNilaiList = [...allNilaiList, ...hist.nilaiList];
    }
  }

  // Filter tampil_di_syahadah
  allProgramMapels = allProgramMapels.filter((pm: any) => pm.mapel.tampil_di_syahadah !== false);

  const isAkbarnas = riwayat.program.nama_indo.toLowerCase().includes("akbarnas");

  const nilaiGroups = new Map<string, any[]>();
  for (const nilai of allNilaiList) {
    if (!nilaiGroups.has(nilai.mapelId)) {
      nilaiGroups.set(nilai.mapelId, []);
    }
    nilaiGroups.get(nilai.mapelId)!.push(nilai);
  }

  const nilaiMap = new Map();
  for (const [mapelId, list] of nilaiGroups.entries()) {
    if (isAkbarnas) {
      // Use grade-calculator for Akbarnas gabungan
      const grandNilaiAkhir = calcAkbarnasMapelAverage(list);

      // Ambil nilai record terakhir sebagai base
      const baseNilai = list[list.length - 1];
      nilaiMap.set(mapelId, {
        ...baseNilai,
        nilaiUsbu1: baseNilai.nilaiUsbu1,
        nilaiUsbu2: baseNilai.nilaiUsbu2,
        nilaiNihai: baseNilai.nilaiNihai,
        nilaiAkhir: grandNilaiAkhir
      });
    } else {
      // Logika normal non-Akbarnas
      let selected = list[list.length - 1];
      for (const n of list) {
        if (n.nilaiAkhir !== null) {
          selected = n;
        }
      }

      if (selected && selected.nilaiAkhir === null && (selected.nilaiUsbu1 !== null || selected.nilaiUsbu2 !== null || selected.nilaiNihai !== null)) {
        const kelas = riwayat.kelas;
        const effectiveUsbuainMode = riwayat.jumlah_kolom_usbu ?? kelas?.jumlah_kolom_usbu ?? 0;
        const programMapel = riwayat.program.programMapels.find((pm: any) => pm.mapelId === selected.mapelId);
        const m = programMapel?.mapel;

        let nilaiAkhirCalculated = null;
        if (m?.jumlah_tes === 3 && effectiveUsbuainMode === 2) {
          nilaiAkhirCalculated = calcMapelNilaiAkhirUsbuain2({ u1: selected.nilaiUsbu1, u2: selected.nilaiUsbu2 });
        } else if (m?.jumlah_tes === 3 && effectiveUsbuainMode === 1) {
          nilaiAkhirCalculated = selected.nilaiNihai;
        } else {
          nilaiAkhirCalculated = calcMapelNilaiAkhir(
            { u1: selected.nilaiUsbu1, u2: selected.nilaiUsbu2, n: selected.nilaiNihai },
            false
          );
        }

        selected = {
          ...selected,
          nilaiAkhir: nilaiAkhirCalculated
        };
      }

      nilaiMap.set(mapelId, selected);
    }
  }

  const nilaiRows = allProgramMapels.map((programMapel: any) => {
    const nilai = nilaiMap.get(programMapel.mapel.id);
    const baseScore = nilai?.nilaiAkhir ?? null;
    const tambahan = nilai?.nilaiTambahan ?? 0;
    const skor = baseScore !== null ? applyNilaiTambahan(baseScore, tambahan) : null;

    return {
      mapelId: programMapel.mapel.id,
      nama_indo: programMapel.mapel.nama_indo,
      nama_arab: programMapel.mapel.nama_arab,
      nilaiUsbu1: nilai?.nilaiUsbu1 ?? null,
      nilaiUsbu2: nilai?.nilaiUsbu2 ?? null,
      nilaiNihai: nilai?.nilaiNihai ?? null,
      nilaiAkhir: nilai?.nilaiAkhir ?? null,
      nilaiTambahan: tambahan,
      skor,
      predikat: skor === null ? null : getPredikat(skor),
      masuk_akumulasi: programMapel.mapel.masuk_akumulasi ?? true,
      bobot: programMapel.mapel.bobot ?? 1,
    };
  });

  const accumulativeRows = nilaiRows.filter((nilai: any) => typeof nilai.skor === "number" && nilai.masuk_akumulasi);
  const average = calcAkumulatif(
    accumulativeRows.map((nilai: any) => ({ score: Number(nilai.skor), bobot: nilai.bobot }))
  );
  const status = calculateStatus(riwayat, accumulativeRows.map((nilai: any) => ({ skor: Number(nilai.skor) })), riwayat.program);

  const isTuratsCert = (riwayat.program as any)?.kategori === "TURATS";
  let predikat: { indo: string; arab: string } = isTuratsCert ? getPredikatTurats(Math.round(average)) : getPredikat(Math.round(average));

  // Check Martabah Ula
  if (status !== "TIDAK_LULUS" && riwayat.programId && average > 0) {
    const effectiveUsbuainMode = riwayat.jumlah_kolom_usbu ?? riwayat.kelas?.jumlah_kolom_usbu ?? 0;
    const isUsbuain = !isAkbarnas && effectiveUsbuainMode > 0;
    
    const isMartabahUla = await checkMartabahUla(riwayat.programId, riwayat.dufahNama, riwayat.id, isUsbuain);
    if (isMartabahUla) {
      predikat = { indo: isTuratsCert ? "Peringkat Satu dengan Predikat Istimewa" : "Martabah Ula", arab: "الامتياز مع مرتبة الشرف الأولى" };
    }
  }

  return {
    masterSantri,
    template,
    riwayatSantri: riwayat,
    santriInternal: {
      ...riwayat.santri,
      tempat_lahir: masterSantri.tempatLahir?.trim() ?? "",
      tanggal_lahir: (masterSantri.tanggalLahir && !isNaN(new Date(masterSantri.tanggalLahir).getTime()))
        ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(masterSantri.tanggalLahir))
        : (masterSantri.tanggalLahir || ""),
      alamat: masterSantri.alamat,
    },
    program: serializeProgram(riwayat.program),
    nilaiRows,
    average,
    averagePredikat: predikat,
    status,
    lokasi: `${masterSantri.sakan} / ${masterSantri.kamar} / ${masterSantri.nomorLemari}`,
    dufahNamaArab,
  };
}

export async function syncStatusKelulusanByProgramIds(programIds: string[]) {
  if (programIds.length === 0) {
    return;
  }

  const riwayatList = await prisma.riwayatSantri.findMany({
    where: {
      programId: {
        in: programIds,
      },
    },
    include: {
      program: true,
      nilaiList: true,
    },
  });

  if (riwayatList.length === 0) {
    return;
  }

  await prisma.$transaction(
    riwayatList.map((riwayat: any) =>
      prisma.riwayatSantri.update({
        where: { id: riwayat.id },
        data: {
          status_kelulusan: calculateStatus(riwayat, riwayat.nilaiList, riwayat.program),
        },
      }),
    ),
  );
}

export async function getRiwayatSantriRows() {
  const [masterSantriList, riwayatList] = await Promise.all([
    getMasterSantriList(),
    prisma.riwayatSantri.findMany({
      include: {
        santri: true,
        program: {
          include: programInclude,
        },
        kelas: true,
        nilaiList: {
          include: {
            mapel: true,
          },
        },
        absenSakanList: true,
        absenKelasList: true,
        absenKegiatanList: {
          include: {
            kategori: true,
          },
        },
      },
      orderBy: {
        dufahNama: "desc",
      },
    }),
  ]);

  const masterMap = new Map<string, typeof masterSantriList[0]>();
  for (const ms of masterSantriList) {
    masterMap.set(ms.id, ms);
  }

  const groupsMap = new Map<string, any>();

  for (const riwayat of riwayatList) {
    const ms = masterMap.get(riwayat.santriId);
    const isHistorical = !ms || !ms.isAktif || riwayat.dufahNama !== ms.dufahNama;

    if (!isHistorical) {
      continue;
    }

    if (!groupsMap.has(riwayat.santriId)) {
      groupsMap.set(riwayat.santriId, {
        santriId: riwayat.santriId,
        nama: ms ? ms.nama : (riwayat.santri?.nama ?? "Tanpa Nama"),
        gender: ms?.gender ?? "-",
        lokasi: ms ? `${ms.sakan} / ${ms.kamar} / ${ms.nomorLemari}` : "-",
        records: [],
      });
    }

    const group = groupsMap.get(riwayat.santriId);
    const program = riwayat.program;
    const kelas = riwayat.kelas;
    const isAkbarnas = program?.nama_indo.toLowerCase().includes("akbarnas");
    const nilaiList = riwayat.nilaiList ?? [];

    if (!isAkbarnas) {
      const effectiveUsbuainMode = riwayat.jumlah_kolom_usbu ?? kelas?.jumlah_kolom_usbu ?? 0;
      for (const n of nilaiList) {
        if (n.nilaiAkhir === null && (n.nilaiUsbu1 !== null || n.nilaiUsbu2 !== null || n.nilaiNihai !== null)) {
          const m = program?.programMapels.find((pm: any) => pm.mapelId === n.mapelId)?.mapel;
          if (m?.jumlah_tes === 3 && effectiveUsbuainMode === 2) {
            n.nilaiAkhir = calcMapelNilaiAkhirUsbuain2({ u1: n.nilaiUsbu1, u2: n.nilaiUsbu2 });
          } else if (m?.jumlah_tes === 3 && effectiveUsbuainMode === 1) {
            n.nilaiAkhir = n.nilaiNihai;
          } else {
            n.nilaiAkhir = calcMapelNilaiAkhir(
              { u1: n.nilaiUsbu1, u2: n.nilaiUsbu2, n: n.nilaiNihai },
              false
            );
          }
        }
      }
    }

    const totalMapel = program?.programMapels.length ?? 0;
    const effectiveUsbuainMode2 = riwayat.jumlah_kolom_usbu ?? kelas?.jumlah_kolom_usbu ?? 0;
    const hasCompleteNilai = Boolean(totalMapel > 0 && program?.programMapels.every((pm: any) => {
      const n = nilaiList.find((nl: any) => nl.mapelId === pm.mapelId);
      if (!n) return false;
      const m = pm.mapel;
      if (m?.jumlah_tes === 1) return n.nilaiAkhir !== null;
      // Usbuain modes
      if (effectiveUsbuainMode2 === 1 && m?.jumlah_tes === 3) return n.nilaiNihai !== null;
      if (effectiveUsbuainMode2 === 2 && m?.jumlah_tes === 3) return n.nilaiUsbu1 !== null && n.nilaiUsbu2 !== null;
      // Normal
      return n.nilaiUsbu1 !== null && n.nilaiUsbu2 !== null && n.nilaiNihai !== null;
    }));
    const accumulativeNilai = nilaiList.filter((n: any) => {
      const pm = program?.programMapels.find((p: any) => p.mapelId === n.mapelId);
      if (!pm) return false;
      return pm.mapel.masuk_akumulasi !== false;
    });
    const status = calculateStatus(
      { is_tasmi: riwayat.is_tasmi },
      accumulativeNilai.map((n: any) => ({ skor: n.nilaiAkhir || 0 })),
      program,
    );

    const absenSakanSummary = {
      hadir: riwayat.absenSakanList.filter((a: any) => a.status === "HADIR").length,
      izin: riwayat.absenSakanList.filter((a: any) => a.status === "IZIN").length,
      sakit: riwayat.absenSakanList.filter((a: any) => a.status === "SAKIT").length,
      alpha: riwayat.absenSakanList.filter((a: any) => a.status === "ALPHA").length,
      total: riwayat.absenSakanList.length,
    };

    // Group kelas absen by hissoh
    const hissohList = ["ULA", "TSANI", "TSALIS", "RABI", "KHAMIS"];
    const absenKelasByHissoh = hissohList.map((h) => {
      const list = riwayat.absenKelasList.filter((a: any) => a.hissoh === h);
      return {
        hissoh: h,
        hadir: list.filter((a: any) => a.status === "HADIR").length,
        alpha: list.filter((a: any) => a.status === "ALPHA").length,
        total: list.length,
      };
    }).filter((h) => h.total > 0);

    // Group kegiatan absen by kategori
    const kegiatanMap = new Map<string, { nama: string; hadir: number; alpha: number; total: number }>();
    for (const a of riwayat.absenKegiatanList) {
      const key = a.kategoriId;
      const kategoriNama = a.kategori?.nama ?? "Kegiatan";
      if (!kegiatanMap.has(key)) {
        kegiatanMap.set(key, { nama: kategoriNama, hadir: 0, alpha: 0, total: 0 });
      }
      const entry = kegiatanMap.get(key)!;
      entry.total += 1;
      if (a.status === "HADIR") entry.hadir += 1;
      else if (a.status === "ALPHA") entry.alpha += 1;
    }

    group.records.push({
      riwayatId: riwayat.id,
      dufahNama: riwayat.dufahNama,
      programNama: program?.nama_indo ?? "Belum diatur",
      programId: program?.id ?? null,
      programKategori: program?.kategori ?? "REGULER",
      isUsbuain: (riwayat.jumlah_kolom_usbu ?? kelas?.jumlah_kolom_usbu ?? 0) > 0,
      kelasNama: kelas?.nama ?? "-",
      kelasId: kelas?.id ?? null,
      statusKelulusan: program && hasCompleteNilai ? status : "TIDAK_LULUS",
      isTasmi: riwayat.is_tasmi ?? false,
      canPrintSyahadah: Boolean(program) && hasCompleteNilai && status !== "TIDAK_LULUS",
      canViewIjazah: Boolean(program) && hasCompleteNilai,
      nilaiList: nilaiList.map((n: any) => ({
        mapelNama: n.mapel.nama_indo,
        skor: n.nilaiAkhir ?? 0,
      })),
      rataRata: nilaiList.length > 0 ? (nilaiList.reduce((acc: number, n: any) => acc + (n.nilaiAkhir ?? 0), 0) / nilaiList.length).toFixed(2) : null,
      absenSakan: absenSakanSummary,
      absenKelasByHissoh,
      absenKegiatan: Array.from(kegiatanMap.values()),
    });
  }

  return Array.from(groupsMap.values()).sort((a, b) => a.nama.localeCompare(b.nama, "id"));
}

