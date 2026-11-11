import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import { getActiveDufahName } from "@/lib/absensi";

export const dynamic = "force-dynamic";

// GET ?sakan=&dufahNama= — daftar Qism Ubudiyah (dufahNama default dufah aktif)
export async function GET(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("ubudiyah");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sakan = searchParams.get("sakan") || undefined;
  const dufahNama = searchParams.get("dufahNama") || (await getActiveDufahName()) || "";
  if (!dufahNama) return NextResponse.json({ error: "Dufah tidak ditemukan" }, { status: 400 });

  const qismList = await prisma.ubudiyahQism.findMany({
    where: { dufahNama, ...(sakan ? { sakan } : {}) },
  });

  const santriList = await prisma.santriInternal.findMany({
    where: { id: { in: [...new Set(qismList.map((q) => q.santriId))] } },
    select: { id: true, nama: true },
  });
  const santriMap = new Map(santriList.map((s) => [s.id, s]));

  const data = qismList
    .map((q) => ({
      id: q.id,
      santriId: q.santriId,
      nama: santriMap.get(q.santriId)?.nama ?? "Tanpa Nama",
      sakan: q.sakan,
      dufahNama: q.dufahNama,
      isActive: q.isActive,
      createdAt: q.createdAt,
    }))
    .sort(
      (a, b) =>
        a.sakan.localeCompare(b.sakan, "id") || a.nama.localeCompare(b.nama, "id")
    );

  return NextResponse.json({ dufahNama, data });
}

// POST { santriId | santriIds[], sakan, dufahNama? } — tunjuk Qism Ubudiyah.
// Bila sudah ada baris nonaktif (santriId, dufahNama) -> diaktifkan lagi.
// Bila sudah aktif -> 409. Validasi gagal satu santri -> gagal semua (tanpa tulis sebagian).
export async function POST(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("ubudiyah_edit");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const santriIds: string[] = Array.isArray(body.santriIds)
    ? body.santriIds
    : typeof body.santriId === "string"
      ? [body.santriId]
      : [];
  const sakan = typeof body.sakan === "string" ? body.sakan.trim() : "";
  if (santriIds.length === 0 || !sakan) {
    return NextResponse.json({ error: "santriId dan sakan wajib diisi" }, { status: 400 });
  }
  const dufahNama =
    (typeof body.dufahNama === "string" && body.dufahNama.trim()) ||
    (await getActiveDufahName()) ||
    "";
  if (!dufahNama) return NextResponse.json({ error: "Dufah tidak ditemukan" }, { status: 400 });

  const uniqueSantriIds = [...new Set(santriIds)];
  const santriList = await prisma.santriInternal.findMany({
    where: { id: { in: uniqueSantriIds } },
    select: { id: true, nama: true, sakan: true, dufahNama: true, isAktif: true },
  });
  const santriMap = new Map(santriList.map((s) => [s.id, s]));

  for (const santriId of uniqueSantriIds) {
    const s = santriMap.get(santriId);
    if (!s) {
      return NextResponse.json({ error: `Santri ${santriId} tidak ditemukan` }, { status: 400 });
    }
    if (!s.isAktif) {
      return NextResponse.json({ error: `${s.nama ?? santriId} bukan santri aktif` }, { status: 400 });
    }
    if (s.sakan !== sakan) {
      return NextResponse.json(
        { error: `${s.nama ?? santriId} tidak berada di sakan ${sakan}` },
        { status: 400 }
      );
    }
    if (s.dufahNama !== dufahNama) {
      return NextResponse.json(
        { error: `${s.nama ?? santriId} bukan santri ${dufahNama}` },
        { status: 400 }
      );
    }
  }

  const existing = await prisma.ubudiyahQism.findMany({
    where: { santriId: { in: uniqueSantriIds }, dufahNama },
  });
  const existingMap = new Map(existing.map((q) => [q.santriId, q]));
  for (const santriId of uniqueSantriIds) {
    const q = existingMap.get(santriId);
    if (q?.isActive) {
      const s = santriMap.get(santriId);
      return NextResponse.json(
        { error: `${s?.nama ?? santriId} sudah menjadi Qism Ubudiyah di ${dufahNama} (sakan ${sakan})` },
        { status: 409 }
      );
    }
  }

  const data = [];
  for (const santriId of uniqueSantriIds) {
    const q = existingMap.get(santriId);
    const saved = q
      ? await prisma.ubudiyahQism.update({
          where: { id: q.id },
          data: { isActive: true, sakan, ditunjukOleh: session.userId },
        })
      : await prisma.ubudiyahQism.create({
          data: { santriId, sakan, dufahNama, ditunjukOleh: session.userId },
        });
    data.push({
      id: saved.id,
      santriId: saved.santriId,
      nama: santriMap.get(santriId)?.nama ?? "Tanpa Nama",
      sakan: saved.sakan,
      dufahNama: saved.dufahNama,
      isActive: saved.isActive,
      createdAt: saved.createdAt,
    });
  }

  return NextResponse.json({ dufahNama, data });
}

// DELETE ?id=... — nonaktifkan Qism (soft deactivate, bukan hapus fisik)
export async function DELETE(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("ubudiyah_edit");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id wajib diisi" }, { status: 400 });

  const qism = await prisma.ubudiyahQism.findUnique({ where: { id } });
  if (!qism) return NextResponse.json({ error: "Qism tidak ditemukan" }, { status: 404 });

  await prisma.ubudiyahQism.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
