import assert from "node:assert/strict";
import { test } from "node:test";
import {
  __aturBacaHasilUntukTes,
  __resetHubUntukTes,
  buatStreamSSE,
  jadwalkanBroadcast,
} from "./pemilihan-lajnah-hub";

// Pengujian debounce broadcast tanpa database: pembaca DB diganti stub.
// Jalankan dengan DATABASE_URL dummy, mis:
//   DATABASE_URL=postgresql://u:p@localhost:5432/siakad npx tsx --test src/lib/pemilihan-lajnah-hub.test.ts

const dec = new TextDecoder();

// Baca dari stream SSE sampai dapat satu frame data:, lewati retry/ping.
async function bacaData(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs = 3000,
): Promise<string | null> {
  let buf = "";
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const sisa = deadline - Date.now();
    const hasil = await Promise.race([
      reader.read(),
      new Promise<null>((selesai) => setTimeout(() => selesai(null), sisa)),
    ]);
    if (!hasil || hasil.done) return null;
    buf += dec.decode(hasil.value, { stream: true });
    const idx = buf.indexOf("\n\n");
    if (idx >= 0) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      if (frame.startsWith("data:")) return frame;
    }
  }
  return null;
}

// Ambil totalSuara dari satu frame SSE (null bila frame tak valid).
function ambilTotal(frame: string | null): number | null {
  if (!frame) return null;
  try {
    const data = JSON.parse(frame.replace(/^data:/, "").trim());
    return typeof data.totalSuara === "number" ? (data.totalSuara as number) : null;
  } catch {
    return null;
  }
}

function pasangStub() {
  let suara: Record<string, number> = { p1: 0, p2: 0 };
  __aturBacaHasilUntukTes(async (sesiId: string) => {
    assert.equal(sesiId, "sesi-uji");
    const total = suara.p1 + suara.p2;
    return {
      status: "BUKA",
      rencanaTutupAt: null,
      ditutupAt: null,
      totalSuara: total,
      suara: { ...suara },
      serverNow: new Date().toISOString(),
    };
  });
  return {
    aturSuara: (p1: number, p2: number) => {
      suara = { p1, p2 };
    },
  };
}

function bukaStream() {
  const ac = new AbortController();
  const res = buatStreamSSE("sesi-uji", new Request("http://localhost/stream", { signal: ac.signal }));
  assert.ok(res.body);
  return { reader: res.body.getReader(), tutup: () => ac.abort() };
}

test("debounce: 5 pemicu cepat digabung menjadi satu broadcast", async () => {
  __resetHubUntukTes();
  const stub = pasangStub();
  const { reader, tutup } = bukaStream();

  assert.equal(ambilTotal(await bacaData(reader)), 0);

  stub.aturSuara(3, 2);
  for (let i = 0; i < 5; i++) jadwalkanBroadcast("sesi-uji");
  assert.equal(ambilTotal(await bacaData(reader)), 5);

  const ekstra = await bacaData(reader, 800);
  assert.equal(ekstra, null);

  tutup();
  __resetHubUntukTes();
});

test("jadwal dapat dipicu lagi setelah jendela debounce lewat", async () => {
  __resetHubUntukTes();
  const stub = pasangStub();
  const { reader, tutup } = bukaStream();
  await bacaData(reader); // habiskan pesan awal

  stub.aturSuara(1, 0);
  jadwalkanBroadcast("sesi-uji");
  assert.equal(ambilTotal(await bacaData(reader)), 1);

  stub.aturSuara(1, 1);
  jadwalkanBroadcast("sesi-uji");
  assert.equal(ambilTotal(await bacaData(reader)), 2);

  tutup();
  __resetHubUntukTes();
});

test("tanpa klien yang menonton, broadcast terjadwal tidak menyentuh database", async () => {
  __resetHubUntukTes();
  let panggilan = 0;
  __aturBacaHasilUntukTes(async () => {
    panggilan++;
    return { status: "BUKA", rencanaTutupAt: null, ditutupAt: null, totalSuara: 0, suara: {}, serverNow: new Date().toISOString() };
  });
  jadwalkanBroadcast("sesi-tanpa-klien");
  await new Promise((selesai) => setTimeout(selesai, 700));
  assert.equal(panggilan, 0);
  __resetHubUntukTes();
});
