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

// Susun isi notifikasi laporan sakan:
// - sakan yang baru submit (+ ringkasannya bila satu sakan),
// - lalu daftar sakan yang BELUM absen, atau penanda "semua sudah lapor".
// Tanpa tag: tiap simpan menghasilkan notifikasi tersendiri.
export function formatSakanPushBody(
  submitted: string[],
  ringkasan: string | null,
  remaining: string[]
): string {
  let first: string;
  if (submitted.length === 1) {
    first = `Sakan ${submitted[0]} sudah lapor`;
    if (ringkasan) first += ` • ${ringkasan}`;
  } else {
    first = `${submitted.length} sakan sudah lapor: ${submitted.join(", ")}`;
  }
  if (remaining.length > 0) {
    return `${first} • ${remaining.length} sakan belum absen: ${remaining.join(", ")}`;
  }
  return `${first} • Semua sakan sudah lapor`;
}
