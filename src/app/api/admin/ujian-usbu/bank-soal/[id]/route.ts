import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // Add permission check
    if (session.role !== "ADMIN") {
      const p = await prisma.rolePermission.findUnique({
        where: { role_permission: { role: session.role, permission: "ujian_usbu" } }
      });
      if (!p) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const { pertanyaan, gambarUrl, tipeSoal, bobot, opsiList, usbuKe, bulanKe, paketSoal, jenisSoalId, grupSoalId, perintah, kunciJawaban, dataTambahan } = await req.json();

    // Ambil opsi lama (id + urutan) SEBELUM dihapus — untuk memetakan
    // jawaban santri yang sudah masuk ke id opsi yang baru
    const soalLama = await prisma.bankSoalUsbu.findUnique({
      where: { id },
      select: { opsiList: { select: { id: true, urutan: true }, orderBy: { urutan: "asc" } } },
    });

    // Update soal and re-create opsi, lalu arahkan jawaban santri ke id baru
    const updatedSoal = await prisma.$transaction(async (tx) => {
      const upd = await tx.bankSoalUsbu.update({
        where: { id },
        data: {
          pertanyaan: pertanyaan || "",
          gambarUrl: gambarUrl || null,
          grupSoalId: grupSoalId !== undefined ? (grupSoalId || null) : undefined,
          tipeSoal: tipeSoal || "PG",
          perintah: perintah !== undefined ? (perintah || null) : undefined,
          kunciJawaban: kunciJawaban !== undefined ? (kunciJawaban || null) : undefined,
          dataTambahan: dataTambahan !== undefined ? (dataTambahan || null) : undefined,
          bobot: Number(bobot) || 10,
          ...(usbuKe !== undefined && { usbuKe: Number(usbuKe) }),
          ...(bulanKe !== undefined && { bulanKe: Number(bulanKe) }),
          ...(paketSoal !== undefined && { paketSoal }),
          ...(jenisSoalId !== undefined && { jenisSoalId }),
          opsiList: {
            deleteMany: {},
            create: opsiList?.map((opsi: any, i: number) => ({
              teks: opsi.teks || "",
              gambarUrl: opsi.gambarUrl || null,
              isCorrect: opsi.isCorrect,
              urutan: i + 1
            })) || []
          }
        },
        include: {
          opsiList: true
        }
      });

      // Petakan id lama -> id baru berdasarkan urutan opsi
      const lama = (soalLama?.opsiList || []).slice().sort((a, b) => a.urutan - b.urutan);
      const baru = (upd.opsiList || []).slice().sort((a, b) => a.urutan - b.urutan);
      const n = Math.min(lama.length, baru.length);
      for (let i = 0; i < n; i++) {
        if (lama[i].id !== baru[i].id) {
          await tx.jawabanUjianSantri.updateMany({
            where: { soalId: id, opsiId: lama[i].id },
            data: { opsiId: baru[i].id },
          });
        }
      }
      return upd;
    });

    return NextResponse.json(updatedSoal);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.role !== "ADMIN") {
      const p = await prisma.rolePermission.findUnique({
        where: { role_permission: { role: session.role, permission: "ujian_usbu" } }
      });
      if (!p) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    await prisma.bankSoalUsbu.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
