import { getDashboardSantriRows, getCertificateData } from "@/lib/app-data";
import { getBaseUrl } from "@/lib/base-url";
import { getMartabahLayout } from "@/lib/syahadah-layout";
import { SyahadahMartabahDocument } from "@/components/syahadah-martabah-document";
import { SyahadahMartabahTuratsDocument } from "@/components/syahadah-martabah-turats-document";
import { PrintToolbar } from "@/components/print-toolbar";
import { requirePermission } from "@/lib/permission";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cetak Bulk Martabah Ula - Admin Panel",
};

// Cetak bulk Sertifikat Penghargaan (Martabah Ula), print-only tanpa editor.
// Cakupan = daftar Martabah Ula yang sama seperti halaman daftar: 1 santri
// teratas per program (lulus, rata-rata tertinggi), semua seksi sekaligus,
// diurutkan per nama program. Logika seleksi ini cerminan computeMartabahUla
// di martabah-ula-client.tsx (program berkategori sama selalu satu seksi,
// sehingga top-per-program per seksi = top-per-program global).
// Dokumen + layout + QR persis seperti cetak satuan per santri.
export default async function CetakBulkMartabahPage() {
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
        if (!data) return null;
        const isTurats = (data.program as any)?.kategori === "TURATS";
        const layout = await getMartabahLayout(isTurats);
        const qrUrl = `${baseUrl}/ijazah/${santri.id}`;
        return { id: santri.id, data, layout, isTurats, qrUrl };
      })
    )
  ).filter((x): x is NonNullable<typeof x> => x !== null);

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
          {items.map((item) =>
            item.isTurats ? (
              <SyahadahMartabahTuratsDocument
                key={item.id}
                qrUrl={item.qrUrl}
                data={item.data as any}
                layout={item.layout}
              />
            ) : (
              <SyahadahMartabahDocument
                key={item.id}
                qrUrl={item.qrUrl}
                data={item.data as any}
                layout={item.layout}
              />
            )
          )}
        </div>
      </div>
    </>
  );
}
