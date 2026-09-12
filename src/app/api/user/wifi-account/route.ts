import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const account = await prisma.wifiAccount.findUnique({
      where: { userId: session.userId },
      include: { profile: true }
    });

    return NextResponse.json({ account });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch wifi account' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { username, password } = await request.json();
    if (!username || !password) return NextResponse.json({ error: 'Username and password required' }, { status: 400 });

    if (username.length < 3 || username.length > 20) {
      return NextResponse.json({ error: 'Username must be between 3 and 20 characters' }, { status: 400 });
    }

    if (/^\d+$/.test(username)) {
      return NextResponse.json({ error: 'Username tidak boleh berisikan angka saja' }, { status: 400 });
    }

    const exist = await prisma.wifiAccount.findUnique({ where: { username } });
    if (exist) return NextResponse.json({ error: 'Username ini sudah dipakai, coba yang lain' }, { status: 400 });

    const account = await prisma.wifiAccount.create({
      data: {
        userId: session.userId,
        username: username.toLowerCase(),
        password, // Disimpan plain untuk kebutuhan FreeRadius
      }
    });

    return NextResponse.json({ account });
  } catch (error) {
    return NextResponse.json({ error: 'Gagal membuat akun wifi, mungkin Anda sudah memiliki akun.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { password } = await request.json();
    if (!password) return NextResponse.json({ error: 'Password required' }, { status: 400 });

    const account = await prisma.wifiAccount.update({
      where: { userId: session.userId },
      data: { password }
    });

    return NextResponse.json({ account });
  } catch (error) {
    return NextResponse.json({ error: 'Gagal update password' }, { status: 500 });
  }
}
