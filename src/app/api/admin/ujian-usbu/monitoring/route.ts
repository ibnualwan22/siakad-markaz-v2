import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

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

    if (!sesiGlobalId) {
      return NextResponse.json({ error: "sesiGlobalId diperlukan" }, { status: 400 });
    }

    // Ambil info SesiGlogal untuk mengetahui dufahNama
    const sesiGlobal = await prisma.sesiUjianGlobal.findUnique({
      where: { id: sesiGlobalId },
      include: {
        paketUjianList: {
          include: { _count: { select: { soalPaketList: true } } }
        }
      }
    });

    if (!sesiGlobal) {
      return NextResponse.json({ error: "Sesi ujian tidak ditemukan" }, { status: 404 });
    }

    const totalSoal = sesiGlobal.paketUjianList[0]?._count.soalPaketList || 0;

    // Determine target programs
    let allowedProgramIds: string[] = [];
    if (!sesiGlobal.isSimulasi) {
      allowedProgramIds = sesiGlobal.paketUjianList.map(p => p.programId);
    }
    
    // Ambil SEMUA RiwayatSantri (daftar santri) yang ada di dufah ini, filter by program if not simulasi
    const semuaSantri = await prisma.riwayatSantri.findMany({
      where: { 
        dufahNama: sesiGlobal.dufahNama,
        ...(sesiGlobal.isSimulasi ? {} : {
          programId: { in: allowedProgramIds }
        })
      },
      include: {
        santri: { select: { nama: true, sakan: true, kamar: true, id: true, isAktif: true } },
        kelas: { select: { nama: true } }
      },
      orderBy: { santri: { nama: 'asc' } }
    });

    // Option: only return active santri if required
    const activeSantri = semuaSantri.filter(r => r.santri.isAktif);

    // Ambil data sesi ujian santri yang sudah mulai (di paket milik sesi global ini)
    const sesiList = await prisma.sesiUjianSantri.findMany({
      where: { paket: { sesiGlobalId } },
      include: {
        riwayat: { select: { id: true, santriId: true } },
        jawabanList: {
          select: { opsiId: true, rpiId: true, jawabanTeks: true, jawabanData: true }
        }
      }
    });

    // Indekskan sesi berdasarkan riwayatId (karena 1 riwayat = 1 santri di dufah ini)
    const sesiMap = new Map();
    for (const sesi of sesiList) {
      sesiMap.set(sesi.riwayat.id, sesi);
    }

    const data = activeSantri.map(riwayat => {
      const sesiInfo = sesiMap.get(riwayat.id);
      
      let dijawab = 0;
      let ragu = 0;
      let belum = 0;
      
      if (sesiInfo) {
        dijawab = sesiInfo.jawabanList.filter((j: any) => j.opsiId || j.jawabanTeks || (j.jawabanData && Object.keys(j.jawabanData).length > 0)).length;
        ragu = sesiInfo.jawabanList.filter((j: any) => j.rpiId === "RAGU").length;
        belum = (sesiInfo.jawabanList.length > 0 ? sesiInfo.jawabanList.length : totalSoal) - dijawab;
      } else {
        belum = totalSoal;
      }

      return {
        id: sesiInfo ? sesiInfo.id : `none-${riwayat.santriId}`,
        santriId: riwayat.santriId,
        namaSantri: riwayat.santri.nama,
        kelasNama: riwayat.kelas?.nama || "Tanpa Kelas",
        lokasi: `${riwayat.santri.sakan || '-'} - ${riwayat.santri.kamar || '-'}`,
        status: sesiInfo ? sesiInfo.status : "BELUM_MULAI",
        waktuMulai: sesiInfo ? sesiInfo.waktuMulai : null,
        waktuSelesai: sesiInfo ? sesiInfo.waktuSelesai : null,
        dijawab,
        ragu,
        belum,
        totalSoal,
        progress: totalSoal > 0 ? Math.round((dijawab / totalSoal) * 100) : 0,
        nilaiTotal: sesiInfo ? sesiInfo.nilaiTotal : 0,
        tabCloseCount: sesiInfo ? sesiInfo.tabCloseCount : 0,
        alasanSubmit: sesiInfo ? sesiInfo.alasanSubmit : null
      };
    });

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
