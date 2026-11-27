import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await checkPermission("reminder_pengajar_toggle");
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const config = await prisma.pengaturanReminderPengajar.findUnique({
      where: { id: 1 },
    });

    return NextResponse.json({
      isActive: config ? config.isActive : true,
      updatedAt: config?.updatedAt ?? null,
      updatedBy: config?.updatedBy ?? null,
    });
  } catch (error) {
    console.error("Gagal membaca pengaturan reminder pengajar:", error);
    return NextResponse.json(
      { error: "Gagal memuat pengaturan reminder pengajar" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await checkPermission("reminder_pengajar_toggle");
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    if (typeof body?.isActive !== "boolean") {
      return NextResponse.json(
        { error: "Parameter isActive harus berupa boolean" },
        { status: 400 }
      );
    }

    const updatedBy = session.nama || session.username || "Admin";
    const config = await prisma.pengaturanReminderPengajar.upsert({
      where: { id: 1 },
      update: {
        isActive: body.isActive,
        updatedBy,
      },
      create: {
        id: 1,
        isActive: body.isActive,
        updatedBy,
      },
    });

    return NextResponse.json({
      success: true,
      isActive: config.isActive,
      updatedAt: config.updatedAt,
      updatedBy: config.updatedBy,
    });
  } catch (error) {
    console.error("Gagal memperbarui pengaturan reminder pengajar:", error);
    return NextResponse.json(
      { error: "Gagal menyimpan pengaturan reminder pengajar" },
      { status: 500 }
    );
  }
}
