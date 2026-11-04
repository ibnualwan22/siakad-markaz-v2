import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import { getMunaqosahPrintData } from "@/lib/munaqosah-hufadz-data";
import CetakTemplateClient from "@/components/cetak/CetakTemplateClient";
import { PrintToolbar } from "@/components/print-toolbar";

export const dynamic = "force-dynamic";

// Cetak massal syahadah Munaqosah: ?ids=<id1>,<id2>,... — satu panggung
// per santri dalam satu dokumen F4 (bulkMode: tanpa @page sendiri).
export default async function CetakBulkMunaqosahPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const session = await getSession();
  const hasPerm = await checkPermission("huffadz");
  if (!session || !hasPerm) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <p className="text-slate-600">Tidak diizinkan melihat halaman ini.</p>
      </div>
    );
  }

  const { ids } = await searchParams;
  const idList = (ids || "").split(",").map((s) => s.trim()).filter(Boolean);
  const dataList = (
    await Promise.all(idList.map((id) => getMunaqosahPrintData(id)))
  ).filter(Boolean);

  if (dataList.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-slate-800">Tidak ada santri</h1>
          <p className="mt-2 text-slate-600">Pilih dulu santri yang sudah munaqosah di halaman Munaqosah Hufadz, lalu tekan Cetak Massal.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        html, body { margin: 0; padding: 0; background: #94a3b8; }
        @media print {
          html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
          @page { size: 330mm 210mm; margin: 0; }
        }
      `}</style>

      <div className="min-h-screen bg-slate-300 px-4 py-8 print:bg-white print:p-0">
        <PrintToolbar backHref="/admin/munaqosah-hufadz" backLabel="Kembali ke Munaqosah Hufadz" />

        <div className="flex flex-col items-center gap-10 print:gap-0">
          {dataList.map((data) => (
            <div key={data!.id} className="w-full print:break-after-page">
              <CetakTemplateClient programKey="munaqosah-hufadz" data={data as any} bulkMode />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
