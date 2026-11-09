import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import { defaultFieldPositions, templateProgramKey } from "@/lib/tadrib-funun";

export const dynamic = "force-dynamic";

// programKey "tadrib-funun-<jenisId>" -> jenisId (dipakai TemplateSyahadahTab,
// yang mengirim programKey seperti route template Nadi).
function jenisIdDariProgramKey(programKey: string): string | null {
  const prefix = "tadrib-funun-";
  if (!programKey.startsWith(prefix)) return null;
  const id = programKey.slice(prefix.length);
  return id || null;
}

// GET ?programKey=tadrib-funun-<jenisId> — ambil template syahadah satu jenis
// (buat default bila belum ada)
export async function GET(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("tadrib_funun");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const programKey = searchParams.get("programKey") || "";
  const jenisId = jenisIdDariProgramKey(programKey);
  if (!jenisId) return NextResponse.json({ error: "programKey tidak valid" }, { status: 400 });

  const jenis = await prisma.tadribFununJenis.findUnique({ where: { id: jenisId } });
  if (!jenis) return NextResponse.json({ error: "Jenis tidak ditemukan" }, { status: 404 });

  let tpl = await prisma.templateCetak.findUnique({ where: { programKey } });
  if (!tpl) {
    tpl = await prisma.templateCetak.create({
      data: {
        programKey,
        nama: `Tadrib Funun — ${jenis.nama}`,
        fieldPositions: defaultFieldPositions(),
      },
    });
  }
  return NextResponse.json(tpl);
}

// PUT { programKey, nama?, backgroundUrl?, backgroundId?, fieldPositions?, isActive? }
export async function PUT(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("tadrib_funun_edit");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const programKey = body.programKey as string | undefined;
  if (!programKey) return NextResponse.json({ error: "programKey wajib diisi" }, { status: 400 });
  const jenisId = jenisIdDariProgramKey(programKey);
  if (!jenisId) return NextResponse.json({ error: "programKey tidak valid" }, { status: 400 });

  const jenis = await prisma.tadribFununJenis.findUnique({ where: { id: jenisId } });
  if (!jenis) return NextResponse.json({ error: "Jenis tidak ditemukan" }, { status: 404 });

  const data: any = {};
  if (body.nama !== undefined) data.nama = body.nama;
  if (body.backgroundUrl !== undefined) data.backgroundUrl = body.backgroundUrl;
  if (body.backgroundId !== undefined) data.backgroundId = body.backgroundId;
  if (body.fieldPositions !== undefined) data.fieldPositions = body.fieldPositions;
  if (body.isActive !== undefined) data.isActive = body.isActive;

  const tpl = await prisma.templateCetak.upsert({
    where: { programKey },
    update: data,
    create: {
      programKey,
      nama: body.nama || `Tadrib Funun — ${jenis.nama}`,
      backgroundUrl: body.backgroundUrl || null,
      backgroundId: body.backgroundId || null,
      fieldPositions: body.fieldPositions || defaultFieldPositions(),
      isActive: body.isActive !== false,
    },
  });
  return NextResponse.json(tpl);
}
