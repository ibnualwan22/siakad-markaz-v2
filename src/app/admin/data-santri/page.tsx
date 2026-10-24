import { requirePermission } from "@/lib/permission";
import { getMasterSantriList } from "@/lib/santri-api";
import { getActiveDufahName } from "@/lib/absensi";
import prisma from "@/lib/prisma";
import { DataSantriClient } from "@/components/admin/data-santri-client";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Data Santri Duf'ah - Admin Panel",
};

export type SantriDufahRow = {
  id: string;
  nama: string;
  gender: string;
  sakan: string;
  kamar: string;
  nomorLemari: string;
  kabupaten: string;
  programNama: string;
  kelasNama: string;
  bulanKe: number;
  kategori: string;
  programKategori: string;
  dufahNama: string;
  noWaSantri: string;
  isCheckedOut?: boolean;
};

export default async function DataSantriPage() {
  await requirePermission("data_santri_dufah");

  const [masterSantriList, activeDufahName] = await Promise.all([
    getMasterSantriList(),
    getActiveDufahName(),
  ]);

  // Get active santri IDs
  const activeSantri = masterSantriList.filter((s) => s.isAktif);
  const activeSantriIds = activeSantri.map((s) => s.id);

  // Query local DB for program & kelas data
  const riwayatList = await prisma.riwayatSantri.findMany({
    where: {
      santriId: { in: activeSantriIds },
    },
    include: {
      program: true,
      kelas: true,
    },
  });

  // Map riwayat by santriId + dufahNama
  const riwayatMap = new Map<string, (typeof riwayatList)[0]>();
  for (const r of riwayatList) {
    riwayatMap.set(`${r.santriId}_${r.dufahNama}`, r);
  }

  // Combine data
  const rows: SantriDufahRow[] = activeSantri.map((ms) => {
    // Try active dufah first, then fallback to the santri's own dufah
    let riwayat = activeDufahName
      ? riwayatMap.get(`${ms.id}_${activeDufahName}`)
      : undefined;
    if (!riwayat) {
      riwayat = riwayatMap.get(`${ms.id}_${ms.dufahNama}`);
    }

    return {
      id: ms.id,
      nama: ms.nama,
      gender: ms.gender,
      sakan: ms.sakan,
      kamar: ms.kamar,
      nomorLemari: ms.nomorLemari,
      kabupaten: ms.kabupaten,
      programNama: riwayat?.program?.nama_indo ?? "Belum diatur",
      kelasNama: riwayat?.kelas?.nama ?? "-",
      bulanKe: ms.bulanKe,
      kategori: ms.kategori,
      programKategori: riwayat?.program?.kategori ?? "REGULER",
      dufahNama: riwayat?.dufahNama ?? ms.dufahNama ?? "",
      noWaSantri: ms.noWaSantri,
      isCheckedOut: ms.isCheckedOut,
    };
  });

  // Sort by nama alphabetically
  rows.sort((a, b) => a.nama.localeCompare(b.nama, "id"));

  // Get unique values for filters
  const uniqueSakans = [...new Set(rows.map((r) => r.sakan).filter((s) => s !== "-"))].sort();
  const uniquePrograms = [...new Set(rows.map((r) => r.programNama).filter((p) => p !== "Belum diatur"))].sort();
  const uniqueKelas = [...new Set(rows.map((r) => r.kelasNama).filter((k) => k !== "-"))].sort();

  return (
    <div className="space-y-6">
      <DataSantriClient
        rows={rows}
        uniqueSakans={uniqueSakans}
        uniquePrograms={uniquePrograms}
        uniqueKelas={uniqueKelas}
        activeDufahName={activeDufahName}
      />
    </div>
  );
}
