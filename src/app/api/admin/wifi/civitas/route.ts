import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import * as bcrypt from 'bcryptjs';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const civitas = await prisma.wifiAccount.findMany({
      include: {
        user: { select: { nama: true, role: true } },
        profile: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ civitas });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch civitas wifi accounts' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { accountId, isActive, profileId } = await request.json();
    if (!accountId) return NextResponse.json({ error: 'Account ID required' }, { status: 400 });

    const updateData: any = {};
    if (isActive !== undefined) updateData.isActive = isActive;
    if (profileId !== undefined) updateData.profileId = profileId;

    const account = await prisma.wifiAccount.update({
      where: { id: accountId },
      data: updateData
    });

    return NextResponse.json({ success: true, account });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update civitas account' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    await prisma.wifiAccount.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete civitas account' }, { status: 500 });
  }
}
