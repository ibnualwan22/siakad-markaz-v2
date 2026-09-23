import { getRiwayatSantriRows } from "@/lib/app-data";
import { RiwayatClient } from "@/components/admin/riwayat-client";
import { Metadata } from "next";
import { requirePermission } from "@/lib/permission";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Riwayat Santri - Admin Panel",
};

export default async function RiwayatPage(props: { searchParams: Promise<{ dufah?: string }> }) {
  await requirePermission("riwayat_santri");
  const { dufah } = await props.searchParams;

  const dufahList = await prisma.dufah.findMany({
    orderBy: { usbu1StartDate: { sort: 'desc', nulls: 'last' } },
    select: { nama: true }
  });

  const santriGroups = dufah ? await getRiwayatSantriRows(dufah) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black md:text-4xl ">
          Riwayat Santri
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] max-w-2xl">
          Arsip data santri tidak aktif terdahulu. Anda masih bisa melihat nilai dan mencetak syahadah (sertifikat) mereka.
        </p>
      </div>

      <RiwayatClient santriGroups={santriGroups} dufahList={dufahList.map(d => d.nama)} initialDufah={dufah} />
    </div>
  );
}
