import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import { getActiveDufahName } from "@/lib/absensi";

export const dynamic = "force-dynamic";

// GET ?dufahNama=... — status buka/tutup pendaftaran satu dufah.
// Tanpa baris = tertutup.
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
  return NextResponse.json({ dufahNama, dibuka: periode?.dibuka ?? false });
}

// POST { dufahNama?, dibuka } — buka/tutup pendaftaran satu dufah.
export async function POST(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("nadi_hufadz_edit");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const dufahNama = body.dufahNama || (await getActiveDufahName()) || "";
  if (!dufahNama) return NextResponse.json({ error: "Dufah tidak ditemukan" }, { status: 400 });
  if (typeof body.dibuka !== "boolean") {
    return NextResponse.json({ error: "dibuka wajib boolean" }, { status: 400 });
  }

  const periode = await prisma.nadiHufadzPeriode.upsert({
    where: { dufahNama },
    update: { dibuka: body.dibuka },
    create: { dufahNama, dibuka: body.dibuka },
  });

  return NextResponse.json({ dufahNama: periode.dufahNama, dibuka: periode.dibuka });
}
