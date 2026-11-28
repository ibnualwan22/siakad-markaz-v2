import { requirePermission } from "@/lib/permission";
import prisma from "@/lib/prisma";
import { getMasterSantriList } from "@/lib/santri-api";
import { redirect } from "next/navigation";
import { CetakUsbuDocument } from "@/components/admin/cetak-usbu-document";
import { getActiveDufahName } from "@/lib/absensi";
import { calcAkumulatif, applyNilaiTambahan } from "@/lib/grade-calculator";
import { getSession } from "@/lib/auth";

export default async function CetakBulkUsbuPage({ params }: { params: Promise<{ usbu: string }> }) {
  await requirePermission("cetak_nilai_pekanan");
  const session = await getSession();
  if (session?.role !== "ADMIN") {
    redirect("/admin/cetak-usbu");
  }

  const { usbu } = await params;
  const targetUsbu = parseInt(usbu);

  if (targetUsbu < 1 || targetUsbu > 4) redirect("/admin/cetak-usbu");

  const masterList = await getMasterSantriList();
  const masterMap = new Map(masterList.map(m => [m.id, m]));
  const activeStudentIds = Array.from(masterMap.values()).filter(m => m.isAktif).map(m => m.id);

  const kelasList = await prisma.kelas.findMany({
    where: { isActive: true, isDeleted: false },
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
    },
    orderBy: { nama: "asc" }
  });

  const allClassData = [];

  for (const kelas of kelasList) {
    const riwayatListRaw = await prisma.riwayatSantri.findMany({
      where: {
        kelasId: kelas.id,
      },
      include: {
        santri: true,
        nilaiList: true,
      }
    });

    if (riwayatListRaw.length === 0) continue;

    const isAkbarnas = kelas.program.nama_indo.toLowerCase().includes("akbarnas");
    const isMonth2 = kelas.is_akbarnas_b2 || false;

    let riwayatList = riwayatListRaw.filter((r: any) => {
      const ms = masterMap.get(r.santriId);
      return activeStudentIds.includes(r.santriId) && ms?.dufahNama === r.dufahNama;
    });

    const activeMapels = kelas.program.programMapels.filter(pm => {
      // Untuk usbu 1/2/3 (pekanan): sembunyikan mapel yang hanya 1x tes
      if (targetUsbu !== 4 && pm.mapel.jumlah_tes === 1) return false;
      // For Akbarnas usbu=4 (Semua Usbu'): show ALL mapels including MC, Dubbing, etc.
      if (isAkbarnas && targetUsbu === 4) return true;
      if (!isAkbarnas) return true;
      if (isMonth2) {
        return (pm.mapel as any).bulan_aktif !== 1;
      } else {
        return (pm.mapel as any).bulan_aktif !== 2;
      }
    });

    const rows = riwayatList.map((riwayat: any) => {
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
              score = match.nilaiNihai ?? null;
            } else {
              score = match.nilaiUsbu1 ?? match.nilaiAkhir;
            }
          } else if (targetUsbu === 2) {
            if (effectiveMode === 1 && pm.mapel.jumlah_tes === 3) {
              score = null;
            } else {
              score = match.nilaiUsbu2 ?? match.nilaiAkhir;
            }
          } else if (targetUsbu === 3) {
            if ((effectiveMode === 1 || effectiveMode === 2) && pm.mapel.jumlah_tes === 3) {
              score = null;
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

      return {
        nama,
        gender,
        mapelScores,
        nilaiAkumulatif
      };
    }).filter(Boolean) as any[];

    // Sort by akumulatif descending to get ranking
    rows.sort((a, b) => b.nilaiAkumulatif - a.nilaiAkumulatif);

    // Assign ranking
    rows.forEach((r, idx) => {
      r.peringkat = idx + 1;
    });

    // Then sort back by name alphabetically
    rows.sort((a, b) => a.nama.localeCompare(b.nama, "id"));

    allClassData.push({
      kelas,
      activeMapels,
      rows,
      isMonth2
    });
  }

  if (allClassData.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-200">
        <p className="text-xl font-bold text-[var(--color-text)]">Tidak ada data kelas yang dapat dicetak.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-200 p-4 md:p-8">
      <style>{`
        @media print {
          .bulk-container { padding: 0 !important; background: white !important; }
        }
      `}</style>
      <div className="bulk-container flex flex-col gap-8 md:gap-12">
        {allClassData.map(({ kelas, activeMapels, rows, isMonth2 }) => (
          <CetakUsbuDocument
            key={kelas.id}
            kelasNama={kelas.nama + (isMonth2 ? " (Bulan 2)" : "")}
            waliKelas={kelas.waliKelas?.nama || "Belum dihubungkan"}
            usbuLabel={targetUsbu === 3 ? "Nihai" : targetUsbu === 4 ? "Akumulatif" : targetUsbu.toString()}
            mapelHeaders={activeMapels.map((pm: any) => pm.mapel.nama_indo.toUpperCase() as string)}
            rows={rows}
          />
        ))}
      </div>
    </div>
  );
}
