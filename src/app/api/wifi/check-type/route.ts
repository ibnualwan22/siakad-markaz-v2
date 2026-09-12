import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { input } = await request.json();
    
    if (!input || typeof input !== 'string') {
      return NextResponse.json({ type: 'unknown' });
    }

    const trimmed = input.trim();
    const isOnlyDigits = /^\d+$/.test(trimmed);

    if (isOnlyDigits) {
      if (trimmed.length === 11) {
        // Cek apakah itu NIS Santri Aktif
        const santri = await prisma.santriInternal.findUnique({
          where: { id: trimmed }
        });
        if (santri && santri.isAktif) {
          return NextResponse.json({ type: 'santri' });
        }
      }

      // Kalau tidak (atau sisa angka), cek apakah voucher
      const voucher = await prisma.wifiVoucher.findUnique({
        where: { code: trimmed }
      });
      if (voucher) {
        return NextResponse.json({ type: 'voucher' });
      }

      // Jika bukan keduanya tapi angka
      return NextResponse.json({ type: 'unknown' });
    } else {
      // Jika ada huruf -> pastikan > 3 huruf baru jadi civitas
      if (trimmed.length >= 3) {
        // Cek civitas account
        const account = await prisma.wifiAccount.findUnique({
          where: { username: trimmed.toLowerCase() }
        });
        if (account) {
          return NextResponse.json({ type: 'civitas' });
        }
      }
      return NextResponse.json({ type: 'unknown' });
    }
  } catch (error) {
    return NextResponse.json({ type: 'unknown', error: 'Internal Error' }, { status: 500 });
  }
}
