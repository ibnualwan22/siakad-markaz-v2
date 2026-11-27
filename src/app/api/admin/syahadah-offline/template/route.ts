import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasAnyPermission } from "@/lib/permission";
import {
  baseSlugFromOfflineKey,
  defaultFieldPositionsOffline,
  isMusyarokahProgramKey,
} from "@/lib/syahadah-offline";
import { getDummyPrintData } from "@/lib/syahadah-offline-data";

export const dynamic = "force-dynamic";

// Template syahadah offline per program (F4 portrait 215x330mm).
// - Lulus:      "syahadah-offline-<slug>"
// - Musyarokah: "syahadah-offline-<slug>-musyarokah"
async function isAuthorized() {
  const session = await getSession();
  if (!session) return false;
  return hasAnyPermission("data_syahadah", "layout_syahadah");
}

// GET ?programKey=syahadah-offline-idad-awal[|-musyarokah]
export async function GET(request: Request) {
  if (!(await isAuthorized())) {
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
    // Bila ini template Musyarokah baru, salin posisi & offset awal dari template Lulus-nya
    let seedPositions: any = defaultFieldPositionsOffline();
    let seedOffsetX = 0;
    let seedOffsetY = 0;
    if (isMusyarokahProgramKey(programKey)) {
      const baseKey = `syahadah-offline-${baseSlugFromOfflineKey(programKey)}`;
      const baseTpl = await prisma.templateCetak.findUnique({
        where: { programKey: baseKey },
      });
      if (baseTpl?.fieldPositions) {
        seedPositions = {
          ...defaultFieldPositionsOffline(),
          ...(baseTpl.fieldPositions as any),
        };
        seedOffsetX = Number((baseTpl as any).offsetX) || 0;
        seedOffsetY = Number((baseTpl as any).offsetY) || 0;
      }
    }

    tpl = await prisma.templateCetak.create({
      data: {
        programKey,
        nama: `Syahadah Offline ${programKey.replace("syahadah-offline-", "")}`,
        fieldPositions: seedPositions,
        offsetX: seedOffsetX,
        offsetY: seedOffsetY,
      },
    });
  }

  const dummy = await getDummyPrintData(programKey);
  return NextResponse.json({
    ...tpl,
    dummyTexts: dummy?.texts ?? null,
    dummyQrDataUrl: dummy?.qrDataUrl ?? null,
    dummyQrUrl: dummy?.qrUrl ?? null,
    dummySignatureUrl: dummy?.signatureUrl ?? null,
    isMusyarokah: dummy?.isMusyarokah ?? isMusyarokahProgramKey(programKey),
    isHufadz: dummy?.isHufadz ?? false,
    slotCount: dummy?.slotCount ?? 12,
  });
}

// PUT { programKey, nama?, backgroundUrl?, backgroundId?, fieldPositions?,
//       isActive?, locked?, offsetX?, offsetY? }
export async function PUT(request: Request) {
  if (!(await isAuthorized())) {
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
