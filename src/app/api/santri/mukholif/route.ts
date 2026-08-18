import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSantriSession } from "@/lib/santri-auth";

export async function GET(request: Request) {
  const session = await getSantriSession();
  
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get reports made by this jasus
  try {
    const laporanList = await prisma.laporanMukholif.findMany({
      where: {
        jasusId: session.santriId
      },
      include: {
        pelanggarList: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return NextResponse.json(laporanList);
  } catch (error) {
    console.error("Error fetching mukholif laporan:", error);
    return NextResponse.json({ error: "Gagal mengambil data laporan" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSantriSession();
  
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  if (!session.isAktif) {
    return NextResponse.json({ error: "Santri tidak aktif" }, { status: 403 });
  }

  try {
    const data = await request.json();
    const { waktuMelanggar, tempatMelanggar, perkataanYgDiucapkan, detailKejadian, pelanggarIds } = data;

    if (!waktuMelanggar || !tempatMelanggar || !perkataanYgDiucapkan || !pelanggarIds || !Array.isArray(pelanggarIds) || pelanggarIds.length === 0) {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
    }
    
    if (pelanggarIds.includes(session.santriId)) {
      return NextResponse.json({ error: "Anda tidak bisa melaporkan diri sendiri" }, { status: 400 });
    }

    // Ambil data detail untuk tiap pelanggar
    const santriPelanggar = await prisma.santriInternal.findMany({
      where: {
        id: { in: pelanggarIds }
      },
      include: {
        riwayatRecords: {
          orderBy: { id: 'desc' },
          take: 1,
          include: {
            kelas: true
          }
        }
      }
    });

    if (santriPelanggar.length === 0) {
      return NextResponse.json({ error: "Pelanggar tidak ditemukan" }, { status: 404 });
    }

    const newLaporan = await prisma.laporanMukholif.create({
      data: {
        waktuMelanggar: new Date(waktuMelanggar),
        tempatMelanggar,
        perkataanYgDiucapkan,
        detailKejadian: detailKejadian || null,
        jasusId: session.santriId,
        jasusNama: session.nama,
        pelanggarList: {
          create: santriPelanggar.map(p => ({
            santriId: p.id,
            santriNama: p.nama || "Tanpa Nama",
            santriKelas: p.riwayatRecords[0]?.kelas?.nama || null,
            santriAsrama: p.sakan ? `${p.sakan} - ${p.kamar || ''}` : null
          }))
        }
      }
    });

    return NextResponse.json({ success: true, data: newLaporan });
  } catch (error) {
    console.error("Error creating laporan mukholif:", error);
    return NextResponse.json({ error: "Gagal membuat laporan" }, { status: 500 });
  }
}
