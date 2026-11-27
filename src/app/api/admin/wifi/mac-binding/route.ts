import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

/**
 * Admin: kelola ikatan MAC WiFi (1 NIS/username = 1 perangkat)
 *
 * GET    /api/admin/wifi/mac-binding
 *   Daftar semua ikatan (opsional ?ownerId=... untuk satu pemilik).
 * POST   /api/admin/wifi/mac-binding   { ownerType, ownerId, macAddress }
 *   Ikat / ganti MAC pemilik secara manual (override).
 * DELETE /api/admin/wifi/mac-binding?ownerId=...
 *   Hapus ikatan -> pemilik bisa login dari perangkat baru (reset).
 *
 * Semua butuh sesi ADMIN (pola yang sama dengan route admin WiFi lain).
 */

function normalizeMac(raw: string): string {
  const hex = String(raw || '').replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  if (hex.length !== 12) return '';
  return hex.match(/.{2}/g)!.join(':');
}

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return null;
  return session;
}

export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ownerId = request.nextUrl.searchParams.get('ownerId') || undefined;

  const bindings = await prisma.wifiMacBinding.findMany({
    where: ownerId ? { ownerId } : {},
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json({ bindings });
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const ownerType = String(body.ownerType || '').toUpperCase();
  const ownerIdRaw = String(body.ownerId || '').trim();
  const mac = normalizeMac(String(body.macAddress || ''));

  if (ownerType !== 'SANTRI' && ownerType !== 'CIVITAS') {
    return NextResponse.json(
      { error: 'ownerType harus SANTRI atau CIVITAS.' },
      { status: 400 }
    );
  }
  if (!ownerIdRaw) {
    return NextResponse.json(
      { error: 'ownerId (NIS / username) harus diisi.' },
      { status: 400 }
    );
  }
  if (!mac) {
    return NextResponse.json(
      { error: 'macAddress tidak valid (harus 12 digit hex).' },
      { status: 400 }
    );
  }

  const ownerId =
    ownerType === 'CIVITAS' ? ownerIdRaw.toLowerCase() : ownerIdRaw;

  const binding = await prisma.wifiMacBinding.upsert({
    where: { ownerId },
    update: { ownerType, macAddress: mac, lastSeenAt: new Date() },
    create: { ownerType, ownerId, macAddress: mac },
  });

  return NextResponse.json({ success: true, binding });
}

export async function DELETE(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ownerId = request.nextUrl.searchParams.get('ownerId') || '';
  if (!ownerId) {
    return NextResponse.json(
      { error: 'ownerId (NIS / username) harus diisi.' },
      { status: 400 }
    );
  }

  await prisma.wifiMacBinding.deleteMany({ where: { ownerId } });

  return NextResponse.json({
    success: true,
    message: `Ikatan MAC untuk ${ownerId} dihapus. Pemilik bisa login dari perangkat baru.`,
  });
}
