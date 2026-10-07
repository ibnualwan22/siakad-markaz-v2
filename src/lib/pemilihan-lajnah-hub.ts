// Hub broadcast SSE untuk pemilihan lajnah — dipakai bersama oleh stream santri,
// stream admin (layar acara), dan route vote/tutup/buka.
//
// Satu instance per proses (module-level Map), sama seperti sebelumnya.
// Dua mekanisme pembaruan:
//   1. Polling interval sebagai fallback (klien baru join, dsb.).
//   2. Dorongan terdorong (push) via jadwalkanBroadcast() — debounce ~300ms,
//      dipanggil setelah vote/tutup/buka berhasil, agar layar terasa realtime.
import prisma from "@/lib/prisma";

export type RingkasanSuara = {
  status: string | undefined;
  rencanaTutupAt: string | null | undefined;
  ditutupAt: string | null | undefined;
  totalSuara: number;
  suara: Record<string, number>;
  serverNow: string;
};

type Hub = {
  clients: Set<ReadableStreamDefaultController<Uint8Array>>;
  lastPayload: string;
  timer: ReturnType<typeof setInterval> | null;
};

const hubs = new Map<string, Hub>();
const enc = new TextEncoder();

// Jendela debounce untuk dorongan broadcast (ms).
export const TUNDA_SIAR_MS = 300;
const tundaSiarkan = new Map<string, ReturnType<typeof setTimeout>>();

// Seam untuk test: ganti pembaca DB tanpa menyentuh prisma.
let bacaHasilImpl: (sesiId: string) => Promise<RingkasanSuara> = bacaHasilDariDb;
export function __aturBacaHasilUntukTes(fn: (sesiId: string) => Promise<RingkasanSuara>) {
  bacaHasilImpl = fn;
}
export function __resetHubUntukTes() {
  for (const tunda of tundaSiarkan.values()) clearTimeout(tunda);
  tundaSiarkan.clear();
  for (const hub of hubs.values()) {
    if (hub.timer) clearInterval(hub.timer);
  }
  hubs.clear();
  bacaHasilImpl = bacaHasilDariDb;
}

async function bacaHasilDariDb(sesiId: string): Promise<RingkasanSuara> {
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
  return {
    status: sesi?.status,
    rencanaTutupAt: sesi?.rencanaTutupAt?.toISOString() ?? null,
    ditutupAt: sesi?.ditutupAt?.toISOString() ?? null,
    totalSuara: total,
    suara,
    serverNow: new Date().toISOString(),
  };
}

// Kunci deteksi perubahan: seluruh isi kecuali serverNow yang selalu berubah.
// Tanpa ini, perbandingan payload tidak pernah sama sehingga broadcast
// terjadi tiap tick walau tidak ada suara masuk.
function kunciPerubahan(data: RingkasanSuara): string {
  return JSON.stringify({
    status: data.status,
    rencanaTutupAt: data.rencanaTutupAt,
    ditutupAt: data.ditutupAt,
    totalSuara: data.totalSuara,
    suara: data.suara,
  });
}

function getHub(sesiId: string): Hub {
  let hub = hubs.get(sesiId);
  if (!hub) {
    hub = { clients: new Set(), lastPayload: "", timer: null };
    hubs.set(sesiId, hub);
  }
  return hub;
}

function kirimKeKlien(sesiId: string, msg: string) {
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

// Baca ulang hasil lalu siarkan hanya bila berubah. Dipakai polling maupun push.
async function segarkanSesi(sesiId: string): Promise<boolean> {
  const hub = hubs.get(sesiId);
  if (!hub || hub.clients.size === 0) return false;
  try {
    const data = await bacaHasilImpl(sesiId);
    const kunci = kunciPerubahan(data);
    if (kunci !== hub.lastPayload) {
      hub.lastPayload = kunci;
      kirimKeKlien(sesiId, `data: ${JSON.stringify(data)}\n\n`);
      return true;
    }
  } catch {
    // coba lagi di tick berikutnya
  }
  return false;
}

function pastikanPolling(sesiId: string) {
  const hub = getHub(sesiId);
  if (hub.timer) return;
  let n = 0;
  const tick = async () => {
    n++;
    const berubah = await segarkanSesi(sesiId);
    if (!berubah && n % 25 === 0) {
      kirimKeKlien(sesiId, ": ping\n\n"); // heartbeat + sapu client mati
    }
  };
  tick();
  hub.timer = setInterval(tick, 1000);
}

// Dorong pembaruan segera setelah vote/tutup/buka. Banyak pemicu dalam
// 300ms digabung menjadi satu broadcast — database tidak dibanjiri query.
export function jadwalkanBroadcast(sesiId: string) {
  const hub = hubs.get(sesiId);
  if (!hub || hub.clients.size === 0) return; // tidak ada yang menonton
  if (tundaSiarkan.has(sesiId)) return; // sudah terjadwal dalam jendela ini
  tundaSiarkan.set(
    sesiId,
    setTimeout(() => {
      tundaSiarkan.delete(sesiId);
      void segarkanSesi(sesiId);
    }, TUNDA_SIAR_MS),
  );
}

function lepasKlien(sesiId: string, controller: ReadableStreamDefaultController<Uint8Array>) {
  const hub = hubs.get(sesiId);
  if (!hub) return;
  hub.clients.delete(controller);
  if (hub.clients.size === 0) {
    if (hub.timer) clearInterval(hub.timer);
    const tunda = tundaSiarkan.get(sesiId);
    if (tunda) {
      clearTimeout(tunda);
      tundaSiarkan.delete(sesiId);
    }
    hubs.delete(sesiId);
  }
}

// Bangun response SSE untuk satu sesi. Dipakai route stream santri & admin.
export function buatStreamSSE(sesiId: string, req: Request): Response {
  const hub = getHub(sesiId);
  pastikanPolling(sesiId);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      hub.clients.add(controller);
      try {
        controller.enqueue(enc.encode("retry: 3000\n\n"));
      } catch { /* abaikan */ }
      // Kirim kondisi terkini langsung tanpa menunggu tick
      bacaHasilImpl(sesiId)
        .then((data) => {
          const payload = JSON.stringify(data);
          hub.lastPayload = kunciPerubahan(data);
          try {
            controller.enqueue(enc.encode(`data: ${payload}\n\n`));
          } catch { /* abaikan */ }
        })
        .catch(() => {});
      req.signal.addEventListener("abort", () => {
        lepasKlien(sesiId, controller);
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
