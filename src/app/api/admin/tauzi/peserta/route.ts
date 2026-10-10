import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import { calcAkumulatif } from "@/lib/grade-calculator";

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

    // ── Riwayat terakhir (di luar dufah sesi ini) + nilai akumulatif ──
    // Untuk tiap santri: ambil riwayat dufah terbaru SEBELUM dufah sesi tauzi' saat ini,
    // beserta kelasnya dan nilai akumulatif (rata-rata berbobot nilaiAkhir per mapel).
    const semuaRiwayat = await prisma.riwayatSantri.findMany({
      where: { santriId: { in: santriIds } },
      include: {
        kelas: { select: { nama: true } },
        dufah: { select: { usbu1StartDate: true } },
      },
    });

    const parseDufahNum = (nama: string): number => {
      const m = String(nama || "").match(/(\d+)\s*$/);
      return m ? parseInt(m[1], 10) : 0;
    };

    const riwayatTerakhirBySantri = new Map<string, any>();
    const riwayatBySantri = new Map<string, any[]>();
    for (const rw of semuaRiwayat) {
      if (!riwayatBySantri.has(rw.santriId)) riwayatBySantri.set(rw.santriId, []);
      riwayatBySantri.get(rw.santriId)!.push(rw);
    }
    for (const [santriId, list] of riwayatBySantri) {
      const prev = list
        .filter((rw: any) => rw.dufahNama !== sesi.dufahNama)
        .sort((a: any, b: any) => {
          const da = a.dufah?.usbu1StartDate ? new Date(a.dufah.usbu1StartDate).getTime() : 0;
          const db = b.dufah?.usbu1StartDate ? new Date(b.dufah.usbu1StartDate).getTime() : 0;
          if (da !== db) return db - da;
          return parseDufahNum(b.dufahNama) - parseDufahNum(a.dufahNama);
        });
      if (prev.length > 0) riwayatTerakhirBySantri.set(santriId, prev[0]);
    }

    const riwayatTerakhirIds = [...riwayatTerakhirBySantri.values()].map((rw: any) => rw.id);
    const nilaiAkumulatifByRiwayat = new Map<string, number | null>();
    if (riwayatTerakhirIds.length > 0) {
      const nilaiList = await prisma.nilai.findMany({
        where: { riwayatId: { in: riwayatTerakhirIds } },
        include: { mapel: { select: { bobot: true, masuk_akumulasi: true } } },
      });
      const byRiwayat = new Map<string, any[]>();
      for (const n of nilaiList) {
        if (!byRiwayat.has(n.riwayatId)) byRiwayat.set(n.riwayatId, []);
        byRiwayat.get(n.riwayatId)!.push(n);
      }
      for (const rwId of riwayatTerakhirIds) {
        const items = (byRiwayat.get(rwId) || [])
          .filter((n: any) => n.nilaiAkhir !== null && n.nilaiAkhir !== undefined && n.mapel?.masuk_akumulasi !== false)
          .map((n: any) => ({
            score: (n.nilaiAkhir || 0) + (n.nilaiTambahan || 0),
            bobot: n.mapel?.bobot ?? 1,
          }));
        if (items.length === 0) {
          nilaiAkumulatifByRiwayat.set(rwId, null);
        } else {
          nilaiAkumulatifByRiwayat.set(rwId, calcAkumulatif(items));
        }
      }
    }

    const buildRiwayatTerakhir = (santriId: string) => {
      const rw = riwayatTerakhirBySantri.get(santriId);
      if (!rw) return null;
      return {
        dufahNama: rw.dufahNama,
        dufahNomor: parseDufahNum(rw.dufahNama) || rw.dufahNama,
        kelasNama: rw.kelas?.nama || null,
        nilaiAkumulatif: nilaiAkumulatifByRiwayat.has(rw.id) ? nilaiAkumulatifByRiwayat.get(rw.id) : null,
      };
    };

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
        p.riwayatTerakhir = buildRiwayatTerakhir(r.santriId);
        
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
          riwayatTerakhir: buildRiwayatTerakhir(r.santriId),
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
