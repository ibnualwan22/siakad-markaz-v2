import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { nama, username, password, role, kelasId, sakan, noHp, isActive } = body;

    const dataToUpdate: any = {
      nama,
      username,
      role,
      kelasId: kelasId || null,
      sakan: sakan || null,
      noHp: noHp !== undefined ? (noHp || null) : undefined,
    };

    if (isActive !== undefined) {
      dataToUpdate.isActive = isActive;
    }

    if (password && password.trim() !== "") {
      dataToUpdate.passwordHash = await hashPassword(password);
    }

    if (kelasId) {
      await prisma.user.updateMany({
        where: { kelasId, id: { not: id } },
        data: { kelasId: null }
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: "Username sudah digunakan" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
