import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { getActiveDufahName } from "@/lib/absensi";

/**
 * GET /api/bawwabah/status — status periode Siakad untuk Bawwabah (Fase 7).
 *
 * Dipakai Bawwabah untuk memverifikasi propagasi setelah memicu rollover
 * PPDB: apakah Siakad sudah mengikuti (dufah aktif = dufah baru), berapa
 * santri aktif, dan kapan terakhir sync. Read-only, tanpa efek samping.
 *
 * Auth: header `x-bawwabah-key` == env BAWABAH_API_KEY. Tanpa key -> 401.
 *
 * Respons: { dufahAktif, jumlahSantriAktif, lastSyncedAt }
 *   - dufahAktif: nama dufah berjalan versi Siakad (turunan dari santri
 *     aktif bersakan terbanyak — getActiveDufahName yang sudah ada).
 *   - jumlahSantriAktif: santri isAktif=true yang sudah punya sakan.
 *   - lastSyncedAt: sync terakhir (ISO) atau null.
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

export async function GET(req: Request) {
  if (!kunciBawwabahValid(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const dufahAktif = await getActiveDufahName();
    const jumlahSantriAktif = await prisma.santriInternal.count({
      where: {
        isAktif: true,
        dufahNama: { not: null },
        sakan: { not: "-" },
      },
    });
    const lastSynced = await prisma.santriInternal.findFirst({
      where: { lastSyncedAt: { not: null } },
      orderBy: { lastSyncedAt: "desc" },
      select: { lastSyncedAt: true },
    });
    return NextResponse.json({
      dufahAktif,
      jumlahSantriAktif,
      lastSyncedAt: lastSynced?.lastSyncedAt?.toISOString() ?? null,
    });
  } catch (e) {
    console.error("GET /api/bawwabah/status gagal:", e);
    return NextResponse.json(
      { error: "Gagal membaca status Siakad" },
      { status: 500 }
    );
  }
}
