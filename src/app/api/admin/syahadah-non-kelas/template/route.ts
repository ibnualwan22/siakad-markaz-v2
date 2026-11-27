import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasAnyPermission } from "@/lib/permission";
import {
  defaultFallbackBackgroundForNonKelas,
  defaultNonKelasPositions,
  isValidNonKelasProgramKey,
  normalizeNonKelasPositions,
} from "@/lib/syahadah-non-kelas";
import { getNonKelasDummyData } from "@/lib/syahadah-non-kelas-data";

export const dynamic = "force-dynamic";

async function isAuthorized() {
  const session = await getSession();
  if (!session) return false;
  return hasAnyPermission(
    "data_syahadah",
    "layout_syahadah",
    "nadi_hufadz",
    "lajnah_syahadah",
    "osim_syahadah",
    "tadrib_funun",
    "martabah_ula",
  );
}

// GET ?programKey=nadi-hufadz|lajnah|osim|tadrib-funun-...|non-kelas-cac|non-kelas-martabah-arabiyah|non-kelas-martabah-turats
export async function GET(request: Request) {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const programKey = searchParams.get("programKey") || "";
  if (!isValidNonKelasProgramKey(programKey)) {
    return NextResponse.json(
      { error: "programKey syahadah non-kelas tidak valid" },
      { status: 400 },
    );
  }

  let tpl = await prisma.templateCetak.findUnique({ where: { programKey } });
  if (!tpl) {
    tpl = await prisma.templateCetak.create({
      data: {
        programKey,
        nama: `Syahadah Non-Kelas ${programKey}`,
        fieldPositions: {
          ...defaultNonKelasPositions(programKey),
          units: "pct",
        },
      },
    });
  }

  const dummy = await getNonKelasDummyData(programKey);
  const normalizedPositions = normalizeNonKelasPositions(
    programKey,
    (tpl.fieldPositions as Record<string, unknown>) || null,
  );

  return NextResponse.json({
    ...tpl,
    backgroundUrl:
      tpl.backgroundUrl ?? defaultFallbackBackgroundForNonKelas(programKey),
    hasCustomBackground: Boolean(tpl.backgroundUrl),
    fieldPositions: normalizedPositions,
    dummyTexts: dummy?.texts ?? null,
    dummyQrUrl: dummy?.qrUrl ?? null,
    dummySignatureUrl: dummy?.signatureUrl ?? null,
    dummyStampUrl: dummy?.stampUrl ?? null,
    jenisLabel: dummy?.jenisLabel ?? programKey,
  });
}

// PUT { programKey, backgroundUrl?, backgroundId?, fieldPositions?, locked?, offsetX?, offsetY? }
export async function PUT(request: Request) {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const programKey = String(body.programKey || "");
  if (!isValidNonKelasProgramKey(programKey)) {
    return NextResponse.json(
      { error: "programKey syahadah non-kelas tidak valid" },
      { status: 400 },
    );
  }

  const {
    nama,
    backgroundUrl,
    backgroundId,
    fieldPositions,
    locked,
    offsetX,
    offsetY,
  } = body;

  const data: Record<string, unknown> = {};
  if (nama !== undefined) data.nama = nama;
  if (backgroundUrl !== undefined) data.backgroundUrl = backgroundUrl;
  if (backgroundId !== undefined) data.backgroundId = backgroundId;
  if (fieldPositions !== undefined) {
    data.fieldPositions = { ...fieldPositions, units: "pct" };
  }
  if (locked !== undefined) data.locked = Boolean(locked);
  if (offsetX !== undefined) data.offsetX = Number(offsetX) || 0;
  if (offsetY !== undefined) data.offsetY = Number(offsetY) || 0;

  const tpl = await prisma.templateCetak.upsert({
    where: { programKey },
    update: data,
    create: {
      programKey,
      nama: nama || `Syahadah Non-Kelas ${programKey}`,
      backgroundUrl: backgroundUrl || null,
      backgroundId: backgroundId || null,
      fieldPositions: fieldPositions
        ? { ...fieldPositions, units: "pct" }
        : { ...defaultNonKelasPositions(programKey), units: "pct" },
      isActive: true,
      locked: locked === true,
      offsetX: Number(offsetX) || 0,
      offsetY: Number(offsetY) || 0,
    },
  });

  return NextResponse.json(tpl);
}
