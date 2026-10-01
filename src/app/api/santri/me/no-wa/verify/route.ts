export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSantriSession } from '@/lib/santri-auth';
import { normalizeWa, verifyOtpHash } from '@/lib/no-wa';

const MAX_ATTEMPTS = 5;

export async function POST(request: Request) {
  try {
    const session = await getSantriSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { noWa, otp } = await request.json();
    const normalized = normalizeWa(noWa || '');
    if (!normalized || !otp || String(otp).trim().length !== 6) {
      return NextResponse.json(
        { error: 'Nomor atau kode OTP tidak valid.' },
        { status: 400 }
      );
    }

    const record = await prisma.waOtp.findFirst({
      where: { santriId: session.santriId },
      orderBy: { createdAt: 'desc' },
    });

    if (!record || record.noWa !== normalized) {
      return NextResponse.json(
        { error: 'Tidak ada permintaan OTP untuk nomor ini. Minta kode baru.' },
        { status: 404 }
      );
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      await prisma.waOtp.delete({ where: { id: record.id } });
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan. Minta kode baru.' },
        { status: 429 }
      );
    }

    if (record.expiresAt.getTime() < Date.now()) {
      await prisma.waOtp.delete({ where: { id: record.id } });
      return NextResponse.json(
        { error: 'Kode sudah kedaluwarsa. Minta kode baru.' },
        { status: 410 }
      );
    }

    if (!verifyOtpHash(String(otp).trim(), record.otpHash)) {
      await prisma.waOtp.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      return NextResponse.json({ error: 'Kode OTP salah.' }, { status: 401 });
    }

    // Verifikasi berhasil: simpan nomor & hapus semua OTP santri ini
    await prisma.$transaction([
      prisma.santriInternal.update({
        where: { id: session.santriId },
        data: { noWaSantri: normalized },
      }),
      prisma.waOtp.deleteMany({ where: { santriId: session.santriId } }),
    ]);

    return NextResponse.json({
      success: true,
      message: 'Nomor WhatsApp berhasil diverifikasi dan disimpan.',
      noWa: normalized,
    });
  } catch (error) {
    console.error('Error verify OTP WA:', error);
    return NextResponse.json({ error: 'Gagal memverifikasi kode' }, { status: 500 });
  }
}
