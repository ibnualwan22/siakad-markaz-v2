import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/permission";
import AkbarnasMcClient from "@/components/admin/akbarnas-mc-client";
import { defaultFieldPositionsAkbarnasMc } from "@/lib/akbarnas-mc";

export const dynamic = "force-dynamic";

// Halaman ini HANYA editor layout syahadah MC Akbarnas bulan 1.
// Daftar & pencetakan ada di Data Syahadah (/admin/syahadah): di sana,
// baris Akbarnas bulan pertama yang nilai MC-nya terisi mendapat tombol
// cetak yang membuka syahadah MC, dan ikut terhitung di cetak bulk.
export default async function AkbarnasMcAdminPage() {
  await requirePermission("data_syahadah");

  const template = await prisma.templateCetak.findUnique({
    where: { programKey: "akbarnas-mc" },
  });
  const syahadahTemplate = await prisma.syahadahTemplate.findFirst();

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Layout Syahadah MC Akbarnas</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Atur posisi & ukuran field syahadah MC bulan 1 di sini. Pencetakannya
          lewat Data Syahadah (per santri maupun bulk).
        </p>
      </div>
      <AkbarnasMcClient
        namaMudir={syahadahTemplate?.nama_mudir_arab || "اسم المدير"}
        initialBg={template?.backgroundUrl || "/images/syahadah-bg.png"}
        initialPositions={
          (template?.fieldPositions as any) || defaultFieldPositionsAkbarnasMc()
        }
      />
    </div>
  );
}
