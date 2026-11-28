import { requirePermission } from "@/lib/permission";
import { getProgramCatalog } from "@/lib/app-data";
import { KelasClient } from "@/components/admin/kelas-client";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Daftar Nama Kelas - Admin Panel",
};

export default async function NamaKelasPage() {
  await requirePermission("ruang_kelas");
  const programList = await getProgramCatalog({ includeInactiveKelas: true });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-black md:text-4xl ">
            Manajemen Nama Kelas
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Kelola nama ruangan atau sub-kelas (contoh: Shifr A, Shifr B) yang menginduk ke Kelas utama.
          </p>
        </div>
      </div>

      <KelasClient programList={programList} />
    </div>
  );
}
