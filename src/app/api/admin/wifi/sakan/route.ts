import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Ambil daftar Sakan yang unik dari Santri (santri aktif)
    const sakansRaw = await prisma.santriInternal.findMany({
      where: { isAktif: true, AND: [{ sakan: { not: null } }, { sakan: { not: "" } }] },
      select: { sakan: true },
      distinct: ['sakan']
    });

    type SakanAggr = { sakan: string; _count: { sakan: number } };
    const sakanCountRaw = await prisma.santriInternal.groupBy({
      by: ['sakan'],
      where: { isAktif: true, AND: [{ sakan: { not: null } }, { sakan: { not: "" } }] },
      _count: { sakan: true }
    });

    // Ambil config yang ada
    const configs = await prisma.wifiSakanConfig.findMany();
    const profiles = await prisma.wifiProfile.findMany();

    // Gabungkan
    const result = (sakansRaw as { sakan: string }[]).map(s => {
      const countItem = (sakanCountRaw as SakanAggr[]).find(c => c.sakan === s.sakan);
      const conf = configs.find(c => c.sakan === s.sakan);
      
      return {
        sakan: s.sakan,
        count: countItem?._count.sakan || 0,
        enabled: conf?.enabled || false,
        profileId: conf?.profileId || null,
        profileName: profiles.find(p => p.id === conf?.profileId)?.name || null
      };
    });

    return NextResponse.json({ sakans: result });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch sakans' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { sakan, enabled, profileId } = await request.json();

    if (!sakan) return NextResponse.json({ error: 'Sakan name is required' }, { status: 400 });

    const updated = await prisma.wifiSakanConfig.upsert({
      where: { sakan },
      update: { enabled, profileId: profileId || null },
      create: { sakan, enabled, profileId: profileId || null } // Type string requires string payload, handled if null. Let's make sure undefined goes as null.
    });

    return NextResponse.json({ success: true, sakan: updated });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update sakan config' }, { status: 500 });
  }
}
