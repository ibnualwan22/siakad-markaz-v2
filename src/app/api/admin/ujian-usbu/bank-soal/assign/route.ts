import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { soalIds, usbuKe } = await req.json();

    if (!Array.isArray(soalIds) || !usbuKe) {
      return NextResponse.json({ error: "soalIds (array) dan usbuKe diperlukan" }, { status: 400 });
    }

    const usbuFormat = Number(usbuKe);

    const existing = await prisma.soalUsbuAssignment.findMany({
      where: {
        soalId: { in: soalIds },
        usbuKe: usbuFormat
      },
      select: { soalId: true }
    });
    
    const existingSoalIds = new Set(existing.map(e => e.soalId));
    const toInsert = soalIds.filter((id: string) => !existingSoalIds.has(id));

    if (toInsert.length > 0) {
      await prisma.soalUsbuAssignment.createMany({
        data: toInsert.map((soalId: string) => ({
          soalId,
          usbuKe: usbuFormat,
        })),
        skipDuplicates: true
      });
    }

    return NextResponse.json({ success: true, inserted: toInsert.length });
  } catch (error: any) {
    console.error("POST Assign Error:", error);
    return NextResponse.json({ error: "Gagal assign soal" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { soalIds, usbuKe } = await req.json();

    if (!Array.isArray(soalIds) || !usbuKe) {
      return NextResponse.json({ error: "soalIds dan usbuKe diperlukan" }, { status: 400 });
    }

    await prisma.soalUsbuAssignment.deleteMany({
      where: {
        soalId: { in: soalIds },
        usbuKe: Number(usbuKe)
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE Assign Error:", error);
    return NextResponse.json({ error: "Gagal unassign soal" }, { status: 500 });
  }
}
