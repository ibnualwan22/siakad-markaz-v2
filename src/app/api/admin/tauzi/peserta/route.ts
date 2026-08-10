import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";

export async function GET(request: Request) {
  const session = await getSession();
  const hasPermissionHasil = await checkPermission("tauzi_hasil");
  const hasPermissionNilai = await checkPermission("tauzi_nilai");

  if (!session || (!hasPermissionHasil && !hasPermissionNilai && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sesiTauziId = searchParams.get("sesiTauziId");
  const programId = searchParams.get("programId");

  if (!sesiTauziId) {
    return NextResponse.json({ error: "sesiTauziId param wajib ada" }, { status: 400 });
  }

  try {
    const sesi = await prisma.sesiTauzi.findUnique({ where: { id: sesiTauziId } });
    if (!sesi) {
      return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 });
    }

    const search = searchParams.get("search");

    const riwayatWhere: any = { dufahNama: sesi.dufahNama };
    if (search && search.trim() !== "") {
      riwayatWhere.santri = { nama: { contains: search.trim(), mode: "insensitive" } };
    } else if (programId) {
      if (programId === "none") {
        riwayatWhere.programId = null;
      } else {
        riwayatWhere.programId = programId;
      }
    }

    const riwayatList = await prisma.riwayatSantri.findMany({
      where: riwayatWhere,
      include: {
        santri: { select: { nama: true, id: true, gender: true, bulanKe: true } },
        program: { select: { nama_indo: true, nama_arab: true } },
        kelas: { select: { nama: true } }
      }
    });

    const santriIds = riwayatList.map(r => r.santriId);

    const pesertaListRaw = await prisma.pesertaTauzi.findMany({
      where: {
        sesiTauziId,
        santriId: { in: santriIds }
      },
      include: {
        program: { select: { nama_indo: true, nama_arab: true } },
        programRekomendasi: { select: { nama_indo: true, nama_arab: true } }
      }
    });

    const pesertaMap = new Map();
    for (const p of pesertaListRaw) {
      pesertaMap.set(p.santriId, p);
    }

    const finalResults = [];
    for (const r of riwayatList) {
      if (pesertaMap.has(r.santriId)) {
        const p = pesertaMap.get(r.santriId);
        p.santri = r.santri; // override in case it was missing
        
        // Catatan: Jika p.program (waktu ujian dikerjakan) berbeda dengan r.program (status aktif),
        // Kita biarkan objek utuh agar Admin tahu anak tsb mengerjakan ujian program lama/lainnya.
        // Tapi kita tempelkan currentProgram (opsional untuk UI)
        p.currentProgram = r.program;
        p.currentKelas = r.kelas;
        
        finalResults.push(p);
      } else {
        finalResults.push({
          id: `dummy_${r.santriId}`,
          isDummy: true,
          santriId: r.santriId,
          santri: r.santri,
          sesiTauziId: sesiTauziId,
          programId: r.programId,
          program: r.program,
          currentProgram: r.program,
          currentKelas: r.kelas,
          sudahUjian: false,
          nilaiTahriri: null,
          nilaiMuqobalah: null,
          programRekomendasiId: null,
          programRekomendasi: null,
          penyimakNama: null,
        });
      }
    }

    finalResults.sort((a, b) => a.santri.nama.localeCompare(b.santri.nama));

    return NextResponse.json(finalResults);
  } catch (error) {
    console.error("Error fetching peserta tauzi:", error);
    return NextResponse.json({ error: "Gagal mengambil data peserta ujian" }, { status: 500 });
  }
}
