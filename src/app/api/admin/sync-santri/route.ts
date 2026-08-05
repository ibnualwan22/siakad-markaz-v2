import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const PPDB_URL = process.env.NEXT_PUBLIC_PPDB_URL || "https://ppdb.markazarabiyah.site";

type ApiSantriResponse = {
  id: string;
  nis?: string;
  nama: string;
  gender: string;
  tempatLahir?: string | null;
  tanggalLahir?: string | null;
  detailAlamat?: string | null;
  noWaSantri?: string | null;
  noWaWali?: string | null;
  kabupaten?: string | null;
  riwayat?: Array<{
    status?: string;
    bulanKe?: number;
    dufah?: {
      nama?: string;
      tanggalBuka?: string;
      tanggalTutup?: string;
    } | null;
    lemari?: {
      nomor?: string | null;
      kamar?: {
        nama?: string | null;
        sakan?: {
          nama?: string | null;
        } | null;
      } | null;
    } | null;
  }>;
  isAktif?: boolean;
  kategoriSiswa?: string;
  kategori?: string;
  kategoriProgram?: string;
  programAktif?: string | null;
};

export async function POST() {
  try {
    const apiKey = process.env.PPDB_API_KEY || "markaz-siakad-api-2026";
    const response = await fetch(
      `${PPDB_URL}/api/santri/siakad?key=${apiKey}&filter=AKTIF`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `API PPDB gagal: HTTP ${response.status}` },
        { status: 502 }
      );
    }

    const json = await response.json();
    const dataArray = Array.isArray(json) ? json : json.data;
    if (!Array.isArray(dataArray)) {
      return NextResponse.json(
        { error: "Format response API PPDB tidak sesuai" },
        { status: 502 }
      );
    }

    const validSantri = dataArray.filter(
      (s: ApiSantriResponse) => s.nis && s.nis.trim() !== ""
    );

    const now = new Date();
    let syncedCount = 0;
    let newRiwayatCount = 0;

    // ===== 1. Sync Dufah table terlebih dahulu =====
    // Collect all dufah names from PPDB data
    const validDufahNames = new Set<string>();
    const santriDufahMap = new Map<string, string>(); // santriNIS -> dufahNama from PPDB
    for (const santri of validSantri) {
      const assignedRiwayat = santri.riwayat?.find(
        (r: any) => r.status === "ASSIGNED"
      );
      const dufahNama = assignedRiwayat?.dufah?.nama;
      if (dufahNama && dufahNama !== "-") {
        validDufahNames.add(dufahNama);
        if (santri.nis) santriDufahMap.set(santri.nis, dufahNama);
      }
    }

    const existingDufahs = await prisma.dufah.findMany({
      select: { nama: true },
    });
    const existingDufahNames = new Set(existingDufahs.map((d) => d.nama));
    const missingDufahs = Array.from(validDufahNames).filter(
      (name) => !existingDufahNames.has(name)
    );

    // ===== RENAME DETECTION =====
    // Before creating new dufahs, check if this is actually a RENAME scenario.
    // If most santri pointing to a "new" dufah name already have riwayat under a different dufah name,
    // it's a rename — not a genuinely new dufah.
    let renamedDufahCount = 0;
    for (const newDufahName of missingDufahs) {
      // Get all santri IDs that PPDB says belong to this "new" dufah
      const santriInNewDufah = Array.from(santriDufahMap.entries())
        .filter(([_, dufName]) => dufName === newDufahName)
        .map(([nis]) => nis);

      if (santriInNewDufah.length === 0) continue;

      // Check if these santri already have riwayat under a DIFFERENT dufah name
      const existingRiwayatForThese = await prisma.riwayatSantri.findMany({
        where: { santriId: { in: santriInNewDufah } },
        select: { santriId: true, dufahNama: true },
        orderBy: { id: "desc" }
      });

      // Count how many of these santri have riwayat under other dufah names
      const otherDufahCounts = new Map<string, number>();
      const seenSantri = new Set<string>();
      for (const r of existingRiwayatForThese) {
        if (seenSantri.has(r.santriId)) continue;
        seenSantri.add(r.santriId);
        if (r.dufahNama !== newDufahName && r.dufahNama !== "-") {
          otherDufahCounts.set(r.dufahNama, (otherDufahCounts.get(r.dufahNama) || 0) + 1);
        }
      }

      // If >50% of santri already have riwayat under a single other dufah,
      // this is a rename scenario.
      for (const [oldDufahName, count] of otherDufahCounts.entries()) {
        if (count >= santriInNewDufah.length * 0.5) {
          console.log(`[SYNC] Detected dufah RENAME: "${oldDufahName}" → "${newDufahName}" (${count}/${santriInNewDufah.length} santri match)`);
          
          // Insert new dufah first to satisfy Foreign Key rules
          await prisma.dufah.create({
            data: { nama: newDufahName }
          }).catch(() => {}); // in case of concurrent execution
          
          // Rename in riwayatSantri (children)
          await prisma.riwayatSantri.updateMany({
            where: { dufahNama: oldDufahName },
            data: { dufahNama: newDufahName }
          });
          // Rename in santriInternal (children)
          await prisma.santriInternal.updateMany({
            where: { dufahNama: oldDufahName },
            data: { dufahNama: newDufahName }
          });
          // Delete the old empty dufah record (if no other orphaned tables depend on it)
          await prisma.dufah.delete({
            where: { nama: oldDufahName }
          }).catch(() => {});
          
          renamedDufahCount++;
          break; // Only one rename per new dufah name
        }
      }
    }

    // Re-check which dufahs are actually still missing after renames
    const existingDufahsAfterRename = await prisma.dufah.findMany({ select: { nama: true } });
    const existingDufahNamesAfterRename = new Set(existingDufahsAfterRename.map(d => d.nama));
    const trulyMissingDufahs = Array.from(validDufahNames).filter(
      (name) => !existingDufahNamesAfterRename.has(name)
    );

    if (trulyMissingDufahs.length > 0) {
      await prisma.dufah.createMany({
        data: trulyMissingDufahs.map((nama) => ({ nama })),
        skipDuplicates: true,
      });
    }


    // ===== 2. Upsert semua santri ke SantriInternal =====
    for (const santri of validSantri) {
      // Prioritaskan ASSIGNED. Tapi jika tidak ada ASSIGNED di riwayat TERBARU,
      // kita perbolehkan PRE_LIST untuk kasus Akbarnas B2 (dimana lemari blm di-assign ulang).
      let targetRiwayat = santri.riwayat?.find((r: any) => r.status === "ASSIGNED");
      
      // Jika riwayat terbaru di PPDB (index 0) adalah PRE_LIST, gunakan itu sbg ganti
      if (santri.riwayat && santri.riwayat[0]?.status === "PRE_LIST") {
        targetRiwayat = santri.riwayat[0];
      }

      if (!targetRiwayat) continue;

      let sakanName = targetRiwayat.lemari?.kamar?.sakan?.nama;
      let kamarName = targetRiwayat.lemari?.kamar?.nama;
      let nomorLemari = targetRiwayat.lemari?.nomor;

      if (!sakanName) {
        // Fallback ke riwayat ASSIGNED lama untuk sakan
        const oldAssigned = santri.riwayat?.find((r: any) => r.status === "ASSIGNED" && r.id !== targetRiwayat.id);
        if (oldAssigned) {
          sakanName = oldAssigned.lemari?.kamar?.sakan?.nama;
          kamarName = oldAssigned.lemari?.kamar?.nama;
          nomorLemari = oldAssigned.lemari?.nomor;
        }
      }

      sakanName = sakanName ?? "-";
      kamarName = kamarName ?? "-";
      nomorLemari = nomorLemari ?? "-";

      // Hanya proses santri yang sudah ada sakan (aktif bulan ini)
      if (sakanName === "-") continue;

      const dufahNama = targetRiwayat.dufah?.nama ?? "-";

      await prisma.santriInternal.upsert({
        where: { id: santri.nis as string },
        create: {
          id: santri.nis as string,
          nama: santri.nama,
          gender: santri.gender,
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
          bulanKe: targetRiwayat.bulanKe ?? 0,
          isAktif: santri.isAktif ?? false,
          lastSyncedAt: now,
        },
        update: {
          nama: santri.nama,
          gender: santri.gender,
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
          bulanKe: targetRiwayat.bulanKe ?? 0,
          isAktif: santri.isAktif ?? false,
          lastSyncedAt: now,
        },
      });
      syncedCount++;
    }

    // ===== 2.5 Deactivate santri yang sudah tidak ada di PPDB (tidak aktif) =====
    // ValidSantri berisi semua santri yang masih aktif di PPDB.
    // Jika ada santri di lokal yang isAktif = true, tapi ID-nya tidak ada di validSantri, berarti dia sudah nonaktif.
    const activeSantriIdsInPpdb = new Set(validSantri.map(s => s.nis as string));
    
    const localActiveSantri = await prisma.santriInternal.findMany({
      where: { isAktif: true },
      select: { id: true }
    });

    const santriToDeactivate = localActiveSantri
      .filter(s => !activeSantriIdsInPpdb.has(s.id))
      .map(s => s.id);

    let deactivatedCount = 0;
    if (santriToDeactivate.length > 0) {
      const updateResult = await prisma.santriInternal.updateMany({
        where: { id: { in: santriToDeactivate } },
        data: { 
          isAktif: false,
          lastSyncedAt: now 
        }
      });
      deactivatedCount = updateResult.count;
    }

    // ===== 3. Auto-create RiwayatSantri untuk santri aktif yang belum ada =====
    const activeSantriList = await prisma.santriInternal.findMany({
      where: {
        isAktif: true,
        dufahNama: { not: null },
        sakan: { not: "-" },
      },
    });

    const activeSantriWithDufah = activeSantriList.filter(
      (s) => s.dufahNama && s.dufahNama !== "-"
    );

    let continuingAkbarnasCount = 0;

    if (activeSantriWithDufah.length > 0) {
      const existingRiwayat = await prisma.riwayatSantri.findMany({
        where: {
          santriId: { in: activeSantriWithDufah.map((s) => s.id) },
        },
        select: { santriId: true, dufahNama: true, programId: true, kelasId: true, is_tasmi: true },
        orderBy: { id: "desc" },
      });

      const riwayatSet = new Set(
        existingRiwayat.map((r) => `${r.santriId}_${r.dufahNama}`)
      );

      // For Akbarnas auto-carry-over
      const previousRiwayats = await prisma.riwayatSantri.findMany({
        where: {
          santriId: { in: activeSantriWithDufah.map((s) => s.id) },
        },
        include: { program: true, kelas: true },
        orderBy: { id: "desc" },
      });

      const santriToAkbarnasClass = new Map<
        string,
        { programId: string; kelasId: string }
      >();

      for (const pr of previousRiwayats) {
        if (
          !santriToAkbarnasClass.has(pr.santriId) &&
          pr.program &&
          pr.program.nama_indo.toLowerCase().includes("akbarnas")
        ) {
           // We keep the old akbarnas logic to auto carry over if needed
          const wasBulan2 = pr.kelas?.is_akbarnas_b2;
          if (pr.kelasId && pr.programId && !wasBulan2) {
            santriToAkbarnasClass.set(pr.santriId, {
              programId: pr.programId,
              kelasId: pr.kelasId,
            });
          }
        }
      }

      // Map untuk matching program berdasarkan nama string dari PPDB
      const allPrograms = await prisma.program.findMany({ select: { id: true, nama_indo: true } });
      const programMap = new Map<string, string>();
      allPrograms.forEach(p => {
         programMap.set(p.nama_indo.toLowerCase().trim(), p.id);
      });

      // ===== Fetch programAktif dari PPDB per-santri status endpoint =====
      // API bulk PPDB hanya mengembalikan programId (UUID PPDB, bukan SIAKAD).
      // Endpoint /api/integrasi/siakad/status?nis=xxx mengembalikan "programAktif" sebagai NAMA string.
      const PPDB_BASE_URL = process.env.PPDB_BASE_URL || 'https://ppdb.markazarabiyah.com';
      const PPDB_SIAKAD_KEY = process.env.PPDB_SIAKAD_API_KEY || '';
      
      const santriProgramMap = new Map<string, string>();
      
      // Ambil santri yang programnya masih null (baik yang sudah ada riwayat maupun yang baru)
      const santriNeedingProgram = activeSantriWithDufah.filter(s => {
         const existingRec = existingRiwayat.find(r => r.santriId === s.id);
         return !existingRec?.programId && !santriToAkbarnasClass.has(s.id);
      });

      // Fetch data per-santri secara paralel (batch 10)
      const BATCH_SIZE = 10;
      for (let i = 0; i < santriNeedingProgram.length; i += BATCH_SIZE) {
        const batch = santriNeedingProgram.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map(async (s) => {
            try {
              const res = await fetch(`${PPDB_BASE_URL}/api/integrasi/siakad/status?nis=${s.id}`, {
                method: 'GET',
                headers: {
                  'x-api-key': PPDB_SIAKAD_KEY,
                  'Accept': 'application/json',
                  'User-Agent': 'Mozilla/5.0',
                },
              });
              if (res.ok) {
                const data = await res.json();
                const progName = data?.data?.programAktif;
                if (progName && typeof progName === 'string') {
                  const mappedId = programMap.get(progName.toLowerCase().trim());
                  if (mappedId) {
                    santriProgramMap.set(s.id, mappedId);
                  }
                }
              }
            } catch {
              // Skip jika gagal fetch satu santri
            }
          })
        );
      }

      // Setelah semua program di-resolve, buat riwayat baru untuk santri yang belum punya
      const missingRiwayat = activeSantriWithDufah.filter(
        (s) => !riwayatSet.has(`${s.id}_${s.dufahNama}`)
      );

      if (missingRiwayat.length > 0) {
        await prisma.riwayatSantri.createMany({
          data: missingRiwayat.map((s) => {
            const pastAkbarnas = santriToAkbarnasClass.get(s.id);
            const activeProgramId = santriProgramMap.get(s.id) || null;
            
            if (pastAkbarnas) continuingAkbarnasCount++;
            return {
              santriId: s.id,
              dufahNama: s.dufahNama!,
              programId: pastAkbarnas ? pastAkbarnas.programId : activeProgramId,
              kelasId: pastAkbarnas ? pastAkbarnas.kelasId : null,
              is_tasmi: false,
              status_kelulusan: "TIDAK_LULUS",
            };
          }),
          skipDuplicates: true,
        });
        newRiwayatCount = missingRiwayat.length;
      }

      // Update RiwayatSantri yang sudah ada jika programnya masih kosong (null)
      const existingWithNullProgram = existingRiwayat.filter(r => r.programId === null);
      for (const [nis, mappedProgId] of santriProgramMap.entries()) {
        const matching = existingWithNullProgram.filter(r => r.santriId === nis);
        if (matching.length > 0) {
          await prisma.riwayatSantri.updateMany({
            where: {
              santriId: nis,
              dufahNama: { in: matching.map(m => m.dufahNama) },
              programId: null
            },
            data: { programId: mappedProgId }
          });
        }
      }
    }

    // ===== 4. Auto-toggle Akbarnas classes jika ada Dufah baru =====
    // DETERMINISTIC TOGGLE: Jika ada Dufah baru (bukan rename), hindari "blind toggle"
    // Gunakan fakta: jika ada santri yg dilanjutkan (carry over), maka WAJIB Bulan 2.
    // Jika tidak ada yg dilanjutkan (Bulan 1 baru), maka WAJIB Bulan 1.
    if (trulyMissingDufahs.length > 0) {
      try {
        const akbarnasPrograms = await prisma.program.findMany({
          where: {
            nama_indo: { contains: "akbarnas", mode: "insensitive" },
          },
          select: { id: true },
        });
        const akbarnasIds = akbarnasPrograms.map((p) => p.id);

        if (akbarnasIds.length > 0) {
          const isBulan2Baru = continuingAkbarnasCount > 0;
          await prisma.kelas.updateMany({
            where: { programId: { in: akbarnasIds } },
            data: { is_akbarnas_b2: isBulan2Baru },
          });
        }
      } catch (err) {
        console.error(
          "Gagal auto-toggle kelas Akbarnas saat sync Dufah",
          err
        );
      }
    }

    return NextResponse.json({
      success: true,
      syncedCount,
      newRiwayatCount,
      newDufahCount: missingDufahs.length,
      deactivatedCount,
      timestamp: now.toISOString(),
    });
  } catch (error: any) {
    console.error("Sync santri error:", error);
    return NextResponse.json(
      { error: error.message || "Terjadi kesalahan saat sinkronisasi" },
      { status: 500 }
    );
  }
}

// GET: Return last sync timestamp
export async function GET() {
  try {
    const lastSynced = await prisma.santriInternal.findFirst({
      where: { lastSyncedAt: { not: null } },
      orderBy: { lastSyncedAt: "desc" },
      select: { lastSyncedAt: true },
    });

    const totalSantri = await prisma.santriInternal.count({
      where: { isAktif: true },
    });

    return NextResponse.json({
      lastSyncedAt: lastSynced?.lastSyncedAt?.toISOString() ?? null,
      totalSantriAktif: totalSantri,
    });
  } catch {
    return NextResponse.json({ lastSyncedAt: null, totalSantriAktif: 0 });
  }
}
