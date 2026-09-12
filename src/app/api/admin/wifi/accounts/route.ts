import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

/**
 * GET /api/admin/wifi/accounts
 * 
 * Ambil daftar akun WiFi dari tabel radcheck, join dengan data santri.
 * Query: ?search=xxx&page=1&limit=50
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const search = url.searchParams.get('search') || '';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // Query radcheck join SantriInternal
    const searchCondition = search
      ? `AND (r.username LIKE '%${search.replace(/'/g, "''")}%' OR s.nama LIKE '%${search.replace(/'/g, "''")}%')`
      : '';

    const accounts = await prisma.$queryRawUnsafe<Array<{
      username: string;
      value: string;
      nama: string | null;
      isAktif: boolean | null;
      wifiEnabled: boolean | null;
      sakan: string | null;
    }>>(`
      SELECT r.username, r.value, s.nama, s."isAktif", s."wifiEnabled", s.sakan
      FROM radcheck r
      LEFT JOIN "SantriInternal" s ON r.username = s.id
      WHERE r.attribute = 'Cleartext-Password'
      ${searchCondition}
      ORDER BY s.nama ASC NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `);

    const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(`
      SELECT COUNT(*) as count
      FROM radcheck r
      LEFT JOIN "SantriInternal" s ON r.username = s.id
      WHERE r.attribute = 'Cleartext-Password'
      ${searchCondition}
    `);
    const total = Number(countResult[0]?.count || 0);

    return NextResponse.json({
      accounts: accounts.map(a => ({
        nis: a.username,
        password: a.value,
        nama: a.nama || '-',
        isAktif: a.isAktif ?? false,
        wifiEnabled: a.wifiEnabled ?? false,
        sakan: a.sakan || '-',
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('WiFi accounts error:', error);
    const msg = error instanceof Error ? error.message : String(error);

    if (msg.includes('radcheck') && msg.includes('does not exist')) {
      return NextResponse.json({
        error: 'Tabel RADIUS belum dibuat. Jalankan script SQL: scripts/setup-radius-tables.sql',
      }, { status: 400 });
    }

    return NextResponse.json(
      { error: msg || 'Gagal mengambil daftar akun WiFi' },
      { status: 500 }
    );
  }
}
