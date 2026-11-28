import { NextRequest, NextResponse } from "next/server";
import { getSession, verifyPassword } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("programId");
    const mapelId = searchParams.get("mapelId");

    if (!programId || !mapelId) {
      return NextResponse.json({ babList: [], tanpaBabCount: 0 });
    }

    const [babList, tanpaBabCount] = await Promise.all([
      prisma.babMateri.findMany({
        where: { programId, mapelId },
        include: {
          _count: { select: { soalList: true } },
        },
        orderBy: [{ urutan: "asc" }, { createdAt: "asc" }],
      }),
      prisma.bankSoalUsbu.count({
        where: { programId, mapelId, babId: null },
      }),
    ]);

    return NextResponse.json({ babList, tanpaBabCount });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat Bab" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await checkPermission("ujian_usbu"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { programId, mapelId, nama, deskripsi } = body;

    if (!programId || !mapelId || !nama?.trim()) {
      return NextResponse.json(
        { error: "Program, Mapel, dan Nama Bab wajib diisi" },
        { status: 400 },
      );
    }

    const last = await prisma.babMateri.findFirst({
      where: { programId, mapelId },
      orderBy: { urutan: "desc" },
      select: { urutan: true },
    });

    const created = await prisma.babMateri.create({
      data: {
        programId,
        mapelId,
        nama: String(nama).trim(),
        deskripsi: deskripsi ? String(deskripsi).trim() : null,
        urutan: (last?.urutan ?? 0) + 1,
      },
      include: { _count: { select: { soalList: true } } },
    });

    return NextResponse.json({ success: true, data: created });
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;
    if (code === "P2002") {
      return NextResponse.json(
        { error: "Nama Bab sudah ada pada Program dan Mapel ini" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal membuat Bab" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await checkPermission("ujian_usbu"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();

    // Mode klik-klik cepat: masukkan / keluarkan 1 soal dari Bab
    if (body.action === "toggle-soal") {
      const { babId, soalId, assign } = body as {
        babId?: string;
        soalId?: string;
        assign?: boolean;
      };
      if (!soalId || (assign && !babId)) {
        return NextResponse.json(
          { error: "Parameter soalId dan babId tidak lengkap" },
          { status: 400 },
        );
      }

      const updated = await prisma.bankSoalUsbu.update({
        where: { id: soalId },
        data: { babId: assign ? babId! : null },
        select: {
          id: true,
          babId: true,
          bab: { select: { id: true, nama: true, urutan: true } },
        },
      });
      return NextResponse.json({ success: true, soal: updated });
    }

    // Mode reorder urutan Bab
    if (Array.isArray(body.reorder)) {
      await prisma.$transaction(
        body.reorder.map((item: { id: string; urutan: number }) =>
          prisma.babMateri.update({
            where: { id: item.id },
            data: { urutan: Number(item.urutan) || 0 },
          }),
        ),
      );
      return NextResponse.json({ success: true });
    }

    // Mode edit nama / deskripsi Bab
    const { id, nama, deskripsi } = body;
    if (!id || !nama?.trim()) {
      return NextResponse.json(
        { error: "ID dan Nama Bab wajib diisi" },
        { status: 400 },
      );
    }

    const updated = await prisma.babMateri.update({
      where: { id },
      data: {
        nama: String(nama).trim(),
        deskripsi: deskripsi !== undefined ? (deskripsi ? String(deskripsi).trim() : null) : undefined,
      },
      include: { _count: { select: { soalList: true } } },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;
    if (code === "P2002") {
      return NextResponse.json(
        { error: "Nama Bab sudah digunakan di Mapel ini" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memperbarui Bab" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await checkPermission("ujian_usbu"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { id, password, deleteSoals } = body as {
      id?: string;
      password?: string;
      deleteSoals?: boolean;
    };

    if (!id) {
      return NextResponse.json({ error: "ID Bab wajib diisi" }, { status: 400 });
    }
    if (!password || !String(password).trim()) {
      return NextResponse.json(
        { error: "Sandi Super Admin wajib diisi untuk menghapus Bab" },
        { status: 400 },
      );
    }

    // Verifikasi sandi terhadap akun Super Admin (role = ADMIN & aktif)
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", isActive: true },
      select: { id: true, passwordHash: true },
    });

    let verified = false;
    for (const adm of admins) {
      if (adm.passwordHash && (await verifyPassword(String(password), adm.passwordHash))) {
        verified = true;
        break;
      }
    }

    if (!verified) {
      return NextResponse.json(
        { error: "Sandi Super Admin salah! Penghapusan Bab dibatalkan." },
        { status: 403 },
      );
    }

    const bab = await prisma.babMateri.findUnique({
      where: { id },
      include: { _count: { select: { soalList: true } } },
    });
    if (!bab) {
      return NextResponse.json({ error: "Bab tidak ditemukan" }, { status: 404 });
    }

    if (deleteSoals) {
      await prisma.$transaction([
        prisma.bankSoalUsbu.deleteMany({ where: { babId: id } }),
        prisma.babMateri.delete({ where: { id } }),
      ]);
      return NextResponse.json({
        success: true,
        deletedSoals: bab._count.soalList,
        message: `Bab "${bab.nama}" beserta ${bab._count.soalList} soal di dalamnya berhasil dihapus.`,
      });
    } else {
      await prisma.babMateri.delete({ where: { id } });
      return NextResponse.json({
        success: true,
        deletedSoals: 0,
        message: `Bab "${bab.nama}" berhasil dihapus. ${bab._count.soalList} soal dipindahkan ke kategori Tanpa Bab.`,
      });
    }
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menghapus Bab" },
      { status: 500 },
    );
  }
}
