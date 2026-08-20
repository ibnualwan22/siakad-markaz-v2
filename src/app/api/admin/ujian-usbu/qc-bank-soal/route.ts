import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    if (session.role !== "ADMIN") {
      const p = await prisma.rolePermission.findUnique({
        where: { role_permission: { role: session.role, permission: "ujian_usbu" } }
      });
      if (!p) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    
    const { searchParams } = new URL(req.url);
    const filterProgramId = searchParams.get("programId");
    
    if (!filterProgramId) {
       return NextResponse.json({ error: "programId required" }, { status: 400 });
    }
    
    const mapels = await prisma.mapel.findMany();
    const mapelDict = Object.fromEntries(mapels.map(m => [m.id, m]));
    
    const queryCond: any = {};
    if (filterProgramId !== "ALL") queryCond.programId = filterProgramId;
    
    const soals = await prisma.bankSoalUsbu.findMany({
       where: queryCond,
       include: {
          jenisSoal: { select: { nama: true } },
          usbuAssignments: true
       }
    });
    
    const usbus = [1, 2, 3];
    const resultsByUsbu = usbus.map(u => {
       const aggregated = new Map<string, any>();
       
       // Pre-initialize ALL mapels that appear in the 'soals' list, regardless of assignment.
       // This guarantees that if a Mapel has questions but 0 points in this Usbu, it shows up as "KURANG_BOBOT (0)".
       for (const soal of soals) {
          const mId = soal.mapelId;
          if (!aggregated.has(mId)) {
             aggregated.set(mId, {
                mapelId: mId,
                mapelNama: mapelDict[mId]?.nama_indo || "Unknown",
                totalSoal: 0,
                totalBobot: 0,
                jenisSoalMap: {}
             });
          }
       }
       
       // Now calculate the points only for checked assignments
       for (const soal of soals) {
          if (!soal.usbuAssignments?.some((a: any) => a.usbuKe === u)) continue;
          
          const agg = aggregated.get(soal.mapelId);
          agg.totalSoal += 1;
          agg.totalBobot += (soal.bobot || 0);
          
          // Jenis Soal Check
          const jenisId = soal.jenisSoalId || soal.tipeSoal;
          const jenisNama = soal.jenisSoal?.nama || soal.tipeSoal.replace(/_/g, ' ');
          if (!agg.jenisSoalMap[jenisId]) {
             agg.jenisSoalMap[jenisId] = { id: jenisId, nama: jenisNama, count: 0, totalBobot: 0 };
          }
          agg.jenisSoalMap[jenisId].count += 1;
          agg.jenisSoalMap[jenisId].totalBobot += (soal.bobot || 0);
       }
       
       const mapels = Array.from(aggregated.values()).map(agg => {
          agg.jenisSoalBreakdown = Object.values(agg.jenisSoalMap);
          delete agg.jenisSoalMap;
          
          let status = "SIAP";
          let totalBobot = Math.round(agg.totalBobot * 100) / 100;
          if (totalBobot > 100) status = "OVER";
          else if (totalBobot < 100) status = "KURANG_BOBOT";
          
          return { ...agg, totalBobot, status };
       });

       return { usbu: u, mapels };
    });
    
    const orphanSoalsRaw = await prisma.bankSoalUsbu.findMany({
       where: { jenisSoalId: null },
       include: {
          mapel: { select: { nama_indo: true, nama_arab: true } },
          usbuAssignments: true
       }
    });
    
    // Filter orphans based on programId if not ALL
    const filteredOrphans = filterProgramId !== "ALL" 
       ? orphanSoalsRaw.filter(s => s.programId === filterProgramId) 
       : orphanSoalsRaw;

    const orphanSoals = filteredOrphans.map(s => ({
       id: (s as any).id,
       pertanyaan: ((s as any).pertanyaan || "").substring(0, 80) + ((s as any).pertanyaan?.length > 80 ? "..." : ""),
       mapelNama: (s as any).mapel?.nama_indo || (s as any).mapel?.nama_arab || "Unknown",
       tipeSoal: (s as any).tipeSoal,
       usbuAssignments: (s as any).usbuAssignments?.map((u: any) => u.usbuKe) || []
    }));

    return NextResponse.json({
       aggregatesByUsbu: resultsByUsbu,
       orphanSoals
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
