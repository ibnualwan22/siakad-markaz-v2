import { notFound, redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import CetakTemplateClient from "@/components/cetak/CetakTemplateClient";
import { formatJuzTeks, formatPeriodeArab, defaultFieldPositions } from "@/lib/nadi-hufadz";
import { defaultFieldPositions as defaultFieldPositionsTadrib, resolveTadribFununMinHadir, templateProgramKey } from "@/lib/tadrib-funun";
import { defaultFieldPositionsOrganisasi, getTanggalSyahadahOrganisasi } from "@/lib/syahadah-organisasi";
import { getAkbarnasMcPrintData } from "@/lib/akbarnas-mc-data";

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

  // --- Syahadah MC Akbarnas bulan 1 ---
  // pesertaId = id RiwayatSantri. Gerbang + isi dari helper bersama
  // (dipakai juga cetak bulk) — bukan gerbang kelulusan gabungan.
  if (programKey === "akbarnas-mc") {
    const hasPerm = await checkPermission("data_syahadah");
    if (!hasPerm) redirect("/login");

    const data = await getAkbarnasMcPrintData(pesertaId);
    if (!data) notFound();

    return <CetakTemplateClient programKey={programKey} data={data} showPngButton />;
  }

  // --- Tadrib Funun ---
  // programKey = "tadrib-funun-<jenisId>"; pesertaId = id TadribFununPeserta.
  // Syarat cetak: kehadiran >= minHadir jenisnya DAN syahadah sudah
  // diterbitkan admin. Isi: nama + tanggal periode saja.
  if (programKey.startsWith("tadrib-funun-")) {
    const hasPerm = await checkPermission("tadrib_funun");
    if (!hasPerm) redirect("/login");

    const peserta = await prisma.tadribFununPeserta.findUnique({
      where: { id: pesertaId },
      include: {
        santri: { select: { nama: true } },
        jenis: { select: { id: true, nama: true, minHadir: true } },
        hadir: { orderBy: { pertemuanKe: "asc" }, select: { tanggal: true } },
      },
    });
    if (!peserta) notFound();
    if (templateProgramKey(peserta.jenis.id) !== programKey) notFound();
    if (peserta.hadir.length < resolveTadribFununMinHadir(peserta.jenis.minHadir)) notFound();
    if (!peserta.syahadahDiterbitkanAt) notFound();

    const template = await prisma.templateCetak.findUnique({ where: { programKey } });

    const tglDari = peserta.hadir.length
      ? peserta.hadir[0].tanggal.toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const tglSampai = peserta.hadir.length
      ? peserta.hadir[peserta.hadir.length - 1].tanggal.toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    const data = {
      nama: peserta.santri.nama || "-",
      periode: formatPeriodeArab(tglDari, tglSampai),
      template: {
        backgroundUrl: template?.backgroundUrl || null,
        fieldPositions: (template?.fieldPositions as any) || defaultFieldPositionsTadrib(),
      },
    };

    return <CetakTemplateClient programKey={programKey} data={data} />;
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
