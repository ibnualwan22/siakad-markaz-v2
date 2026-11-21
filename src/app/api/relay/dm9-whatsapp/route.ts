import { NextRequest, NextResponse } from "next/server";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

/**
 * Relay WhatsApp untuk DM9 (Dies Miladis ke-9).
 *
 * Latar: panggilan langsung dari Vercel ke gateway wa-multi diblokir
 * Cloudflare ("Just a moment..." — 403 HTML), karena IP datacenter Vercel
 * dianggap bot. VPS ini lolos dari Cloudflare, jadi DM9 memanggil relay
 * ini dan relay yang meneruskan ke gateway memakai WA_API_KEY +
 * WA_SESSION_ID2 yang sudah ada di .env SIAKAD.
 *
 * Auth: header `Authorization: Bearer <DM9_RELAY_SECRET>` — nilai sama
 * dengan DM9_RELAY_SECRET di .env SIAKAD dan SIAKAD_RELAY_SECRET di env
 * Vercel project dm9. Tanpa secret yang cocok, route ini menolak 401
 * sebelum menyentuh gateway. Secret TIDAK PERNAH ditulis di kode / chat.
 */
const RELAY_SECRET = process.env.DM9_RELAY_SECRET;

function maskPhone(phone: string): string {
  if (phone.length <= 7) return "***";
  return `${phone.slice(0, 4)}***${phone.slice(-3)}`;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    let token: string | null = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice("Bearer ".length);
    }

    if (!RELAY_SECRET) {
      console.error("[relay-dm9] DM9_RELAY_SECRET belum dikonfigurasi");
      return NextResponse.json(
        { success: false, detail: "Relay belum dikonfigurasi" },
        { status: 500 }
      );
    }

    if (token !== RELAY_SECRET) {
      return NextResponse.json(
        { success: false, detail: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    const to = typeof body?.to === "string" ? body.to.trim() : "";
    const message = typeof body?.message === "string" ? body.message : "";

    if (!/^62[1-9][0-9]{7,12}$/.test(to)) {
      return NextResponse.json(
        { success: false, detail: "Nomor tujuan tidak valid" },
        { status: 400 }
      );
    }

    if (!message.trim() || message.length > 4000) {
      return NextResponse.json(
        { success: false, detail: "Pesan tidak valid" },
        { status: 400 }
      );
    }

    const result = await sendWhatsAppMessage(to, message);

    console.log("[relay-dm9]", {
      to: maskPhone(to),
      sessionId: (process.env.WA_SESSION_ID2 || "").slice(0, 8),
      success: result.success,
      detail: result.detail,
    });

    return NextResponse.json({
      success: result.success,
      detail: result.detail,
    });
  } catch (error) {
    console.error(
      "[relay-dm9] error",
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json(
      { success: false, detail: "Relay error" },
      { status: 500 }
    );
  }
}
