import { createHash, timingSafeEqual, randomInt } from "crypto";

// Normalisasi nomor WA ke format 628xx. Kembalikan null jika tidak valid.
export function normalizeWa(input: string): string | null {
  const digits = (input || "").replace(/\D/g, "");
  let n = digits;
  if (n.startsWith("0")) n = "62" + n.slice(1);
  if (!n.startsWith("62")) return null;
  if (n.length < 11 || n.length > 15) return null;
  return n;
}

export function maskWa(noWa: string): string {
  if (!noWa) return "-";
  if (noWa.length <= 8) return "••••" + noWa.slice(-2);
  return noWa.slice(0, 4) + "••••" + noWa.slice(-4);
}

export function hashOtp(otp: string): string {
  return createHash("sha256").update(otp).digest("hex");
}

export function verifyOtpHash(otp: string, hash: string): boolean {
  try {
    const a = Buffer.from(hashOtp(otp), "hex");
    const b = Buffer.from(hash, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function generateOtp(): string {
  return String(randomInt(100000, 1000000));
}

export async function sendFonnte(target: string, message: string): Promise<boolean> {
  // Via gateway WA self-hosted (nama dipertahankan agar pemanggil tidak berubah)
  const base = process.env.WA_GATEWAY_URL || "http://100.94.148.88:3100";
  const token = process.env.WA_GATEWAY_TOKEN;
  if (!token) {
    console.error("WA_GATEWAY_TOKEN belum diset di environment");
    return false;
  }
  try {
    const res = await fetch(`${base}/api/send/text`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to: target, text: message }),
    });
    if (!res.ok) {
      console.error("WA gateway error:", res.status, await res.text().then((t) => t.slice(0, 200)));
    }
    return res.ok;
  } catch (e) {
    console.error("Gagal kirim WA gateway:", e);
    return false;
  }
}

