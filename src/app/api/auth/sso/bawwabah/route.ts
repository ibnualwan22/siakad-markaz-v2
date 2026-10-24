import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { createSession } from "@/lib/auth";

// Verifikasi SSO dari Bawwabah (Fase 5): Bawwabah menerbitkan token sekali
// pakai (payload base64url + HMAC-SHA256 hex, 120 detik, pola yang sama
// dengan SSO Siakad→E-Maliyah). Route ini memverifikasi, menandai jti sudah
// dipakai (anti-replay), lalu membuat sesi Siakad biasa dan mengarahkan ke
// dashboard admin. Login langsung tetap jalan paralel.
function errorPage(pesan: string) {
  return new NextResponse(
    `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Siakad</title></head><body style="font-family:system-ui,sans-serif;background:#F3F4F6;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0"><div style="background:#fff;border:1px solid #E5E7EB;border-radius:14px;padding:24px;max-width:420px"><h2 style="color:#B91C1C;margin:0 0 8px">Gagal masuk lewat Bawwabah</h2><p style="color:#374151;font-size:14px;line-height:1.6;margin:0">${pesan}</p><p style="margin:16px 0 0;font-size:14px"><a href="/login">Login langsung di Siakad</a> &middot; <a href="https://bawwabah.markazarabiyah.site/dashboard">Kembali ke Bawwabah</a></p></div></body></html>`,
    {
      status: 401,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }
  );
}

export async function GET(req: Request) {
  const secret = process.env.BAWWABAH_SSO_SECRET;
  if (!secret)
    return errorPage("Integrasi SSO belum dikonfigurasi di server.");

  const raw = new URL(req.url).searchParams.get("token") || "";
  const parts = raw.split(".");
  if (parts.length !== 2) return errorPage("Token SSO tidak valid.");
  const [payloadB64, sigHex] = parts;

  const expected = createHmac("sha256", secret)
    .update(payloadB64)
    .digest("hex");
  const sigBuf = Buffer.from(sigHex, "hex");
  const expBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf))
    return errorPage("Token SSO tidak valid.");

  let payload: {
    siakad_id?: string;
    aud?: string;
    exp?: number;
    jti?: string;
  };
  try {
    payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    );
  } catch {
    return errorPage("Token SSO tidak valid.");
  }

  if (
    !payload.siakad_id ||
    !payload.jti ||
    payload.aud !== "siakad" ||
    !payload.exp ||
    Date.now() / 1000 > payload.exp
  )
    return errorPage("Token SSO sudah kedaluwarsa atau tidak valid.");

  // Konsumsi jti secara atomik: baris kedua dengan jti sama gagal unique
  // constraint (P2002) → token sudah dipakai.
  try {
    await prisma.ssoConsumedToken.create({
      data: { jti: payload.jti, aud: payload.aud },
    });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "P2002") return errorPage("Token SSO sudah dipakai.");
    throw e;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.siakad_id },
  });
  if (!user) return errorPage("Akun tidak ditemukan.");
  if (!user.isActive)
    return errorPage("Akun dinonaktifkan. Silakan hubungi admin.");

  await createSession({
    userId: user.id,
    username: user.username,
    role: user.role,
    nama: user.nama,
    kelasId: user.kelasId,
    sakan: user.sakan,
  });
  return NextResponse.redirect(new URL("/admin/dashboard", req.url));
}
