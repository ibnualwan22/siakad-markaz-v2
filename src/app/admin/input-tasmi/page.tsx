import { requirePermission, checkPermission } from "@/lib/permission";
import { getProgramCatalog } from "@/lib/app-data";
import { InputTasmiBulkClient } from "@/components/admin/input-tasmi-bulk-client";
import Link from "next/link";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function InputTasmiPage() {
  await requirePermission("input_tasmi");
  
  const session = await getSession();
  const isAdmin = session?.role === "ADMIN" || session?.role === "Administrator";
  const allowedKelasId = session?.kelasId ?? null;
  
  const hasEditPermission = await checkPermission("input_tasmi_edit");

  // Fetch full program list structure with mapels and kelas
  const programList = await getProgramCatalog();

  if (!isAdmin && !allowedKelasId) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-[var(--color-surface-dark)] min-h-[300px] text-center space-y-4">
        <div className="h-12 w-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 font-bold text-xl">!</div>
        <h3 className="text-xl font-bold text-[var(--color-text)]">Akses Kelas Belum Diatur</h3>
        <p className="text-sm text-[var(--color-text-muted)] max-w-sm leading-relaxed">
          Akun Anda belum dihubungkan dengan kelas manapun. Silakan hubungi Super Admin untuk mengatur penugasan kelas Anda.
        </p>
        <Link 
          href="/admin/dashboard" 
          className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-bold text-xs py-2 px-4 rounded-xl transition-colors"
        >
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

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
