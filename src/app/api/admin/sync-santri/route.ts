import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { checkPermission } from "@/lib/permission";
import { jalankanSyncSantri } from "@/lib/sync-santri";

/**
 * POST /api/admin/sync-santri — sinkronisasi santri PPDB -> Siakad.
 *
 * Fase 7: DIKUNCI. Sebelumnya tanpa autentikasi sama sekali.
 * Diterima: (a) sesi admin dengan izin manajemen_dufah, ATAU
 * (b) header `x-bawwabah-key` == env BAWABAH_API_KEY (dipakai tombol
 * Kirim Ulang di Bawwabah saat webhook gagal). Tanpa keduanya -> 401.
 *
 * Logika sync-nya ada di `@/lib/sync-santri` (dipakai juga handler
 * webhook PPDB secara in-process — jadi penguncian route ini TIDAK
 * memengaruhi webhook).
 *
 * Tombol manual "Sinkronisasi PPDB" di sidebar admin DIHAPUS (perintah
 * user 6 Nov 2026): sync berjalan otomatis di belakang layar via webhook;
 * kirim ulang pindah ke Bawwabah (/periode).
 */
function kunciBawwabahValid(req: Request): boolean {
  const key = process.env.BAWABAH_API_KEY;
  if (!key) return false;
  const got = req.headers.get("x-bawwabah-key");
  if (!got) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(key);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!kunciBawwabahValid(req)) {
    const boleh = await checkPermission("manajemen_dufah");
    if (!boleh) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const hasil = await jalankanSyncSantri();
  if (!hasil.success) {
    return NextResponse.json({ error: hasil.error }, { status: hasil.status });
  }
  return NextResponse.json({
    success: true,
    syncedCount: hasil.syncedCount,
    newRiwayatCount: hasil.newRiwayatCount,
    newDufahCount: hasil.newDufahCount,
    deactivatedCount: hasil.deactivatedCount,
    timestamp: hasil.timestamp,
  });
}

// GET: Return last sync timestamp
export async function GET() {
  try {
    const lastSynced = await prisma.santriInternal.findFirst({
      where: { lastSyncedAt: { not: null } },
      orderBy: { lastSyncedAt: "desc" },
      select: { lastSyncedAt: true },
    });

    const totalSantri = await prisma.santriInternal.count({
      where: { isAktif: true },
    });

    return NextResponse.json({
      lastSyncedAt: lastSynced?.lastSyncedAt?.toISOString() ?? null,
      totalSantriAktif: totalSantri,
    });
  } catch {
    return NextResponse.json({ lastSyncedAt: null, totalSantriAktif: 0 });
  }
}
