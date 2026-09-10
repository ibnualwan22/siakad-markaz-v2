import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTauziSession } from '@/lib/tauzi-auth';

// Utility: deterministic seed & PRNG
function cyrb128(str: string) {
  let h1 = 1779033703, h2 = 3144134277,
      h3 = 1013904242, h4 = 2773480762;
  for (let i = 0, k; i < str.length; i++) {
      k = str.charCodeAt(i);
      h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
      h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
      h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
      h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return (h1^h2^h3^h4) >>> 0;
}

function mulberry32(a: number) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

function shuffleArray(array: any[], rng: () => number) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

export async function GET() {
  const session = await getTauziSession();
  if (!session || !session.programId) {
    return NextResponse.json({ error: 'Unauthorized / Belum pilih program' }, { status: 401 });
  }

  try {
    // Cek peserta
    if (!session.pesertaId) {
      return NextResponse.json({ error: 'Peserta ID tidak ditemukan' }, { status: 401 });
    }

    const peserta = await prisma.pesertaTauzi.findUnique({
      where: { id: session.pesertaId },
      include: {
        santri: { select: { nama: true, id: true } },
        program: { select: { nama_indo: true } }
      }
    });

    if (!peserta) {
      return NextResponse.json({ error: 'Data peserta tidak valid' }, { status: 401 });
    }

    if (peserta.sudahUjian) {
      return NextResponse.json({ error: 'Anda sudah menyelesaikan ujian ini.' }, { status: 403 });
    }
    const soalRawList = await prisma.soalTauzi.findMany({
      where: {
        sesiTauziId: session.sesiTauziId,
        programId: session.programId
      },
      select: {
        id: true,
        pertanyaan: true,
        urutan: true,
        jawabanList: {
          select: {
            id: true,
            teks: true,
            urutan: true
          }
        }
      }
    });

    // Ambil recovered answers untuk auto-save restore
    const savedResponses = await prisma.responseTauzi.findMany({
      where: { pesertaId: session.pesertaId },
      select: { soalId: true, jawabanId: true, ragu: true }
    });

    const parsedSaved = savedResponses.reduce((acc: any, curr) => {
      acc[curr.soalId] = { jawabanId: curr.jawabanId, ragu: curr.ragu };
      return acc;
    }, {});

    // Deterministic random generator for this specific student
    const seed = cyrb128(session.pesertaId);
    const rng = mulberry32(seed);

    // Shuffle pertanyaan
    const soalList = [...soalRawList];
    shuffleArray(soalList, rng);

    // Shuffle jawaban untuk setiap soal
    soalList.forEach((soal) => {
      shuffleArray(soal.jawabanList, rng);
    });

    return NextResponse.json({
      peserta: {
        nama: peserta.santri.nama,
        nis: peserta.santri.id,
        program: peserta.program?.nama_indo || '-'
      },
      soalList,
      savedResponses: parsedSaved
    });
  } catch (error) {
    console.error('Error fetching soal tauzi santri:', error);
    return NextResponse.json({ error: 'Gagal mengambil data soal' }, { status: 500 });
  }
}
