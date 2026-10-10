import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";

export async function GET() {
  const session = await getSession();
  const [hasSesi, hasNilai, hasHasil, hasSoal] = await Promise.all([
    checkPermission("tauzi_sesi"),
    checkPermission("tauzi_nilai"),
    checkPermission("tauzi_hasil"),
    checkPermission("tauzi_soal")
  ]);
  const canView = hasSesi || hasNilai || hasHasil || hasSoal;

  if (!session || (!canView && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sesiList = await prisma.sesiTauzi.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(sesiList);
  } catch (error) {
    console.error("Error fetching sesi tauzi:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data sesi tauzi'" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  const hasPermission = await checkPermission("tauzi_sesi");
  if (!session || (!hasPermission && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { nama, dufahNama, isActive, copySoalDariSesiId } = body;

    if (!nama || !dufahNama) {
      return NextResponse.json(
        { error: "Nama sesi dan duf'ah wajib diisi" },
        { status: 400 }
      );
    }

    // Jika isActive true, nonaktifkan yang lain dulu (opsional, tapi asumsikan hanya 1 yg aktif)
    // Walau tergantung policy, biasanya tes per duf'ah 1 yg aktif.
    if (isActive) {
      await prisma.sesiTauzi.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      });
    }

    const newSesi = await prisma.sesiTauzi.create({
      data: {
        nama,
        dufahNama,
        isActive: isActive || false,
      },
    });

    // Salin soal (beserta pilihan jawaban) dari sesi sumber, bila diminta
    let soalDisalin = 0;
    if (copySoalDariSesiId) {
      const soalSumber = await prisma.soalTauzi.findMany({
        where: { sesiTauziId: copySoalDariSesiId },
        include: { jawabanList: true },
        orderBy: [{ programId: "asc" }, { urutan: "asc" }],
      });
      for (const s of soalSumber) {
        await prisma.soalTauzi.create({
          data: {
            sesiTauziId: newSesi.id,
            programId: s.programId,
            pertanyaan: s.pertanyaan,
            urutan: s.urutan,
            jawabanList: {
              create: s.jawabanList.map((j) => ({
                teks: j.teks,
                isCorrect: j.isCorrect,
                urutan: j.urutan,
              })),
            },
          },
        });
        soalDisalin++;
      }
    }

    return NextResponse.json({ ...newSesi, soalDisalin }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating sesi tauzi:", error);
    return NextResponse.json(
      { error: "Gagal membuat sesi tauzi'" },
      { status: 500 }
    );
  }
}
