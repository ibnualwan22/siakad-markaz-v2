import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword, getSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { mode } = await request.json();

    // mode: "default" = set password = NIS untuk semua santri aktif yang belum punya password
    // mode: "reset_all" = reset semua password santri aktif ke NIS mereka
    const whereClause =
      mode === 'reset_all'
        ? { isAktif: true }
        : { isAktif: true, passwordHash: null };

    const santriList = await prisma.santriInternal.findMany({
      where: whereClause,
      select: { id: true },
    });

    if (santriList.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Tidak ada santri yang perlu diproses',
        count: 0,
      });
    }

    let count = 0;
    const radiusInserts: string[] = [];

    for (const santri of santriList) {
      // Password default = NIS santri
      const hash = await hashPassword(santri.id);
      await prisma.santriInternal.update({
        where: { id: santri.id },
        data: { passwordHash: hash },
      });
      radiusInserts.push(santri.id);
      count++;
    }

    // Sync ke tabel radcheck untuk RADIUS
    try {
      for (const nis of radiusInserts) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO radcheck (username, attribute, op, value)
           VALUES ($1, 'Cleartext-Password', ':=', $2)
           ON CONFLICT (username, attribute)
           DO UPDATE SET value = $2`,
          nis,
          nis // password default = NIS
        );
      }
    } catch {
      console.log('Tabel radcheck belum tersedia, skip sync RADIUS');
    }

    return NextResponse.json({
      success: true,
      message: `Password ${count} santri berhasil di-set ke NIS masing-masing`,
      count,
    });
  } catch (error) {
    console.error('Error bulk setting passwords:', error);
    return NextResponse.json(
      { error: 'Gagal mengatur password massal' },
      { status: 500 }
    );
  }
}
