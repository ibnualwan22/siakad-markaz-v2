import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTauziSession } from '@/lib/tauzi-auth';

export async function POST(request: Request) {
  const session = await getTauziSession();
  if (!session || !session.pesertaId || !session.programId) {
    return NextResponse.json({ error: 'Unauthorized / invalid state' }, { status: 401 });
  }

  try {
    const peserta = await prisma.pesertaTauzi.findUnique({
      where: { id: session.pesertaId }
    });
    if (peserta?.sudahUjian) {
      return NextResponse.json({ error: 'Ujian sudah diselesaikan' }, { status: 403 });
    }

    const body = await request.json();
    const { jawaban } = body; // format: { "soalId1": "jawabanId1", "soalId2": "jawabanId2" }

    if (!jawaban || typeof jawaban !== 'object') {
      return NextResponse.json({ error: 'Format jawaban tidak valid' }, { status: 400 });
    }

    // Ambil kunci jawaban dari DB
    const allSoal = await prisma.soalTauzi.findMany({
      where: { sesiTauziId: session.sesiTauziId, programId: session.programId },
      include: {
        jawabanList: {
          select: { id: true, isCorrect: true }
        }
      }
    });

    if (allSoal.length === 0) {
      return NextResponse.json({ error: 'Soal tidak ditemukan / kosong.' }, { status: 400 });
    }

    interface ResponsePayload {
      pesertaId: string;
      soalId: string;
      jawabanId: string | null;
      ragu?: boolean;
    }

    let correctCount = 0;
    const responseArray: ResponsePayload[] = [];

    for (const soal of allSoal) {
      const ansData = jawaban[soal.id];
      const userAnswerId = (ansData && typeof ansData === 'object') ? ansData.jawabanId : ansData;
      const ragu = (ansData && typeof ansData === 'object') ? !!ansData.ragu : false;
      const correctJawaban = soal.jawabanList.find(j => j.isCorrect);

      if (userAnswerId && correctJawaban && userAnswerId === correctJawaban.id) {
        correctCount++;
      }

      responseArray.push({
        pesertaId: session.pesertaId,
        soalId: soal.id,
        jawabanId: userAnswerId || null, // Allow adding ragu here later if we want it passed
        ragu
      });
    }

    const nilaiTahriri = Math.round((correctCount / allSoal.length) * 100);

    // Gunakan transaction untuk menyimpan response dan mengupdate peserta
    await prisma.$transaction(async (tx) => {
      // Upsert tiap response (bila submit ditekan berkali-kali)
      for (const res of responseArray) {
        await tx.responseTauzi.upsert({
          where: {
            pesertaId_soalId: {
              pesertaId: res.pesertaId,
              soalId: res.soalId
            }
          },
          update: {
            jawabanId: res.jawabanId,
            ragu: (res as any).ragu
          },
          create: {
            pesertaId: res.pesertaId,
            soalId: res.soalId,
            jawabanId: res.jawabanId,
            ragu: (res as any).ragu
          }
        });
      }

      await tx.pesertaTauzi.update({
        where: { id: session.pesertaId },
        data: {
          nilaiTahriri,
          sudahUjian: true
        }
      });
    });

    return NextResponse.json({ success: true, nilaiTahriri });
  } catch (error) {
    console.error('Error submitting tauzi exam:', error);
    return NextResponse.json({ error: 'Gagal memproses jawaban' }, { status: 500 });
  }
}
