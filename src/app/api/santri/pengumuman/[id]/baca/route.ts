import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSantriSession } from "@/lib/santri-auth";
import { getLembagaSantri } from "@/lib/notifikasi-target";

export const dynamic = "force-dynamic";

// Tandai satu pengumuman sebagai dibaca. Pengumuman harus terlihat oleh
// santri ini (aturan yang sama seperti GET /api/santri/pengumuman);
// bila tidak terlihat → 404 (tidak membocorkan keberadaannya).
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSantriSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  const pengumuman = await prisma.pengumuman.findUnique({
    where: { id },
    select: { id: true, lembaga: true },
  });
  if (!pengumuman) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });

  const target = pengumuman.lembaga as unknown;
  let terlihat = false;
  if (target === null || target === undefined) {
    terlihat = true;
  } else if (Array.isArray(target)) {
    if (target.length === 0) {
      terlihat = true;
    } else {
      const lembagaSantri = await getLembagaSantri(session.santriId);
      terlihat =
        lembagaSantri !== null &&
        (target as unknown[]).includes(lembagaSantri);
    }
  }
  if (!terlihat) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });

  await prisma.pengumumanDibaca.upsert({
    where: {
      pengumumanId_santriId: {
        pengumumanId: pengumuman.id,
        santriId: session.santriId,
      },
    },
    update: {},
    create: { pengumumanId: pengumuman.id, santriId: session.santriId },
  });
  return NextResponse.json({ ok: true });
}
