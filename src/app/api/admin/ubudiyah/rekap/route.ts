import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import { getTodayWibString, parseWibDateString } from "@/lib/absensi";
import { UbudiyahKegiatan, UbudiyahStatus } from "@prisma/client";
import { UBUDIYAH_KEGIATAN_ORDER } from "@/lib/ubudiyah";

export const dynamic = "force-dynamic";

// GET ?tanggal=&sakan=&kegiatan=&status= — rekap absen Ubudiyah.
// tanggal default hari ini (WIB). KSU TIDAK difilter — tampil dengan
// kategori untuk badge. Urut: sakan ASC, nama ASC, lalu urutan kegiatan.
export async function GET(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("ubudiyah");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tanggal = searchParams.get("tanggal") || getTodayWibString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
    return NextResponse.json({ error: "tanggal harus format YYYY-MM-DD" }, { status: 400 });
  }
  const kegiatanParam = searchParams.get("kegiatan");
  const statusParam = searchParams.get("status");
  const sakanParam = searchParams.get("sakan");

  const kegiatan = kegiatanParam
    ? (Object.values(UbudiyahKegiatan).includes(kegiatanParam as UbudiyahKegiatan)
        ? (kegiatanParam as UbudiyahKegiatan)
        : null)
    : undefined;
  if (kegiatanParam && !kegiatan) {
    return NextResponse.json({ error: `kegiatan tidak valid: ${kegiatanParam}` }, { status: 400 });
  }
  const status = statusParam
    ? (Object.values(UbudiyahStatus).includes(statusParam as UbudiyahStatus)
        ? (statusParam as UbudiyahStatus)
        : null)
    : undefined;
  if (statusParam && !status) {
    return NextResponse.json({ error: `status tidak valid: ${statusParam}` }, { status: 400 });
  }

  const hadir = await prisma.ubudiyahHadir.findMany({
    where: {
      tanggal: parseWibDateString(tanggal),
      ...(kegiatan ? { kegiatan } : {}),
      ...(status ? { status } : {}),
    },
  });

  // Join manual: UbudiyahHadir -> RiwayatSantri (by id) -> SantriInternal
  const riwayatList = await prisma.riwayatSantri.findMany({
    where: { id: { in: [...new Set(hadir.map((h) => h.riwayatId))] } },
    select: { id: true, santriId: true },
  });
  const riwayatMap = new Map(riwayatList.map((r) => [r.id, r]));

  const santriList = await prisma.santriInternal.findMany({
    where: { id: { in: [...new Set(riwayatList.map((r) => r.santriId))] } },
    select: { id: true, nama: true, sakan: true, kategori: true },
  });
  const santriMap = new Map(santriList.map((s) => [s.id, s]));

  // pencatatNama diselesaikan dari SantriInternal bila pencatatId adalah
  // santri; bila tidak ada biarkan null.
  const pencatatList = await prisma.santriInternal.findMany({
    where: {
      id: {
        in: [...new Set(hadir.map((h) => h.pencatatId).filter((v): v is string => !!v))],
      },
    },
    select: { id: true, nama: true },
  });
  const pencatatMap = new Map(pencatatList.map((s) => [s.id, s]));

  const data = hadir
    .map((h) => {
      const r = riwayatMap.get(h.riwayatId);
      const s = r ? santriMap.get(r.santriId) : undefined;
      return {
        riwayatId: h.riwayatId,
        santriId: r?.santriId ?? "",
        nama: s?.nama ?? "Tanpa Nama",
        sakan: s?.sakan ?? "-",
        kategori: s?.kategori ?? "-",
        kegiatan: h.kegiatan,
        status: h.status,
        keterangan: h.keterangan,
        pencatatId: h.pencatatId,
        pencatatNama: h.pencatatId ? (pencatatMap.get(h.pencatatId)?.nama ?? null) : null,
      };
    })
    .filter((row) => !sakanParam || row.sakan === sakanParam)
    .sort(
      (a, b) =>
        a.sakan.localeCompare(b.sakan, "id") ||
        a.nama.localeCompare(b.nama, "id") ||
        UBUDIYAH_KEGIATAN_ORDER.indexOf(a.kegiatan) -
          UBUDIYAH_KEGIATAN_ORDER.indexOf(b.kegiatan)
    );

  return NextResponse.json({ tanggal, data });
}
