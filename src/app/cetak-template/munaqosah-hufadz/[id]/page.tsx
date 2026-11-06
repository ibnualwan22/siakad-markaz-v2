import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import { getMunaqosahPrintData } from "@/lib/munaqosah-hufadz-data";
import CetakTemplateClient from "@/components/cetak/CetakTemplateClient";

export const dynamic = "force-dynamic";

export default async function CetakMunaqosahPage({
  params,
}: {
  params: Promise<{ id: string }>;
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

  const { id } = await params;
  const data = await getMunaqosahPrintData(id);
  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <p className="text-slate-600">Data munaqosah tidak ditemukan.</p>
      </div>
    );
  }

  return (
    <CetakTemplateClient
      programKey="munaqosah-hufadz"
      data={data as any}
      showPngButton
    />
  );
}
