import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth';

/**
 * Verifikasi login WiFi untuk Civitas (username + password)
 * Dipanggil oleh halaman login sebelum redirect ke gateway
 *
 * DIPERBARUI — Fase 1 Ruijie + Siakad:
 * Civitas kini memakai AKUN UTAMA mereka (Siakad/Bawwabah — User.username
 * + User.passwordHash bcrypt, sama seperti login portal Siakad), bukan
 * lagi password WiFi terpisah. Akun WiFi lama (WifiAccount, plaintext)
 * tetap diterima sebagai fallback kompatibilitas mundur bagi civitas
 * yang sudah punya akun WiFi.
 */
export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({
        success: false,
        message: "Username dan password harus diisi."
      });
    }

    const lowered = username.toLowerCase().trim();

    // (1) Akun utama Siakad/Bawwabah (User) — dicek dulu.
    const user = await prisma.user.findUnique({
      where: { username: lowered },
    });
    if (user) {
      if (!user.isActive) {
        return NextResponse.json({
          success: false,
          message: "Akun Anda tidak aktif. Hubungi admin."
        });
      }
      const isMatch = await verifyPassword(password, user.passwordHash);
      if (isMatch) {
        return NextResponse.json({ success: true });
      }
      // Password tidak cocok di akun utama -> lanjut cek akun WiFi lama
      // (username bisa sama, password berbeda). Jangan langsung gagal.
    }

    // (2) Akun WiFi lama (WifiAccount, plaintext) — fallback.
    const account = await prisma.wifiAccount.findUnique({
      where: { username: lowered },
    });

    if (!account) {
      return NextResponse.json({
        success: false,
        message: "Akun WiFi tidak ditemukan."
      });
    }

    if (!account.isActive) {
      return NextResponse.json({
        success: false,
        message: "Akun WiFi Anda tidak aktif. Hubungi admin."
      });
    }

    // Password WiFi disimpan plaintext (kebutuhan RADIUS)
    if (account.password !== password) {
      return NextResponse.json({
        success: false,
        message: "Password salah."
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[WiFi Verify] Error:', error);
    return NextResponse.json({
      success: false,
      message: "Terjadi kesalahan server."
    }, { status: 500 });
  }
}
