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
    const [laporanList, isLajnahCount] = await Promise.all([
      prisma.laporanMukholif.findMany({
        where: { jasusId: session.santriId },
        include: { pelanggarList: true },
        orderBy: { createdAt: "desc" }
      }),
      prisma.anggotaLajnah.count({
        where: { santriId: session.santriId }
      })
    ]);

    return NextResponse.json({
      laporanList,
      isLajnah: isLajnahCount > 0
    });
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
    const { laporan } = data; // Array of reports

    if (!laporan || !Array.isArray(laporan) || laporan.length === 0) {
      return NextResponse.json({ error: "Data laporan kosong" }, { status: 400 });
    }

    // Verify if current user is Lajnah
    const isLajnahCount = await prisma.anggotaLajnah.count({
      where: { santriId: session.santriId }
    });
    const isLajnah = isLajnahCount > 0;

    // Collect unique pelanggar IDs to fetch them at once
    const allPelanggarIds = Array.from(new Set(laporan.flatMap((l: any) => l.pelanggarIds || [])));

    if (allPelanggarIds.length === 0) {
      return NextResponse.json({ error: "Tidak ada pelanggar yang dpilih" }, { status: 400 });
    }

    // Ambil data detail untuk tiap pelanggar
    const santriPelanggarList = await prisma.santriInternal.findMany({
      where: { id: { in: allPelanggarIds } },
      include: {
        riwayatRecords: {
          orderBy: { id: 'desc' },
          take: 1,
          include: { kelas: true }
        }
      }
    });

    const pelanggarMap = new Map(santriPelanggarList.map(p => [p.id, p]));
    const transactions = [];

    for (const item of laporan) {
      const pIds = item.pelanggarIds.filter((id: string) => id !== session.santriId);
      if (pIds.length === 0) continue; // Skip if empty or trying to report self

      let jasusId = session.santriId;
      let jasusNama = session.nama;
      
      if (isLajnah && item.pelaporKustomId && item.pelaporKustomNama) {
         jasusId = item.pelaporKustomId;
         jasusNama = item.pelaporKustomNama;
      }

      transactions.push(
        prisma.laporanMukholif.create({
          data: {
            waktuMelanggar: new Date(item.waktuMelanggar),
            tempatMelanggar: item.tempatMelanggar,
            perkataanYgDiucapkan: item.perkataanYgDiucapkan,
            detailKejadian: item.detailKejadian || null,
            jasusId,
            jasusNama,
            pelanggarList: {
              create: pIds.map((pId: string) => {
                const p = pelanggarMap.get(pId);
                if (!p) return null;
                return {
                  santriId: p.id,
                  santriNama: p.nama || "Tanpa Nama",
                  santriKelas: p.riwayatRecords[0]?.kelas?.nama || null,
                  santriAsrama: p.sakan ? `${p.sakan} - ${p.kamar || ''}` : null
                };
              }).filter(Boolean) as any
            }
          }
        })
      );
    }

    if (transactions.length === 0) {
      return NextResponse.json({ error: "Tidak ada laporan valid yang bisa diproses" }, { status: 400 });
    }

    await prisma.$transaction(transactions);

    return NextResponse.json({ success: true, count: transactions.length });
  } catch (error) {
    console.error("Error batch creating laporan mukholif:", error);
    return NextResponse.json({ error: "Gagal membuat daftar laporan" }, { status: 500 });
  }
}
