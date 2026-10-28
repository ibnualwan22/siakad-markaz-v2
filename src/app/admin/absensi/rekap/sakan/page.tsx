import { requirePermission } from "@/lib/permission";
import { Suspense } from "react";
import { Metadata } from "next";
import { RekapFilterClient } from "@/components/admin/rekap-filter-client";
import { AbsensiRekapDetailClient } from "@/components/admin/absensi-rekap-detail-client";
import { SakanAlertBelumAbsen } from "@/components/admin/sakan-alert-belum-absen";
import { SakanBoardClient } from "@/components/admin/sakan-board-client";
import { PushPermissionPrompt } from "@/components/admin/push-permission-prompt";

export const metadata: Metadata = {
  title: "Rekap Absen Sakan - Admin Panel",
};

export const dynamic = "force-dynamic";

export default async function RekapSakanPage() {
  await requirePermission("rekap_sakan");
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 pb-2">
        <h1 className="text-3xl font-black md:text-4xl ">
          Rekap Absen Sakan
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] max-w-2xl">
          Laporan kehadiran santri di asrama berdasarkan rentang tanggal.
        </p>
      </div>

      {/* Alert: Sakan yang belum absen hari ini */}
      <SakanAlertBelumAbsen />

      {/* Langganan notifikasi laporan sakan (admin) */}
      <PushPermissionPrompt benefitText="Aktifkan notifikasi laporan sakan: setiap sakan yang selesai absen mengirim ringkasan ke perangkat ini, tanpa perlu menunggu laporan di grup WA." />

      {/* Papan status sakan hari ini + daftar perhatian */}
      <SakanBoardClient />

      <Suspense fallback={<div className="animate-pulse p-4 text-[var(--color-text-subtle)] font-medium">Memuat Filter...</div>}>
        <RekapFilterClient type="sakan" title="Rincian Absen Sakan" useUsbu={false} />
      </Suspense>

      <Suspense fallback={<div className="animate-pulse p-10 text-center text-[var(--color-text-subtle)] font-medium">Memuat Rincian...</div>}>
        <AbsensiRekapDetailClient />
      </Suspense>
    </div>
  );
}
