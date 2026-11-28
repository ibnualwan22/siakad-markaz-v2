import { requirePermission } from "@/lib/permission";
import { Metadata } from "next";
import { getMasterSantriList } from "@/lib/santri-api";
import { AbsensiKegiatanClient } from "@/components/admin/absensi-kegiatan-client";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Absen Kegiatan - Admin Panel",
};


export default async function AbsensiKegiatanPage() {
  await requirePermission("absen_kegiatan");
  const session = await getSession();
  const userSakan = session?.sakan || undefined;

  const [masterSantri, kegiatanList, kelasList] = await Promise.all([
    getMasterSantriList(),
    prisma.kategoriKegiatan.findMany({ orderBy: { nama: "asc" } }),
    prisma.kelas.findMany({ where: { isActive: true, isDeleted: false }, orderBy: { nama: "asc" }, select: { id: true, nama: true } }),
  ]);

  const sakanSet = new Set<string>();
  masterSantri.forEach(s => {
    if (s.sakan && s.sakan !== "-") sakanSet.add(s.sakan);
  });
  const sakanList = Array.from(sakanSet).sort();

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black md:text-4xl ">
          Absen Kegiatan
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] max-w-2xl">
          Pendataan kehadiran santri untuk kegiatan dinamis seperti Halaqoh dan Tahajud.
        </p>
      </div>
      <AbsensiKegiatanClient 
        sakanList={sakanList} 
        kegiatanList={kegiatanList} 
        kelasList={kelasList}
        defaultSakan={userSakan}
      />
    </div>
  );
}
