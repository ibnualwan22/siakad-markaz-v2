import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

const PERMISSION = "lajnah_manage";

async function authorize() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") {
    const p = await prisma.rolePermission.findUnique({
      where: { role_permission: { role: session.role, permission: PERMISSION } },
    });
    if (!p) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

// POST /api/admin/pemilihan-lajnah/[id]/paslon — daftarkan paslon (2 santri)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await authorize();
  if (denied) return denied;
  try {
    const { id: sesiId } = await params;
    const sesi = await prisma.sesiPemilihanLajnah.findUnique({
      where: { id: sesiId },
      include: { paslonList: true },
    });
    if (!sesi) return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 });
    if (sesi.status !== "DRAFT") {
      return NextResponse.json({ error: "Paslon hanya bisa ditambah saat sesi masih DRAFT" }, { status: 400 });
    }
    const { santri1Id, santri2Id, nomorUrut, fotoUrl, visiMisi } = await req.json();
    if (!santri1Id || !santri2Id) {
      return NextResponse.json({ error: "Dua santri (rois & wakil) wajib dipilih" }, { status: 400 });
    }
    if (santri1Id === santri2Id) {
      return NextResponse.json({ error: "Roiss dan wakil harus santri yang berbeda" }, { status: 400 });
    }
    // Validasi: santri aktif di dufah sesi ini
    const calons = await prisma.santriInternal.findMany({
      where: { id: { in: [santri1Id, santri2Id] } },
      select: { id: true, nama: true, isAktif: true, dufahNama: true },
    });
    if (calons.length !== 2) {
      return NextResponse.json({ error: "Salah satu santri tidak ditemukan" }, { status: 400 });
    }
    for (const c of calons) {
      if (!c.isAktif || c.dufahNama !== sesi.dufahNama) {
        return NextResponse.json({ error: `${c.nama || "Santri"} bukan santri aktif di ${sesi.dufahNama}` }, { status: 400 });
      }
    }
    // Cegah santri dobel di paslon lain pada sesi yang sama
    const bentrok = sesi.paslonList.find(
      (p) => [p.santri1Id, p.santri2Id].includes(santri1Id) || [p.santri1Id, p.santri2Id].includes(santri2Id)
    );
    if (bentrok) {
      return NextResponse.json({ error: "Salah satu santri sudah terdaftar di paslon lain pada sesi ini" }, { status: 400 });
    }
    let no = nomorUrut;
    if (no == null) {
      no = sesi.paslonList.reduce((m, p) => Math.max(m, p.nomorUrut), 0) + 1;
    } else if (sesi.paslonList.some((p) => p.nomorUrut === Number(no))) {
      return NextResponse.json({ error: `Nomor urut ${no} sudah dipakai` }, { status: 400 });
    }
    const paslon = await prisma.paslonLajnah.create({
      data: {
        sesiId,
        nomorUrut: Number(no),
        santri1Id,
        santri2Id,
        fotoUrl: fotoUrl?.trim() || null,
        visiMisi: visiMisi?.trim() || null,
      },
      include: {
        santri1: { select: { id: true, nama: true } },
        santri2: { select: { id: true, nama: true } },
      },
    });
    return NextResponse.json(paslon);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
