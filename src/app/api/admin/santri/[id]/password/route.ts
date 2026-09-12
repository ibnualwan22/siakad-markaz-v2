import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword, getSession } from '@/lib/auth';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { password } = await request.json();

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: 'Password minimal 6 karakter' },
        { status: 400 }
      );
    }

    // Cek santri ada
    const santri = await prisma.santriInternal.findUnique({
      where: { id },
    });

    if (!santri) {
      return NextResponse.json(
        { error: 'Santri tidak ditemukan' },
        { status: 404 }
      );
    }

    const passwordHash = await hashPassword(password);

    await prisma.santriInternal.update({
      where: { id },
      data: { passwordHash },
    });

    // Sync ke tabel radcheck untuk RADIUS (jika tabel sudah ada)
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO radcheck (username, attribute, op, value)
         VALUES ($1, 'Cleartext-Password', ':=', $2)
         ON CONFLICT (username, attribute)
         DO UPDATE SET value = $2`,
        id,
        password
      );
    } catch {
      // Tabel radcheck belum ada, skip saja
      console.log('Tabel radcheck belum tersedia, skip sync RADIUS');
    }

    return NextResponse.json({
      success: true,
      message: `Password santri ${santri.nama || id} berhasil diubah`,
    });
  } catch (error) {
    console.error('Error setting santri password:', error);
    return NextResponse.json(
      { error: 'Gagal mengubah password' },
      { status: 500 }
    );
  }
}
