import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import { defaultFieldPositionsMunaqosah } from "@/lib/munaqosah-hufadz";

export const dynamic = "force-dynamic";

const PROGRAM_KEY = "munaqosah-hufadz";

// GET ?programKey=munaqosah-hufadz — ambil template (buat default bila
// belum ada). Background default KOSONG: gambar template kiriman user
// diupload via Cloudinary lewat editor (file JPG tidak bisa ikut push
// connector — hanya file teks UTF-8 yang bisa didorong).
export async function GET(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("nadi_hufadz");
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
        nama: "Munaqosah Hufadz",
        backgroundUrl: null,
        fieldPositions: defaultFieldPositionsMunaqosah(),
      },
    });
  }
  return NextResponse.json(tpl);
}

// PUT { programKey?, nama?, backgroundUrl?, backgroundId?, fieldPositions?, isActive? }
export async function PUT(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("nadi_hufadz_edit");
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
      nama: nama || "Munaqosah Hufadz",
      backgroundUrl: backgroundUrl ?? null,
      backgroundId: backgroundId ?? null,
      fieldPositions: fieldPositions ?? defaultFieldPositionsMunaqosah(),
    },
  });
  return NextResponse.json(tpl);
}
