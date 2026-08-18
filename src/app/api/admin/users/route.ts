import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        nama: true,
        username: true,
        role: true,
        kelasId: true,
        sakan: true,
        noHp: true,
        isActive: true,
        createdAt: true,
        kelas: {
          select: {
            nama: true,
          }
        }
      }
    });
    return NextResponse.json(users);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { nama, username, password, role, kelasId, sakan, noHp } = body;

    if (!nama || !username || !password || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check if username exists
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json({ error: "Username sudah digunakan" }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    if (kelasId) {
      await prisma.user.updateMany({
        where: { kelasId },
        data: { kelasId: null }
      });
    }

    const newUser = await prisma.user.create({
      data: {
        nama,
        username,
        passwordHash,
        role,
        kelasId: kelasId || null,
        sakan: sakan || null,
        noHp: noHp || null,
        isActive: true,
      }
    });

    return NextResponse.json({ success: true, user: newUser });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
