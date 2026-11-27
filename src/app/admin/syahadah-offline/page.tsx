import { redirect } from "next/navigation";
import { getProgramCatalog } from "@/lib/app-data";
import { hasAnyPermission } from "@/lib/permission";
import SyahadahOfflineClient from "@/components/admin/syahadah-offline-client";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Layout Syahadah - Admin Panel",
};

export default async function SyahadahOfflinePage() {
  const allowed = await hasAnyPermission("data_syahadah", "layout_syahadah");
  if (!allowed) {
    redirect("/admin/dashboard?error=unauthorized");
  }
  const programList = await getProgramCatalog();

  return (
    <div className="space-y-6 offline-print-reset">
      <div className="no-print flex flex-col gap-2">
        <h1 className="text-3xl font-black md:text-4xl">Layout Syahadah</h1>
        <p className="text-sm text-[var(--color-text-muted)] max-w-3xl">
          Editor terpadu syahadah F4 portrait (215 × 330 mm) untuk semua lembaga
          (Markaz Arabiyah, Turats, &amp; Hufadz). Atur desain <strong>Lulus</strong>{" "}
          (kertas pre-printed) dan <strong>Musyarokah</strong> (kertas polos) secara terpisah,
          geser posisi field dengan mouse atau panah keyboard (Shift = 5× cepat), lalu kalibrasi offset printer.
        </p>
      </div>

      <SyahadahOfflineClient programs={programList as any} />
    </div>
  );
}
