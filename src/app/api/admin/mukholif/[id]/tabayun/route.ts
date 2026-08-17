import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(request: Request, context: any) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = await Promise.resolve(context.params);
  const { id } = params;

  try {
    const { results } = await request.json();
    // results is array of: 
    // { pelanggarId, statusTabayun, iqobSounding, iqobJawal, iqobPenyetoran }

    if (!Array.isArray(results) || results.length === 0) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    // Process each result
    let allFinished = true;

    for (const res of results) {
      const { pelanggarId, statusTabayun, iqobSounding, iqobJawal, iqobPenyetoran } = res;
      
      const existing = await prisma.pelanggarMukholif.findUnique({
        where: { id: pelanggarId }
      });

      if (!existing) continue;

      const updateData: any = {
        statusTabayun,
        tabayunAt: new Date()
      };

      if (statusTabayun === "PELANGGAR") {
        updateData.iqobSounding = !!iqobSounding;
        updateData.iqobJawal = !!iqobJawal;
        updateData.iqobPenyetoran = !!iqobPenyetoran;
      } else {
        updateData.iqobSounding = false;
        updateData.iqobJawal = false;
        updateData.iqobPenyetoran = false;
      }

      if (res.jumlahTidakHadir !== undefined) {
        updateData.jumlahTidakHadir = res.jumlahTidakHadir;
      }
      if (statusTabayun === "TIDAK_HADIR" || statusTabayun === null) {
        allFinished = false;
      }

      await prisma.pelanggarMukholif.update({
        where: { id: pelanggarId },
        data: updateData
      });
    }

    // check if there's any other pelanggar in this report that is not finished
    const remainingUnfinished = await prisma.pelanggarMukholif.count({
      where: {
        laporanId: id,
        OR: [
          { statusTabayun: null },
          { statusTabayun: "TIDAK_HADIR" }
        ]
      }
    });

    if (remainingUnfinished === 0) {
      // All finished, update laporan status
      await prisma.laporanMukholif.update({
        where: { id },
        data: { status: "SELESAI" }
      });
    } else {
      // Make sure laporan status is not SELESAI if some are not finished
      await prisma.laporanMukholif.update({
        where: { id },
        data: { status: "MENUNGGU" }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing tabayun:", error);
    return NextResponse.json({ error: "Failed to save tabayun" }, { status: 500 });
  }
}
