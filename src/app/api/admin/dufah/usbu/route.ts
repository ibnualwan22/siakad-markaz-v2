import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { PrismaClient } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import { getActiveDufahName } from "@/lib/absensi";

// Fase 7: Bawwabah mengirim tanggal Usbu otomatis (saat ditetapkan di
// Bawwabah) lewat header `x-bawwabah-key` == env BAWABAH_API_KEY.
// Jalur sesi + izin lama tetap berlaku untuk UI Siakad.
function kunciBawwabahValid(request: Request): boolean {
  const key = process.env.BAWABAH_API_KEY;
  if (!key) return false;
  const got = request.headers.get("x-bawwabah-key");
  if (!got) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(key);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const prisma = new PrismaClient();

export async function POST(request: Request) {
  const kunciOk = kunciBawwabahValid(request);
  const session = await getSession();
  const hasPermission = await checkPermission("manajemen_dufah_edit");
  if (!kunciOk && (!session || !hasPermission)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { 
      nama, 
      namaArab,
      akbarnasBulan,
      usbu1StartDate, usbu1EndDate, usbu1Active,
      usbu2StartDate, usbu2EndDate, usbu2Active,
      usbu3StartDate, usbu3EndDate, usbu3Active
    } = body;

    if (!nama) {
      return NextResponse.json({ error: "Nama Dufah diperlukan" }, { status: 400 });
    }

    const dufah = await prisma.dufah.findUnique({
      where: { nama },
    });

    if (!dufah) {
      return NextResponse.json({ error: "Angkatan tidak ditemukan" }, { status: 404 });
    }

    const parseDate = (d: string | null | undefined) => d ? new Date(d) : null;
    const parsedAkbarnasBulan =
      akbarnasBulan === 1 || akbarnasBulan === 2
        ? akbarnasBulan
        : akbarnasBulan !== undefined
          ? (Number(akbarnasBulan) === 2 ? 2 : 1)
          : undefined;

    const updated = await prisma.dufah.update({
      where: { nama },
      data: {
        namaArab: namaArab || null,
        ...(parsedAkbarnasBulan !== undefined ? { akbarnasBulan: parsedAkbarnasBulan } : {}),
        usbu1StartDate: parseDate(usbu1StartDate),
        usbu1EndDate: parseDate(usbu1EndDate),
        usbu1Active: Boolean(usbu1Active),
        usbu2StartDate: parseDate(usbu2StartDate),
        usbu2EndDate: parseDate(usbu2EndDate),
        usbu2Active: Boolean(usbu2Active),
        usbu3StartDate: parseDate(usbu3StartDate),
        usbu3EndDate: parseDate(usbu3EndDate),
        usbu3Active: Boolean(usbu3Active),
      },
    });

    // Jika yang diupdate adalah Dufah aktif, sinkronkan flag is_akbarnas_b2 seluruh kelas Akbarnas
    if (parsedAkbarnasBulan !== undefined) {
      const activeDufah = await getActiveDufahName();
      if (activeDufah === nama) {
        await prisma.kelas.updateMany({
          where: { program: { nama_indo: { contains: "Akbarnas", mode: "insensitive" } } },
          data: { is_akbarnas_b2: parsedAkbarnasBulan === 2 },
        });
      }
    }

    return NextResponse.json({ success: true, dufah: updated });
  } catch (error: any) {
    console.error("Usbu configuration error:", error);
    return NextResponse.json(
      { error: "Gagal memproses pengaturan Usbu'" },
      { status: 500 }
    );
  }
}

