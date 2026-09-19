import { requirePermission } from "@/lib/permission";
import { getDashboardSantriRows, getProgramCatalog } from "@/lib/app-data";
import { DashboardCharts } from "@/components/admin/dashboard-charts";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard Grafik - Admin Panel",
};

export default async function DashboardPage() {
  await requirePermission("dashboard");
  const [santriRows, programList] = await Promise.all([
    getDashboardSantriRows(),
    getProgramCatalog(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black md:text-4xl " style={{ color: "var(--color-text)" }}>
          Dashboard Utama
        </h1>
        <p className="text-sm max-w-2xl" style={{ color: "var(--color-text-muted)" }}>
          Visualisasi ringkas dari distribusi data santri Markaz Arabiyah berdasarkan kelas utama dan rombongan belajar.
        </p>
      </div>

      <DashboardCharts santriRows={santriRows} programList={programList} />
    </div>
  );
}
