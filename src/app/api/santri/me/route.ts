import { NextResponse } from 'next/server';
import { getSantriSession } from '@/lib/santri-auth';
import { getSantriOverview } from '@/lib/santri-overview';
export const dynamic = 'force-dynamic';
export async function GET() {
  const session = await getSantriSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return getSantriOverview(session.santriId);
}
