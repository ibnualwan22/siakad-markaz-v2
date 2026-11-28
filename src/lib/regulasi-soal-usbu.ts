// Regulasi / Panduan Pencetangan Soal Usbu' 1 & 2 (sesuai PDF Panduan Wali Kelas)

export const TIPE_SOAL_LABELS: Record<string, string> = {
  PG: "Pilihan Ganda",
  PG_MULTI: "Pilihan Ganda (Multi)",
  BENAR_SALAH: "Benar / Salah",
  ISIAN_SAMPING: "Isi Kosong (Opsi Samping)",
  ISIAN_BAWAH: "Isi Kosong (Opsi Bawah)",
  MUFRODAT: "Pilih Mufrodat",
  ESSAY_SINGKAT: "Essay Singkat",
  ESSAY_PANJANG: "Essay Panjang",
  MENJODOHKAN: "Menjodohkan",
  MENGURUTKAN: "Mengurutkan",
  KITABAH: "Kitabah Merangkai Huruf",
  DRAG_KATEGORI: "Drag & Drop Kategori",
  PARAGRAF_RUMPANG: "Paragraf Rumpang",
  IDENTIFIKASI_KESALAHAN: "Identifikasi Kesalahan",
  TABEL_TASRIF: "Tabel Matriks Dinamis",
  SUSUN_HURUF: "Susun Potongan Huruf Acak",
  DRAG_TO_BLANK: "Drag to Blank",
  STABILO_SYNTAX: "Stabilo Syntax / I'rab",
  JARING_RELASI: "Jaring Relasi Kata",
};

export type RegulasiQismRule = {
  id?: string;
  urutanQism: number;
  tipeSoal: string;
  targetJumlah: number;
  targetBobot: number;
  catatan: string | null;
  usbuBerlaku?: string;
};

export type AssignedSoalLite = {
  id: string;
  tipeSoal: string;
  bobot: number;
  bulanKe?: number;
};

export type QismEvalResult = {
  urutanQism: number;
  tipeSoal: string;
  tipeLabel: string;
  targetJumlah: number;
  targetBobot: number;
  targetSubtotal: number;
  terpilihJumlah: number;
  terpilihBobot: number;
  catatan: string | null;
  status: "PAS" | "KURANG" | "LEBIH";
  bobotMismatchCount: number;
};

export type MapelEvalResult = {
  hasRegulasi: boolean;
  totalSoal: number;
  totalBobot: number;
  targetTotalSoal: number;
  targetTotalBobot: number;
  isOver100: boolean;
  isExact100: boolean;
  qisms: QismEvalResult[];
  extraSoals: { tipeSoal: string; count: number; bobot: number }[];
};

/**
 * Mencocokkan daftar soal yang sudah dicentang ke daftar Qism regulasi.
 * Mendukung 2 mapel khusus yang punya 2 Qism sama-sama PG (I'lal & Sharaf Tsani)
 * dengan memprioritaskan kecocokan bobot, lalu slot kosong Qism secara berurutan.
 */
export function evaluateMapelRegulasi(
  rules: RegulasiQismRule[],
  assignedSoals: AssignedSoalLite[],
): MapelEvalResult {
  const sortedRules = [...rules].sort((a, b) => a.urutanQism - b.urutanQism);
  const totalSoal = assignedSoals.length;
  const totalBobot = Math.round(
    assignedSoals.reduce((acc, s) => acc + (Number(s.bobot) || 0), 0) * 100,
  ) / 100;

  if (sortedRules.length === 0) {
    return {
      hasRegulasi: false,
      totalSoal,
      totalBobot,
      targetTotalSoal: 0,
      targetTotalBobot: 100,
      isOver100: totalBobot > 100,
      isExact100: Math.abs(totalBobot - 100) < 0.01,
      qisms: [],
      extraSoals: [],
    };
  }

  const buckets: AssignedSoalLite[][] = sortedRules.map(() => []);
  const unmatched: AssignedSoalLite[] = [];

  for (const soal of assignedSoals) {
    const candidateIndices = sortedRules
      .map((r, idx) => (r.tipeSoal === soal.tipeSoal ? idx : -1))
      .filter((idx) => idx >= 0);

    if (candidateIndices.length === 0) {
      unmatched.push(soal);
      continue;
    }

    if (candidateIndices.length === 1) {
      buckets[candidateIndices[0]].push(soal);
      continue;
    }

    // Ada >1 Qism dengan tipeSoal sama (misal 2x PG di I'lal atau Sharaf Tsani):
    // 1. Cari yang bobotnya cocok & masih ada slot
    let picked = candidateIndices.find(
      (idx) =>
        Math.abs((Number(soal.bobot) || 0) - sortedRules[idx].targetBobot) < 0.01 &&
        buckets[idx].length < sortedRules[idx].targetJumlah,
    );
    // 2. Jika tidak, cari yang bobotnya cocok meski sudah penuh
    if (picked === undefined) {
      picked = candidateIndices.find(
        (idx) =>
          Math.abs((Number(soal.bobot) || 0) - sortedRules[idx].targetBobot) < 0.01,
      );
    }
    // 3. Jika tidak, cari slot pertama yang masih kurang
    if (picked === undefined) {
      picked = candidateIndices.find(
        (idx) => buckets[idx].length < sortedRules[idx].targetJumlah,
      );
    }
    // 4. Fallback ke kandidat terakhir
    if (picked === undefined) {
      picked = candidateIndices[candidateIndices.length - 1];
    }
    buckets[picked].push(soal);
  }

  const qisms: QismEvalResult[] = sortedRules.map((r, idx) => {
    const list = buckets[idx];
    const terpilihJumlah = list.length;
    const terpilihBobot =
      Math.round(list.reduce((a, s) => a + (Number(s.bobot) || 0), 0) * 100) / 100;
    const targetSubtotal = Math.round(r.targetJumlah * r.targetBobot * 100) / 100;
    const bobotMismatchCount = list.filter(
      (s) => Math.abs((Number(s.bobot) || 0) - r.targetBobot) >= 0.01,
    ).length;

    let status: "PAS" | "KURANG" | "LEBIH" = "KURANG";
    if (terpilihJumlah > r.targetJumlah || terpilihBobot > targetSubtotal + 0.01) {
      status = "LEBIH";
    } else if (terpilihJumlah === r.targetJumlah) {
      status = "PAS";
    }

    return {
      urutanQism: r.urutanQism,
      tipeSoal: r.tipeSoal,
      tipeLabel: TIPE_SOAL_LABELS[r.tipeSoal] || r.tipeSoal,
      targetJumlah: r.targetJumlah,
      targetBobot: r.targetBobot,
      targetSubtotal,
      terpilihJumlah,
      terpilihBobot,
      catatan: r.catatan,
      status,
      bobotMismatchCount,
    };
  });

  const extraMap = new Map<string, { tipeSoal: string; count: number; bobot: number }>();
  for (const u of unmatched) {
    const cur = extraMap.get(u.tipeSoal) || { tipeSoal: u.tipeSoal, count: 0, bobot: 0 };
    cur.count += 1;
    cur.bobot = Math.round((cur.bobot + (Number(u.bobot) || 0)) * 100) / 100;
    extraMap.set(u.tipeSoal, cur);
  }

  const targetTotalSoal = sortedRules.reduce((a, r) => a + r.targetJumlah, 0);
  const targetTotalBobot =
    Math.round(
      sortedRules.reduce((a, r) => a + r.targetJumlah * r.targetBobot, 0) * 100,
    ) / 100;

  return {
    hasRegulasi: true,
    totalSoal,
    totalBobot,
    targetTotalSoal,
    targetTotalBobot,
    isOver100: totalBobot > 100.01,
    isExact100: Math.abs(totalBobot - 100) < 0.01,
    qisms,
    extraSoals: Array.from(extraMap.values()),
  };
}

/**
 * Mengecek apakah sebuah soal masih boleh dicentang ke Usbu' tertentu (1 atau 2).
 * Jika kuota jenis soal tersebut di regulasi sudah penuh atau bobot total sudah >= 100,
 * mengembalikan allowed: false agar tombol centang di UI menjadi abu-abu (disabled).
 */
export function checkQuotaForCandidate(
  rules: RegulasiQismRule[],
  assignedSoals: AssignedSoalLite[],
  candidate: { tipeSoal: string; bobot: number },
  usbuKe: number,
): { allowed: boolean; reason?: string; suggestedBobot?: number } {
  // Usbu' 3 belum dikunci regulasi (menyusul)
  if (usbuKe !== 1 && usbuKe !== 2) {
    return { allowed: true };
  }

  const activeRules = rules.filter((r) => {
    const list = (r.usbuBerlaku || "1,2").split(",").map((x) => Number(x.trim()));
    return list.includes(usbuKe);
  });

  if (activeRules.length === 0) {
    // Belum ada regulasi -> tetap jaga agar tidak melebihi 100? Tidak, beri warning saja
    return { allowed: true };
  }

  const evalRes = evaluateMapelRegulasi(activeRules, assignedSoals);
  const matchingQisms = evalRes.qisms.filter((q) => q.tipeSoal === candidate.tipeSoal);

  if (matchingQisms.length === 0) {
    return {
      allowed: false,
      reason: `Tipe "${TIPE_SOAL_LABELS[candidate.tipeSoal] || candidate.tipeSoal}" tidak ada di panduan Usbu' ${usbuKe} mapel ini`,
    };
  }

  const totalTargetForType = matchingQisms.reduce((a, q) => a + q.targetJumlah, 0);
  const totalSelectedForType = matchingQisms.reduce((a, q) => a + q.terpilihJumlah, 0);

  if (totalSelectedForType >= totalTargetForType) {
    return {
      allowed: false,
      reason: `Kuota ${TIPE_SOAL_LABELS[candidate.tipeSoal] || candidate.tipeSoal} sudah penuh (${totalSelectedForType}/${totalTargetForType})`,
    };
  }

  // Tentukan suggestedBobot otomatis dari Qism yang masih punya slot
  let suggestedBobot: number | undefined;
  if (matchingQisms.length === 1) {
    suggestedBobot = matchingQisms[0].targetBobot;
  } else {
    // Dual-PG: pilih Qism yang bobotnya cocok & belum penuh, kalau tidak ambil Qism pertama yang belum penuh
    const exactMatch = matchingQisms.find(
      (q) =>
        Math.abs((Number(candidate.bobot) || 0) - q.targetBobot) < 0.01 &&
        q.terpilihJumlah < q.targetJumlah,
    );
    const openSlot =
      exactMatch || matchingQisms.find((q) => q.terpilihJumlah < q.targetJumlah);
    if (openSlot) suggestedBobot = openSlot.targetBobot;
  }

  const effectiveBobot = suggestedBobot ?? (Number(candidate.bobot) || 0);
  if (evalRes.totalBobot + effectiveBobot > 100.01) {
    return {
      allowed: false,
      reason: `Bobot total mapel akan melebihi 100 (${evalRes.totalBobot} + ${effectiveBobot})`,
    };
  }

  return { allowed: true, suggestedBobot };
}

// =========================================================================
// BLUEPRINT REGULASI DARI PDF PANDUAN PENCETANGAN SOAL USBU 1 DAN 2
// =========================================================================
export type BlueprintEntry = {
  programMatch: string[]; // nama_indo program di DB (case-insensitive)
  mapelMatch: string[];   // nama_indo mapel di DB (case-insensitive)
  bulanKe: number;
  qisms: Omit<RegulasiQismRule, "id" | "usbuBerlaku">[];
};

export const PDF_REGULASI_BLUEPRINT: BlueprintEntry[] = [
  // 1. SHIFR
  {
    programMatch: ["Shifr"],
    mapelMatch: ["Anashir Al-Lughah", "Anashir Lughah"],
    bulanKe: 1,
    qisms: [
      { urutanQism: 1, tipeSoal: "PG", targetJumlah: 10, targetBobot: 2, catatan: null },
      { urutanQism: 2, tipeSoal: "MENJODOHKAN", targetJumlah: 1, targetBobot: 20, catatan: "1 soal berisi 10 pasang dengan bobot 20/soal" },
      { urutanQism: 3, tipeSoal: "ISIAN_SAMPING", targetJumlah: 10, targetBobot: 3, catatan: null },
      { urutanQism: 4, tipeSoal: "BENAR_SALAH", targetJumlah: 10, targetBobot: 3, catatan: null },
    ],
  },

  // 2. IDAD AWAL
  {
    programMatch: ["I'dad Awal", "Idad Awal"],
    mapelMatch: ["Mufradat", "Mufrodat"],
    bulanKe: 1,
    qisms: [
      { urutanQism: 1, tipeSoal: "PG", targetJumlah: 5, targetBobot: 3, catatan: null },
      { urutanQism: 2, tipeSoal: "ISIAN_SAMPING", targetJumlah: 7, targetBobot: 5, catatan: "Menentukan 1 mufradat yang cocok dari maudhu yang ditentukan" },
      { urutanQism: 3, tipeSoal: "ESSAY_SINGKAT", targetJumlah: 10, targetBobot: 5, catatan: "Menerjemahkan mufradat (indo-arab / arab-indo)" },
    ],
  },
  {
    programMatch: ["I'dad Awal", "Idad Awal"],
    mapelMatch: ["Ta'birat", "Tabirat"],
    bulanKe: 1,
    qisms: [
      { urutanQism: 1, tipeSoal: "PG", targetJumlah: 5, targetBobot: 3, catatan: null },
      { urutanQism: 2, tipeSoal: "SUSUN_HURUF", targetJumlah: 7, targetBobot: 5, catatan: "Mengurutkan tabirat" },
      { urutanQism: 3, tipeSoal: "ESSAY_PANJANG", targetJumlah: 5, targetBobot: 10, catatan: "Menerjemahkan tabirat" },
    ],
  },
  {
    programMatch: ["I'dad Awal", "Idad Awal"],
    mapelMatch: ["Tarakib", "Qawaid"],
    bulanKe: 1,
    qisms: [
      { urutanQism: 1, tipeSoal: "PG", targetJumlah: 10, targetBobot: 2, catatan: null },
      { urutanQism: 2, tipeSoal: "BENAR_SALAH", targetJumlah: 10, targetBobot: 3, catatan: "Fokus ke satu materi (seperti bentuk mufrad/tasniyah/jama serta jenis bina, disesuaikan capaian usbu)" },
      { urutanQism: 3, tipeSoal: "ESSAY_PANJANG", targetJumlah: 5, targetBobot: 10, catatan: null },
    ],
  },

  // 3. IDAD TSANI
  {
    programMatch: ["I'dad Tsani", "Idad Tsani"],
    mapelMatch: ["Ta'birat", "Tabirat"],
    bulanKe: 1,
    qisms: [
      { urutanQism: 1, tipeSoal: "PG", targetJumlah: 5, targetBobot: 3, catatan: null },
      { urutanQism: 2, tipeSoal: "SUSUN_HURUF", targetJumlah: 7, targetBobot: 5, catatan: "Mengurutkan tabirat" },
      { urutanQism: 3, tipeSoal: "ESSAY_PANJANG", targetJumlah: 5, targetBobot: 10, catatan: "Menerjemahkan tabirat" },
    ],
  },
  {
    programMatch: ["I'dad Tsani", "Idad Tsani"],
    mapelMatch: ["Kitabah"],
    bulanKe: 1,
    qisms: [
      { urutanQism: 1, tipeSoal: "PG", targetJumlah: 5, targetBobot: 3, catatan: null },
      { urutanQism: 2, tipeSoal: "BENAR_SALAH", targetJumlah: 10, targetBobot: 4, catatan: "Fokus pada satu materi (disesuaikan dengan capaian materi usbu)" },
      { urutanQism: 3, tipeSoal: "ESSAY_SINGKAT", targetJumlah: 8, targetBobot: 5, catatan: "Membuat contoh sesuai materi" },
    ],
  },
  {
    programMatch: ["I'dad Tsani", "Idad Tsani"],
    mapelMatch: ["Qawaid"],
    bulanKe: 1,
    qisms: [
      { urutanQism: 1, tipeSoal: "PG", targetJumlah: 10, targetBobot: 2, catatan: null },
      { urutanQism: 2, tipeSoal: "BENAR_SALAH", targetJumlah: 10, targetBobot: 3, catatan: "Fokus ke satu materi (seperti irab kata, jenis irab, jenis kata, mabni dll)" },
      { urutanQism: 3, tipeSoal: "ESSAY_PANJANG", targetJumlah: 5, targetBobot: 10, catatan: null },
    ],
  },
  {
    programMatch: ["I'dad Tsani", "Idad Tsani"],
    mapelMatch: ["Mufradat", "Mufrodat"],
    bulanKe: 1,
    qisms: [
      { urutanQism: 1, tipeSoal: "PG", targetJumlah: 5, targetBobot: 4, catatan: null },
      { urutanQism: 2, tipeSoal: "MENJODOHKAN", targetJumlah: 1, targetBobot: 40, catatan: "1 soal (dengan 8 pasangan) dengan bobot 40/soal" },
      { urutanQism: 3, tipeSoal: "ESSAY_SINGKAT", targetJumlah: 5, targetBobot: 8, catatan: "Menentukan mufradat yang tepat berdasarkan deskripsi" },
    ],
  },

  // 4. SYARQI AWWAL
  {
    programMatch: ["Syarqi Awwal", "Syarqi Awal"],
    mapelMatch: ["Qawaid"],
    bulanKe: 1,
    qisms: [
      { urutanQism: 1, tipeSoal: "PG", targetJumlah: 5, targetBobot: 3, catatan: null },
      { urutanQism: 2, tipeSoal: "TABEL_TASRIF", targetJumlah: 1, targetBobot: 35, catatan: "Menentukan mauqi/jenis/i'rab dari kata — 1 tabel (10 kotak kosong), bobot maks 35" },
      { urutanQism: 3, tipeSoal: "ESSAY_PANJANG", targetJumlah: 5, targetBobot: 10, catatan: "Soal uraian seputar materi" },
    ],
  },
  {
    programMatch: ["Syarqi Awwal", "Syarqi Awal"],
    mapelMatch: ["Mufradat", "Mufrodat"],
    bulanKe: 1,
    qisms: [
      { urutanQism: 1, tipeSoal: "PG", targetJumlah: 5, targetBobot: 3, catatan: null },
      { urutanQism: 2, tipeSoal: "ESSAY_SINGKAT", targetJumlah: 5, targetBobot: 4, catatan: "Menentukan terjemah mufradat" },
      { urutanQism: 3, tipeSoal: "ISIAN_SAMPING", targetJumlah: 5, targetBobot: 5, catatan: "Menentukan mufradat yang cocok dari pernyataan" },
      { urutanQism: 4, tipeSoal: "ESSAY_PANJANG", targetJumlah: 5, targetBobot: 8, catatan: "Membuat jumlah dari mufradat" },
    ],
  },

  // 5. ATIQAH
  {
    programMatch: ["Atiqah"],
    mapelMatch: ["Qawaid"],
    bulanKe: 1,
    qisms: [
      { urutanQism: 1, tipeSoal: "PG", targetJumlah: 5, targetBobot: 2, catatan: null },
      { urutanQism: 2, tipeSoal: "BENAR_SALAH", targetJumlah: 5, targetBobot: 3, catatan: null },
      { urutanQism: 3, tipeSoal: "DRAG_TO_BLANK", targetJumlah: 5, targetBobot: 3, catatan: null },
      { urutanQism: 4, tipeSoal: "ESSAY_SINGKAT", targetJumlah: 5, targetBobot: 4, catatan: null },
      { urutanQism: 5, tipeSoal: "ESSAY_PANJANG", targetJumlah: 5, targetBobot: 8, catatan: null },
    ],
  },

  // 6. TAKHASSUS AWAL
  {
    programMatch: ["Takhasus Awal", "Takhassus Awal"],
    mapelMatch: ["Nahwu"],
    bulanKe: 1,
    qisms: [
      { urutanQism: 1, tipeSoal: "PG", targetJumlah: 5, targetBobot: 3, catatan: null },
      { urutanQism: 2, tipeSoal: "TABEL_TASRIF", targetJumlah: 1, targetBobot: 35, catatan: "Menentukan mauqi/jenis i'rab/jenis dari kata (disesuaikan capaian usbu) — 1 tabel (10 kolom kosong), bobot maks 35" },
      { urutanQism: 3, tipeSoal: "ESSAY_PANJANG", targetJumlah: 5, targetBobot: 10, catatan: "Soal uraian seputar materi" },
    ],
  },
  {
    programMatch: ["Takhasus Awal", "Takhassus Awal"],
    mapelMatch: ["Sharf", "Sharaf", "Shorof"],
    bulanKe: 1,
    qisms: [
      { urutanQism: 1, tipeSoal: "PG", targetJumlah: 5, targetBobot: 3, catatan: null },
      { urutanQism: 2, tipeSoal: "ESSAY_SINGKAT", targetJumlah: 7, targetBobot: 5, catatan: "Menentukan jawaban benar dari pernyataan salah dari kata yang digaris bawahi" },
      { urutanQism: 3, tipeSoal: "TABEL_TASRIF", targetJumlah: 1, targetBobot: 50, catatan: "Melanjutkan tasrifan wazan — 1 tabel (25 kolom kosong), bobot maks 50" },
    ],
  },
  {
    programMatch: ["Takhasus Awal", "Takhassus Awal"],
    mapelMatch: ["I'lal"],
    bulanKe: 1,
    qisms: [
      { urutanQism: 1, tipeSoal: "PG", targetJumlah: 5, targetBobot: 3, catatan: "Pilihan ganda umum" },
      { urutanQism: 2, tipeSoal: "PG", targetJumlah: 6, targetBobot: 5, catatan: "Menentukan asal kata" },
      { urutanQism: 3, tipeSoal: "ESSAY_SINGKAT", targetJumlah: 7, targetBobot: 5, catatan: "Menentukan jenis i'lal" },
      { urutanQism: 4, tipeSoal: "ESSAY_PANJANG", targetJumlah: 2, targetBobot: 10, catatan: "Mengilal kata" },
    ],
  },

  // 7. TAKHASSUS TSANI
  {
    programMatch: ["Takhasus Tsani", "Takhassus Tsani"],
    mapelMatch: ["Nahwu"],
    bulanKe: 1,
    qisms: [
      { urutanQism: 1, tipeSoal: "PG", targetJumlah: 5, targetBobot: 3, catatan: null },
      { urutanQism: 2, tipeSoal: "MENJODOHKAN", targetJumlah: 1, targetBobot: 35, catatan: "Menjodohkan kalimat — 1 soal (10 kolom pasangan), bobot maks 35" },
      { urutanQism: 3, tipeSoal: "ESSAY_PANJANG", targetJumlah: 5, targetBobot: 10, catatan: "Soal uraian seputar materi" },
    ],
  },
  {
    programMatch: ["Takhasus Tsani", "Takhassus Tsani"],
    mapelMatch: ["Sharf", "Sharaf", "Shorof"],
    bulanKe: 1,
    qisms: [
      { urutanQism: 1, tipeSoal: "PG", targetJumlah: 5, targetBobot: 2, catatan: "Pilihan ganda umum" },
      { urutanQism: 2, tipeSoal: "PG", targetJumlah: 3, targetBobot: 5, catatan: "Menentukan shighah dari sebuah kata" },
      { urutanQism: 3, tipeSoal: "TABEL_TASRIF", targetJumlah: 1, targetBobot: 25, catatan: "Melanjutkan tasrifan wazan — 1 tabel (10 kolom kosong), bobot maks 25" },
      { urutanQism: 4, tipeSoal: "ESSAY_PANJANG", targetJumlah: 5, targetBobot: 10, catatan: "Faidah wazan dari jumlah dan terjemahannya" },
    ],
  },
  {
    programMatch: ["Takhasus Tsani", "Takhassus Tsani"],
    mapelMatch: ["I'rab"],
    bulanKe: 1,
    qisms: [
      { urutanQism: 1, tipeSoal: "PG", targetJumlah: 5, targetBobot: 3, catatan: null },
      { urutanQism: 2, tipeSoal: "BENAR_SALAH", targetJumlah: 7, targetBobot: 5, catatan: "Penentuan mauqi kata dari jumlah" },
      { urutanQism: 3, tipeSoal: "ESSAY_PANJANG", targetJumlah: 5, targetBobot: 10, catatan: "Mengirab kata dari jumlah" },
    ],
  },

  // 8. AKBARNAS BULAN 1
  {
    programMatch: ["Akbarnas"],
    mapelMatch: ["Ta'birat", "Tabirat"],
    bulanKe: 1,
    qisms: [
      { urutanQism: 1, tipeSoal: "PG", targetJumlah: 5, targetBobot: 3, catatan: null },
      { urutanQism: 2, tipeSoal: "SUSUN_HURUF", targetJumlah: 7, targetBobot: 5, catatan: "Mengurutkan tabirat" },
      { urutanQism: 3, tipeSoal: "ESSAY_PANJANG", targetJumlah: 5, targetBobot: 10, catatan: "Menerjemahkan tabirat" },
    ],
  },
  {
    programMatch: ["Akbarnas"],
    mapelMatch: ["Mufradat", "Mufrodat"],
    bulanKe: 1,
    qisms: [
      { urutanQism: 1, tipeSoal: "PG", targetJumlah: 5, targetBobot: 3, catatan: null },
      { urutanQism: 2, tipeSoal: "ISIAN_SAMPING", targetJumlah: 7, targetBobot: 5, catatan: "Menentukan 1 mufradat yang cocok dari maudhu yang ditentukan" },
      { urutanQism: 3, tipeSoal: "ESSAY_SINGKAT", targetJumlah: 10, targetBobot: 5, catatan: "Menerjemahkan mufradat (indo-arab / arab-indo)" },
    ],
  },
  {
    programMatch: ["Akbarnas"],
    mapelMatch: ["Tarakib Tathbiqiyah", "Tarakib tatbiqiy"],
    bulanKe: 1,
    qisms: [
      { urutanQism: 1, tipeSoal: "PG", targetJumlah: 10, targetBobot: 2, catatan: null },
      { urutanQism: 2, tipeSoal: "BENAR_SALAH", targetJumlah: 10, targetBobot: 3, catatan: "Fokus ke satu materi (disesuaikan capaian usbu)" },
      { urutanQism: 3, tipeSoal: "ESSAY_PANJANG", targetJumlah: 5, targetBobot: 10, catatan: null },
    ],
  },

  // 9. AKBARNAS BULAN 2
  {
    programMatch: ["Akbarnas"],
    mapelMatch: ["Uslub"],
    bulanKe: 2,
    qisms: [
      { urutanQism: 1, tipeSoal: "PG", targetJumlah: 10, targetBobot: 2, catatan: null },
      { urutanQism: 2, tipeSoal: "MENJODOHKAN", targetJumlah: 1, targetBobot: 30, catatan: "Menjodohkan uslub yang sesuai — 1 soal (10 pasang), bobot 30/soal" },
      { urutanQism: 3, tipeSoal: "ESSAY_PANJANG", targetJumlah: 5, targetBobot: 10, catatan: "Menerjemahkan kalimat" },
    ],
  },
  {
    programMatch: ["Akbarnas"],
    mapelMatch: ["Mufradat", "Mufrodat"],
    bulanKe: 2,
    qisms: [
      { urutanQism: 1, tipeSoal: "PG", targetJumlah: 5, targetBobot: 3, catatan: null },
      { urutanQism: 2, tipeSoal: "ISIAN_SAMPING", targetJumlah: 7, targetBobot: 5, catatan: "Menentukan 1 mufradat yang cocok dari maudhu yang ditentukan" },
      { urutanQism: 3, tipeSoal: "ESSAY_SINGKAT", targetJumlah: 10, targetBobot: 5, catatan: "Menerjemahkan mufradat (indo-arab / arab-indo)" },
    ],
  },
  {
    programMatch: ["Akbarnas"],
    mapelMatch: ["Tarakib Tathbiqiyah", "Tarakib tatbiqiy"],
    bulanKe: 2,
    qisms: [
      { urutanQism: 1, tipeSoal: "PG", targetJumlah: 10, targetBobot: 2, catatan: null },
      { urutanQism: 2, tipeSoal: "BENAR_SALAH", targetJumlah: 10, targetBobot: 3, catatan: "Fokus ke satu materi (disesuaikan capaian usbu)" },
      { urutanQism: 3, tipeSoal: "ESSAY_PANJANG", targetJumlah: 5, targetBobot: 10, catatan: null },
    ],
  },

  // 10. ULA 1 & ULA 2
  ...["Ula 1", "Ula 2"].flatMap((prog): BlueprintEntry[] => [
    {
      programMatch: [prog],
      mapelMatch: ["Nahwu", "Qawaid"],
      bulanKe: 1,
      qisms: [
        { urutanQism: 1, tipeSoal: "PG", targetJumlah: 5, targetBobot: 3, catatan: "Qawaid (Jurumiyah)" },
        { urutanQism: 2, tipeSoal: "BENAR_SALAH", targetJumlah: 7, targetBobot: 5, catatan: null },
        { urutanQism: 3, tipeSoal: "ESSAY_PANJANG", targetJumlah: 5, targetBobot: 10, catatan: null },
      ],
    },
    {
      programMatch: [prog],
      mapelMatch: ["Shorof", "Sharf", "Amtsilah Tasrifiyah"],
      bulanKe: 1,
      qisms: [
        { urutanQism: 1, tipeSoal: "PG", targetJumlah: 5, targetBobot: 3, catatan: "Amtsilah Tasrifiyah" },
        { urutanQism: 2, tipeSoal: "ESSAY_SINGKAT", targetJumlah: 7, targetBobot: 5, catatan: "Menentukan jawaban benar dari pernyataan salah dari kata yang digaris bawahi" },
        { urutanQism: 3, tipeSoal: "TABEL_TASRIF", targetJumlah: 1, targetBobot: 50, catatan: "Melanjutkan tasrifan — 1 tabel (25 kolom kosong), bobot maks 50" },
      ],
    },
    {
      programMatch: [prog],
      mapelMatch: ["Hafalan"],
      bulanKe: 1,
      qisms: [
        { urutanQism: 1, tipeSoal: "ESSAY_PANJANG", targetJumlah: 5, targetBobot: 20, catatan: "Melanjutkan matan Jurumiyah" },
      ],
    },
  ]),

  // 11. WUSTHO 1 & WUSTHO 2
  ...["Wustho 1", "Wustho 2"].flatMap((prog): BlueprintEntry[] => [
    {
      programMatch: [prog],
      mapelMatch: ["Nahwu", "Qawaid"],
      bulanKe: 1,
      qisms: [
        { urutanQism: 1, tipeSoal: "PG", targetJumlah: 5, targetBobot: 3, catatan: "Qawaid (Imriti)" },
        { urutanQism: 2, tipeSoal: "BENAR_SALAH", targetJumlah: 7, targetBobot: 5, catatan: null },
        { urutanQism: 3, tipeSoal: "ESSAY_PANJANG", targetJumlah: 5, targetBobot: 10, catatan: null },
      ],
    },
    {
      programMatch: [prog],
      mapelMatch: ["Shorof", "Sharf", "Amtsilah Tasrifiyah"],
      bulanKe: 1,
      qisms: [
        { urutanQism: 1, tipeSoal: "PG", targetJumlah: 5, targetBobot: 3, catatan: "Amtsilah Tasrifiyah" },
        { urutanQism: 2, tipeSoal: "ESSAY_SINGKAT", targetJumlah: 7, targetBobot: 5, catatan: "Menentukan jawaban benar dari pernyataan salah dari kata yang digaris bawahi" },
        { urutanQism: 3, tipeSoal: "TABEL_TASRIF", targetJumlah: 1, targetBobot: 50, catatan: "Melanjutkan tasrifan — 1 tabel (25 kolom kosong), bobot maks 50" },
      ],
    },
    {
      programMatch: [prog],
      mapelMatch: ["Hafalan"],
      bulanKe: 1,
      qisms: [
        { urutanQism: 1, tipeSoal: "ESSAY_PANJANG", targetJumlah: 5, targetBobot: 20, catatan: "Melanjutkan nadzam Imriti" },
      ],
    },
  ]),
];
