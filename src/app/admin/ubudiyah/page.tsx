import { getMasterSantriList } from "@/lib/santri-api";
import { getActiveDufahName } from "@/lib/absensi";
import { checkPermission } from "@/lib/permission";
import UbudiyahClient from "@/components/admin/ubudiyah-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ubudiyah - Admin Panel",
};

export default async function UbudiyahPage() {
  const canEdit = await checkPermission("ubudiyah_edit");
  const dufahAktif = (await getActiveDufahName()) || "";
  // Daftar santri aktif beserta sakannya — dipakai pemilih santri Qism
  // (pola yang sama seperti tab Peserta Tadrib Funun: daftar santri
  // dioper sebagai props dari page, bukan di-fetch client).
  // getMasterSantriList sudah hanya mengembalikan santri aktif
  // (isAktif, sakan != "-") terurut nama.
  const masterSantri = await getMasterSantriList();
  const santriAktif = masterSantri
    .filter((s) => s.isAktif)
    .map((s) => ({ id: s.id, nama: s.nama || "-", sakan: s.sakan || "-" }))
    .sort((a, b) => a.nama.localeCompare(b.nama, "id"));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black md:text-4xl">Ubudiyah</h1>
        <p className="text-sm text-[var(--color-text-muted)] max-w-2xl">
          Kelola Qism Ubudiyah per sakan dan rekap absensi kegiatan wajib
          berjamaah (Subuh, Maghrib, Isya, Halaqoh).
          {dufahAktif && (
            <>
              {" "}Dufah aktif: <span className="font-bold">{dufahAktif}</span>
            </>
          )}
        </p>
      </div>
      <UbudiyahClient dufahAktif={dufahAktif} santriAktif={santriAktif} canEdit={canEdit} />
    </div>
  );
}
