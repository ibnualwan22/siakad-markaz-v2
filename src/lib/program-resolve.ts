// Pemetaan program PPDB -> program Siakad (dipakai sync-santri & webhook PPDB).
//
// Urutan prioritas pencocokan:
//   1. `siakadProgramNama` eksplisit dari Master Program PPDB (sumber kebenaran utama)
//   2. `progName` persis atau lewat kamus alias aman (mengatasi beda ejaan seperti
//      "Markaz Huffadz" -> "Hufadz", "Program Arabic Camp 1/2/3" -> "Arabic Boot Camp",
//      "Program Atha" -> "Atha", "Akbarnas Bulan Ke 2" -> "Akbarnas", "Syarqi Tsany" -> "Syarqi Tsani")
//   3. `kategoriProgram` (menormalisasi "TUROTS" -> "TURATS"), HANYA bila tepat satu
//      program Siakad berkategori itu (mis. HUFADZ unik).

export type ProgramRef = { id: string; nama_indo: string; kategori: string };

const PPDB_TO_SIAKAD_ALIASES: Record<string, string> = {
  "markaz huffadz": "hufadz",
  "akbarnas bulan ke 2": "akbarnas",
  "program arabic camp 1": "arabic boot camp",
  "program arabic camp 2": "arabic boot camp",
  "program arabic camp 3": "arabic boot camp",
  "program atha": "atha",
  "program atha (non asrama)": "atha",
  "syarqi tsany": "syarqi tsani",
};

function normalizeKategori(raw?: string | null): string {
  const k = (raw || "").toUpperCase().trim();
  if (k === "TUROTS") return "TURATS";
  return k;
}

export function buildProgramMaps(programs: ProgramRef[]) {
  const byName = new Map<string, string>();
  const kategoriCount = new Map<string, number>();
  for (const p of programs) {
    byName.set(p.nama_indo.toLowerCase().trim(), p.id);
    const k = normalizeKategori(p.kategori);
    if (k) kategoriCount.set(k, (kategoriCount.get(k) || 0) + 1);
  }
  const byUniqueKategori = new Map<string, string>();
  for (const p of programs) {
    const k = normalizeKategori(p.kategori);
    if (k && kategoriCount.get(k) === 1) byUniqueKategori.set(k, p.id);
  }
  return { byName, byUniqueKategori };
}

export function resolveProgramSiakad(
  maps: { byName: Map<string, string>; byUniqueKategori: Map<string, string> },
  progName: string | null | undefined,
  kategoriProgram: string | null | undefined,
  siakadProgramNama?: string | null | undefined,
): string | undefined {
  // 1. Mapping eksplisit dari PPDB
  if (siakadProgramNama && typeof siakadProgramNama === "string") {
    const exact = maps.byName.get(siakadProgramNama.toLowerCase().trim());
    if (exact) return exact;
  }

  // 2. Nama program persis atau lewat kamus alias aman
  if (progName && typeof progName === "string") {
    const norm = progName.toLowerCase().trim();
    const byName = maps.byName.get(norm);
    if (byName) return byName;

    const alias = PPDB_TO_SIAKAD_ALIASES[norm];
    if (alias) {
      const byAlias = maps.byName.get(alias);
      if (byAlias) return byAlias;
    }
  }

  // 3. Fallback kategori (HANYA jika unik, mis. HUFADZ)
  if (kategoriProgram && typeof kategoriProgram === "string") {
    const k = normalizeKategori(kategoriProgram);
    return maps.byUniqueKategori.get(k);
  }

  return undefined;
}
