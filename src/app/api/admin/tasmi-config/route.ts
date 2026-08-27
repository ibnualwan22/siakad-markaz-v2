import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const config = await prisma.tasmiConfig.findMany({
      include: {
        program: true,
        mapel: true
      }
    });
    return NextResponse.json(config);
  } catch (error) {
    console.error("Config fetch error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const payload = await request.json();
    const { configurations } = payload as { configurations: { programId: string, mapelId: string, kolom: string }[] };

    // Transaction for atomic update: delete all existing, insert new ones
    await prisma.$transaction(async (tx) => {
      await tx.tasmiConfig.deleteMany({});
      
      if (configurations && configurations.length > 0) {
        await tx.tasmiConfig.createMany({
          data: configurations.map(c => ({
            programId: c.programId,
            mapelId: c.mapelId,
            kolom: c.kolom
          }))
        });
      }
    });

    return NextResponse.json({ success: true, message: "Configuration saved successfully" });
  } catch (error) {
    console.error("Config save error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
