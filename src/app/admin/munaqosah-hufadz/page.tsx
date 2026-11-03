import { getActiveDufahName } from "@/lib/absensi";
import { checkPermission } from "@/lib/permission";
import MunaqosahHufadzClient from "@/components/admin/munaqosah-hufadz-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Munaqosah Hufadz - Admin Panel",
};

export default async function MunaqosahHufadzPage() {
  const canEdit = await checkPermission("nadi_hufadz_edit");
  const dufahAktif = (await getActiveDufahName()) || "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black md:text-4xl">Munaqosah Hufadz</h1>
        <p className="text-sm text-[var(--color-text-muted)] max-w-2xl">
          Kelola nilai munaqosah santri Hufadz (5 kolom, rata-rata otomatis),
          template, dan cetak syahadah Hufadz — per santri maupun massal.
          {dufahAktif && (
            <>
              {" "}Dufah aktif: <span className="font-bold">{dufahAktif}</span>
            </>
          )}
        </p>
      </div>
      <MunaqosahHufadzClient dufahAktif={dufahAktif} canEdit={canEdit} />
    </div>
  );
}
