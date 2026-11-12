import { Metadata } from "next";
import { requirePermission, getEffectivePermissions } from "@/lib/permission";
import { getMasterSantriList } from "@/lib/santri-api";
import PerizinanClient from "@/components/admin/perizinan-client";
import { getActiveRiwayatListForAbsen } from "@/lib/absensi";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Input Perizinan Santri - Admin Panel",
};

export default async function PerizinanPage() {
  const session = await getSession();
  
  // Ambil permission user, pastikan dia punya setidaknya 1 permission untuk tipe izin
  const permissions = session
    ? await getEffectivePermissions(session.userId, session.role)
    : [];

  const santriList = await getActiveRiwayatListForAbsen();
  
  // Untuk dropdown autocomplete
  const santriOptions = santriList.map(s => ({
    riwayatId: s.riwayatId,
    nama: s.nama,
    kelasNama: s.kelasNama,
    sakan: s.sakan
  }));

  const sakanList = Array.from(new Set(santriList.map(s => s.sakan).filter(s => s && s !== "-"))).sort();
  const kelasList = Array.from(new Set(santriList.map(s => s.kelasNama).filter(k => k))).sort();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">
          Input Perizinan Santri
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Pilih santri dan buat tasrih perizinan.
        </p>
      </div>

      <PerizinanClient 
        santriOptions={santriOptions} 
        sakanList={sakanList}
        kelasList={kelasList as string[]}
        permissions={permissions}
      />
    </div>
  );
}
