import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

// Kunci publik VAPID (bukan rahasia) untuk berlangganan dari browser.
// Dibatasi ke sesi staf: santri tidak lewat jalur ini.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    publicKey: process.env.PUSH_VAPID_PUBLIC_KEY || null,
  });
}
