import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import { defaultFieldPositionsOffline } from "@/lib/syahadah-offline";
import { getDummyPrintData } from "@/lib/syahadah-offline-data";

export const dynamic = "force-dynamic";

// Template syahadah offline per program (A4 portrait, pre-printed).
// programKey: "syahadah-offline-<slug program>", mis. "syahadah-offline-idad-awal".
// Izin: data_syahadah (sama seperti halaman Data Syahadah).
const PERMISSION = "data_syahadah";

// GET ?programKey=syahadah-offline-idad-awal — ambil template
// (buat default bila belum ada).
export async function GET(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission(PERMISSION);
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const programKey = searchParams.get("programKey") || "";
  if (!programKey.startsWith("syahadah-offline-")) {
    return NextResponse.json(
      { error: "programKey harus diawali syahadah-offline-" },
      { status: 400 },
    );
  }

  let tpl = await prisma.templateCetak.findUnique({ where: { programKey } });
  if (!tpl) {
    tpl = await prisma.templateCetak.create({
      data: {
        programKey,
        nama: `Syahadah Offline ${programKey.replace("syahadah-offline-", "")}`,
        fieldPositions: defaultFieldPositionsOffline(),
      },
    });
  }
  // Teks dummy untuk preview editor — SAMA dengan yang dipakai halaman
  // cetak tes (getDummyPrintData: Ahmad Ibnu Alwan, nilai ٩٥, nama program
  // asli). Bila programKey tidak cocok program mana pun, null — tab
  // memakai OFFLINE_FIELD_SAMPLE sebagai fallback.
  const dummy = await getDummyPrintData(programKey);
  return NextResponse.json({ ...tpl, dummyTexts: dummy?.texts ?? null });
}

// PUT { programKey, nama?, backgroundUrl?, backgroundId?, fieldPositions?,
//       isActive?, locked?, offsetX?, offsetY? }
export async function PUT(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission(PERMISSION);
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const programKey = body.programKey || "";
  if (!programKey.startsWith("syahadah-offline-")) {
    return NextResponse.json(
      { error: "programKey harus diawali syahadah-offline-" },
      { status: 400 },
    );
  }
  const {
    nama,
    backgroundUrl,
    backgroundId,
    fieldPositions,
    isActive,
    locked,
    offsetX,
    offsetY,
  } = body;

  const data: any = {};
  if (nama !== undefined) data.nama = nama;
  if (backgroundUrl !== undefined) data.backgroundUrl = backgroundUrl;
  if (backgroundId !== undefined) data.backgroundId = backgroundId;
  if (fieldPositions !== undefined) data.fieldPositions = fieldPositions;
  if (isActive !== undefined) data.isActive = isActive;
  if (locked !== undefined) data.locked = locked;
  if (offsetX !== undefined) data.offsetX = Number(offsetX) || 0;
  if (offsetY !== undefined) data.offsetY = Number(offsetY) || 0;

  const tpl = await prisma.templateCetak.upsert({
    where: { programKey },
    update: data,
    create: {
      programKey,
      nama: nama || `Syahadah Offline ${programKey.replace("syahadah-offline-", "")}`,
      backgroundUrl: backgroundUrl || null,
      backgroundId: backgroundId || null,
      fieldPositions: fieldPositions || defaultFieldPositionsOffline(),
      isActive: isActive !== false,
      locked: locked === true,
      offsetX: Number(offsetX) || 0,
      offsetY: Number(offsetY) || 0,
    },
  });
  return NextResponse.json(tpl);
}
