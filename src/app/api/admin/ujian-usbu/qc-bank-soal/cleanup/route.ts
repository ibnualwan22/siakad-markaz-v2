import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode");
    const programId = searchParams.get("programId");
    const soalId = searchParams.get("soalId");
    
    let deletedCount = 0;
    
    await prisma.$transaction(async (tx) => {
       if (mode === "all") {
          const queryCond: any = { jenisSoalId: null };
          if (programId && programId !== "ALL") queryCond.programId = programId;
          
          const res = await tx.bankSoalUsbu.deleteMany({
             where: queryCond
          });
          deletedCount = res.count;
       } else if (soalId) {
          const res = await tx.bankSoalUsbu.delete({
             where: { id: soalId }
          });
          deletedCount = 1;
       } else {
          throw new Error("Missing parameters for cleanup");
       }
    });

    return NextResponse.json({ success: true, deletedSoalCount: deletedCount });
  } catch (err: any) {
    console.error("Cleanup Orphan Error:", err);
    return NextResponse.json({ error: err.message || "Gagal menghapus soal anomali" }, { status: 500 });
  }
}
