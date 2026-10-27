import { NextResponse } from "next/server";
import { getSantriSession } from "@/lib/santri-auth";

// Konfigurasi Pusher untuk klien santri: hanya kunci publik + cluster + nama
// channel miliknya sendiri. Secret TIDAK PERNAH keluar lewat endpoint ini.
// Dipakai runtime (bukan NEXT_PUBLIC) supaya deploy image tidak perlu rebuild
// saat kredensial berubah.
export async function GET() {
  const session = await getSantriSession();
  if (!session || !session.isAktif) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const key = process.env.PUSHER_KEY;
  const cluster = process.env.PUSHER_CLUSTER;
  if (!key || !cluster) {
    return NextResponse.json({ success: false, configured: false });
  }
  return NextResponse.json({
    success: true,
    configured: true,
    key,
    cluster,
    channel: `private-santri-${session.santriId}`,
  });
}
