import { getDashboardSantriRows } from "@/lib/app-data";
import { getActiveDufahName } from "@/lib/absensi";
import { checkPermission } from "@/lib/permission";
import NadiHufadzClient from "@/components/admin/nadi-hufadz-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Nadi Hufadz - Admin Panel",
};

export default async function NadiHufadzPage() {
  const canEdit = await checkPermission("nadi_hufadz_edit");
  const dufahAktif = (await getActiveDufahName()) || "";
  const allRows = await getDashboardSantriRows();
  const santriAktif = allRows
    .filter((s: any) => s.isAktif)
    .map((s: any) => ({ id: s.id, nama: s.nama || "-" }))
    .sort((a: any, b: any) => a.nama.localeCompare(b.nama));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black md:text-4xl">Nadi Hufadz</h1>
        <p className="text-sm text-[var(--color-text-muted)] max-w-2xl">
          Kelola peserta, setoran harian, tasmi&apos;, template, dan cetak syahadah Nadi Hufadz.
          {dufahAktif && (
            <>
              {" "}Dufah aktif: <span className="font-bold">{dufahAktif}</span>
            </>
          )}
        </p>
      </div>
      <NadiHufadzClient dufahAktif={dufahAktif} santriAktif={santriAktif} canEdit={canEdit} />
    </div>
  );
}
