import { checkPermission } from "@/lib/permission";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { ScanAbsenClient } from "@/components/admin/scan-absen-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Scan Absen Kegiatan - Admin Panel",
};

export default async function ScanAbsenPage() {
  // Halaman boleh diakses pemilik permission scan_absen_kegiatan ATAU pengaturan_kegiatan.
  // Form "buka sesi" hanya tampil untuk pemilik pengaturan_kegiatan (lihat prop bisaBuatSesi).
  const bisaKelola = await checkPermission("pengaturan_kegiatan");
  const bisaScan = await checkPermission("scan_absen_kegiatan");
  if (!bisaKelola && !bisaScan) redirect("/admin/dashboard?error=unauthorized");

  const kategoriList = await prisma.kategoriKegiatan.findMany({
    where: { aktif: true },
    orderBy: { nama: "asc" },
    select: { id: true, nama: true },
  });

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black md:text-4xl">Scan Absen Kegiatan</h1>
        <p className="text-sm text-[var(--color-text-muted)] max-w-2xl">
          Buka sesi, lalu scan QR santri di gerbang dengan scanner bluetooth atau kamera HP.
          Mendukung banyak jalur scan bersamaan dalam satu sesi.
        </p>
      </div>
      <ScanAbsenClient kategoriList={kategoriList} bisaBuatSesi={bisaKelola} />
    </div>
  );
}
