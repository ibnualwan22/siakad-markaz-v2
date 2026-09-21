import { NextResponse } from 'next/server';
import { getSantriSession } from '@/lib/santri-auth';

const PPDB_BASE_URL = process.env.PPDB_BASE_URL || 'https://ppdb.markazarabiyah.com';
const PPDB_API_KEY = process.env.PPDB_SIAKAD_API_KEY || '';

export async function GET() {
  const session = await getSantriSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const res = await fetch(
      `${PPDB_BASE_URL}/api/integrasi/siakad/status?nis=${session.santriId}`,
      {
        method: 'GET',
        headers: {
          'x-api-key': PPDB_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        cache: 'no-store',
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      return NextResponse.json(
        { error: errorData?.error || 'Gagal mengambil status dari PPDB', status: 'error' },
        { status: res.status }
      );
    }

    const data = await res.json();

    // Imunify360 returns HTTP 200 but without data/meta (usually `{ message: "Access denied..." }`)
    if (!data.meta && data.message) {
      return NextResponse.json(
        { error: `PPDB/Imunify360: ${data.message}`, status: 'error' },
        { status: 502 }
      );
    }

    if (data.meta && data.meta.programTersedia) {
      console.log("DEBUG_PROGRAM_0:", data.meta.programTersedia[0]);
    }

    return NextResponse.json({ success: true, data: data.data, meta: data.meta });
  } catch (error) {
    console.error('PPDB status error:', error);
    return NextResponse.json(
      { error: 'Tidak dapat terhubung ke server PPDB', status: 'error' },
      { status: 502 }
    );
  }
}
