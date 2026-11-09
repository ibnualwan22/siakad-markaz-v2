import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Pengumuman GLOBAL untuk tamu (belum login) — batch app 1.0.6+7 butir 4.
// Tanpa sesi: hanya pengumuman yang lembaganya null/kosong (GLOBAL) yang
// terlihat. Bentuk respons sama dengan GET /api/santri/pengumuman, dengan
// sudahDibaca selalu false (tamu tidak punya status baca) dan tanpa
// jumlahBelumDibaca.
export const dynamic = "force-dynamic";

export async function GET() {
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
    if (Array.isArray(target)) return target.length === 0;
    return false;
  });

  const items = visible.map((p) => ({
    id: p.id,
    judul: p.judul,
    isi: p.isi,
    tautan: p.tautan,
    pengirimLabel: p.pengirimLabel,
    dibuatAt: p.dibuatAt,
    sudahDibaca: false,
  }));

  return NextResponse.json({ items });
}
