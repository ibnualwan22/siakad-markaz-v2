import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// Endpoint internal untuk aplikasi eksternal (E-Maliyah):
// verifikasi kredensial pengguna Siakad tanpa membuka sesi web.
// Dijaga API key yang sama dengan /api/external/* lainnya.
// TIDAK PERNAH mengembalikan passwordHash.

function validateApiKey(request: Request): boolean {
  const apiKey = request.headers.get('x-api-key');
  const envApiKey = process.env.EXTERNAL_API_KEY;
  return !!envApiKey && apiKey === envApiKey;
}

export async function POST(request: Request) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!username || !password) {
      return NextResponse.json({ error: 'Username dan password wajib diisi' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { username } });

    // Pesan generik: jangan bocorkan apakah username ada atau akun nonaktif.
    if (!user || !user.isActive) {
      return NextResponse.json({ success: false, error: 'Kredensial tidak valid' }, { status: 401 });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Kredensial tidak valid' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        nama: user.nama,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Error verifying external credentials:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan sistem' }, { status: 500 });
  }
}
