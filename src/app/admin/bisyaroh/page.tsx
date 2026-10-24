import { redirect } from "next/navigation";
import { createHmac, randomUUID } from "crypto";

import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permission";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bisyaroh Saya - Admin Panel",
};

// Pintasan ke E-Maliyah: pengguna sudah login di Siakad, jadi halaman ini
// hanya membuat token sekali pakai (120 detik, HMAC-SHA256 dengan secret
// bersama) lalu mengalihkan ke callback SSO E-Maliyah. Tidak ada password
// kedua; E-Maliyah menerbitkan sesinya sendiri dari token ini.
export default async function BisyarohPage() {
  await requirePermission("jadwal_saya");
  const session = await getSession();
  if (!session) return null;

  const secret = process.env.EMALIYAH_SSO_SECRET;
  const target = process.env.EMALIYAH_SSO_URL;
  if (!secret || !target) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Bisyaroh Saya</h1>
        <p>Integrasi ke E-Maliyah belum dikonfigurasi di server. Silakan hubungi admin.</p>
      </main>
    );
  }

  const payload = {
    siakad_id: session.userId,
    exp: Math.floor(Date.now() / 1000) + 120,
    jti: randomUUID(),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(payloadB64).digest("hex");
  redirect(`${target}?token=${payloadB64}.${sig}`);
}
