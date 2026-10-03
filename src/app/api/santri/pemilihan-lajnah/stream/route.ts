import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSantriSession } from "@/lib/santri-auth";

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

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      let terakhir = "";
      let pingCount = 0;
      const kirim = async () => {
        try {
          const data = await ambilHasil();
          const payload = JSON.stringify(data);
          if (payload !== terakhir) {
            terakhir = payload;
            controller.enqueue(enc.encode(`data: ${payload}\n\n`));
          } else if (++pingCount % 5 === 0) {
            controller.enqueue(enc.encode(`: ping\n\n`));
          }
        } catch {
          clearInterval(iv);
          try { controller.close(); } catch {}
        }
      };
      await kirim();
      const iv = setInterval(kirim, 3000);
      req.signal.addEventListener("abort", () => {
        clearInterval(iv);
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
