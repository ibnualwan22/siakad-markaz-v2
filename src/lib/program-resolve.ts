// Pemetaan program PPDB -> program Siakad (dipakai sync-santri).
//
// PPDB mengirim program sebagai NAMA string (programAktif) + kategori
// (kategoriProgram). Nama PPDB tidak selalu sama dengan nama Siakad
// (mis. PPDB "Markaz Huffadz" vs Siakad "Hufadz") — karena itu pencocokan
// nama saja bisa gagal dan riwayat santri tercipta tanpa program.
// Fallback: kategoriProgram, tapi HANYA bila tepat satu program Siakad
// berkategori itu (HUFADZ unik; TURATS dan REGULER punya banyak program
// jadi tidak ditebak).

export type ProgramRef = { id: string; nama_indo: string; kategori: string };

export function buildProgramMaps(programs: ProgramRef[]) {
  const byName = new Map<string, string>();
  const kategoriCount = new Map<string, number>();
  for (const p of programs) {
    byName.set(p.nama_indo.toLowerCase().trim(), p.id);
    const k = p.kategori.toUpperCase().trim();
    if (k) kategoriCount.set(k, (kategoriCount.get(k) || 0) + 1);
  }
  const byUniqueKategori = new Map<string, string>();
  for (const p of programs) {
    const k = p.kategori.toUpperCase().trim();
    if (k && kategoriCount.get(k) === 1) byUniqueKategori.set(k, p.id);
  }
  return { byName, byUniqueKategori };
}

export function resolveProgramSiakad(
  maps: { byName: Map<string, string>; byUniqueKategori: Map<string, string> },
  progName: string | null | undefined,
  kategoriProgram: string | null | undefined,
): string | undefined {
  if (progName && typeof progName === "string") {
    const byName = maps.byName.get(progName.toLowerCase().trim());
    if (byName) return byName;
  }
  if (kategoriProgram && typeof kategoriProgram === "string") {
    return maps.byUniqueKategori.get(kategoriProgram.toUpperCase().trim());
  }
  return undefined;
}
