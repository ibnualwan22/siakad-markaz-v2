import { getProgramCatalog } from "@/lib/app-data";
import { requirePermission } from "@/lib/permission";
import SyahadahOfflineClient from "@/components/admin/syahadah-offline-client";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Template Syahadah Offline - Admin Panel",
};

export default async function SyahadahOfflinePage() {
  await requirePermission("data_syahadah");
  const programList = await getProgramCatalog();

  return (
    <div className="space-y-6 offline-print-reset">
      <div className="no-print flex flex-col gap-2">
        <h1 className="text-3xl font-black md:text-4xl">Template Syahadah Offline</h1>
        <p className="text-sm text-[var(--color-text-muted)] max-w-2xl">
          Atur template syahadah F4 portrait (215 × 330 mm) untuk kertas pre-printed:
          upload desain per program, geser posisi field dengan mouse atau tombol panah
          keyboard (Shift = 5× cepat), tampilkan nama mapel, nilai, &amp; QR, lalu
          kalibrasi offset printer dan kunci template.
        </p>
      </div>

      <SyahadahOfflineClient programs={programList as any} />
    </div>
  );
}
