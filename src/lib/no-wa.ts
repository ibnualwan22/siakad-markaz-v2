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
  const token = process.env.FONNTE_TOKEN;
  if (!token) {
    console.error("FONNTE_TOKEN belum diset di environment");
    return false;
  }
  try {
    const res = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: { Authorization: token },
      body: new URLSearchParams({ target, message }),
    });
    if (!res.ok) {
      console.error("Fonnte error:", res.status, await res.text().then((t) => t.slice(0, 200)));
    }
    return res.ok;
  } catch (e) {
    console.error("Gagal kirim Fonnte:", e);
    return false;
  }
}
