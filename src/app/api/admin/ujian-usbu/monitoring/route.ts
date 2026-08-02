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
    const sesiGlobalId = searchParams.get("sesiGlobalId");

    if (!sesiGlobalId) {
      return NextResponse.json({ error: "sesiGlobalId diperlukan" }, { status: 400 });
    }

    // Ambil data sesi ujian santri beserta info santri
    const sesiList = await prisma.sesiUjianSantri.findMany({
      where: { paket: { sesiGlobalId } },
      include: {
        riwayat: {
          include: {
            santri: {
              select: { nama: true, sakan: true, kamar: true, id: true }
            }
          }
        },
        _count: {
          select: { jawabanList: true }
        }
      },
      orderBy: { waktuMulai: 'desc' }
    });
    
    // Ambil jumlah soal dari paket pertama untuk menghitung progress (biasanya sama antar paket dalam 1 sesi global)
    const paketFirst = await prisma.paketUjian.findFirst({
      where: { sesiGlobalId },
      include: {
        _count: {
          select: { soalPaketList: true }
        }
      }
    });

    const totalSoal = paketFirst?._count.soalPaketList || 0;

    const data = sesiList.map(s => ({
      id: s.id,
      santriId: s.riwayat.santri.id,
      namaSantri: s.riwayat.santri.nama,
      lokasi: `${s.riwayat.santri.sakan} - ${s.riwayat.santri.kamar}`,
      status: s.status,
      waktuMulai: s.waktuMulai,
      waktuSelesai: s.waktuSelesai,
      dijawab: s._count.jawabanList,
      totalSoal,
      progress: totalSoal > 0 ? Math.round((s._count.jawabanList / totalSoal) * 100) : 0,
      nilaiTotal: s.nilaiTotal,
      tabCloseCount: s.tabCloseCount
    }));

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
