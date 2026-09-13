import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Verifikasi login WiFi untuk Civitas (username + password)
 * Dipanggil oleh halaman login sebelum redirect ke gateway
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

    const account = await prisma.wifiAccount.findUnique({
      where: { username: username.toLowerCase().trim() },
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
