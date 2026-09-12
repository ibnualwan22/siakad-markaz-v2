import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { getSantriSession } from '@/lib/santri-auth';

export async function PUT(request: Request) {
  try {
    const session = await getSantriSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password baru minimal 6 karakter' },
        { status: 400 }
      );
    }

    const santri = await prisma.santriInternal.findUnique({
      where: { id: session.santriId },
    });

    if (!santri) {
      return NextResponse.json({ error: 'Santri tidak ditemukan' }, { status: 404 });
    }

    // Jika sudah punya password, verifikasi password lama
    if (santri.passwordHash) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: 'Password lama harus diisi' },
          { status: 400 }
        );
      }
      const isMatch = await verifyPassword(currentPassword, santri.passwordHash);
      if (!isMatch) {
        return NextResponse.json(
          { error: 'Password lama salah' },
          { status: 401 }
        );
      }
    }

    const newHash = await hashPassword(newPassword);

    await prisma.santriInternal.update({
      where: { id: session.santriId },
      data: { passwordHash: newHash },
    });

    // Sync ke tabel radcheck untuk RADIUS
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO radcheck (username, attribute, op, value)
         VALUES ($1, 'Cleartext-Password', ':=', $2)
         ON CONFLICT (username, attribute)
         DO UPDATE SET value = $2`,
        session.santriId,
        newPassword
      );
    } catch {
      console.log('Tabel radcheck belum tersedia, skip sync RADIUS');
    }

    return NextResponse.json({
      success: true,
      message: 'Password berhasil diubah',
    });
  } catch (error) {
    console.error('Error changing santri password:', error);
    return NextResponse.json(
      { error: 'Gagal mengubah password' },
      { status: 500 }
    );
  }
}
