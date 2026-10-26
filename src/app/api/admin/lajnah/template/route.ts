import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import { defaultFieldPositionsOrganisasi } from "@/lib/syahadah-organisasi";

export const dynamic = "force-dynamic";

const PROGRAM_KEY = "lajnah";
const PERMISSION = "lajnah_syahadah";

// GET ?programKey=lajnah — ambil template (buat default bila belum ada)
export async function GET(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission(PERMISSION);
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const programKey = searchParams.get("programKey") || PROGRAM_KEY;

  let tpl = await prisma.templateCetak.findUnique({ where: { programKey } });
  if (!tpl) {
    tpl = await prisma.templateCetak.create({
      data: {
        programKey,
        nama: "Lajnah",
        fieldPositions: defaultFieldPositionsOrganisasi(),
      },
    });
  }
  return NextResponse.json(tpl);
}

// PUT { programKey?, nama?, backgroundUrl?, backgroundId?, fieldPositions?, isActive? }
export async function PUT(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission(PERMISSION);
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const programKey = body.programKey || PROGRAM_KEY;
  const { nama, backgroundUrl, backgroundId, fieldPositions, isActive } = body;

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
      nama: nama || "Lajnah",
      backgroundUrl: backgroundUrl || null,
      backgroundId: backgroundId || null,
      fieldPositions: fieldPositions || defaultFieldPositionsOrganisasi(),
      isActive: isActive !== false,
    },
  });
  return NextResponse.json(tpl);
}
