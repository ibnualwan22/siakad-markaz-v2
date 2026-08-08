import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { POST as runGlobalSync } from "@/app/api/admin/sync-santri/route";

const WEBHOOK_SECRET = process.env.PPDB_WEBHOOK_SECRET || "rahasia-webhook-siakad";

export async function POST(req: NextRequest) {
  try {
    // 1. Validasi Autentikasi
    const authHeader = req.headers.get("authorization");
    const customHeader = req.headers.get("x-webhook-secret");
    
    let token = customHeader;
    if (!token && authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
    
    if (token !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse Body
    const body = await req.json();
    const action = body.action || "update_santri";
    const data = body.data;

    // 3. Mode pemicu sync massal
    if (action === "sync_all") {
      // Panggil fungsi POST dari route sync-santri secara langsung
      return await runGlobalSync();
    }

    // 4. Mode update satu santri (push)
    if (action === "update_santri" && data) {
      const santri = data;
      if (!santri.nis) {
        return NextResponse.json({ error: "Kolom 'nis' (ID) wajib ada pada payload data." }, { status: 400 });
      }

      const validDufahNames = new Set<string>();
      
      let targetRiwayat = santri.riwayat?.find((r: any) => r.status === "ASSIGNED");
      
      // Fallback PRE_LIST
      if (santri.riwayat && santri.riwayat[0]?.status === "PRE_LIST") {
        targetRiwayat = santri.riwayat[0];
      }

      let sakanName = targetRiwayat?.lemari?.kamar?.sakan?.nama;
      let kamarName = targetRiwayat?.lemari?.kamar?.nama;
      let nomorLemari = targetRiwayat?.lemari?.nomor;
      let dufahNama = targetRiwayat?.dufah?.nama;

      if (!sakanName) {
        // Fallback ASSIGNED lama
        const oldAssigned = santri.riwayat?.find((r: any) => r.status === "ASSIGNED" && r.id !== targetRiwayat?.id);
        if (oldAssigned) {
          sakanName = oldAssigned.lemari?.kamar?.sakan?.nama;
          kamarName = oldAssigned.lemari?.kamar?.nama;
          nomorLemari = oldAssigned.lemari?.nomor;
          dufahNama = oldAssigned.dufah?.nama;
        }
      }

      sakanName = sakanName ?? "-";
      kamarName = kamarName ?? "-";
      nomorLemari = nomorLemari ?? "-";
      dufahNama = dufahNama ?? "-";

      const now = new Date();
      const isActive = santri.isAktif ?? false;

      // Ensure dufah exist locally if possible
      if (dufahNama !== "-") {
        const d = await prisma.dufah.findUnique({ where: { nama: dufahNama } });
        if (!d) {
          await prisma.dufah.create({ data: { nama: dufahNama } }).catch(() => {});
        }
      }

      // Opsional: fetch programAktif ke PPDB jika dibutuhkan
      let mappedProgId = null;
      try {
        const PPDB_BASE_URL = process.env.PPDB_BASE_URL || 'https://ppdb.markazarabiyah.com';
        const PPDB_SIAKAD_KEY = process.env.PPDB_SIAKAD_API_KEY || '';
        if (PPDB_SIAKAD_KEY && santri.nis) {
          const resProg = await fetch(`${PPDB_BASE_URL}/api/integrasi/siakad/status?nis=${santri.nis}`, {
             method: 'GET',
             headers: { 'x-api-key': PPDB_SIAKAD_KEY, 'Accept': 'application/json' },
          });
          if (resProg.ok) {
             const progData = await resProg.json();
             const progName = progData?.data?.programAktif;
             if (progName) {
                const program = await prisma.program.findFirst({
                    where: { nama_indo: { equals: progName, mode: 'insensitive' } }
                });
                if (program) mappedProgId = program.id;
             }
          }
        }
      } catch (e) {
          // ignore error
      }

      const upsertedSantri = await prisma.santriInternal.upsert({
        where: { id: santri.nis },
        create: {
          id: santri.nis,
          nama: santri.nama || "-",
          gender: santri.gender || "L",
          tempat_lahir: santri.tempatLahir ?? "",
          tanggal_lahir: santri.tanggalLahir ?? null,
          alamat: santri.detailAlamat ?? "",
          sakan: sakanName,
          kamar: kamarName,
          nomorLemari: nomorLemari,
          dufahNama: dufahNama,
          kategori: santri.kategori ?? "-",
          noWaSantri: santri.noWaSantri ?? "-",
          noWaWali: santri.noWaWali ?? null,
          kabupaten: santri.kabupaten ?? "-",
          bulanKe: targetRiwayat?.bulanKe ?? 0,
          isAktif: isActive,
          lastSyncedAt: now,
        },
        update: {
          nama: santri.nama || "-",
          gender: santri.gender || "L",
          tempat_lahir: santri.tempatLahir ?? "",
          tanggal_lahir: santri.tanggalLahir ?? null,
          alamat: santri.detailAlamat ?? "",
          sakan: sakanName,
          kamar: kamarName,
          nomorLemari: nomorLemari,
          dufahNama: dufahNama,
          kategori: santri.kategori ?? "-",
          noWaSantri: santri.noWaSantri ?? "-",
          noWaWali: santri.noWaWali ?? null,
          kabupaten: santri.kabupaten ?? "-",
          bulanKe: targetRiwayat?.bulanKe ?? 0,
          isAktif: isActive,
          lastSyncedAt: now,
        },
      });

      // Update / Create RiwayatSantri if aktif
      if (isActive && dufahNama !== "-" && sakanName !== "-") {
         const riwayat = await prisma.riwayatSantri.findFirst({
             where: { santriId: santri.nis, dufahNama: dufahNama }
         });

         if (!riwayat) {
             const santriRiwayats = await prisma.riwayatSantri.findMany({
                 where: { santriId: santri.nis },
                 include: { program: true, kelas: true },
                 orderBy: { id: 'desc' }
             });
             
             let programId = mappedProgId;
             let kelasId = null;

             const pastAkbarnas = santriRiwayats.find(r => r.program?.nama_indo.toLowerCase().includes("akbarnas"));
             if (pastAkbarnas && !pastAkbarnas.kelas?.is_akbarnas_b2) {
                 // carry over
                 programId = pastAkbarnas.programId;
                 kelasId = pastAkbarnas.kelasId;
             }

             await prisma.riwayatSantri.create({
                 data: {
                     santriId: santri.nis,
                     dufahNama: dufahNama,
                     programId: programId,
                     kelasId: kelasId,
                     is_tasmi: false,
                     status_kelulusan: "TIDAK_LULUS"
                 }
             });
         } else if (mappedProgId && !riwayat.programId) {
            await prisma.riwayatSantri.update({
                where: { id: riwayat.id },
                data: { programId: mappedProgId }
            });
         }
      }

      return NextResponse.json({
        success: true,
        message: "Data santri berhasil diperbarui.",
        santriId: upsertedSantri.id
      });
    }

    return NextResponse.json({ error: "Format webhook tidak dikenali." }, { status: 400 });

  } catch (error: any) {
    console.error("PPDB Webhook error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
