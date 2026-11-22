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
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black md:text-4xl">Template Syahadah Offline</h1>
        <p className="text-sm text-[var(--color-text-muted)] max-w-2xl">
          Atur template syahadah A4 portrait untuk kertas pre-printed: upload desain
          Canva per program, geser posisi field (kolom nilai mengikuti mapel yang
          tampil di syahadah), lalu kalibrasi offset printer dan kunci template.
          Desain lama (yang tampil di riwayat santri) tidak berubah.
        </p>
      </div>

      <SyahadahOfflineClient programs={programList as any} />
    </div>
  );
}
