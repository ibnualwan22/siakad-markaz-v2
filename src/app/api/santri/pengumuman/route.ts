import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSantriSession } from "@/lib/santri-auth";
import { getLembagaSantri } from "@/lib/notifikasi-target";

export const dynamic = "force-dynamic";

// Daftar pengumuman yang terlihat oleh santri ini, terbaru dulu.
// Aturan visibilitas: global (lembaga null/kosong) ATAU lembaga santri
// termasuk dalam daftar lembaga pengumuman. Filter JSON dilakukan di JS
// (ambil 100 terbaru lalu saring), bukan filter JSON Prisma.
export async function GET() {
  const session = await getSantriSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const lembagaSantri = await getLembagaSantri(session.santriId);

  const rows = await prisma.pengumuman.findMany({
    orderBy: { dibuatAt: "desc" },
    take: 100,
    select: {
      id: true,
      judul: true,
      isi: true,
      tautan: true,
      pengirimLabel: true,
      lembaga: true,
      dibuatAt: true,
    },
  });

  const visible = rows.filter((p) => {
    const target = p.lembaga as unknown;
    if (target === null || target === undefined) return true;
    if (Array.isArray(target)) {
      if (target.length === 0) return true;
      if (lembagaSantri === null) return false;
      return (target as unknown[]).includes(lembagaSantri);
    }
    return false;
  });

  const dibaca = await prisma.pengumumanDibaca.findMany({
    where: {
      santriId: session.santriId,
      pengumumanId: { in: visible.map((p) => p.id) },
    },
    select: { pengumumanId: true },
  });
  const dibacaSet = new Set(dibaca.map((d) => d.pengumumanId));

  const items = visible.map((p) => ({
    id: p.id,
    judul: p.judul,
    isi: p.isi,
    tautan: p.tautan,
    pengirimLabel: p.pengirimLabel,
    dibuatAt: p.dibuatAt,
    sudahDibaca: dibacaSet.has(p.id),
  }));

  return NextResponse.json({
    items,
    jumlahBelumDibaca: items.filter((i) => !i.sudahDibaca).length,
  });
}
