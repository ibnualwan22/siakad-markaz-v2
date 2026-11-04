import { getDashboardSantriRows, getCertificateData } from "@/lib/app-data";
import { getBaseUrl } from "@/lib/base-url";
import { getMartabahCacLayout } from "@/lib/syahadah-layout";
import { SyahadahCacDocument } from "@/components/syahadah-cac-document";
import { PrintToolbar } from "@/components/print-toolbar";
import { requirePermission } from "@/lib/permission";
import prisma from "@/lib/prisma";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cetak Bulk CAC - Admin Panel",
};

// Cetak bulk Sertifikat CAC, print-only tanpa editor.
// Cakupan sama seperti bulk Penghargaan: 1 santri teratas per program
// (lulus, rata-rata tertinggi), semua seksi sekaligus, urut per nama program.
// Dokumen + layout + QR persis seperti cetak satuan per santri
// (QR -> halaman verifikasi /cac/[riwayatId]).
//
// Nomor seri: dokumen CAC mengambil serinya sendiri lewat API
// /api/admin/cac-serial (idempotent per riwayatId, urutan per tahun).
// Halaman bulk ini PRA-ASSIGN nomor seri secara SEKUENSIAL (satu per satu,
// bukan paralel) sebelum render — karena API membaca nomor terakhir lalu
// membuat berikutnya, pemanggilan paralel akan race pada nomor urut.
// Buka ulang halaman memakai ulang nomor yang sama (findUnique per riwayatId),
// jadi pra-assign idempotent; membuka halaman = mengambil nomor, sama
// seperti membuka cetak satuan CAC.
export default async function CetakBulkCacPage() {
  await requirePermission("martabah_ula");
  const baseUrl = await getBaseUrl();

  const allRows = await getDashboardSantriRows();
  const completed = allRows.filter(
    (s: any) => s.isAktif && s.canViewIjazah && s.statusKelulusan !== "TIDAK_LULUS"
  );

  const byProgram = new Map<string, any[]>();
  for (const santri of completed) {
    const pid = santri.programId ?? "unknown";
    if (!byProgram.has(pid)) byProgram.set(pid, []);
    byProgram.get(pid)!.push(santri);
  }

  const tops: any[] = [];
  for (const students of byProgram.values()) {
    students.sort((a: any, b: any) => b.average - a.average);
    if (students.length > 0) tops.push(students[0]);
  }
  tops.sort((a: any, b: any) =>
    (a.programNama ?? "").localeCompare(b.programNama ?? "", "id")
  );

  if (tops.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-slate-800">Tidak ada santri</h1>
          <p className="mt-2 text-slate-600">
            Belum ada lulusan Martabah Ula. Pastikan Usbu&apos; Nihai sudah terisi untuk semua mapel.
          </p>
        </div>
      </div>
    );
  }

  const items = (
    await Promise.all(
      tops.map(async (santri) => {
        const data = await getCertificateData(santri.id);
        if (!data || !data.riwayatSantri?.id) return null;
        const qrUrl = `${baseUrl}/cac/${data.riwayatSantri.id}`;
        return { id: santri.id, data, qrUrl };
      })
    )
  ).filter((x): x is NonNullable<typeof x> => x !== null);

  // Pra-assign nomor seri CAC secara sekuensial (logika sama seperti
  // /api/admin/cac-serial). WAJIB sekuensial: jangan Promise.all di sini.
  const templateConfig = await prisma.syahadahTemplate.findFirst({
    orderBy: { id: "asc" },
  });
  let tahunCetak = new Date().getFullYear();
  if (templateConfig?.tgl_cetak_indo) {
    const match = templateConfig.tgl_cetak_indo.match(/\d{4}/);
    if (match) tahunCetak = parseInt(match[0], 10);
  }
  for (const item of items) {
    const riwayatId = item.data.riwayatSantri.id;
    const existing = await prisma.syahadahCacRecord.findUnique({
      where: { riwayatId },
    });
    if (existing) continue;
    await prisma.$transaction(async (tx) => {
      const checkEx = await tx.syahadahCacRecord.findUnique({
        where: { riwayatId },
      });
      if (checkEx) return checkEx;
      const lastRecord = await tx.syahadahCacRecord.findFirst({
        where: { tahunCetak },
        orderBy: { urutan: "desc" },
      });
      const nextUrutan = lastRecord ? lastRecord.urutan + 1 : 1;
      const serialNumber = `No.:C.AC/MA/${tahunCetak}/${String(nextUrutan).padStart(4, "0")}`;
      return tx.syahadahCacRecord.create({
        data: { riwayatId, serialNumber, tahunCetak, urutan: nextUrutan },
      });
    });
  }

  const layout = await getMartabahCacLayout();

  return (
    <>
      <style>{`
        html, body { margin: 0; padding: 0; background: #94a3b8; }
        @media print {
          html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
          @page { size: 330mm 215mm; landscape; margin: 0; }
        }
      `}</style>

      <div className="min-h-screen bg-slate-300 px-4 py-8 print:bg-white print:p-0">
        <PrintToolbar backHref="/admin/martabah-ula" backLabel="Kembali ke Martabah Ula" />

        <div className="flex flex-col items-center gap-10 print:gap-0">
          {items.map((item) => (
            <SyahadahCacDocument
              key={item.id}
              qrUrl={item.qrUrl}
              data={item.data as any}
              layout={layout}
            />
          ))}
        </div>
      </div>
    </>
  );
}
