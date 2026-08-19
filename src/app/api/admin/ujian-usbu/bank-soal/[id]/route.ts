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
    const { pertanyaan, gambarUrl, tipeSoal, bobot, opsiList, usbuKe, paketSoal, jenisSoalId, grupSoalId, perintah, kunciJawaban, dataTambahan } = await req.json();

    // Update soal and re-create opsi
    const updatedSoal = await prisma.bankSoalUsbu.update({
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
