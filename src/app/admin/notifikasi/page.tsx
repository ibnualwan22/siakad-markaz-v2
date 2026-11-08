import { requirePermission } from "@/lib/permission";
import { NotifikasiClient } from "@/components/admin/notifikasi-client";

export const dynamic = "force-dynamic";

export default async function NotifikasiPage() {
  await requirePermission("notifikasi_kelola");

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)] tracking-tight">Notifikasi Pengumuman</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Jadwal pengumuman berkala ke santri — arsip inbox, FCM aplikasi, dan web push portal.</p>
        </div>
      </div>

      <NotifikasiClient />
    </div>
  );
}
