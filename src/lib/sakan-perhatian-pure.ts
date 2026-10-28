// Fungsi murni (tanpa Prisma) untuk daftar perhatian absen sakan.
// Dipisah dari sakan-perhatian.ts agar bisa diuji langsung dengan node.

// Ambil nomor tasrih [TRS-xxx] dari keterangan (pola yang sama dengan
// komponen absensi-sakan-client).
export function extractNomorTasrih(keterangan: string | null): string | null {
  if (!keterangan) return null;
  const match = keterangan.match(/\[(TRS-[\d-]+)\]/);
  return match ? match[1] : null;
}

// Sisakan catatan manusia: buang token tasrih dan awalan "Auto ..." hasil
// inject sistem (GET/POST sakan), lalu rapikan pemisah " | ".
export function humanKeterangan(keterangan: string | null): string {
  if (!keterangan) return "";
  let text = keterangan;
  text = text.replace(/\s*Auto\s+(IZIN|SAKIT)\s*\[(TRS-[\d-]+)\]\s*/g, " ");
  text = text.replace(/\s*\[(TRS-[\d-]+)\]\s*/g, " ");
  return text
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" | ");
}
