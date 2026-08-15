import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const mapelId = searchParams.get("mapelId");
    const programId = searchParams.get("programId");
    const usbuKe = searchParams.get("usbuKe");
    const jenisSoalId = searchParams.get("jenisSoalId");
    const paketSoal = searchParams.get("paketSoal");

    const where: any = {};
    if (mapelId) where.mapelId = mapelId;
    if (programId) where.programId = programId;
    
    // For legacy usages if they still pass paketSoal, although we use jenisSoalId now
    if (paketSoal) where.paketSoal = paketSoal;
    if (jenisSoalId) where.jenisSoalId = jenisSoalId;

    // For usbuKe filter, we now filter by relations if usbuKe is present!
    if (usbuKe) {
      where.usbuAssignments = {
        some: {
          usbuKe: Number(usbuKe)
        }
      };
    }

    const soal = await prisma.bankSoalUsbu.findMany({
      where,
      include: {
        opsiList: {
          orderBy: { urutan: 'asc' }
        },
        mapel: { select: { nama_indo: true } },
        program: { select: { nama_indo: true } },
        jenisSoal: { select: { nama: true } },
        usbuAssignments: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(soal);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.role !== "ADMIN") {
      const p = await prisma.rolePermission.findUnique({
        where: { role_permission: { role: session.role, permission: "ujian_usbu" } }
      });
      if (!p) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { mapelId, programId, jenisSoalId, tipeSoal, pertanyaan, gambarUrl, bobot, opsiList, grupSoalId, perintah, kunciJawaban, dataTambahan } = await req.json();

    if (!mapelId || !programId || (!pertanyaan && !gambarUrl)) {
      return NextResponse.json({ error: "Pertanyaan atau gambar tidak boleh kosong" }, { status: 400 });
    }

    const newSoal = await prisma.bankSoalUsbu.create({
      data: {
        mapelId,
        programId,
        jenisSoalId,
        tipeSoal: tipeSoal || "PG",
        pertanyaan: pertanyaan || "",
        gambarUrl: gambarUrl || null,
        grupSoalId: grupSoalId || null,
        perintah: perintah || null,
        kunciJawaban: kunciJawaban || null,
        dataTambahan: dataTambahan || null,
        bobot: Number(bobot) || 10,
        opsiList: {
          create: opsiList?.map((opsi: any, i: number) => ({
            teks: opsi.teks || "",
            gambarUrl: opsi.gambarUrl || null,
            isCorrect: opsi.isCorrect,
            urutan: i + 1
          })) || []
        }
      },
      include: {
        opsiList: true,
        usbuAssignments: true
      }
    });

    return NextResponse.json(newSoal);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
