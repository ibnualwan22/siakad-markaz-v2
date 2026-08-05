import { getCertificateData } from "@/lib/app-data";
import { getBaseUrl } from "@/lib/base-url";
import { notFound } from "next/navigation";
import { SyahadahEditor } from "@/components/syahadah-editor";
import { getMartabahCacLayout } from "@/lib/syahadah-layout";

export const dynamic = "force-dynamic";

export default async function CetakCacPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getCertificateData(id);

  if (!data) {
    notFound();
  }

  const baseUrl = await getBaseUrl();
  // Here, qr code goes to the special CAC verification page
  const qrUrl = `${baseUrl}/cac/${data.riwayatSantri?.id}`;

  const riwayatId = data.riwayatSantri?.id ?? null;
  const programId = data.program?.id ?? null;

  const layout = await getMartabahCacLayout();

  return (
    <SyahadahEditor
      qrUrl={qrUrl}
      data={data as any}
      initialLayout={layout}
      riwayatId={riwayatId}
      programId={programId}
      mode="per-santri"
      isMartabah={true}
      isCac={true}
      backHref="/admin/martabah-ula"
      backLabel="← Kembali ke Martabah Ula"
      titleLabel="Layout Editor — Sertifikat CAC"
      isTurats={false}
    />
  );
}
