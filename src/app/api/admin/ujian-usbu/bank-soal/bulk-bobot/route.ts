import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.role !== "ADMIN") {
      const p = await prisma.rolePermission.findUnique({
        where: { role_permission: { role: session.role, permission: "ujian_usbu" } }
      });
      if (!p) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { soalIds, bobot } = await req.json();

    if (!soalIds || !Array.isArray(soalIds) || typeof bobot !== 'number') {
      return NextResponse.json({ error: "Invalid payload: soalIds array and bobot required" }, { status: 400 });
    }

    const updated = await prisma.bankSoalUsbu.updateMany({
      where: { id: { in: soalIds } },
      data: { bobot: Number(bobot) }
    });

    return NextResponse.json({ success: true, count: updated.count });
  } catch (error: any) {
    console.error("Bulk Bobot Error:", error);
    return NextResponse.json({ error: error.message || "Gagal update bobot masal" }, { status: 500 });
  }
}
