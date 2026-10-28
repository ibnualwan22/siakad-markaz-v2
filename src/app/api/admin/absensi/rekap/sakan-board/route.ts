import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getMasterSantriList } from "@/lib/santri-api";
import {
  filterPerhatian,
  humanKeterangan,
  extractNomorTasrih,
} from "@/lib/sakan-perhatian";

// Papan status sakan HARI INI (WIB) + daftar perhatian:
// - semua sakan: sudah/belum lapor + hitungan H/I/S/A
// - perhatian: santri IZIN (kecuali tasrih HARIAN/TABIROT) + SAKIT,
//   dan santri HADIR/ALPHA yang punya catatan manusia.
// Pola pemetaan riwayat aktif mengikuti route sakan-status yang sudah ada.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "ADMIN") {
    const rp = await prisma.rolePermission.findMany({
      where: { role: session.role as any, permission: "rekap_sakan" },
    });
    if (rp.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    const now = new Date();
    const wibOffset = 7 * 60 * 60 * 1000;
    const wibNow = new Date(now.getTime() + wibOffset);
    const todayStr = wibNow.toISOString().split("T")[0];

    const masterSantriList = await getMasterSantriList();
    const active = masterSantriList.filter(
      (ms) => ms.isAktif && !ms.isCheckedOut && ms.sakan && ms.sakan !== "-"
    );
    const activeDufahBySantri = new Map<string, string>();
    const santriById = new Map<string, (typeof active)[number]>();
    for (const ms of active) {
      activeDufahBySantri.set(ms.id, ms.dufahNama);
      santriById.set(ms.id, ms);
    }

    const rows = await prisma.absenSakan.findMany({
      where: { tanggal: new Date(`${todayStr}T00:00:00Z`) },
      include: {
        riwayat: { select: { santriId: true, dufahNama: true } },
      },
    });

    type BoardRow = {
      nama: string;
      sakan: string;
      status: string;
      keterangan: string | null;
    };
    const boardRows: BoardRow[] = [];
    for (const r of rows) {
      const activeDufah = activeDufahBySantri.get(r.riwayat.santriId);
      if (!activeDufah || activeDufah !== r.riwayat.dufahNama) continue;
      const ms = santriById.get(r.riwayat.santriId);
      if (!ms) continue;
      boardRows.push({
        nama: ms.nama,
        sakan: ms.sakan,
        status: r.status,
        keterangan: r.keterangan,
      });
    }

    const sakanNames = Array.from(new Set(active.map((ms) => ms.sakan))).sort();
    const sakanBoard = sakanNames.map((nama) => {
      const total = active.filter((ms) => ms.sakan === nama).length;
      const rs = boardRows.filter((r) => r.sakan === nama);
      return {
        nama,
        total,
        sudahLapor: rs.length > 0,
        hadir: rs.filter((r) => r.status === "HADIR").length,
        izin: rs.filter((r) => r.status === "IZIN").length,
        sakit: rs.filter((r) => r.status === "SAKIT").length,
        alpha: rs.filter((r) => r.status === "ALPHA").length,
      };
    });

    const { izinSakit, bercatatan } = await filterPerhatian(boardRows);
    const tampil = (r: BoardRow) => ({
      nama: r.nama,
      sakan: r.sakan,
      status: r.status,
      keterangan: humanKeterangan(r.keterangan) || null,
      tasrih: extractNomorTasrih(r.keterangan),
    });

    return NextResponse.json({
      tanggal: todayStr,
      sakan: sakanBoard,
      perhatian: {
        izinSakit: izinSakit.map(tampil),
        bercatatan: bercatatan.map(tampil),
      },
    });
  } catch (error) {
    console.error("Error sakan-board:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan sistem" },
      { status: 500 }
    );
  }
}
