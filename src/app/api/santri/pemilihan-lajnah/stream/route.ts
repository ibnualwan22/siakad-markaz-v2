import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSantriSession } from "@/lib/santri-auth";
import { tutupPemilihanKedaluwarsa } from "@/lib/pemilihan-lajnah";

export const dynamic = "force-dynamic";

// GET /api/santri/pemilihan-lajnah/stream?sesiId= — Server-Sent Events hasil live.
// Mengirim update setiap ada perubahan suara / status sesi (poll 3 detik).
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

  const ambilHasil = async () => {
    await tutupPemilihanKedaluwarsa(prisma, sesiId);
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
    return { status: sesi?.status, rencanaTutupAt: sesi?.rencanaTutupAt, totalSuara: total, suara };
  };

  let stop = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      let terakhir = "";
      let pingCount = 0;
      let stopped = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      stop = () => {
        if (stopped) return;
        stopped = true;
        if (timer) clearTimeout(timer);
        req.signal.removeEventListener("abort", stop);
        try { controller.close(); } catch { /* already closed or cancelled */ }
      };
      const kirim = async () => {
        try {
          const data = await ambilHasil();
          if (stopped) return;
          const payload = JSON.stringify(data);
          if (payload !== terakhir || ++pingCount % 5 === 0) {
            terakhir = payload;
            // Keep the changing clock out of change detection. A periodic data
            // heartbeat lets clients refresh their server clock offset too.
            controller.enqueue(enc.encode(`data: ${JSON.stringify({ ...data, serverNow: new Date().toISOString() })}\n\n`));
          }
        } catch {
          stop();
        } finally {
          if (!stopped) timer = setTimeout(kirim, 3000);
        }
      };
      req.signal.addEventListener("abort", stop, { once: true });
      if (req.signal.aborted) stop();
      else void kirim();
    },
    cancel() { stop(); },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // matikan buffer nginx agar SSE realtime
    },
  });
}
