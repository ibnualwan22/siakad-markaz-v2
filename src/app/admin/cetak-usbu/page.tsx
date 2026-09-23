import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { CetakUsbuSelector } from "@/components/admin/cetak-usbu-selector";
import { requirePermission } from "@/lib/permission";
import { getSession } from "@/lib/auth";

export default async function CetakUsbuPage() {
  await requirePermission("cetak_nilai_pekanan");
  
  const session = await getSession();
  const isAdmin = session?.role === "ADMIN";
  const allowedKelasId = session?.kelasId ?? null;
  const isRestricted = !isAdmin && !!allowedKelasId;

  const kelasList = await prisma.kelas.findMany({
    where: isRestricted ? { id: allowedKelasId } : undefined,
    include: {
      program: true,
    },
    orderBy: [
      { program: { nama_indo: "asc" } },
      { nama: "asc" },
    ]
  });

  const dufahList = await prisma.dufah.findMany({
    orderBy: { usbu1StartDate: { sort: 'desc', nulls: 'last' } },
    select: { nama: true }
  });

  const riwayatGroups = await prisma.riwayatSantri.groupBy({
    by: ['dufahNama', 'kelasId'],
    where: { kelasId: { not: null } }
  });

  const riwayatMapping: Record<string, string[]> = {};
  for (const r of riwayatGroups) {
    if (r.kelasId) {
      if (!riwayatMapping[r.dufahNama]) riwayatMapping[r.dufahNama] = [];
      riwayatMapping[r.dufahNama].push(r.kelasId);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black ">Cetak Rapor Usbu'</h1>
          <p className="mt-2 text-[var(--color-text-muted)]">
            Pilih kelas dan fase Usbu' untuk mencetak Daftar Nilai Ujian Akhir Pekan.
          </p>
        </div>
      </div>

      <div className="rounded-[2.5rem] bg-white p-8 shadow-sm border border-[var(--color-surface-dark)]/60 w-full max-w-2xl">
        <CetakUsbuSelector 
          kelasList={kelasList.map(k => ({ id: k.id, nama: k.nama, programNama: k.program.nama_indo }))} 
          isRestricted={isRestricted}
          dufahList={dufahList.map(d => d.nama)}
          riwayatMapping={riwayatMapping}
        />
      </div>
    </div>
  );
}
