import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { recalculateSesiNilai } from "@/lib/recalculate-sesi-nilai";

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
    const sesiGlobalId = searchParams.get("sesiGlobalId");
    const kelasId = searchParams.get("kelasId");

    if (!sesiGlobalId || !kelasId) {
      return NextResponse.json({ error: "Paket ujian dan Kelas harus dipilih" }, { status: 400 });
    }

    // 1. Dapatkan kelas untuk mengetahui programId dari kelas tersebut
    const kls = await prisma.kelas.findUnique({ where: { id: kelasId } });
    if (!kls) {
      return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
    }

    // 2. Dapatkan PaketUjian HANYA untuk program terkait pada sesiGlobalId ini, agar mapel program lain tidak bocor
    const pakets = await prisma.paketUjian.findMany({
      where: { sesiGlobalId, programId: kls.programId }
    });
    
    if (pakets.length === 0) {
      return NextResponse.json([]);
    }

    const paketIds = pakets.map(p => p.id);

    // 2. Fetch the questions (SoalPaket) in these pakets, we group them by the actual Soal
    const soalPakets = await prisma.soalPaket.findMany({
      where: { paketId: { in: paketIds } },
      include: {
        soal: {
          include: {
            opsiList: true,
            mapel: true
          }
        },
        paket: true
      },
      orderBy: [
        { paket: { programId: 'asc' } },
        { urutan: 'asc' }
      ]
    });

    // Deduplicate soal based on ID in case different programs use same soal
    const uniqueSoals = new Map<string, any>();
    for (const sp of soalPakets) {
       if (!uniqueSoals.has(sp.soal.id)) {
          uniqueSoals.set(sp.soal.id, sp.soal);
       }
    }

    // 3. Fetch all students exam sessions in this Class for these pakets
    const sesiSantris = await prisma.sesiUjianSantri.findMany({
      where: {
        paketId: { in: paketIds },
        riwayat: {
          kelasId: kelasId
        },
        status: { in: ["AUTO_SUBMIT", "SELESAI", "MENGERJAKAN"] } // bisa lihat yang lagi mengerjakan juga
      },
      include: {
        riwayat: {
          include: {
            santri: true
          }
        },
        jawabanList: true
      }
    });

    // 4. Transform data: Soal -> array of answers from students
    const result = Array.from(uniqueSoals.values()).map(soal => {
      const studentAnswers = sesiSantris.map(sesi => {
        const jaw = sesi.jawabanList.find(j => j.soalId === soal.id);
        
        return {
          id: jaw?.id || null, // ID of JawabanUjianSantri
          sesiId: sesi.id, // Needed for recalculate
          santriNama: sesi.riwayat.santri.nama,
          opsiId: jaw?.opsiId || null,
          jawabanTeks: jaw?.jawabanTeks || null,
          jawabanData: jaw?.jawabanData ? (typeof jaw.jawabanData === 'string' ? JSON.parse(jaw.jawabanData) : jaw.jawabanData) : null,
          nilaiManual: jaw?.nilaiManual ?? null,
          aiGraded: jaw?.aiGraded || false,
          aiFeedback: jaw?.aiFeedback || null,
          sesiStatus: sesi.status
        };
      }).sort((a, b) => (a.santriNama || "").localeCompare(b.santriNama || ""));

      return {
        id: soal.id,
        tipeSoal: soal.tipeSoal,
        mapelNama: soal.mapel.nama_indo || soal.mapel.nama,
        bobot: soal.bobot,
        pertanyaan: soal.pertanyaan,
        kunciJawaban: soal.kunciJawaban,
        opsiList: soal.opsiList,
        dataTambahan: soal.dataTambahan ? (typeof soal.dataTambahan === 'string' ? JSON.parse(soal.dataTambahan) : soal.dataTambahan) : null,
        jawabanSantri: studentAnswers
      };
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.role !== "ADMIN") {
       const p = await prisma.rolePermission.findUnique({
         where: { role_permission: { role: session.role, permission: "ujian_usbu" } }
       });
       if (!p) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { jawabanId, nilaiManual } = await req.json();

    if (!jawabanId || (typeof nilaiManual !== 'number' && nilaiManual !== null)) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    // @ts-ignore
    const jaw = await prisma.jawabanUjianSantri.update({
      where: { id: jawabanId },
      data: { nilaiManual }
    });

    if (jaw && jaw.sesiId) {
      await recalculateSesiNilai(jaw.sesiId);
    }

    return NextResponse.json({ success: true, jaw });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
