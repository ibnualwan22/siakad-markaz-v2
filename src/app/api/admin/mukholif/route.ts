import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check permission manually or handle it on layout? Let's check manually here too for security
  if (session.role !== "ADMIN") {
    const rolePerms = await prisma.rolePermission.findMany({
      where: { role: session.role as any, permission: "mukholif_lughoh" }
    });
    if (rolePerms.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status") || "MENUNGGU"; // MENUNGGU | SELESAI | ALL
  const q = searchParams.get("q") || "";

  try {
    const whereClause: any = {};
    if (statusFilter !== "ALL") {
      whereClause.status = statusFilter;
    }

    if (q) {
      whereClause.pelanggarList = {
        some: {
          santri: {
            nama: { contains: q, mode: 'insensitive' }
          }
        }
      };
    }

    const laporanList = await prisma.laporanMukholif.findMany({
      where: whereClause,
      include: {
        pelanggarList: {
          select: { 
            id: true, 
            statusTabayun: true, 
            jumlahTidakHadir: true, 
            tabayunAt: true,
            santriNama: true,
            santriKelas: true,
            santriAsrama: true,
            santri: { select: { nama: true } }
          }
        },
        jasus: {
          select: {
            sakan: true,
            kamar: true,
            riwayatRecords: {
              orderBy: { id: 'desc' },
              take: 1,
              select: { kelas: { select: { nama: true } } }
            }
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return NextResponse.json(laporanList);
  } catch (error) {
    console.error("Error fetching admin laporan mukholif:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role !== "ADMIN") {
    const rolePerms = await prisma.rolePermission.findMany({
      where: { role: session.role as any, permission: "mukholif_lughoh" }
    });
    if (rolePerms.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    const data = await request.json();
    const { laporan } = data; // Array of reports
    
    if (!laporan || !Array.isArray(laporan) || laporan.length === 0) {
      return NextResponse.json({ error: "Data laporan kosong" }, { status: 400 });
    }

    const allPelanggarIds = Array.from(new Set(laporan.flatMap((l: any) => l.pelanggarIds || [])));
    if (allPelanggarIds.length === 0) {
      return NextResponse.json({ error: "Tidak ada pelanggar yang dipilih" }, { status: 400 });
    }

    const santriPelanggarList = await prisma.santriInternal.findMany({
      where: { id: { in: allPelanggarIds as string[] } },
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
      const pIds = item.pelanggarIds;
      if (!pIds || pIds.length === 0) continue;

      let jasusId = session.userId;
      let jasusNama = session.nama;
      
      if (item.pelaporKustomId && item.pelaporKustomNama) {
         jasusId = item.pelaporKustomId;
         jasusNama = item.pelaporKustomNama;
      } else {
         try {
           await prisma.santriInternal.upsert({
             where: { id: "ADMIN" },
             update: {},
             create: { id: "ADMIN", nama: "Administrator", pin: "123456", isAktif: true } as any
           });
         } catch { } // ignore if already exists or schema different (upsert should work if minimal fields provided)
         jasusId = "ADMIN";
         jasusNama = "Administrator";
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
    console.error("Error creating laporan mukholif by admin:", error);
    return NextResponse.json({ error: "Gagal membuat daftar laporan" }, { status: 500 });
  }
}
