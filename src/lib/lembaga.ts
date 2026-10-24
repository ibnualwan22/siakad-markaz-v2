// Pemetaan lembaga (Markaz Arabiyah / Turats / Hufadz) untuk filter & label periode.
// Satu-satunya sumber kebenaran untuk istilah + nomor periode berjalan.
// SEMENTARA: nomor berjalan diisi manual di sini (Duf'ah 94, Marhalah 5, Nukhbah 1).
// Saat Bawwabah mengambil alih pergantian periode, ganti sumber data ini saja;
// semua tampilan (filter, label santri, dashboard) tidak perlu diubah.

export type LembagaId = "ARABIYAH" | "TURATS" | "HUFADZ";

export const LEMBAGA_LIST: {
  id: LembagaId;
  label: string;
  term: string;
  current: number;
}[] = [
  { id: "ARABIYAH", label: "Markaz Arabiyah", term: "Duf'ah", current: 94 },
  { id: "TURATS", label: "Markaz Turats", term: "Marhalah", current: 5 },
  { id: "HUFADZ", label: "Markaz Hufadz", term: "Nukhbah", current: 1 },
];

// Program.kategori -> lembaga. Nilai selain TURATS/HUFADZ (REGULER, USBUAIN,
// null) mengikuti konvensi lama: default REGULER = Markaz Arabiyah.
export function lembagaFromProgramKategori(kategori?: string | null): LembagaId {
  if (kategori === "TURATS") return "TURATS";
  if (kategori === "HUFADZ") return "HUFADZ";
  return "ARABIYAH";
}

export function lembagaLabel(id: LembagaId): string {
  return LEMBAGA_LIST.find((l) => l.id === id)?.label ?? "Markaz Arabiyah";
}

// Label periode berjalan untuk satu lembaga, mis. "Marhalah 5".
export function lembagaPeriodeLabel(id: LembagaId): string {
  const l = LEMBAGA_LIST.find((x) => x.id === id);
  if (!l) return "";
  return `${l.term} ${l.current}`;
}

// Label periode untuk satu baris santri: bila riwayatnya adalah dufah aktif,
// tampilkan istilah lembaganya; bila riwayat lama, tampilkan nama dufah apa adanya
// (tidak ditebak konversinya).
export function santriPeriodeLabel(
  lembagaId: LembagaId,
  dufahNama: string | null | undefined,
  activeDufahName: string | null | undefined
): string {
  if (dufahNama && activeDufahName && dufahNama === activeDufahName) {
    return lembagaPeriodeLabel(lembagaId);
  }
  return dufahNama ?? "-";
}

export const LEMBAGA_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "SEMUA", label: "Semua Lembaga" },
  ...LEMBAGA_LIST.map((l) => ({ value: l.id, label: l.label })),
];
