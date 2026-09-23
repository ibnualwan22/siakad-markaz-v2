import { requirePermission } from "@/lib/permission";
import prisma from "@/lib/prisma";
import { getMasterSantriList } from "@/lib/santri-api";
import { redirect } from "next/navigation";
import { CetakUsbuDocument } from "@/components/admin/cetak-usbu-document";
import { getActiveDufahName } from "@/lib/absensi";
import { calcAkumulatif, calcAkbarnasMapelAverage, applyNilaiTambahan } from "@/lib/grade-calculator";
import { getSession } from "@/lib/auth";

export default async function CetakUsbuPrintPage(props: { params: Promise<{ kelasId: string, usbu: string }>, searchParams: Promise<{ bulan?: string, dufah?: string }> }) {
  await requirePermission("cetak_nilai_pekanan");
  const session = await getSession();
  const isAdmin = session?.role === "ADMIN";
  const allowedKelasId = session?.kelasId ?? null;
  const isRestricted = !isAdmin && !!allowedKelasId;

  const { kelasId, usbu } = await props.params;
  const { bulan, dufah } = await props.searchParams;
  const targetUsbu = parseInt(usbu);

  if (targetUsbu < 1 || targetUsbu > 4) redirect("/admin/cetak-usbu");

  if (isRestricted && allowedKelasId !== kelasId) {
    redirect("/admin/cetak-usbu");
  }

  const kelas = await prisma.kelas.findUnique({
    where: { id: kelasId },
    include: {
      waliKelas: true,
      program: {
        include: {
          programMapels: {
            include: { mapel: true },
            orderBy: { urutan: "asc" }
          }
        }
      }
    }
  });

  if (!kelas) redirect("/admin/cetak-usbu");

  const masterList = await getMasterSantriList();
  const masterMap = new Map(masterList.map(m => [m.id, m]));

  const activeRiwayatList = await prisma.riwayatSantri.findMany({
    where: { 
      kelasId,
      ...(dufah ? { dufahNama: dufah } : {})
    },
    select: { id: true, santriId: true, dufahNama: true }
  });

  const validActiveRiwayats = dufah ? activeRiwayatList : activeRiwayatList.filter(r => {
    const ms = masterMap.get(r.santriId);
    return ms?.isAktif && ms.dufahNama === r.dufahNama;
  });

  const isAkbarnas = kelas.program.nama_indo.toLowerCase().includes("akbarnas");
  const isGabungan = isAkbarnas && bulan === "gabungan";
  const isMonth2 = isAkbarnas && bulan === "2";

  // ===== GABUNGAN MODE: merge all Akbarnas riwayat for both months =====
  if (isGabungan) {
    const santriIds = validActiveRiwayats.map(r => r.santriId);

    // Get ALL Akbarnas riwayat for these students (both months/dufah)
    const allAkbarnasRiwayat = await prisma.riwayatSantri.findMany({
      where: {
        santriId: { in: santriIds },
        program: { nama_indo: { contains: "akbarnas", mode: "insensitive" } },
      },
      include: { santri: true, nilaiList: true },
    });

    // Include ALL mapels for display — MC, Dubbing, Taqdimul Qishah etc.
    // Akumulatif calculation still only uses masuk_akumulasi mapels (handled below)
    const allMapels = kelas.program.programMapels.filter(pm => {
      if (targetUsbu !== 4 && pm.mapel.jumlah_tes === 1) return false;
      return true;
    });

    // Group riwayat by santriId
    const riwayatBySantri = new Map<string, typeof allAkbarnasRiwayat>();
    for (const r of allAkbarnasRiwayat) {
      if (!riwayatBySantri.has(r.santriId)) riwayatBySantri.set(r.santriId, []);
      riwayatBySantri.get(r.santriId)!.push(r);
    }

    const rows = santriIds.map(santriId => {
      const ms = masterMap.get(santriId);
      if (!ms) return null;

      const allRiwayats = riwayatBySantri.get(santriId) || [];

      // Merge nilaiList from all riwayat, grouped by mapelId
      const combinedNilaiMap = new Map<string, any[]>();
      for (const r of allRiwayats) {
        for (const n of r.nilaiList) {
          if (!combinedNilaiMap.has(n.mapelId)) combinedNilaiMap.set(n.mapelId, []);
          combinedNilaiMap.get(n.mapelId)!.push(n);
        }
      }

      const mapelScores: (number | "-")[] = [];
      const akumulatifItems: { score: number; bobot: number }[] = [];

      for (const pm of allMapels) {
        const nilaiEntries = combinedNilaiMap.get(pm.mapelId) || [];

        // Use grade-calculator for Akbarnas gabungan average
        let grandScore = calcAkbarnasMapelAverage(nilaiEntries);

        // Add nilaiTambahan from the latest riwayat entry
        let tambahan = 0;
        for (const n of nilaiEntries) {
          if (n.nilaiTambahan && n.nilaiTambahan > 0) tambahan = n.nilaiTambahan;
        }
        if (grandScore !== null && tambahan > 0) grandScore = applyNilaiTambahan(grandScore, tambahan);

        if (grandScore !== null) {
          mapelScores.push(grandScore);
          if (pm.mapel.masuk_akumulasi !== false) {
            akumulatifItems.push({ score: grandScore, bobot: pm.mapel.bobot ?? 1 });
          }
        } else {
          mapelScores.push("-");
        }
      }

      const nilaiAkumulatif = calcAkumulatif(akumulatifItems);

      return { nama: ms.nama, gender: ms.gender || "-", mapelScores, nilaiAkumulatif };
    }).filter(Boolean) as any[];

    rows.sort((a: any, b: any) => b.nilaiAkumulatif - a.nilaiAkumulatif);
    rows.forEach((r: any, idx: number) => { r.peringkat = idx + 1; });
    rows.sort((a: any, b: any) => a.nama.localeCompare(b.nama, "id"));

    return (
      <div className="min-h-screen bg-slate-200 p-4 md:p-8">
        <CetakUsbuDocument
          kelasNama={kelas.nama + " (Gabungan B1+B2)"}
          waliKelas={kelas.waliKelas?.nama || "Belum dihubungkan"}
          usbuLabel="Gabungan"
          mapelHeaders={allMapels.map(pm => pm.mapel.nama_indo.toUpperCase() as string)}
          rows={rows}
        />
      </div>
    );
  }

  // ===== NORMAL MODE (Bulan 1 / Bulan 2 / Non-Akbarnas) =====
  let targetRiwayatIds: string[] = [];

  if (isAkbarnas) {
    const reqMonth = bulan === "2" ? "2" : "1";
    if (reqMonth === "2" && !kelas.is_akbarnas_b2) {
      targetRiwayatIds = [];
    } else if (reqMonth === "2" && kelas.is_akbarnas_b2) {
      targetRiwayatIds = validActiveRiwayats.map(r => r.id);
    } else if (reqMonth === "1" && !kelas.is_akbarnas_b2) {
      targetRiwayatIds = validActiveRiwayats.map(r => r.id);
    } else if (reqMonth === "1" && kelas.is_akbarnas_b2) {
      const santriIds = validActiveRiwayats.map(r => r.santriId);
      const previousRiwayats = await prisma.riwayatSantri.findMany({
        where: {
          santriId: { in: santriIds },
          program: { nama_indo: { contains: "akbarnas", mode: "insensitive" } },
          id: { notIn: validActiveRiwayats.map(r => r.id) }
        },
        orderBy: { id: 'desc' }
      });
      const santriToHistorical = new Map();
      for (const r of previousRiwayats) {
        if (!santriToHistorical.has(r.santriId)) {
          santriToHistorical.set(r.santriId, r);
        }
      }
      targetRiwayatIds = validActiveRiwayats.map(active => {
        const hist = santriToHistorical.get(active.santriId);
        return hist ? hist.id : null;
      }).filter(Boolean) as string[];
    }
  } else {
    targetRiwayatIds = validActiveRiwayats.map(r => r.id);
  }

  const riwayatList = await prisma.riwayatSantri.findMany({
    where: { id: { in: targetRiwayatIds } },
    include: { santri: true, nilaiList: true }
  });

  const activeMapels = kelas.program.programMapels.filter(pm => {
    if (targetUsbu !== 4 && pm.mapel.jumlah_tes === 1) return false;
    if (!isAkbarnas) return true;
    if (isMonth2) {
      return (pm.mapel as any).bulan_aktif !== 1;
    } else {
      return (pm.mapel as any).bulan_aktif !== 2;
    }
  });

  const rows = riwayatList.map(riwayat => {
    const ms = masterMap.get(riwayat.santriId);
    if (!ms && !riwayat.santri) return null;

    const nama = ms?.nama || riwayat.santri.nama || "Tanpa Nama";
    const gender = ms?.gender || "-";

    const mapelScores: (number | "-")[] = [];
    const akumulatifItems: { score: number; bobot: number }[] = [];

    const effectiveMode = riwayat.jumlah_kolom_usbu ?? kelas.jumlah_kolom_usbu ?? 0;

    for (const pm of activeMapels) {
      const match = riwayat.nilaiList.find((n: any) => n.mapelId === pm.mapelId);

      let score: number | null = null;
      if (match) {
        if (targetUsbu === 1) {
          if (effectiveMode === 1 && pm.mapel.jumlah_tes === 3) {
            // Mode 1 kolom: nilai disimpan di nilaiNihai, tampilkan itu
            score = match.nilaiNihai ?? null;
          } else {
            score = match.nilaiUsbu1 ?? match.nilaiAkhir;
          }
        } else if (targetUsbu === 2) {
          if (effectiveMode === 1 && pm.mapel.jumlah_tes === 3) {
            score = null; // Mode 1: tidak ada usbu' 2
          } else {
            score = match.nilaiUsbu2 ?? match.nilaiAkhir;
          }
        } else if (targetUsbu === 3) {
          if ((effectiveMode === 1 || effectiveMode === 2) && pm.mapel.jumlah_tes === 3) {
            score = null; // Mode 1 & 2: tidak ada nihai
          } else {
            score = match.nilaiNihai ?? match.nilaiAkhir;
          }
        } else if (targetUsbu === 4) {
          const base = match.nilaiAkhir;
          const tmb = match.nilaiTambahan ?? 0;
          score = base !== null && base !== undefined ? applyNilaiTambahan(base, tmb) : null;
        }
      }

      if (score !== null && score !== undefined) {
        mapelScores.push(score);
        if (pm.mapel.masuk_akumulasi !== false) {
          const currentWeight = targetUsbu === 4 ? (pm.mapel.bobot ?? 1) : ((pm.mapel as any).bobot_usbu ?? 1);
          akumulatifItems.push({ score, bobot: currentWeight });
        }
      } else {
        mapelScores.push("-");
      }
    }

    const nilaiAkumulatif = calcAkumulatif(akumulatifItems);

    return { nama, gender, mapelScores, nilaiAkumulatif };
  }).filter(Boolean) as any[];

  rows.sort((a, b) => b.nilaiAkumulatif - a.nilaiAkumulatif);
  rows.forEach((r, idx) => { r.peringkat = idx + 1; });
  rows.sort((a, b) => a.nama.localeCompare(b.nama, "id"));

  return (
    <div className="min-h-screen bg-slate-200 p-4 md:p-8">
      <CetakUsbuDocument
        kelasNama={kelas.nama + (isMonth2 ? " (Bulan 2)" : "")}
        waliKelas={kelas.waliKelas?.nama || "Belum dihubungkan"}
        usbuLabel={targetUsbu === 3 ? "Nihai" : targetUsbu === 4 ? "Akumulatif" : targetUsbu.toString()}
        mapelHeaders={activeMapels.map(pm => pm.mapel.nama_indo.toUpperCase() as string)}
        rows={rows}
      />
    </div>
  );
}
