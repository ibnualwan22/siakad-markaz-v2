/**
 * Kunci penandatangan JWT terpusat.
 *
 * JWT_SECRET WAJIB diset di environment variable — tidak ada lagi
 * fallback hardcoded (sebelumnya secret default tertulis di repo publik,
 * sehingga siapa pun bisa menempa token session, termasuk sebagai ADMIN).
 *
 * Pengecekan dilakukan secara lazy (saat kunci pertama kali dipakai),
 * supaya `next build` tidak crash ketika env belum tersedia; request yang
 * butuh session akan gagal dengan pesan yang jelas.
 */

let cachedKey: Uint8Array | null = null;

export function getJwtKey(): Uint8Array {
  if (cachedKey) return cachedKey;

  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET belum dikonfigurasi dengan benar. " +
        "Set environment variable JWT_SECRET dengan string acak " +
        "minimal 32 karakter sebelum menjalankan aplikasi."
    );
  }

  cachedKey = new TextEncoder().encode(secret);
  return cachedKey;
}
