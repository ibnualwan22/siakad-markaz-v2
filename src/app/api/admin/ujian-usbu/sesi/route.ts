import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import { getActiveDufahName } from "@/lib/absensi";

function generateCode() {
  return crypto.randomInt(100000, 999999).toString();
}

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sesi = await prisma.sesiUjianGlobal.findMany({
      include: {
        _count: {
          select: { paketUjianList: true }
        },
        paketUjianList: {
          include: {
            program: { select: { nama_indo: true } },
            _count: { select: { soalPaketList: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(sesi);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

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

    const { usbuKe, durasiMenit, acakSoal, acakOpsi, programIds, programPaketMap } = await req.json();

    const selectedPrograms = programIds || (programPaketMap ? Object.keys(programPaketMap) : []);

    if (!usbuKe || selectedPrograms.length === 0) {
      return NextResponse.json({ error: "Data tidak lengkap. Pilih program." }, { status: 400 });
    }

    // Get active dufah
    const dufah = await getActiveDufahName();
    if (!dufah) return NextResponse.json({ error: "Tidak ada target Duf'ah yang aktif. Harap atur di menu Konteks Aktif." }, { status: 400 });

    const kodeAkses = generateCode();
    const namaSesi = `Ujian Usbu' ${usbuKe} - ${dufah}`;

    const newSesi = await prisma.$transaction(async (tx) => {
      // 1. Create SesiUjianGlobal
      const sesi = await tx.sesiUjianGlobal.create({
        data: {
          nama: namaSesi,
          dufahNama: dufah,
          usbuKe: Number(usbuKe),
          durasiMenit: Number(durasiMenit) || 120,
          kodeAkses,
          acakSoal: acakSoal ?? true,
          acakOpsi: acakOpsi ?? true,
          isActive: false, 
        }
      });

      // 2. Create PaketUjian per selected program
      for (const programId of selectedPrograms) {
        
        // Find all questions assigned to this usbuKe for this program
        const soalList = await tx.bankSoalUsbu.findMany({
          where: { 
            programId, 
            usbuAssignments: { some: { usbuKe: Number(usbuKe) } }
          }
        });

        // Skip if no questions
        if (soalList.length === 0) continue;

        const p = await tx.program.findUnique({ where: { id: programId } });

        const paket = await tx.paketUjian.create({
          data: {
            nama: `Uj.Usbu' ${usbuKe} - ${p?.nama_indo || 'Program'}`,
            programId,
            sesiGlobalId: sesi.id,
            paketSoal: "A" // Legacy fallback, hidden from UI
          }
        });

        // 3. Assign soal to this paket
        await tx.soalPaket.createMany({
          data: soalList.map((s: any, index: number) => ({
            paketId: paket.id,
            soalId: s.id,
            urutan: index + 1
          }))
        });
      }

      return sesi;
    });

    return NextResponse.json({ success: true, sesi: newSesi });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
