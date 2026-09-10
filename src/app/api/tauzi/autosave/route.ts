import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTauziSession } from '@/lib/tauzi-auth';

export async function POST(request: Request) {
  const session = await getTauziSession();
  if (!session || !session.pesertaId || !session.programId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const peserta = await prisma.pesertaTauzi.findUnique({
      where: { id: session.pesertaId }
    });
    if (peserta?.sudahUjian) {
      return NextResponse.json({ error: 'Ujian sudah selesai, tidak bisa menyimpan' }, { status: 403 });
    }

    const { jawaban } = await request.json(); // format: { "soalId": { jawabanId: "id", ragu: true } }
    
    if (!jawaban || typeof jawaban !== 'object') {
      return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
    }

    const updates = Object.entries(jawaban).map(([soalId, data]: [string, any]) => {
      return prisma.responseTauzi.upsert({
        where: {
          pesertaId_soalId: {
            pesertaId: session.pesertaId as string,
            soalId
          }
        },
        update: {
          jawabanId: data.jawabanId || null,
          ragu: !!data.ragu
        },
        create: {
          pesertaId: session.pesertaId as string,
          soalId,
          jawabanId: data.jawabanId || null,
          ragu: !!data.ragu
        }
      });
    });

    // Execute all upserts in a transaction for auto-save batch
    await prisma.$transaction(updates);

    return NextResponse.json({ success: true, savedCount: updates.length });
  } catch (error) {
    console.error("Autosave error:", error);
    return NextResponse.json({ error: 'Gagal melakukan autosave' }, { status: 500 });
  }
}
