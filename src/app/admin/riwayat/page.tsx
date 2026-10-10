import { getRiwayatSantriList } from "@/lib/app-data";
import { RiwayatClient } from "@/components/admin/riwayat-client";
import { Metadata } from "next";
import { requirePermission } from "@/lib/permission";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Riwayat Santri - Admin Panel",
};

export default async function RiwayatPage(props: { searchParams: Promise<{ dufah?: string; status?: string; program?: string; q?: string }> }) {
  await requirePermission("riwayat_santri");
  const { dufah, status, program, q } = await props.searchParams;

  const [dufahList, programList] = await Promise.all([
    prisma.dufah.findMany({
      orderBy: { usbu1StartDate: { sort: 'desc', nulls: 'last' } },
      select: { nama: true }
    }),
    prisma.program.findMany({
      orderBy: { nama_indo: 'asc' },
      select: { id: true, nama_indo: true }
    }),
  ]);

  const santriList = dufah
    ? await getRiwayatSantriList(dufah, {
        status: status || "all",
        programId: program || "",
        search: q || "",
      })
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black md:text-4xl ">
          Riwayat Santri
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] max-w-2xl">
          Arsip data santri per dufah. Anda masih bisa melihat nilai dan mencetak syahadah (sertifikat) mereka.
        </p>
      </div>

      <RiwayatClient
        santriList={santriList}
        dufahList={dufahList.map(d => d.nama)}
        programList={programList}
        initialDufah={dufah}
        initialStatus={status || "all"}
        initialProgram={program || ""}
        initialQuery={q || ""}
      />
    </div>
  );
}
