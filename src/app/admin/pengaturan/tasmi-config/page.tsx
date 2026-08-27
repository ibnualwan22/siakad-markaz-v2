import { requirePermission } from "@/lib/permission";
import { getProgramCatalog } from "@/lib/app-data";
import { TasmiConfigForm } from "@/components/admin/tasmi-config-form";
import Link from "next/link";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TasmiConfigPage() {
  await requirePermission("tasmi_config");

  const programList = await getProgramCatalog();
  const existingConfig = await prisma.tasmiConfig.findMany();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[var(--color-primary)]">
            Pengaturan
          </p>
          <h2 className="mt-2 text-3xl font-bold text-[var(--color-text)]">Konfigurasi Tasmi'</h2>
        </div>
        <Link
          href="/admin/dashboard"
          className="rounded-full border border-[var(--color-surface-dark)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-text)] transition hover:border-slate-300 hover:bg-[var(--color-secondary)]"
        >
          Kembali ke Dashboard
        </Link>
      </div>

      <TasmiConfigForm programList={programList as any} existingConfig={existingConfig} />
    </div>
  );
}
