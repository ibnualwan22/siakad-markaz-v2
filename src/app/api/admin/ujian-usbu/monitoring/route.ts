import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

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

    // Ambil data sesi ujian santri — OPTIMIZED: gunakan _count alih-alih load semua jawaban
    const sesiList = await prisma.sesiUjianSantri.findMany({
      where: { paket: { sesiGlobalId } },
      select: {
        id: true,
        status: true,
        waktuMulai: true,
        waktuSelesai: true,
        nilaiTotal: true,
        tabCloseCount: true,
        alasanSubmit: true,
        riwayat: { select: { id: true, santriId: true } },
        _count: {
          select: {
            jawabanList: true  // total jawaban (termasuk kosong)
          }
        },
      }
    });

    // Hitung dijawab dan ragu secara terpisah dengan aggregate query (jauh lebih ringan)
    const jawabStats = await prisma.jawabanUjianSantri.groupBy({
      by: ['sesiId'],
      where: {
        sesi: { paket: { sesiGlobalId } },
        OR: [
          { opsiId: { not: null } },
          { jawabanTeks: { not: null } },
          { jawabanData: { not: Prisma.DbNull } }
        ]
      },
      _count: { id: true }
    });

    const raguStats = await prisma.jawabanUjianSantri.groupBy({
      by: ['sesiId'],
      where: {
        sesi: { paket: { sesiGlobalId } },
        rpiId: "RAGU"
      },
      _count: { id: true }
    });

    // Buat map untuk lookup cepat
    const dijawabMap = new Map(jawabStats.map(s => [s.sesiId, (s._count as any).id as number]));
    const raguMap = new Map(raguStats.map(s => [s.sesiId, (s._count as any).id as number]));

    // Indekskan sesi berdasarkan riwayatId
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
        dijawab = dijawabMap.get(sesiInfo.id) || 0;
        ragu = raguMap.get(sesiInfo.id) || 0;
        const totalJawaban = sesiInfo._count.jawabanList || totalSoal;
        belum = totalJawaban - dijawab;
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
