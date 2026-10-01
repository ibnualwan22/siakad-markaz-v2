export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSantriSession } from '@/lib/santri-auth';
import { maskWa } from '@/lib/no-wa';

export async function GET() {
  const session = await getSantriSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const santri = await prisma.santriInternal.findUnique({
    where: { id: session.santriId },
    select: { noWaSantri: true },
  });

  if (!santri) {
    return NextResponse.json({ error: 'Santri tidak ditemukan' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    noWaMasked: santri.noWaSantri ? maskWa(santri.noWaSantri) : null,
    terhubung: !!santri.noWaSantri,
  });
}
