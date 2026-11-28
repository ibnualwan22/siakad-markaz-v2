import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveDufahName } from "@/lib/absensi";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const activeDufahName = await getActiveDufahName();

    if (!activeDufahName) {
      return NextResponse.json({
        activeDufah: null,
        activeUsbu: null,
        usbuLabel: "Tidak Ada Aktif",
        akbarnasBulan: 2,
      });
    }

    const dufah = await prisma.dufah.findUnique({ where: { nama: activeDufahName } });

    if (!dufah) {
      return NextResponse.json({
        activeDufah: activeDufahName,
        activeUsbu: 1,
        usbuLabel: "Usbu' 1",
        akbarnasBulan: 2,
      });
    }

    const tTime = Date.now();
    let usbuLabel = "Di Luar Usbu'";
    let activeUsbu = 0;

    const isActive = (startDay: Date | null, endDay: Date | null, active: boolean) => {
      if (!active) return false;
      const start = startDay ? new Date(startDay).getTime() : 0;
      // Tambahkan 23 jam 59 menit 59 detik agar batas harinya penuh sampai malam hari
      const end = endDay ? new Date(endDay).getTime() + 86399999 : Infinity;
      return tTime >= start && tTime <= end;
    };

    if (isActive(dufah.usbu1StartDate, dufah.usbu1EndDate, dufah.usbu1Active)) {
      activeUsbu = 1;
      usbuLabel = "Usbu' 1";
    } else if (isActive(dufah.usbu2StartDate, dufah.usbu2EndDate, dufah.usbu2Active)) {
      activeUsbu = 2;
      usbuLabel = "Usbu' 2";
    } else if (isActive(dufah.usbu3StartDate, dufah.usbu3EndDate, dufah.usbu3Active)) {
      activeUsbu = 3;
      usbuLabel = "Nihai";
    }

    return NextResponse.json({
      activeDufah: activeDufahName,
      activeUsbu,
      usbuLabel,
      akbarnasBulan: dufah.akbarnasBulan === 1 ? 1 : 2,
    });
  } catch (error) {
    console.error("Error active context:", error);
    return NextResponse.json({ error: "Gagal mengambil konteks aktif" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const [canUjian, canDufah] = await Promise.all([
      checkPermission("ujian_usbu"),
      checkPermission("manajemen_dufah_edit"),
    ]);
    if (!canUjian && !canDufah && session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const nextBulan = Number(body?.akbarnasBulan);
    if (nextBulan !== 1 && nextBulan !== 2) {
      return NextResponse.json({ error: "akbarnasBulan harus 1 atau 2" }, { status: 400 });
    }

    const activeDufahName = await getActiveDufahName();
    if (!activeDufahName) {
      return NextResponse.json({ error: "Dufah aktif tidak ditemukan" }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.dufah.update({
        where: { nama: activeDufahName },
        data: { akbarnasBulan: nextBulan },
      }),
      // Sinkronkan seluruh kelas Akbarnas agar selalu seragam di bulan yang sama
      prisma.kelas.updateMany({
        where: { program: { nama_indo: { contains: "Akbarnas", mode: "insensitive" } } },
        data: { is_akbarnas_b2: nextBulan === 2 },
      }),
    ]);

    return NextResponse.json({
      success: true,
      activeDufah: activeDufahName,
      akbarnasBulan: nextBulan,
    });
  } catch (error) {
    console.error("Error update active akbarnasBulan:", error);
    return NextResponse.json({ error: "Gagal memperbarui bulan Akbarnas aktif" }, { status: 500 });
  }
}
