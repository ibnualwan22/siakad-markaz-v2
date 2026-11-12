import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Izin khusus per user — dikelola ADMIN dari halaman Manajemen Role
// (tab "Per User"). Konsisten dengan /api/admin/roles: hanya ADMIN
// yang boleh membaca/mengubah, bukan pemegang manajemen_role_edit.
//
// GET ?search=... — cari user berdasarkan nama/username (maks 10).
// GET ?userId=... — user + izin role-nya + override per-user-nya.
// POST { userId, overrides: [{ permission, jenis: "GRANT"|"DENY" }] }
//   — mengganti SELURUH override user itu (satu transaksi).
async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

export async function GET(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = (searchParams.get("search") || "").trim();
  const userId = (searchParams.get("userId") || "").trim();

  try {
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, nama: true, username: true, role: true },
      });
      if (!user) {
        return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
      }
      const [rolePermissions, overrides] = await Promise.all([
        prisma.rolePermission.findMany({
          where: { role: user.role as any },
          select: { permission: true },
        }),
        prisma.userPermission.findMany({
          where: { userId },
          select: { permission: true, jenis: true, diberikanOleh: true, createdAt: true },
          orderBy: { permission: "asc" },
        }),
      ]);
      return NextResponse.json({
        user,
        rolePermissions: rolePermissions.map((p) => p.permission),
        overrides,
      });
    }

    if (!search) return NextResponse.json({ users: [] });
    const users = await prisma.user.findMany({
      where: {
        AND: [
          { role: { not: "ADMIN" } },
          {
            OR: [
              { nama: { contains: search, mode: "insensitive" } },
              { username: { contains: search, mode: "insensitive" } },
            ],
          },
        ],
      },
      select: { id: true, nama: true, username: true, role: true },
      orderBy: { nama: "asc" },
      take: 10,
    });
    return NextResponse.json({ users });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch user permissions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { userId, overrides } = await request.json();
    if (!userId || !Array.isArray(overrides)) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }
    if (user.role === "ADMIN") {
      return NextResponse.json(
        { error: "ADMIN sudah memiliki semua izin; tidak perlu override per-user" },
        { status: 400 }
      );
    }

    // Validasi isi: izin non-kosong, jenis hanya GRANT/DENY, tanpa duplikat.
    const bersih = new Map<string, "GRANT" | "DENY">();
    for (const o of overrides) {
      const permission = typeof o?.permission === "string" ? o.permission.trim() : "";
      if (!permission) {
        return NextResponse.json({ error: "Invalid data" }, { status: 400 });
      }
      if (o?.jenis !== "GRANT" && o?.jenis !== "DENY") {
        return NextResponse.json({ error: "Invalid data" }, { status: 400 });
      }
      bersih.set(permission, o.jenis);
    }

    const diberikanOleh = session.nama || session.username || null;
    await prisma.$transaction([
      prisma.userPermission.deleteMany({ where: { userId } }),
      prisma.userPermission.createMany({
        data: Array.from(bersih.entries()).map(([permission, jenis]) => ({
          userId,
          permission,
          jenis,
          diberikanOleh,
        })),
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update user permissions" }, { status: 500 });
  }
}
