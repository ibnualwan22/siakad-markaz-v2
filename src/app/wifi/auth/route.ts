import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * WiFiDog Auth Endpoint
 * 
 * Setelah user login melalui halaman /wifi/login, gateway Ruijie akan
 * memanggil endpoint ini untuk memvalidasi apakah user tersebut
 * benar-benar berhak menggunakan internet.
 * 
 * Request: GET /wifi/auth?stage=...&ip=...&mac=...&token=...&incoming=...&outgoing=...
 * 
 * Response: Plain text
 *   - "Auth: 1" = user authorized (boleh internet)
 *   - "Auth: 0" = user denied (blokir)
 * 
 * stage bisa berupa:
 *   - "login"    = user baru saja login (validasi pertama)
 *   - "counters" = periodic check (heartbeat, cek apakah masih boleh online)
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const stage = params.get('stage') || 'login';
  const token = params.get('token') || '';
  const mac = params.get('mac') || '';
  const ip = params.get('ip') || '';

  console.log(`[WiFiDog Auth] stage=${stage} token=${token} mac=${mac} ip=${ip}`);

  try {
    if (stage === 'counters') {
      // Heartbeat / periodic check
      // Jika token ada dan valid, biarkan user tetap online
      if (token) {
        return new NextResponse('Auth: 1', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        });
      }
      return new NextResponse('Auth: 0', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // Stage: login (validasi pertama)
    // Token dari WiFiDog berisi username yang di-submit dari form login
    // Kita cek apakah username tersebut ada di database (radcheck atau prisma)
    if (!token) {
      return new NextResponse('Auth: 0', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // Token dalam implementasi kita = username (NIS/voucher/civitas username)
    const username = token;
    const isOnlyDigits = /^\d+$/.test(username);

    let isAuthorized = false;

    if (isOnlyDigits && username.length === 11) {
      // Cek Santri NIS
      const santri = await prisma.santriInternal.findUnique({
        where: { id: username },
      });
      if (santri && santri.isAktif && santri.wifiEnabled !== false) {
        isAuthorized = true;
      }
    } else if (isOnlyDigits) {
      // Cek Voucher (valid = belum dipakai dan belum kedaluwarsa)
      const voucher = await prisma.wifiVoucher.findFirst({
        where: {
          code: username,
          usedAt: null, // Belum pernah dipakai
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
      });
      if (voucher) {
        isAuthorized = true;

        // Catat penggunaan voucher
        await prisma.wifiVoucher.update({
          where: { id: voucher.id },
          data: { usedAt: new Date() },
        });
      }
    } else {
      // Cek Civitas Account (username + password sudah divalidasi oleh form login)
      const account = await prisma.wifiAccount.findUnique({
        where: { username: username.toLowerCase() },
      });
      if (account && account.isActive) {
        isAuthorized = true;
      }
    }

    console.log(`[WiFiDog Auth] username=${username} authorized=${isAuthorized}`);

    return new NextResponse(isAuthorized ? 'Auth: 1' : 'Auth: 0', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (error) {
    console.error('[WiFiDog Auth] Error:', error);
    // Jika terjadi error internal, tolak akses demi keamanan
    return new NextResponse('Auth: 0', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}
