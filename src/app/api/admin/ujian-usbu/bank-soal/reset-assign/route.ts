import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { programId, mapelId, usbuKe } = await req.json();

    if (!programId || !mapelId || !usbuKe) {
      return NextResponse.json({ error: "programId, mapelId, dan usbuKe diperlukan" }, { status: 400 });
    }

    // Prisma string format
    const deleted = await prisma.soalUsbuAssignment.deleteMany({
      where: {
        usbuKe: Number(usbuKe),
        soal: {
          mapelId,
          programId,
        }
      }
    });

    return NextResponse.json({ success: true, count: deleted.count });
  } catch (error: any) {
    console.error("POST Reset Assign Error:", error);
    return NextResponse.json({ error: "Gagal reset assignment" }, { status: 500 });
  }
}
