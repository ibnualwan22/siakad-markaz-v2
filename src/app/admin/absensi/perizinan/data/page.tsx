import { Metadata } from "next";
import { getEffectivePermissions } from "@/lib/permission";
import PerizinanDataClient from "@/components/admin/perizinan-data-client";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Data Santri Izin - Admin Panel",
};

export default async function DataPerizinanPage() {
  const session = await getSession();
  
  const permissions = session
    ? await getEffectivePermissions(session.userId, session.role)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">
          Data Santri Izin
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Daftar santri yang sedang atau pernah mengajukan izin.
        </p>
      </div>

      <PerizinanDataClient permissions={permissions} />
    </div>
  );
}
