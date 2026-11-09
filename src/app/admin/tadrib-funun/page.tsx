import { getDashboardSantriRows } from "@/lib/app-data";
import { getActiveDufahName } from "@/lib/absensi";
import { checkPermission } from "@/lib/permission";
import TadribFununClient from "@/components/admin/tadrib-funun-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tadrib Funun - Admin Panel",
};

export default async function TadribFununPage() {
  const canEdit = await checkPermission("tadrib_funun_edit");
  const dufahAktif = (await getActiveDufahName()) || "";
  const allRows = await getDashboardSantriRows();
  const santriAktif = allRows
    .filter((s: any) => s.isAktif)
    .map((s: any) => ({ id: s.id, nama: s.nama || "-" }))
    .sort((a: any, b: any) => a.nama.localeCompare(b.nama));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black md:text-4xl">Tadrib Funun</h1>
        <p className="text-sm text-[var(--color-text-muted)] max-w-2xl">
          Kelola jenis ekstrakurikuler, pendaftaran, absen, penerbitan, dan
          cetak syahadah Tadrib Funun.
          {dufahAktif && (
            <>
              {" "}Dufah aktif: <span className="font-bold">{dufahAktif}</span>
            </>
          )}
        </p>
      </div>
      <TadribFununClient dufahAktif={dufahAktif} santriAktif={santriAktif} canEdit={canEdit} />
    </div>
  );
}
