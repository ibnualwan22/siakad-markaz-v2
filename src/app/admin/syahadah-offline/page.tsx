import { redirect } from "next/navigation";
import { getProgramCatalog } from "@/lib/app-data";
import { getNonKelasCatalog } from "@/lib/syahadah-non-kelas-data";
import { hasAnyPermission } from "@/lib/permission";
import SyahadahOfflineClient from "@/components/admin/syahadah-offline-client";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Layout Syahadah - Admin Panel",
};

export default async function SyahadahOfflinePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const allowed = await hasAnyPermission(
    "data_syahadah",
    "layout_syahadah",
    "nadi_hufadz",
    "lajnah_syahadah",
    "osim_syahadah",
    "tadrib_funun",
    "martabah_ula",
  );
  if (!allowed) {
    redirect("/admin/dashboard?error=unauthorized");
  }

  const [programList, nonKelasCatalog, sp] = await Promise.all([
    getProgramCatalog(),
    getNonKelasCatalog(),
    searchParams,
  ]);

  const initialMainTab = sp.tab === "non-kelas" ? "non-kelas" : "kelas";

  return (
    <div className="space-y-6 offline-print-reset">
      <div className="no-print flex flex-col gap-2">
        <h1 className="text-3xl font-black md:text-4xl">Layout Syahadah</h1>
        <p className="text-sm text-[var(--color-text-muted)] max-w-3xl">
          Pusat pengaturan desain &amp; posisi syahadah terpadu: <strong>Syahadah Kelas</strong>{" "}
          (F4 Portrait untuk Markaz Arabiyah, Turats, &amp; Hufadz) dan{" "}
          <strong>Syahadah Non-Kelas</strong> (F4 Landscape untuk Nadi Hufadz, Lajnah, OSIM, Tadrib Funun, CAC, &amp; Martabah Ula) lengkap dengan Cetak Bulk Global.
        </p>
      </div>

      <SyahadahOfflineClient
        programs={programList as any}
        nonKelasCatalog={nonKelasCatalog}
        initialMainTab={initialMainTab}
      />
    </div>
  );
}
