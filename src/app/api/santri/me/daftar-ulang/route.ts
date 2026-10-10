import { NextResponse } from 'next/server';
import { getSantriSession } from '@/lib/santri-auth';
import prisma from '@/lib/prisma';

const PPDB_BASE_URL = process.env.PPDB_BASE_URL || 'https://ppdb.markazarabiyah.site';
const PPDB_API_KEY = process.env.PPDB_SIAKAD_API_KEY || '';

export async function POST(request: Request) {
  const session = await getSantriSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { programId, isBeliAtribut = false } = body;

    if (!programId) {
      return NextResponse.json(
        { error: 'Program ID harus dipilih' },
        { status: 400 }
      );
    }

    // Ambil data diri dari Siakad — dipakai PPDB untuk upsert bila NIS belum ada di sana
    const santriInternal = await prisma.santriInternal.findUnique({
      where: { id: session.santriId },
    });

    const dataDiri = santriInternal
      ? {
          nama: santriInternal.nama || session.nama,
          kategori: 'LAMA',
          gender: santriInternal.gender || undefined,
          tempatLahir: santriInternal.tempat_lahir || undefined,
          tanggalLahir: santriInternal.tanggal_lahir || undefined,
          kabupaten: santriInternal.kabupaten || undefined,
          detailAlamat: santriInternal.alamat || undefined,
          noWaSantri: santriInternal.noWaSantri || undefined,
          noWaWali: santriInternal.noWaWali || undefined,
        }
      : { nama: session.nama, kategori: 'LAMA' };

    const res = await fetch(
      `${PPDB_BASE_URL}/api/integrasi/siakad/pendaftaran`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': PPDB_API_KEY,
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        body: JSON.stringify({
          nis: session.santriId,
          programId,
          isBeliAtribut,
          dataDiri,
        }),
      }
    );

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error || 'Gagal melakukan pendaftaran ulang' },
        { status: res.status }
      );
    }

    if (data?.message && !data?.data) {
      return NextResponse.json(
        { error: `PPDB/Imunify360: ${data.message}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Daftar ulang error:', error);
    return NextResponse.json(
      { error: 'Tidak dapat terhubung ke server PPDB' },
      { status: 502 }
    );
  }
}
