import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * WiFiDog Auth Endpoint (DIPERBARUI — Fase 1 Ruijie + Siakad)
 *
 * Setelah user login melalui halaman /wifi/login, gateway Ruijie akan
 * memanggil endpoint ini untuk memvalidasi apakah user tersebut
 * benar-benar berhak menggunakan internet.
 *
 * Request: GET /wifi/auth?stage=...&ip=...&mac=...&token=<redacted>&incoming=...&outgoing=...
 *
 * Response: Plain text
 *   - "Auth: 1" = user authorized (boleh internet)
 *   - "Auth: 0" = user denied (blokir)
 *
 * stage bisa berupa:
 *   - "login"    = user baru saja login (validasi pertama)
 *   - "counters" = periodic check (heartbeat, cek apakah masih boleh online)
 *
 * PERUBAHAN Fase 1 (vs versi lama):
 *   1. Ikatan MAC — 1 NIS/username = 1 perangkat (keputusan user).
 *      - Login pertama dari sebuah MAC -> MAC diikat ke pemilik.
 *      - Login dari MAC berbeda dengan pemilik yang sudah terikat -> DITOLAK.
 *      - Reset ikatan lewat admin: DELETE /api/admin/wifi/mac-binding.
 *   2. Civitas dikenali lewat DUA sumber akun:
 *      - Akun Siakad/Bawwabah (User: username + isActive) — akun utama civitas.
 *      - Akun WiFi lama (WifiAccount) — fallback kompatibilitas mundur.
 *      (Password sudah diverifikasi di halaman login via /api/wifi/verify-login;
 *       di sini hanya dicek akunnya ada + aktif.)
 */

// Normalisasi MAC ke format kanonis: HURUF BESAR, dipisah titik dua.
// Menerima "aa:bb:cc:dd:ee:ff", "aa-bb-cc-dd-ee-ff", "aabbccddeeff".
function normalizeMac(raw: string): string {
  const hex = raw.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  if (hex.length !== 12) return '';
  return hex.match(/.{2}/g)!.join(':');
}

/**
 * Periksa + ikat MAC untuk pemilik (santri/civitas).
 * Mengembalikan true bila MAC boleh dipakai, false bila ditolak.
 * - Belum ada ikatan -> buat ikatan (perangkat pertama).
 * - Ikatan ada + MAC sama -> perbarui lastSeenAt, boleh.
 * - Ikatan ada + MAC beda -> tolak (1 pemilik = 1 perangkat).
 * - MAC kosong (gateway tidak mengirim) -> lolos longgar + dicatat di log.
 */
async function checkAndBindMac(
  ownerType: 'SANTRI' | 'CIVITAS',
  ownerId: string,
  macRaw: string
): Promise<boolean> {
  const mac = normalizeMac(macRaw);
  if (!mac) {
    console.log(`[WiFiDog Auth] MAC kosong untuk ${ownerType}:${ownerId} — lolos longgar`);
    return true;
  }

  const existing = await prisma.wifiMacBinding.findUnique({
    where: { ownerId },
  });

  if (!existing) {
    await prisma.wifiMacBinding.create({
      data: { ownerType, ownerId, macAddress: mac },
    });
    console.log(`[WiFiDog Auth] MAC ${mac} diikat ke ${ownerType}:${ownerId}`);
    return true;
  }

  if (existing.macAddress === mac) {
    await prisma.wifiMacBinding.update({
      where: { ownerId },
      data: { lastSeenAt: new Date() },
    });
    return true;
  }

  console.log(
    `[WiFiDog Auth] DITOLAK — ${ownerType}:${ownerId} sudah terikat ke ${existing.macAddress}, coba dari ${mac}`
  );
  return false;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const stage = params.get('stage') || 'login';
  const token = params.get('token') || '';
  const mac = params.get('mac') || '';
  const ip = params.get('ip') || '';

  console.log(`[WiFiDog Auth] stage=${stage} mac=${mac} ip=${ip}`);

  try {
    if (stage === 'counters') {
      // Heartbeat / periodic check.
      // Token ada + (tidak ada ikatan MAC, atau MAC cocok) -> tetap online.
      // MAC berbeda dari ikatan -> tendang (Auth: 0).
      if (!token) {
        return new NextResponse('Auth: 0', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        });
      }
      const normalizedMac = normalizeMac(mac);
      if (normalizedMac) {
        // ownerId disimpan lowercase untuk civitas (lihat checkAndBindMac),
        // jadi token ikut di-lowercase agar lookup cocok.
        const binding = await prisma.wifiMacBinding.findUnique({
          where: { ownerId: token.toLowerCase() },
        });
        if (binding && binding.macAddress !== normalizedMac) {
          console.log(
            `[WiFiDog Auth] counters DITOLAK — token ${token} terikat ke ${binding.macAddress}, heartbeat dari ${normalizedMac}`
          );
          return new NextResponse('Auth: 0', {
            status: 200,
            headers: { 'Content-Type': 'text/plain' },
          });
        }
      }
      return new NextResponse('Auth: 1', {
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
        // Ikatan MAC: 1 NIS = 1 perangkat
        isAuthorized = await checkAndBindMac('SANTRI', username, mac);
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

        // Catat penggunaan voucher (+ MAC pemakai bila ada)
        await prisma.wifiVoucher.update({
          where: { id: voucher.id },
          data: {
            usedAt: new Date(),
            ...(normalizeMac(mac) ? { usedByMac: normalizeMac(mac) } : {}),
          },
        });
      }
    } else {
      // Cek Civitas Account.
      // (a) Akun Siakad/Bawwabah (User) — akun utama civitas.
      // (b) Akun WiFi lama (WifiAccount) — fallback kompatibilitas mundur.
      const lowered = username.toLowerCase();
      const user = await prisma.user.findUnique({
        where: { username: lowered },
      });
      if (user && user.isActive) {
        isAuthorized = await checkAndBindMac('CIVITAS', lowered, mac);
      } else {
        const account = await prisma.wifiAccount.findUnique({
          where: { username: lowered },
        });
        if (account && account.isActive) {
          isAuthorized = await checkAndBindMac('CIVITAS', lowered, mac);
        }
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
