import { NextResponse } from "next/server";
import { getSantriSession } from "@/lib/santri-auth";
import { authorizePrivateChannel } from "@/lib/pusher-server";

// Auth channel private Pusher untuk santri: hanya santri pemilik sesi yang
// boleh subscribe ke channel-nya sendiri (private-santri-<santriId>).
// pusher-js mengirim socket_id + channel_name sebagai form atau JSON.
export async function POST(request: Request) {
  const session = await getSantriSession();
  if (!session || !session.isAktif) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let socketId = "";
  let channel = "";
  try {
    const text = await request.text();
    try {
      const j = JSON.parse(text);
      socketId = j.socket_id || "";
      channel = j.channel_name || "";
    } catch {
      const p = new URLSearchParams(text);
      socketId = p.get("socket_id") || "";
      channel = p.get("channel_name") || "";
    }
  } catch {
    /* abaikan */
  }
  const expected = `private-santri-${session.santriId}`;
  if (!socketId || channel !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const auth = authorizePrivateChannel(socketId, channel);
  if (!auth) {
    return NextResponse.json({ error: "Pusher belum dikonfigurasi" }, { status: 500 });
  }
  return NextResponse.json({ auth });
}
