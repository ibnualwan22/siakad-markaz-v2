import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const profiles = await prisma.wifiProfile.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ profiles });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name, radiusGroup, downloadKbps, uploadKbps, maxDevices, description } = await request.json();

    if (!name || !radiusGroup) {
      return NextResponse.json({ error: 'Name and radiusGroup are required' }, { status: 400 });
    }

    const profile = await prisma.wifiProfile.create({
      data: {
        name,
        radiusGroup,
        downloadKbps: downloadKbps || 2048,
        uploadKbps: uploadKbps || 1024,
        maxDevices: maxDevices || 1,
        description
      }
    });

    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, name, radiusGroup, downloadKbps, uploadKbps, maxDevices, description } = await request.json();

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const profile = await prisma.wifiProfile.update({
      where: { id },
      data: {
        name,
        radiusGroup,
        downloadKbps,
        uploadKbps,
        maxDevices,
        description
      }
    });

    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    await prisma.wifiProfile.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete profile, it might be in use' }, { status: 500 });
  }
}
