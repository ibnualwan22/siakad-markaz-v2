import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { santriId, wifiEnabled } = await request.json();

    if (!santriId) return NextResponse.json({ error: 'Santri ID is required' }, { status: 400 });

    const updated = await prisma.santriInternal.update({
      where: { id: santriId },
      data: { wifiEnabled }
    });

    return NextResponse.json({ success: true, santri: updated });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to toggle santri WiFi access' }, { status: 500 });
  }
}
