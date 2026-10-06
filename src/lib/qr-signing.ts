import crypto from "crypto";

const PREFIX = "SKA";

/**
 * QR absensi santri: statis per santri, ditandatangani HMAC-SHA256.
 * Format payload: SKA.<santriId>.<signature(32 hex)>
 * Secret diambil dari env QR_SIGNING_SECRET (tidak pernah dikirim ke client).
 */
function getSecret(): string {
  const s = process.env.QR_SIGNING_SECRET;
  if (!s) throw new Error("QR_SIGNING_SECRET belum diset di environment");
  return s;
}

export function signSantriQr(santriId: string): string {
  const sig = crypto
    .createHmac("sha256", getSecret())
    .update(santriId)
    .digest("hex")
    .slice(0, 32);
  return `${PREFIX}.${santriId}.${sig}`;
}

export function verifySantriQr(
  payload: string
): { ok: true; santriId: string } | { ok: false; reason: string } {
  if (!payload || typeof payload !== "string") {
    return { ok: false, reason: "Payload QR kosong" };
  }
  const parts = payload.trim().split(".");
  if (parts.length !== 3 || parts[0] !== PREFIX) {
    return { ok: false, reason: "Format QR tidak dikenal" };
  }
  const [, santriId, sig] = parts;
  if (!santriId || !sig) {
    return { ok: false, reason: "Format QR tidak dikenal" };
  }
  let expected: string;
  try {
    expected = crypto
      .createHmac("sha256", getSecret())
      .update(santriId)
      .digest("hex")
      .slice(0, 32);
  } catch {
    return { ok: false, reason: "Konfigurasi server belum lengkap" };
  }
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "QR tidak valid (tanda tangan salah)" };
  }
  return { ok: true, santriId };
}
