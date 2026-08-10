import { NextResponse } from 'next/server';
import { getSantriSession } from '@/lib/santri-auth';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  const session = await getSantriSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { bulanKe } = body;

    if (bulanKe === undefined || isNaN(parseInt(bulanKe))) {
      return NextResponse.json({ error: 'Payload tidak valid, membutuhkan angka bulanKe' }, { status: 400 });
    }

    const nis = session.santriId;
    const parsedBulanKe = parseInt(bulanKe);

    // ====== LANGKAH 1: Update lokal SIAKAD dulu (pasti berhasil) ======
    await prisma.santriInternal.update({
      where: { id: nis },
      data: { bulanKe: parsedBulanKe }
    });

    // ====== LANGKAH 2: Kirim update ke PPDB (best-effort, tidak menghalangi) ======
    let ppdbSynced = false;
    try {
      const PPDB_BASE_URL = process.env.PPDB_BASE_URL || 'https://ppdb.markazarabiyah.com';
      const PPDB_SIAKAD_KEY = process.env.PPDB_SIAKAD_API_KEY || '';

      if (PPDB_SIAKAD_KEY) {
        const ppdbRes = await fetch(`${PPDB_BASE_URL}/api/integrasi/siakad/update-bulan-ke`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': PPDB_SIAKAD_KEY
          },
          body: JSON.stringify({ nis, bulanKe: parsedBulanKe })
        });
        ppdbSynced = ppdbRes.ok;
      }
    } catch (e) {
      console.error('Gagal sync bulanKe ke PPDB (non-blocking):', e);
    }

    return NextResponse.json({
      success: true,
      message: `Bulan Ke berhasil diperbarui menjadi bulan ke-${parsedBulanKe}.`,
      data: { nis, bulanKe: parsedBulanKe },
      ppdbSynced
    }, { status: 200 });
  } catch (error: any) {
    console.error('Error in /api/santri/me/update-bulan:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan sistem internal' }, { status: 500 });
  }
}
