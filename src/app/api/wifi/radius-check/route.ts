import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth';

/**
 * Endpoint otorisasi WiFi untuk FreeRADIUS (jalur WISPr)
 * POST /api/wifi/radius-check
 *
 * Dipanggil oleh FreeRADIUS (rlm_rest / skrip) saat gateway Ruijie
 * mengirim RADIUS Access-Request. Logika auth di sini SAMA dengan
 * /wifi/auth (WiFiDog) agar keputusan accept/reject konsisten di
 * kedua jalur — satu tempat kebenaran.
 *
 * Body (JSON):
 *   { "username": string, "password": string, "mac": string }
 *   - username: NIS santri (11 digit) / kode voucher / username civitas
 *   - password: sandi yang dimasukkan user (untuk santri: NIS, sampai
 *     wifiPasswordHash diaktifkan; untuk civitas: password akun Siakad
 *     atau password WiFi lama)
 *   - mac: Calling-Station-Id dari gateway (opsional; bila ada, ikatan
 *     MAC 1 NIS = 1 perangkat ditegakkan seperti di /wifi/auth)
 *
 * Response (JSON):
 *   { "accept": true }              -> RADIUS Access-Accept
 *   { "accept": false, "message": "alasan" } -> RADIUS Access-Reject
 *
 * CATATAN:
 * - Endpoint ini HANYA untuk jalur WISPr (bila Ruijie dikonfigurasi
 *   memakai RADIUS). Jalur utama saat ini adalah WiFiDog (/wifi/auth)
 *   yang TIDAK memakai endpoint ini dan TIDAK butuh server RADIUS.
 * - FreeRADIUS BELUM berjalan di VPS (Fase 1 — deployment). Endpoint
 *   ini disiapkan agar siap dipakai saat FreeRADIUS dipasang.
 * - Endpoint ini ditujukan untuk panggilan localhost dari FreeRADIUS
 *   di VPS yang sama. Batasi di nginx / firewall agar tidak terbuka
 *   ke internet (bukan lewat secret yang ditulis di file).
 */

// Normalisasi MAC — sama seperti di /wifi/auth/route.ts
function normalizeMac(raw: string): string {
  const hex = raw.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  if (hex.length !== 12) return '';
  return hex.match(/.{2}/g)!.join(':');
}

async function checkAndBindMac(
  ownerType: 'SANTRI' | 'CIVITAS',
  ownerId: string,
  macRaw: string
): Promise<{ ok: boolean; message?: string }> {
  const mac = normalizeMac(macRaw);
  if (!mac) return { ok: true }; // MAC tidak dikirim -> lolos longgar

  const existing = await prisma.wifiMacBinding.findUnique({
    where: { ownerId },
  });

  if (!existing) {
    await prisma.wifiMacBinding.create({
      data: { ownerType, ownerId, macAddress: mac },
    });
    return { ok: true };
  }

  if (existing.macAddress === mac) {
    await prisma.wifiMacBinding.update({
      where: { ownerId },
      data: { lastSeenAt: new Date() },
    });
    return { ok: true };
  }

  return {
    ok: false,
    message: `Perangkat ini belum terdaftar untuk ${ownerId}. Satu akun hanya untuk satu perangkat — hubungi admin untuk reset.`,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    const mac = String(body.mac || '');

    if (!username) {
      return NextResponse.json(
        { accept: false, message: 'Username kosong.' },
        { status: 400 }
      );
    }

    const isOnlyDigits = /^\d+$/.test(username);

    // --- Santri (NIS 11 digit) ---
    if (isOnlyDigits && username.length === 11) {
      const santri = await prisma.santriInternal.findUnique({
        where: { id: username },
      });
      if (!santri || !santri.isAktif || santri.wifiEnabled === false) {
        return NextResponse.json({
          accept: false,
          message: 'NIS tidak ditemukan / tidak aktif / WiFi diblokir.',
        });
      }

      // Sandi WiFi santri (BELUM aktif saat ini):
      // - Bila wifiPasswordHash sudah diisi -> wajib cocok (bcrypt).
      // - Bila belum diisi -> terima bila password == NIS (konvensi
      //   sync-radius) atau password kosong.
      if (santri.wifiPasswordHash) {
        if (!password || !(await verifyPassword(password, santri.wifiPasswordHash))) {
          return NextResponse.json({
            accept: false,
            message: 'Password WiFi salah.',
          });
        }
      } else if (password && password !== username) {
        return NextResponse.json({
          accept: false,
          message: 'Password salah.',
        });
      }

      const macCheck = await checkAndBindMac('SANTRI', username, mac);
      if (!macCheck.ok) {
        return NextResponse.json({ accept: false, message: macCheck.message });
      }
      return NextResponse.json({ accept: true });
    }

    // --- Voucher (angka, bukan 11 digit) ---
    if (isOnlyDigits) {
      const voucher = await prisma.wifiVoucher.findFirst({
        where: {
          code: username,
          usedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      });
      if (!voucher) {
        return NextResponse.json({
          accept: false,
          message: 'Voucher tidak valid / sudah dipakai / kedaluwarsa.',
        });
      }
      await prisma.wifiVoucher.update({
        where: { id: voucher.id },
        data: {
          usedAt: new Date(),
          ...(normalizeMac(mac) ? { usedByMac: normalizeMac(mac) } : {}),
        },
      });
      return NextResponse.json({ accept: true });
    }

    // --- Civitas (username, ada huruf) ---
    const lowered = username.toLowerCase();

    // (1) Akun utama Siakad/Bawwabah (User, bcrypt)
    const user = await prisma.user.findUnique({
      where: { username: lowered },
    });
    if (user && user.isActive) {
      if (!password || !(await verifyPassword(password, user.passwordHash))) {
        return NextResponse.json({
          accept: false,
          message: 'Password salah.',
        });
      }
      const macCheck = await checkAndBindMac('CIVITAS', lowered, mac);
      if (!macCheck.ok) {
        return NextResponse.json({ accept: false, message: macCheck.message });
      }
      return NextResponse.json({ accept: true });
    }

    // (2) Akun WiFi lama (WifiAccount, plaintext) — fallback
    const account = await prisma.wifiAccount.findUnique({
      where: { username: lowered },
    });
    if (account && account.isActive && account.password === password) {
      const macCheck = await checkAndBindMac('CIVITAS', lowered, mac);
      if (!macCheck.ok) {
        return NextResponse.json({ accept: false, message: macCheck.message });
      }
      return NextResponse.json({ accept: true });
    }

    return NextResponse.json({
      accept: false,
      message: 'Username tidak ditemukan / tidak aktif / password salah.',
    });
  } catch (error) {
    console.error('[WiFi radius-check] Error:', error);
    return NextResponse.json(
      { accept: false, message: 'Terjadi kesalahan server.' },
      { status: 500 }
    );
  }
}
