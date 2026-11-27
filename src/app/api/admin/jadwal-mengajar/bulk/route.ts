import { NextResponse } from "next/server";
import { SesiKelas } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";

export const dynamic = "force-dynamic";

const VALID_SESI = new Set<string>(Object.values(SesiKelas));
const SINGLE_TEACHER_SESI = new Set<string>([
  "SESI_1",
  "SESI_2",
  "SESI_3",
  "SESI_4",
  "SESI_5",
  "SESI_6",
]);

type BulkPengajarSesiInput = {
  kelasId: string;
  sesi: string;
  userId: string;
};

type BulkPengajarSesiProgramInput = {
  programId: string;
  sesi: string;
  userId: string;
};

type BulkSlotMetaInput = {
  targetKey: string;
  sesi: string;
  mapelId?: string | null;
  keterangan?: string | null;
};

export async function POST(request: Request) {
  const session = await getSession();
  const hasPermission = await checkPermission("jadwal_mengajar_edit");
  if (!session || !hasPermission) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const rawPengajarSesi: BulkPengajarSesiInput[] = Array.isArray(body?.pengajarSesi)
      ? body.pengajarSesi
      : [];
    const rawPengajarSesiProgram: BulkPengajarSesiProgramInput[] = Array.isArray(body?.pengajarSesiProgram)
      ? body.pengajarSesiProgram
      : [];
    const rawSlotMetas: BulkSlotMetaInput[] = Array.isArray(body?.slotMetas)
      ? body.slotMetas
      : [];
    const columnOrder: string[] | undefined = Array.isArray(body?.columnOrder)
      ? body.columnOrder.filter((x: unknown): x is string => typeof x === "string" && x.length > 0)
      : undefined;
    const syncWaliKelas = body?.syncWaliKelas !== false;

    // 1. Validasi & deduplikasi PengajarSesi
    const psSeen = new Set<string>();
    const singleSlotSeen = new Set<string>();
    const cleanPengajarSesi: { kelasId: string; sesi: SesiKelas; userId: string }[] = [];

    for (const item of rawPengajarSesi) {
      if (!item?.kelasId || !item?.userId || !VALID_SESI.has(item?.sesi)) continue;
      const uniqKey = `${item.userId}|${item.kelasId}|${item.sesi}`;
      if (psSeen.has(uniqKey)) continue;

      if (SINGLE_TEACHER_SESI.has(item.sesi)) {
        const slotKey = `${item.kelasId}|${item.sesi}`;
        if (singleSlotSeen.has(slotKey)) continue;
        singleSlotSeen.add(slotKey);
      }

      psSeen.add(uniqKey);
      cleanPengajarSesi.push({
        kelasId: item.kelasId,
        sesi: item.sesi as SesiKelas,
        userId: item.userId,
      });
    }

    // 2. Validasi & deduplikasi PengajarSesiProgram
    const pspSeen = new Set<string>();
    const cleanPengajarSesiProgram: { programId: string; sesi: SesiKelas; userId: string }[] = [];

    for (const item of rawPengajarSesiProgram) {
      if (!item?.programId || !item?.userId || !VALID_SESI.has(item?.sesi)) continue;
      const uniqKey = `${item.userId}|${item.programId}|${item.sesi}`;
      if (pspSeen.has(uniqKey)) continue;
      pspSeen.add(uniqKey);
      cleanPengajarSesiProgram.push({
        programId: item.programId,
        sesi: item.sesi as SesiKelas,
        userId: item.userId,
      });
    }

    // 2b. Hanya Super Admin (ADMIN) yang boleh mengosongkan seluruh jadwal sekaligus
    if (
      cleanPengajarSesi.length === 0 &&
      cleanPengajarSesiProgram.length === 0 &&
      session.role !== "ADMIN"
    ) {
      const [existingPS, existingPSP] = await Promise.all([
        prisma.pengajarSesi.count(),
        prisma.pengajarSesiProgram.count(),
      ]);
      if (existingPS > 0 || existingPSP > 0) {
        return NextResponse.json(
          { error: "Hanya Super Admin (ADMIN) yang dapat mengosongkan semua jadwal." },
          { status: 403 }
        );
      }
    }

    // 3. Validasi khusus Sesi 6 (Wali Kelas): 1 user hanya boleh menjadi wali untuk 1 kelas (User.kelasId @unique)
    const sesi6ByUser = new Map<string, string[]>();
    const waliByKelas = new Map<string, string>();
    for (const item of cleanPengajarSesi) {
      if (item.sesi === "SESI_6") {
        waliByKelas.set(item.kelasId, item.userId);
        if (!sesi6ByUser.has(item.userId)) sesi6ByUser.set(item.userId, []);
        sesi6ByUser.get(item.userId)!.push(item.kelasId);
      }
    }

    if (syncWaliKelas) {
      const duplicateSesi6Users = Array.from(sesi6ByUser.entries()).filter(
        ([, kelasIds]) => kelasIds.length > 1
      );
      if (duplicateSesi6Users.length > 0) {
        const dupUserIds = duplicateSesi6Users.map(([uid]) => uid);
        const users = await prisma.user.findMany({
          where: { id: { in: dupUserIds } },
          select: { id: true, nama: true },
        });
        const names = users.map((u) => u.nama).join(", ");
        return NextResponse.json(
          {
            error: `Bentrok di Sesi 6 (Wali Kelas): ${names || "Pengajar"} mengisi lebih dari 1 kelas di Sesi 6. Setiap pengajar hanya bisa menjadi wali untuk 1 kelas.`,
          },
          { status: 400 }
        );
      }
    }

    // 4. Validasi & deduplikasi JadwalSlotMeta
    const metaMap = new Map<
      string,
      { targetKey: string; sesi: SesiKelas; mapelId: string | null; keterangan: string | null }
    >();
    for (const m of rawSlotMetas) {
      if (!m?.targetKey || !VALID_SESI.has(m?.sesi)) continue;
      const mapelId = typeof m.mapelId === "string" && m.mapelId.trim() ? m.mapelId.trim() : null;
      const keterangan =
        typeof m.keterangan === "string" && m.keterangan.trim() ? m.keterangan.trim() : null;
      if (!mapelId && !keterangan) continue;
      metaMap.set(`${m.targetKey}|${m.sesi}`, {
        targetKey: m.targetKey,
        sesi: m.sesi as SesiKelas,
        mapelId,
        keterangan,
      });
    }
    const cleanSlotMetas = Array.from(metaMap.values());

    // 5. Simpan seluruh draft + sinkronkan Wali Kelas dalam satu transaksi
    await prisma.$transaction(async (tx) => {
      await tx.pengajarSesi.deleteMany({});
      if (cleanPengajarSesi.length > 0) {
        await tx.pengajarSesi.createMany({
          data: cleanPengajarSesi,
          skipDuplicates: true,
        });
      }

      await tx.pengajarSesiProgram.deleteMany({});
      if (cleanPengajarSesiProgram.length > 0) {
        await tx.pengajarSesiProgram.createMany({
          data: cleanPengajarSesiProgram,
          skipDuplicates: true,
        });
      }

      await tx.jadwalSlotMeta.deleteMany({});
      if (cleanSlotMetas.length > 0) {
        await tx.jadwalSlotMeta.createMany({
          data: cleanSlotMetas,
          skipDuplicates: true,
        });
      }

      if (columnOrder) {
        await tx.pengaturanJadwalMengajar.upsert({
          where: { id: 1 },
          update: { columnOrder },
          create: { id: 1, columnOrder },
        });
      }

      if (syncWaliKelas) {
        // Lepas semua relasi kelasId lama dulu agar tidak kena unique constraint saat tukar kelas
        await tx.user.updateMany({
          where: { kelasId: { not: null } },
          data: { kelasId: null },
        });

        for (const [kelasId, userId] of waliByKelas.entries()) {
          await tx.user.update({
            where: { id: userId },
            data: { kelasId },
          });
        }
      }
    });

    return NextResponse.json({
      success: true,
      savedCount: cleanPengajarSesi.length + cleanPengajarSesiProgram.length,
      syncedWaliCount: syncWaliKelas ? waliByKelas.size : 0,
    });
  } catch (error) {
    console.error("Gagal menyimpan jadwal mengajar massal:", error);
    return NextResponse.json(
      { error: "Gagal menyimpan perubahan jadwal mengajar" },
      { status: 500 }
    );
  }
}
