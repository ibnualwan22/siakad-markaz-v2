export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSantriSession } from '@/lib/santri-auth';
import { normalizeWa, hashOtp, generateOtp, sendFonnte } from '@/lib/no-wa';

const OTP_TTL_MIN = 10;
const RESEND_COOLDOWN_SEC = 60;

export async function POST(request: Request) {
  try {
    const session = await getSantriSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { noWa } = await request.json();
    const normalized = normalizeWa(noWa || '');
    if (!normalized) {
      return NextResponse.json(
        { error: 'Nomor WhatsApp tidak valid. Gunakan format 08xx atau 628xx.' },
        { status: 400 }
      );
    }

    const santri = await prisma.santriInternal.findUnique({
      where: { id: session.santriId },
      select: { id: true },
    });
    if (!santri) {
      return NextResponse.json({ error: 'Santri tidak ditemukan' }, { status: 404 });
    }

    // Nomor tidak boleh dipakai santri lain (cek varian format 08xx/628xx)
    const varianLokal = '0' + normalized.slice(2);
    const dipakai = await prisma.santriInternal.findFirst({
      where: {
        id: { not: session.santriId },
        OR: [{ noWaSantri: normalized }, { noWaSantri: varianLokal }],
      },
      select: { id: true },
    });
    if (dipakai) {
      return NextResponse.json(
        { error: 'Nomor ini sudah terdaftar untuk santri lain.' },
        { status: 409 }
      );
    }

    // Cooldown kirim ulang
    const terakhir = await prisma.waOtp.findFirst({
      where: { santriId: session.santriId },
      orderBy: { createdAt: 'desc' },
    });
    if (terakhir && Date.now() - terakhir.createdAt.getTime() < RESEND_COOLDOWN_SEC * 1000) {
      return NextResponse.json(
        { error: `Tunggu ${RESEND_COOLDOWN_SEC} detik sebelum meminta kode lagi.` },
        { status: 429 }
      );
    }

    const otp = generateOtp();

    // Bersihkan OTP lama, simpan yang baru
    await prisma.waOtp.deleteMany({ where: { santriId: session.santriId } });
    await prisma.waOtp.create({
      data: {
        santriId: session.santriId,
        noWa: normalized,
        otpHash: hashOtp(otp),
        expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60 * 1000),
      },
    });

    const terkirim = await sendFonnte(
      normalized,
      `Kode verifikasi WhatsApp *Siakad Markaz Arabiyah*: *${otp}*\n\nBerlaku ${OTP_TTL_MIN} menit. Jangan berikan kode ini ke siapapun.`
    );

    if (!terkirim) {
      await prisma.waOtp.deleteMany({ where: { santriId: session.santriId } });
      return NextResponse.json(
        { error: 'Gagal mengirim kode OTP. Coba lagi beberapa saat.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Kode OTP dikirim ke ${normalized}. Berlaku ${OTP_TTL_MIN} menit.`,
    });
  } catch (error) {
    console.error('Error request OTP WA:', error);
    return NextResponse.json({ error: 'Gagal memproses permintaan' }, { status: 500 });
  }
}
