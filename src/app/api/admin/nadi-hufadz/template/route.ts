import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import { defaultFieldPositions } from "@/lib/nadi-hufadz";

export const dynamic = "force-dynamic";

// GET ?programKey=nadi-hufadz — ambil template (buat default bila belum ada)
export async function GET(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("nadi_hufadz");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const programKey = searchParams.get("programKey") || "nadi-hufadz";

  let tpl = await prisma.templateCetak.findUnique({ where: { programKey } });
  if (!tpl) {
    tpl = await prisma.templateCetak.create({
      data: {
        programKey,
        nama: programKey === "nadi-hufadz" ? "Nadi Hufadz" : programKey,
        fieldPositions: defaultFieldPositions(),
      },
    });
  }
  return NextResponse.json(tpl);
}

// PUT { programKey, nama?, backgroundUrl?, backgroundId?, fieldPositions?, isActive? }
export async function PUT(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("nadi_hufadz_edit");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { programKey, nama, backgroundUrl, backgroundId, fieldPositions, isActive } = body;
  if (!programKey) return NextResponse.json({ error: "programKey wajib diisi" }, { status: 400 });

  const data: any = {};
  if (nama !== undefined) data.nama = nama;
  if (backgroundUrl !== undefined) data.backgroundUrl = backgroundUrl;
  if (backgroundId !== undefined) data.backgroundId = backgroundId;
  if (fieldPositions !== undefined) data.fieldPositions = fieldPositions;
  if (isActive !== undefined) data.isActive = isActive;

  const tpl = await prisma.templateCetak.upsert({
    where: { programKey },
    update: data,
    create: {
      programKey,
      nama: nama || programKey,
      backgroundUrl: backgroundUrl || null,
      backgroundId: backgroundId || null,
      fieldPositions: fieldPositions || defaultFieldPositions(),
      isActive: isActive !== false,
    },
  });
  return NextResponse.json(tpl);
}
