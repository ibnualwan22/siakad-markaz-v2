import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Verify permission
    if (session.role !== "ADMIN") {
      const p = await prisma.rolePermission.findUnique({
        where: { role_permission: { role: session.role, permission: "ujian_usbu" } }
      });
      if (!p) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("programId");
    const usbuKe = searchParams.get("usbuKe");
    const paketSoal = searchParams.get("paketSoal");

    if (!programId || !usbuKe) {
      return NextResponse.json({ error: "programId dan usbuKe diperlukan" }, { status: 400 });
    }

    // Fetch ALL soal for this program + usbu + paket (across all mapels)
    const where: any = {
      programId,
      usbuAssignments: {
        some: {
          usbuKe: Number(usbuKe)
        }
      }
    };
    if (paketSoal && paketSoal !== "undefined" && paketSoal !== "null") {
      where.paketSoal = paketSoal;
    }

    const soalList = await prisma.bankSoalUsbu.findMany({
      where,
      include: {
        opsiList: {
          orderBy: { urutan: 'asc' },
          select: { id: true, teks: true, gambarUrl: true, urutan: true, isCorrect: true }
        },
        mapel: { select: { nama_indo: true } },
        jenisSoal: { select: { instruksi: true } }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Build preview data: group by mapel, order soal, handle qiro'ah groups
    const mapelGroups = new Map<string, { mapelName: string; soal: any[] }>();

    for (const s of soalList) {
      const key = s.mapelId;
      if (!mapelGroups.has(key)) {
        mapelGroups.set(key, { mapelName: s.mapel.nama_indo, soal: [] });
      }
      mapelGroups.get(key)!.soal.push({
        soalId: s.id,
        pertanyaan: s.pertanyaan,
        gambarUrl: s.gambarUrl,
        grupSoalId: s.grupSoalId,
        tipeSoal: s.tipeSoal,
        bobot: s.bobot,
        perintah: s.jenisSoal?.instruksi || s.perintah,
        kunciJawaban: s.kunciJawaban,
        dataTambahan: s.dataTambahan,
        opsiList: s.opsiList.map(o => ({
          id: o.id,
          teks: o.teks,
          gambarUrl: o.gambarUrl,
          isCorrect: o.isCorrect
        }))
      });
    }

    // Flatten: for each mapel group, order soal with grup parents first, then children
    const allSoal: any[] = [];
    let urutanUI = 1;

    for (const [, group] of mapelGroups) {
      const mandiri: any[] = [];
      const childrenMap = new Map<string, any[]>();

      for (const s of group.soal) {
        if (s.grupSoalId) {
          if (!childrenMap.has(s.grupSoalId)) childrenMap.set(s.grupSoalId, []);
          childrenMap.get(s.grupSoalId)!.push(s);
        } else {
          mandiri.push(s);
        }
      }

      for (const s of mandiri) {
        s.mapelName = group.mapelName;
        s.urutanUI = urutanUI++;
        allSoal.push(s);

        const children = childrenMap.get(s.soalId);
        if (children) {
          for (const child of children) {
            child.mapelName = group.mapelName;
            child.urutanUI = urutanUI++;
            allSoal.push(child);
          }
          childrenMap.delete(s.soalId);
        }
      }

      // Remaining children without matching parent
      for (const [, children] of childrenMap) {
        for (const child of children) {
          child.mapelName = group.mapelName;
          child.urutanUI = urutanUI++;
          allSoal.push(child);
        }
      }
    }

    return NextResponse.json({
      totalSoal: allSoal.length,
      soal: allSoal
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
