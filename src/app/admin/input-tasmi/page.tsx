import { requirePermission, checkPermission } from "@/lib/permission";
import { getProgramCatalog } from "@/lib/app-data";
import { InputTasmiBulkClient } from "@/components/admin/input-tasmi-bulk-client";
import Link from "next/link";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function InputTasmiPage() {
  await requirePermission("input_tasmi");
  
  const session = await getSession();
  const isAdmin = true; // Forced to true to make access global across all classes for authorized users
  const allowedKelasId = session?.kelasId ?? null;
  
  const hasEditPermission = await checkPermission("input_tasmi_edit");

  // Fetch full program list structure with mapels and kelas
  const programList = await getProgramCatalog();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[var(--color-primary)]">
            Divisi Syahadah
          </p>
          <h2 className="mt-2 text-3xl font-bold text-[var(--color-text)]">Input Tasmi' (Bulk)</h2>
        </div>
        <Link
          href="/admin/dashboard"
          className="rounded-full border border-[var(--color-surface-dark)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-text)] transition hover:border-slate-300 hover:bg-[var(--color-secondary)]"
        >
          Kembali ke Dashboard
        </Link>
      </div>

      <InputTasmiBulkClient
        programList={programList as any}
        allowedKelasId={allowedKelasId}
        isAdmin={isAdmin}
        hasEditPermission={hasEditPermission}
      />
    </div>
  );
}
