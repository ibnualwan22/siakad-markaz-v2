import { getDashboardSantriRows } from "@/lib/app-data";
import { MartabahUlaClient } from "@/components/admin/martabah-ula-client";
import { Metadata } from "next";
import { requirePermission } from "@/lib/permission";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Martabah Ula - Admin Panel",
};

export default async function MartabahUlaPage() {
  await requirePermission("martabah_ula");
  const allRows = await getDashboardSantriRows();
  const santriRows = allRows.filter((santri: any) => santri.isAktif);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black md:text-4xl ">
          Martabah Ula
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] max-w-2xl">
          Pusat informasi kelulusan dengan predikat penghargaan Lulusan Terbaik (Martabah Ula) untuk setiap program pada Duf'ah berjalan.
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          <Link
            href="/admin/martabah-ula/cetak-bulk"
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-xs font-semibold text-amber-600 transition hover:bg-amber-100 hover:border-amber-300 shadow-sm"
          >
            Cetak Bulk Penghargaan
          </Link>
          <Link
            href="/admin/martabah-ula/cetak-bulk-cac"
            className="inline-flex items-center gap-1.5 rounded-lg bg-orange-50 border border-orange-200 px-4 py-2 text-xs font-semibold text-orange-700 transition hover:bg-orange-100 hover:border-orange-300 shadow-sm"
          >
            Cetak Bulk CAC
          </Link>
        </div>
      </div>

      <MartabahUlaClient santriRows={santriRows as any} />
    </div>
  );
}
