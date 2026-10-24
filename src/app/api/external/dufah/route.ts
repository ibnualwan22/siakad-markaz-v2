import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Endpoint internal untuk aplikasi eksternal (E-Maliyah):
// daftar dufah beserta rentang tanggal tiap usbu, agar pemetaan
// periode bisyaroh dipilih dari data Siakad (bukan ketikan manual).
// Dijaga API key yang sama dengan /api/external/* lainnya.

function validateApiKey(request: Request): boolean {
  const apiKey = request.headers.get('x-api-key');
  const envApiKey = process.env.EXTERNAL_API_KEY;
  return !!envApiKey && apiKey === envApiKey;
}

function toISODate(d: Date | null): string | null {
  return d ? d.toISOString().split('T')[0] : null;
}

export async function GET(request: Request) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const dufahList = await prisma.dufah.findMany({ orderBy: { nama: 'desc' } });

    const data = dufahList.map((d) => ({
      nama: d.nama,
      namaArab: d.namaArab,
      usbu: [
        { ke: 1, mulai: toISODate(d.usbu1StartDate), selesai: toISODate(d.usbu1EndDate), aktif: d.usbu1Active },
        { ke: 2, mulai: toISODate(d.usbu2StartDate), selesai: toISODate(d.usbu2EndDate), aktif: d.usbu2Active },
        { ke: 3, mulai: toISODate(d.usbu3StartDate), selesai: toISODate(d.usbu3EndDate), aktif: d.usbu3Active },
      ],
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching external dufah list:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan sistem' }, { status: 500 });
  }
}
