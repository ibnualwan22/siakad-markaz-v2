import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { submitSesiUjianSantri } from "@/lib/exam-submit";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    // Check permission
    if (session.role !== "ADMIN") {
      const p = await prisma.rolePermission.findUnique({
        where: { role_permission: { role: session.role, permission: "ujian_usbu" } }
      });
      if (!p) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { sesiId } = body;

    if (!sesiId) {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
    }

    // Call shared submit function
    const updatedSesi = await submitSesiUjianSantri(sesiId, "FORCE_SUBMIT");

    return NextResponse.json({ success: true, sesi: updatedSesi });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
