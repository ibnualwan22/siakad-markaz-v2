import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import { parseWibDateString } from "@/lib/absensi";

export async function POST(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("manajemen_sesi");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { tanggal } = body;

    if (!tanggal) {
      return NextResponse.json({ error: "Parameter tidak lengkap" }, { status: 400 });
    }

    const parsedDate = parseWibDateString(tanggal);

    // Tanggal taqwim kini global (berlaku untuk semua program)
    const data = await prisma.tanggalTaqwim.upsert({
      where: {
        tanggal: parsedDate
      },
      update: {}, // do nothing if exists
      create: {
        tanggal: parsedDate
      }
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("Gagal menambah tanggal taqwim", error);
    return NextResponse.json({ error: "Gagal menambah tanggal taqwim" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("manajemen_sesi");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
    }

    await prisma.tanggalTaqwim.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Gagal menghapus tanggal taqwim", error);
    return NextResponse.json({ error: "Gagal menghapus tanggal taqwim" }, { status: 500 });
  }
}
