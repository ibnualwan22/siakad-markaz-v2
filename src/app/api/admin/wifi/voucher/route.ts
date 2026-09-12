import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// Helper: Generate random numeric code (6-8 digits)
function generateVoucherCode(length = 6): string {
  const chars = '0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const filter = url.searchParams.get('status') || 'ALL'; // ACTIVE, EXPIRED, UNUSED

    const now = new Date();
    
    let whereCondition: any = {};
    if (filter === 'ACTIVE') {
      whereCondition = {
        usedAt: { not: null },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } }
        ]
      };
    } else if (filter === 'EXPIRED') {
      whereCondition = {
        expiresAt: { not: null, lte: now }
      };
    } else if (filter === 'UNUSED') {
      whereCondition = {
        usedAt: null,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } }
        ]
      };
    }

    const vouchers = await prisma.wifiVoucher.findMany({
      where: whereCondition,
      include: { profile: true },
      orderBy: { createdAt: 'desc' },
      take: 200 // limit to 200 for safe viewing
    });

    return NextResponse.json({ vouchers });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch vouchers' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { quantity, profileId, durasiMenit, note } = await request.json();

    if (!quantity || !profileId || !durasiMenit) {
      return NextResponse.json({ error: 'Quantity, profile, and duration are required' }, { status: 400 });
    }

    const profile = await prisma.wifiProfile.findUnique({ where: { id: profileId } });
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const generatedVouchers = [];
    
    for (let i = 0; i < quantity; i++) {
      // Logic for Expiration (jika ingin expired sejak dari create, atau nunggu used. Yg normal voucher wifi: expired dihitung dari kapan dipakai. Namun kalau simple: hitung dari sekarang).
      // Kita hitung dari sekarang utk mempermudah radcheck
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + parseInt(durasiMenit));

      let code = '';
      let isUnique = false;
      while(!isUnique) {
        code = generateVoucherCode(6);
        const existing = await prisma.wifiVoucher.findUnique({ where: { code } });
        const existingSantri = await prisma.santriInternal.findUnique({ where: { id: code } });
        if (!existing && !existingSantri) {
          isUnique = true;
        }
      }

      generatedVouchers.push({
        code,
        profileId,
        durasiMenit: parseInt(durasiMenit),
        expiresAt,
        note: note || '',
        createdById: session.userId || 'admin'
      });
    }

    const created = await prisma.wifiVoucher.createMany({
      data: generatedVouchers
    });

    return NextResponse.json({ success: true, count: created.count });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create vouchers' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    await prisma.wifiVoucher.delete({ where: { id } });
    
    return NextResponse.json({ success: true });
  } catch(error) {
    return NextResponse.json({ error: 'Failed to delete voucher' }, { status: 500 });
  }
}
