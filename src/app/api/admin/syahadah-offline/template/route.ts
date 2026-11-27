import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasAnyPermission } from "@/lib/permission";
import { lembagaFromProgramKategori } from "@/lib/lembaga";
import {
  baseSlugFromOfflineKey,
  defaultFieldPositionsOffline,
  isLembagaGlobalKey,
  isMusyarokahProgramKey,
  lembagaFromGlobalKey,
  offlineLembagaKey,
  offlineMusyarokahProgramKey,
  offlineProgramKey,
  slugifyProgram,
} from "@/lib/syahadah-offline";
import { getDummyPrintData } from "@/lib/syahadah-offline-data";

export const dynamic = "force-dynamic";

// Template syahadah offline (F4 portrait 215x330mm):
// - Global per lembaga (1 background + layout global per lembaga):
//     "syahadah-offline-lembaga-<arabiyah|turats|hufadz>"
//     "syahadah-offline-lembaga-<arabiyah|turats|hufadz>-musyarokah"
// - Override per program:
//     "syahadah-offline-<slug>"
//     "syahadah-offline-<slug>-musyarokah"
async function isAuthorized() {
  const session = await getSession();
  if (!session) return false;
  return hasAnyPermission("data_syahadah", "layout_syahadah");
}

// GET ?programKey=...
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

  const isGlobal = isLembagaGlobalKey(programKey);
  const isMusyarokah = isMusyarokahProgramKey(programKey);

  let tpl = await prisma.templateCetak.findUnique({ where: { programKey } });
  if (!tpl) {
    let seedPositions: any = defaultFieldPositionsOffline();
    let seedOffsetX = 0;
    let seedOffsetY = 0;

    if (isGlobal) {
      const lembaga = lembagaFromGlobalKey(programKey);
      if (isMusyarokah && lembaga) {
        const baseLembaga = await prisma.templateCetak.findUnique({
          where: { programKey: offlineLembagaKey(lembaga, false) },
        });
        if (baseLembaga?.fieldPositions) {
          seedPositions = {
            ...defaultFieldPositionsOffline(),
            ...(baseLembaga.fieldPositions as any),
          };
          seedOffsetX = Number((baseLembaga as any).offsetX) || 0;
          seedOffsetY = Number((baseLembaga as any).offsetY) || 0;
        }
      }
    } else if (isMusyarokah) {
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
  // Untuk key per-program, tampilkan background global lembaga sebagai prioritas utama
  let effectiveBg = tpl.backgroundUrl;
  let lembagaBackgroundUrl: string | null = isGlobal ? tpl.backgroundUrl : null;
  if (!isGlobal && dummy?.lembaga) {
    const lembagaTpl = await prisma.templateCetak.findUnique({
      where: { programKey: offlineLembagaKey(dummy.lembaga, isMusyarokah) },
      select: { backgroundUrl: true },
    });
    lembagaBackgroundUrl = lembagaTpl?.backgroundUrl ?? null;
    effectiveBg = lembagaBackgroundUrl ?? tpl.backgroundUrl;
  }

  return NextResponse.json({
    ...tpl,
    backgroundUrl: effectiveBg,
    lembagaBackgroundUrl,
    dummyTexts: dummy?.texts ?? null,
    dummyQrDataUrl: dummy?.qrDataUrl ?? null,
    dummyQrUrl: dummy?.qrUrl ?? null,
    dummySignatureUrl: dummy?.signatureUrl ?? null,
    isMusyarokah: dummy?.isMusyarokah ?? isMusyarokah,
    isHufadz: dummy?.isHufadz ?? false,
    slotCount: dummy?.slotCount ?? 12,
  });
}

// PUT { programKey, nama?, backgroundUrl?, backgroundId?, fieldPositions?,
//       isActive?, locked?, offsetX?, offsetY?, applyToAllPrograms? }
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
    applyToAllPrograms,
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

  // Bila menyimpan layout pada template Global Lembaga, langsung terapkan
  // posisi field & offset ke SEMUA program dalam lembaga tersebut!
  let propagatedCount = 0;
  const shouldPropagate =
    isLembagaGlobalKey(programKey) &&
    fieldPositions !== undefined &&
    applyToAllPrograms !== false;

  if (shouldPropagate) {
    const lembaga = lembagaFromGlobalKey(programKey);
    const isMusyarokah = isMusyarokahProgramKey(programKey);
    if (lembaga) {
      const allPrograms = await prisma.program.findMany({
        select: { nama_indo: true, kategori: true },
      });
      const matchingPrograms = allPrograms.filter(
        (p) => lembagaFromProgramKategori(p.kategori) === lembaga,
      );

      for (const prog of matchingPrograms) {
        const slug = slugifyProgram(prog.nama_indo || "");
        if (!slug) continue;
        const pKey = isMusyarokah
          ? offlineMusyarokahProgramKey(prog.nama_indo)
          : offlineProgramKey(prog.nama_indo);

        await prisma.templateCetak.upsert({
          where: { programKey: pKey },
          update: {
            fieldPositions,
            ...(offsetX !== undefined ? { offsetX: Number(offsetX) || 0 } : {}),
            ...(offsetY !== undefined ? { offsetY: Number(offsetY) || 0 } : {}),
          },
          create: {
            programKey: pKey,
            nama: `Syahadah Offline ${pKey.replace("syahadah-offline-", "")}`,
            backgroundUrl: null,
            backgroundId: null,
            fieldPositions,
            isActive: true,
            locked: false,
            offsetX: Number(offsetX) || 0,
            offsetY: Number(offsetY) || 0,
          },
        });
        propagatedCount++;
      }
    }
  }

  return NextResponse.json({ ...tpl, propagatedCount });
}
