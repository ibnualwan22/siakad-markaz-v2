import { requirePermission, checkPermission } from "@/lib/permission";
import { Suspense } from "react";
import { Metadata } from "next";
import { RekapFilterClient } from "@/components/admin/rekap-filter-client";
import { AbsensiRekapDetailClient } from "@/components/admin/absensi-rekap-detail-client";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Rekap Absen Kelas - Admin Panel",
};

export const dynamic = "force-dynamic";

export default async function RekapKelasPage() {
  await requirePermission("rekap_kelas");
  const session = await getSession();
  
  const hasRekapKelasEdit = await checkPermission("rekap_kelas_edit");
  
  // Jika mereka punya rekap_kelas_edit, mereka bisa melihat semua kelas
  const isAdmin = session?.role === "ADMIN" || hasRekapKelasEdit;
  const allowedKelasId = session?.kelasId ?? null;
  const isRestricted = !isAdmin && !!allowedKelasId;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 pb-2">
        <h1 className="text-3xl font-black md:text-4xl ">
          Rekap Absen Kelas
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] max-w-2xl">
          Laporan kehadiran santri di kelas berdasarkan Usbu' (Pekan) yang berjalan.
        </p>
      </div>

      <Suspense fallback={<div className="animate-pulse p-4 text-[var(--color-text-subtle)] font-medium">Memuat Filter...</div>}>
        <RekapFilterClient type="kelas" title="Rincian Absen Kelas" useUsbu={true} />
      </Suspense>

      <Suspense fallback={<div className="animate-pulse p-10 text-center text-[var(--color-text-subtle)] font-medium">Memuat Rincian...</div>}>
        <AbsensiRekapDetailClient allowedKelasId={isRestricted ? allowedKelasId : null} />
      </Suspense>
    </div>
  );
}
