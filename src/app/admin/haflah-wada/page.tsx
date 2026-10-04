import { requirePermission } from "@/lib/permission";
import { getDashboardSantriRows } from "@/lib/app-data";
import { getActiveDufahName } from "@/lib/absensi";
import prisma from "@/lib/prisma";
import { HaflahWadaClient } from "@/components/admin/haflah-wada-client";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Haflah Wada' - Admin Panel",
};

export default async function HaflahWadaPage() {
  await requirePermission("haflah_wada");

  const [santriRows, kelasList, activeDufahName] = await Promise.all([
    getDashboardSantriRows(),
    prisma.kelas.findMany({
      include: {
        waliKelas: true,
      }
    }),
    getActiveDufahName()
  ]);

  const dufahLabel = activeDufahName ?? "Aktif";

  // Fetch all active santri inside graduating programs, including those who failed or haven't completed (TIDAK_LULUS).
  // Santri yang sudah checkout tidak ditampilkan di denah maupun susunan barisan.
  const eligibleRows = santriRows.filter((santri: any) =>
    santri.isAktif && !santri.isCheckedOut && santri.programId
  );

  return (
    <div className="space-y-6 print:space-y-0">
      <div className="flex flex-col gap-2 print:hidden">
        <h1 className="text-3xl font-black md:text-4xl ">
          Haflah Wada'
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] max-w-2xl">
          Manajemen denah tempat duduk dan urutan pemanggilan santri pada acara Haflah Wada'.
        </p>
      </div>

      <HaflahWadaClient 
        santriRows={eligibleRows} 
        kelasList={kelasList}
        dufahLabel={dufahLabel}
      />
    </div>
  );
}
