import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSantriSession } from "@/lib/santri-auth";
import {
  getActiveDufahName,
  getActiveRiwayatListForAbsen,
  getTodayWibString,
  parseWibDateString,
} from "@/lib/absensi";
import { UbudiyahKegiatan, UbudiyahStatus } from "@prisma/client";
import { isUbudiyahKeteranganRequired, isValidUbudiyahStatus } from "@/lib/ubudiyah";

export const dynamic = "force-dynamic";

// Bentuk absen hari ini: { [kegiatan]: { [riwayatId]: { status, keterangan } } }
type AbsenHariIni = Record<
  string,
  Record<string, { status: UbudiyahStatus; keterangan: string | null }>
>;

// Baris penunjukan Qism untuk satu santri pada satu dufah
// (unique [santriId, dufahNama]).
async function getQismAktif(santriId: string, dufahNama: string) {
  return prisma.ubudiyahQism.findUnique({
    where: { santriId_dufahNama: { santriId, dufahNama } },
  });
}

// GET — daftar santri sakan + absen hari ini untuk Qism Ubudiyah yang login.
// Bukan Qism -> { isQism: false, santriList: [], absenHariIni: {} }.
export async function GET() {
  const session = await getSantriSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tanggal = getTodayWibString();
  const dufahNama = (await getActiveDufahName()) || "";

  const notQism = () =>
    NextResponse.json({ isQism: false, tanggal, dufahNama, santriList: [], absenHariIni: {} });
  if (!dufahNama) return notQism();

  const qism = await getQismAktif(session.santriId, dufahNama);
  if (!qism || !qism.isActive) return notQism();

  // Sakan penunjukan harus sama dengan sakan santri saat ini; bila santri
  // sudah pindah sakan, penunjukan dianggap tidak berlaku.
  const saya = await prisma.santriInternal.findUnique({
    where: { id: session.santriId },
    select: { sakan: true },
  });
  if (!saya?.sakan || saya.sakan !== qism.sakan) return notQism();

  const sakan = qism.sakan;
  const targets = await getActiveRiwayatListForAbsen(undefined, sakan);
  const santriList = targets.map((t) => ({
    riwayatId: t.riwayatId,
    santriId: t.santriId,
    nama: t.nama,
    sakan: t.sakan,
    kategori: t.kategori,
  }));

  const riwayatIds = santriList.map((s) => s.riwayatId);
  const hadir = riwayatIds.length
    ? await prisma.ubudiyahHadir.findMany({
        where: { tanggal: parseWibDateString(tanggal), riwayatId: { in: riwayatIds } },
      })
    : [];

  const absenHariIni: AbsenHariIni = {};
  for (const h of hadir) {
    if (!absenHariIni[h.kegiatan]) absenHariIni[h.kegiatan] = {};
    absenHariIni[h.kegiatan][h.riwayatId] = { status: h.status, keterangan: h.keterangan };
  }

  return NextResponse.json({ isQism: true, sakan, tanggal, dufahNama, santriList, absenHariIni });
}

// POST { tanggal, kegiatan, absenList: [{ riwayatId, status, keterangan? }] }
// — simpan absen hari ini (upsert per unique [riwayatId, tanggal, kegiatan]).
// Semua validasi dijalankan dulu; bila satu baris gagal, tidak ada yang disimpan.
export async function POST(request: Request) {
  const session = await getSantriSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const tanggal = typeof body.tanggal === "string" ? body.tanggal : "";
  const kegiatanRaw = typeof body.kegiatan === "string" ? body.kegiatan : "";
  const absenList = Array.isArray(body.absenList) ? body.absenList : null;

  // (a) tanggal HARUS sama dengan hari ini (WIB)
  const today = getTodayWibString();
  if (!tanggal || tanggal !== today) {
    return NextResponse.json(
      { error: `Absen Ubudiyah hanya bisa diisi untuk hari ini (${today})` },
      { status: 400 }
    );
  }

  // (b) kegiatan valid
  if (!Object.values(UbudiyahKegiatan).includes(kegiatanRaw as UbudiyahKegiatan)) {
    return NextResponse.json({ error: `kegiatan tidak valid: ${kegiatanRaw || "-"}` }, { status: 400 });
  }
  const kegiatan = kegiatanRaw as UbudiyahKegiatan;

  if (!absenList || absenList.length === 0) {
    return NextResponse.json({ error: "absenList wajib diisi" }, { status: 400 });
  }

  // (c) pemanggil adalah Qism aktif dufah berjalan
  const dufahNama = (await getActiveDufahName()) || "";
  if (!dufahNama) {
    return NextResponse.json({ error: "Dufah aktif tidak ditemukan" }, { status: 400 });
  }
  const qism = await getQismAktif(session.santriId, dufahNama);
  if (!qism || !qism.isActive) {
    return NextResponse.json(
      { error: "Anda bukan Qism Ubudiyah aktif pada dufah berjalan" },
      { status: 403 }
    );
  }
  const saya = await prisma.santriInternal.findUnique({
    where: { id: session.santriId },
    select: { sakan: true },
  });
  if (!saya?.sakan || saya.sakan !== qism.sakan) {
    return NextResponse.json(
      { error: "Sakan Anda sudah tidak sama dengan sakan penunjukan Qism" },
      { status: 403 }
    );
  }
  const sakan = qism.sakan;

  // (d) tiap riwayatId harus dari sakan Qism
  const targets = await getActiveRiwayatListForAbsen(undefined, sakan);
  const allowed = new Set(targets.map((t) => t.riwayatId));

  // Validasi semua baris dulu (e, f) sebelum menulis apa pun.
  const validated: { riwayatId: string; status: UbudiyahStatus; keterangan: string | null }[] =
    [];
  for (const item of absenList) {
    const riwayatId = typeof item?.riwayatId === "string" ? item.riwayatId : "";
    const statusRaw = typeof item?.status === "string" ? item.status : "";
    if (!riwayatId || !allowed.has(riwayatId)) {
      return NextResponse.json(
        { error: `riwayatId ${riwayatId || "-"} bukan santri sakan ${sakan}` },
        { status: 400 }
      );
    }
    // (e) status valid untuk kegiatan
    if (
      !Object.values(UbudiyahStatus).includes(statusRaw as UbudiyahStatus) ||
      !isValidUbudiyahStatus(kegiatan, statusRaw as UbudiyahStatus)
    ) {
      return NextResponse.json(
        { error: `status ${statusRaw || "-"} tidak valid untuk kegiatan ${kegiatan}` },
        { status: 400 }
      );
    }
    const status = statusRaw as UbudiyahStatus;
    // (f) keterangan wajib bila bukan tepat waktu/hadir; bila tepat
    // waktu/hadir simpan sebagai null
    const keteranganRaw = typeof item?.keterangan === "string" ? item.keterangan.trim() : "";
    if (isUbudiyahKeteranganRequired(status) && !keteranganRaw) {
      return NextResponse.json(
        { error: `keterangan wajib diisi untuk status ${status}` },
        { status: 400 }
      );
    }
    validated.push({
      riwayatId,
      status,
      keterangan: isUbudiyahKeteranganRequired(status) ? keteranganRaw : null,
    });
  }

  // (g) upsert per unique [riwayatId, tanggal, kegiatan], pencatat = santri login
  const parsedDate = parseWibDateString(tanggal);
  for (const row of validated) {
    await prisma.ubudiyahHadir.upsert({
      where: {
        riwayatId_tanggal_kegiatan: { riwayatId: row.riwayatId, tanggal: parsedDate, kegiatan },
      },
      update: { status: row.status, keterangan: row.keterangan, pencatatId: session.santriId },
      create: {
        riwayatId: row.riwayatId,
        tanggal: parsedDate,
        kegiatan,
        status: row.status,
        keterangan: row.keterangan,
        pencatatId: session.santriId,
      },
    });
  }

  return NextResponse.json({ ok: true, saved: validated.length, tanggal, kegiatan });
}
