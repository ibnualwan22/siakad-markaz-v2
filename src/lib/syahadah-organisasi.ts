import prisma from "@/lib/prisma";

// Posisi + font + warna default syahadah Lajnah & OSIM.
// Nama: "The Season" warna #865b34; tanggal: Poppins hitam.
// Font dirujuk lewat nama family yang diatur di layout (tab Template & Layout):
// tampil bila font tersebut tersedia di browser (terinstal / webfont yang dipasang).
// Poppins sendiri ditarik dari Google Fonts oleh CetakTemplateClient.
export function defaultFieldPositionsOrganisasi() {
  return {
    nama: { x: 50, y: 40, fontSize: 44, align: "center", maxWidth: 80, fontFamily: "The Season", color: "#865b34" },
    periode: { x: 50, y: 54, fontSize: 28, align: "center", maxWidth: 80, fontFamily: "Poppins", color: "#000000" },
    tglCetak: { x: 50, y: 62, fontSize: 28, align: "center", maxWidth: 80, fontFamily: "Poppins", color: "#000000" },
  };
}

// Tanggal syahadah organisasi diambil dari data syahadah Markaz Arabiyah
// (tabel SyahadahTemplate, satu baris) — dipakai Lajnah maupun OSIM karena
// waktu mulai dan selesainya sama (keputusan user 27 Okt 2026).
// Format: rentang Indo persis seperti tersimpan, mis.
// "11 September 2026 – 05 Oktober 2026".
export async function getTanggalSyahadahOrganisasi(): Promise<{
  periode: string;
  tglCetak: string;
}> {
  const tpl = await prisma.syahadahTemplate.findFirst();
  const mulai = tpl?.tgl_mulai_indo || "";
  const selesai = tpl?.tgl_selesai_indo || "";
  const periode =
    mulai && selesai ? `${mulai} – ${selesai}` : mulai || selesai || "-";
  return { periode, tglCetak: tpl?.tgl_cetak_indo || "-" };
}
