import { notFound, redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import CetakTemplateClient from "@/components/cetak/CetakTemplateClient";
import { formatJuzTeks, formatPeriodeArab, defaultFieldPositions } from "@/lib/nadi-hufadz";
import { defaultFieldPositionsOrganisasi, getTanggalSyahadahOrganisasi } from "@/lib/syahadah-organisasi";

export const dynamic = "force-dynamic";

/**
 * Halaman cetak generik berbasis template.
 * Dipakai Nadi Hufadz & program lain ke depan.
 * Contoh: /cetak-template/nadi-hufadz/<pesertaId>
 * Syahadah organisasi: /cetak-template/lajnah/<anggotaId>,
 * /cetak-template/osim/<anggotaId> (satu syahadah per baris anggota,
 * jadi semua periode keanggotaan bisa dicetak).
 */
export default async function CetakTemplatePage({
  params,
}: {
  params: Promise<{ programKey: string; pesertaId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { programKey, pesertaId } = await params;

  // --- Syahadah Lajnah / OSIM ---
  if (programKey === "lajnah" || programKey === "osim") {
    const perm = programKey === "lajnah" ? "lajnah_syahadah" : "osim_syahadah";
    const hasPerm = await checkPermission(perm);
    if (!hasPerm) redirect("/login");

    const anggota =
      programKey === "lajnah"
        ? await prisma.anggotaLajnah.findUnique({
            where: { id: pesertaId },
            include: { santri: { select: { nama: true } } },
          })
        : await prisma.anggotaOsim.findUnique({
            where: { id: pesertaId },
            include: { santri: { select: { nama: true } } },
          });
    if (!anggota) notFound();

    const template = await prisma.templateCetak.findUnique({ where: { programKey } });
    const { periode, tglCetak } = await getTanggalSyahadahOrganisasi();

    const data = {
      nama: anggota.santri.nama || "-",
      periode,
      tglCetak,
      template: {
        backgroundUrl: template?.backgroundUrl || null,
        fieldPositions: (template?.fieldPositions as any) || defaultFieldPositionsOrganisasi(),
      },
    };

    return <CetakTemplateClient programKey={programKey} data={data} showPngButton />;
  }

  // --- Nadi Hufadz (tidak diubah) ---
  const hasPerm = await checkPermission("nadi_hufadz");
  if (!hasPerm) redirect("/login");

  const peserta = await prisma.nadiHufadzPeserta.findUnique({
    where: { id: pesertaId },
    include: {
      santri: { select: { nama: true } },
      setoran: { orderBy: { pertemuanKe: "asc" }, select: { tanggal: true } },
      tasmi: true,
    },
  });
  if (!peserta || !peserta.tasmi) notFound();

  const template = await prisma.templateCetak.findUnique({ where: { programKey } });

  const tglDari = peserta.setoran.length
    ? peserta.setoran[0].tanggal.toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const tglSampai = peserta.tasmi.tanggal.toISOString().slice(0, 10);

  const data = {
    nama: peserta.santri.nama || "-",
    juz: formatJuzTeks(peserta.tasmi.juzTeks),
    predikat: peserta.tasmi.predikat,
    periode: formatPeriodeArab(tglDari, tglSampai),
    template: {
      backgroundUrl: template?.backgroundUrl || null,
      fieldPositions: (template?.fieldPositions as any) || defaultFieldPositions(),
    },
  };

  return <CetakTemplateClient programKey={programKey} data={data} />;
}
