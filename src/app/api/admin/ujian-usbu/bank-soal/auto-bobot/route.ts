import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (session.role !== "ADMIN") {
      const p = await prisma.rolePermission.findUnique({
        where: { role_permission: { role: session.role, permission: "ujian_usbu" } }
      });
      if (!p) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { programId, mapelId, usbuKe, paketSoal, bobot } = await req.json();

    if (!programId || !mapelId || !usbuKe || !paketSoal || bobot === undefined) {
      return NextResponse.json({ error: "Parameter tidak lengkap" }, { status: 400 });
    }

    const result = await prisma.bankSoalUsbu.updateMany({
      where: {
        programId,
        mapelId,
        usbuKe: Number(usbuKe),
        paketSoal
      },
      data: {
        bobot: Number(bobot)
      }
    });

    return NextResponse.json({ success: true, updated: result.count });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
