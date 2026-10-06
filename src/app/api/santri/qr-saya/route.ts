import { NextResponse } from "next/server";
import { getSantriSession } from "@/lib/santri-auth";
import { signSantriQr } from "@/lib/qr-signing";

export async function GET() {
  const session = await getSantriSession();
  if (!session || !session.isAktif) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const payload = signSantriQr(session.santriId);
    return NextResponse.json({ success: true, payload, nama: session.nama });
  } catch {
    return NextResponse.json(
      { error: "Konfigurasi QR belum lengkap di server" },
      { status: 500 }
    );
  }
}
