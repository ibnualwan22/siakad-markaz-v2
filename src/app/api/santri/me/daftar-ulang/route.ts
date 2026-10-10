import { NextResponse } from 'next/server';
import { getSantriSession } from '@/lib/santri-auth';
import prisma from '@/lib/prisma';

const PPDB_BASE_URL = process.env.PPDB_BASE_URL || 'https://ppdb.markazarabiyah.site';
const PPDB_API_KEY = process.env.PPDB_SIAKAD_API_KEY || '';

const ppdbHeaders = {
  'Content-Type': 'application/json',
  'x-api-key': PPDB_API_KEY,
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

// GET /api/santri/me/daftar-ulang — cek tagihan PENDING milik santri yang login
export async function GET() {
  const session = await getSantriSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const res = await fetch(
      `${PPDB_BASE_URL}/api/integrasi/siakad/status-bayar?nis=${encodeURIComponent(session.santriId)}`,
      { headers: ppdbHeaders, cache: 'no-store' }
    );
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return NextResponse.json({ error: data?.error || 'Gagal memeriksa status pembayaran' }, { status: res.status });
    }
    return NextResponse.json({ success: true, data: data?.data || { pending: null } });
  } catch (error) {
    console.error('Cek status bayar error:', error);
    return NextResponse.json({ error: 'Tidak dapat terhubung ke server PPDB' }, { status: 502 });
  }
}

// DELETE /api/santri/me/daftar-ulang — batalkan semua tagihan PENDING milik santri yang login
export async function DELETE() {
  const session = await getSantriSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const res = await fetch(
      `${PPDB_BASE_URL}/api/integrasi/siakad/batalkan`,
      {
        method: 'POST',
        headers: ppdbHeaders,
        body: JSON.stringify({ nis: session.santriId }),
      }
    );
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return NextResponse.json({ error: data?.error || 'Gagal membatalkan tagihan' }, { status: res.status });
    }
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Batalkan tagihan error:', error);
    return NextResponse.json({ error: 'Tidak dapat terhubung ke server PPDB' }, { status: 502 });
  }
}

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

    // Sinkron program ke Siakad langsung (tidak menunggu webhook):
    // petakan nama program PPDB -> Program Siakad (nama_indo), lalu set ke riwayat terbaru.
    let siakadProgram: { id: string; nama_indo: string } | null = null;
    const ppdbProgramNama = data?.data?.program?.nama;
    if (ppdbProgramNama) {
      try {
        const prog = await prisma.program.findFirst({
          where: { nama_indo: { equals: ppdbProgramNama, mode: 'insensitive' } },
          select: { id: true, nama_indo: true },
        });
        if (prog) {
          siakadProgram = prog;
          const riwayatTerbaru = await prisma.riwayatSantri.findFirst({
            where: { santriId: session.santriId },
            orderBy: { id: 'desc' },
            select: { id: true },
          });
          if (riwayatTerbaru) {
            await prisma.riwayatSantri.update({
              where: { id: riwayatTerbaru.id },
              data: { programId: prog.id },
            });
          }
          // Samakan juga peserta tauzi aktif bila ada
          const sesiAktif = await prisma.sesiTauzi.findFirst({
            where: { isActive: true },
            select: { id: true },
          });
          if (sesiAktif) {
            await prisma.pesertaTauzi.upsert({
              where: { sesiTauziId_santriId: { sesiTauziId: sesiAktif.id, santriId: session.santriId } },
              update: { programId: prog.id },
              create: { sesiTauziId: sesiAktif.id, santriId: session.santriId, programId: prog.id },
            });
          }
        } else {
          console.warn(`[daftar-ulang] Program PPDB "${ppdbProgramNama}" tidak cocok dengan Program Siakad manapun (NIS: ${session.santriId}). Program Siakad dipertahankan.`);
        }
      } catch (e) {
        console.error('[daftar-ulang] Gagal sinkron program ke Siakad:', e);
      }
    }

    return NextResponse.json({ success: true, data, siakadProgram });
  } catch (error) {
    console.error('Daftar ulang error:', error);
    return NextResponse.json(
      { error: 'Tidak dapat terhubung ke server PPDB' },
      { status: 502 }
    );
  }
}
