import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSantriSession } from "@/lib/santri-auth";

export const dynamic = "force-dynamic";

// Hub broadcast: database hanya ditanya 1x tiap 3 detik PER SESI,
// hasilnya disebar ke semua client yang terhubung.
// 500 santri = ~1 query/3 detik, bukan 500 query/3 detik.
type Hub = {
  clients: Set<ReadableStreamDefaultController<Uint8Array>>;
  lastPayload: string;
  timer: ReturnType<typeof setInterval> | null;
};
const hubs = new Map<string, Hub>();
const enc = new TextEncoder();

async function ambilHasil(sesiId: string) {
  const sesi = await prisma.sesiPemilihanLajnah.findUnique({
    where: { id: sesiId },
    select: { status: true, rencanaTutupAt: true, ditutupAt: true },
  });
  const counts = await prisma.suaraLajnah.groupBy({
    by: ["paslonId"],
    where: { sesiId },
    _count: { _all: true },
  });
  const suara: Record<string, number> = {};
  let total = 0;
  for (const c of counts) {
    suara[c.paslonId] = c._count._all;
    total += c._count._all;
  }
  return { status: sesi?.status, rencanaTutupAt: sesi?.rencanaTutupAt, totalSuara: total, suara, serverNow: new Date().toISOString() };
}

function getHub(sesiId: string): Hub {
  let hub = hubs.get(sesiId);
  if (!hub) {
    hub = { clients: new Set(), lastPayload: "", timer: null };
    hubs.set(sesiId, hub);
  }
  return hub;
}

function broadcast(sesiId: string, msg: string) {
  const hub = hubs.get(sesiId);
  if (!hub) return;
  const data = enc.encode(msg);
  const mati: ReadableStreamDefaultController<Uint8Array>[] = [];
  for (const c of hub.clients) {
    try {
      c.enqueue(data);
    } catch {
      mati.push(c); // client sudah putus
    }
  }
  for (const c of mati) hub.clients.delete(c);
}

function ensurePolling(sesiId: string) {
  const hub = getHub(sesiId);
  if (hub.timer) return;
  let n = 0;
  const tick = async () => {
    n++;
    try {
      const payload = JSON.stringify(await ambilHasil(sesiId));
      if (payload !== hub.lastPayload) {
        hub.lastPayload = payload;
        broadcast(sesiId, `data: ${payload}\n\n`);
      } else if (n % 25 === 0) {
        broadcast(sesiId, ": ping\n\n"); // heartbeat + sapu client mati
      }
    } catch {
      // coba lagi di tick berikutnya
    }
  };
  tick();
  hub.timer = setInterval(tick, 1000);
}

function lepas(sesiId: string, controller: ReadableStreamDefaultController<Uint8Array>) {
  const hub = hubs.get(sesiId);
  if (!hub) return;
  hub.clients.delete(controller);
  if (hub.clients.size === 0) {
    if (hub.timer) clearInterval(hub.timer);
    hubs.delete(sesiId);
  }
}

export async function GET(req: Request) {
  const session = await getSantriSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const sesiId = searchParams.get("sesiId");
  if (!sesiId) return NextResponse.json({ error: "sesiId wajib diisi" }, { status: 400 });

  const santri = await prisma.santriInternal.findUnique({
    where: { id: session.santriId },
    select: { dufahNama: true },
  });
  const sesiAwal = await prisma.sesiPemilihanLajnah.findUnique({
    where: { id: sesiId },
    select: { dufahNama: true },
  });
  if (!sesiAwal || sesiAwal.dufahNama !== santri?.dufahNama) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const hub = getHub(sesiId);
  ensurePolling(sesiId);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      hub.clients.add(controller);
      try {
        controller.enqueue(enc.encode("retry: 3000\n\n"));
      } catch { /* abaikan */ }
      // Kirim kondisi terkini langsung tanpa menunggu tick
      ambilHasil(sesiId)
        .then((data) => {
          const payload = JSON.stringify(data);
          hub.lastPayload = payload;
          try {
            controller.enqueue(enc.encode(`data: ${payload}\n\n`));
          } catch { /* abaikan */ }
        })
        .catch(() => {});
      req.signal.addEventListener("abort", () => {
        lepas(sesiId, controller);
        try {
          controller.close();
        } catch { /* abaikan */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
