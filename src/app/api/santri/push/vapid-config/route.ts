import { NextResponse } from "next/server";
import { getSantriSession } from "@/lib/santri-auth";

export const dynamic = "force-dynamic";

// Kunci publik VAPID (bukan rahasia) untuk berlangganan Web Push dari
// portal santri. Cerminan /api/push/vapid-config staf, tapi auth sesi santri.
export async function GET() {
  const session = await getSantriSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    publicKey: process.env.PUSH_VAPID_PUBLIC_KEY || null,
  });
}
