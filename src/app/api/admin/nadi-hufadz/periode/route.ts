import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import { getActiveDufahName } from "@/lib/absensi";
import {
  resolveNadiHufadzMinHadir,
  validasiNadiHufadzMinHadir,
} from "@/lib/nadi-hufadz";

export const dynamic = "force-dynamic";

// GET ?dufahNama=... — status buka/tutup pendaftaran + ambang minimal
// kehadiran tasmi' satu dufah. Tanpa baris = tertutup, ambang = default.
export async function GET(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("nadi_hufadz");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dufahNama = searchParams.get("dufahNama") || (await getActiveDufahName()) || "";
  if (!dufahNama) return NextResponse.json({ error: "Dufah tidak ditemukan" }, { status: 400 });

  const periode = await prisma.nadiHufadzPeriode.findUnique({ where: { dufahNama } });
  return NextResponse.json({
    dufahNama,
    dibuka: periode?.dibuka ?? false,
    minHadir: resolveNadiHufadzMinHadir(periode?.minHadir),
  });
}

// POST { dufahNama?, dibuka?, minHadir? } — buka/tutup pendaftaran dan/atau
// ubah ambang minimal kehadiran tasmi' satu dufah. Minimal satu field wajib
// diisi; field yang tidak dikirim tidak diubah (upsert parsial).
export async function POST(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("nadi_hufadz_edit");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const dufahNama = body.dufahNama || (await getActiveDufahName()) || "";
  if (!dufahNama) return NextResponse.json({ error: "Dufah tidak ditemukan" }, { status: 400 });
  if (typeof body.dibuka !== "boolean" && body.minHadir === undefined) {
    return NextResponse.json({ error: "dibuka atau minHadir wajib diisi" }, { status: 400 });
  }
  if (body.dibuka !== undefined && typeof body.dibuka !== "boolean") {
    return NextResponse.json({ error: "dibuka wajib boolean" }, { status: 400 });
  }
  if (body.minHadir !== undefined) {
    const err = validasiNadiHufadzMinHadir(body.minHadir);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }

  const update: { dibuka?: boolean; minHadir?: number } = {};
  if (typeof body.dibuka === "boolean") update.dibuka = body.dibuka;
  if (body.minHadir !== undefined) update.minHadir = body.minHadir;

  const periode = await prisma.nadiHufadzPeriode.upsert({
    where: { dufahNama },
    update,
    create: { dufahNama, dibuka: update.dibuka ?? false, minHadir: update.minHadir ?? null },
  });

  return NextResponse.json({
    dufahNama: periode.dufahNama,
    dibuka: periode.dibuka,
    minHadir: resolveNadiHufadzMinHadir(periode.minHadir),
  });
}
