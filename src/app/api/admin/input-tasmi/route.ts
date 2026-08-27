import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getActiveRiwayatListForAbsen } from "@/lib/absensi";
import { calcMapelNilaiAkhir, calcMapelNilaiAkhirUsbuain2 } from "@/lib/grade-calculator";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const kelasId = searchParams.get("kelasId");
    const month = searchParams.get("month");

    if (!kelasId) {
      return NextResponse.json({ error: "Missing kelasId" }, { status: 400 });
    }

    const kelasInfo = await prisma.kelas.findUnique({
      where: { id: kelasId }
    });

    if (!kelasInfo) {
      return NextResponse.json({ error: "Kelas not found" }, { status: 404 });
    }

    const isBulan2 = kelasInfo.is_akbarnas_b2 || false;

    let targetRiwayatList: any[] = [];
    if (month === "1" || month === "2") {
      const activeRiwayatList = await getActiveRiwayatListForAbsen(kelasId);
      
      if (month === "2" && !isBulan2) {
        targetRiwayatList = [];
      } else if (month === "2" && isBulan2) {
        targetRiwayatList = activeRiwayatList;
      } else if (month === "1" && !isBulan2) {
        targetRiwayatList = activeRiwayatList;
      } else if (month === "1" && isBulan2) {
        const santriIds = activeRiwayatList.map((r) => r.santriId);
        
        const previousRiwayats = await prisma.riwayatSantri.findMany({
          where: {
            santriId: { in: santriIds },
            program: { nama_indo: { contains: "akbarnas", mode: "insensitive" } },
            id: { notIn: activeRiwayatList.map((r) => r.riwayatId) }
          },
          orderBy: { id: 'desc' }
        });

        const santriToHistorical = new Map();
        for (const r of previousRiwayats) {
          if (!santriToHistorical.has(r.santriId)) {
            santriToHistorical.set(r.santriId, r);
          }
        }

        targetRiwayatList = activeRiwayatList.map(active => {
          const hist = santriToHistorical.get(active.santriId);
          if (hist) {
            return { ...active, riwayatId: hist.id };
          }
          return null;
        }).filter(Boolean);
      }
    } else {
      targetRiwayatList = await getActiveRiwayatListForAbsen(kelasId);
    }

    const riwayatIds = targetRiwayatList.map((r) => r.riwayatId);

    // Get the configured Tasmi mapels for this program
    const tasmiConfigs = await prisma.tasmiConfig.findMany({
      where: { programId: kelasInfo.programId }
    });

    // Ambil data nilai dan status tasmi' untuk riwayat tersebut
    const dbRiwayat = await prisma.riwayatSantri.findMany({
      where: { id: { in: riwayatIds } },
      select: {
        id: true,
        is_tasmi: true,
        nilaiList: true
      }
    });

    const riwayatMap = new Map(dbRiwayat.map(r => [r.id, r]));

    const responseData = targetRiwayatList.map(santri => {
      const dbData = riwayatMap.get(santri.riwayatId);
      const nilaiMap: any = {};
      
      if (dbData?.nilaiList) {
        for (const nilai of dbData.nilaiList) {
          // Only map values if they are configured as tasmi
          nilaiMap[nilai.mapelId] = {
            u1: nilai.nilaiUsbu1 ?? null,
            u2: nilai.nilaiUsbu2 ?? null,
            n: nilai.nilaiNihai ?? null,
            a: nilai.nilaiAkhir ?? null,
            tambahan: nilai.nilaiTambahan ?? 0,
          };
        }
      }

      // Check if automatically qualifies for tasmi
      let allFilled = true;
      if (tasmiConfigs.length > 0) {
        for (const config of tasmiConfigs) {
          const mapelNilai = nilaiMap[config.mapelId];
          if (!mapelNilai) {
             allFilled = false;
             break;
          }
          if (config.kolom === 'u1' && (mapelNilai.u1 === null || mapelNilai.u1 === "")) allFilled = false;
          if (config.kolom === 'u2' && (mapelNilai.u2 === null || mapelNilai.u2 === "")) allFilled = false;
          if (config.kolom === 'n' && (mapelNilai.n === null || mapelNilai.n === "")) allFilled = false;
        }
      } else {
        allFilled = false; // if no config, auto-tasmi is deactivated
      }

      return {
        riwayatId: santri.riwayatId,
        santriId: santri.santriId,
        nama: santri.nama,
        isCheckedOut: santri.isCheckedOut,
        is_tasmi: dbData?.is_tasmi ?? false,
        auto_qualifies: allFilled,
        nilai: nilaiMap,
      };
    });

    return NextResponse.json({
      tasmiConfigs,
      santriList: responseData
    });
  } catch (error) {
    console.error("Error fetching tasmi data:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { updates, kelasId } = body;

    if (!Array.isArray(updates) || !kelasId) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const kelasInfo = await prisma.kelas.findUnique({
      where: { id: kelasId }
    });

    const tasmiConfigs = await prisma.tasmiConfig.findMany({
      where: { programId: kelasInfo?.programId }
    });

    await prisma.$transaction(async (tx) => {
      for (const update of updates) {
        
        // Save Mapel Nilai
        if (update.nilai && typeof update.nilai === 'object') {
          for (const [mapelId, grades] of Object.entries<any>(update.nilai)) {
            if (grades.u1 !== undefined || grades.u2 !== undefined || grades.n !== undefined) {
              const dataToUpdate: any = {};
              if (grades.u1 !== undefined) dataToUpdate.nilaiUsbu1 = grades.u1;
              if (grades.u2 !== undefined) dataToUpdate.nilaiUsbu2 = grades.u2;
              if (grades.n !== undefined) dataToUpdate.nilaiNihai = grades.n;

              await tx.nilai.upsert({
                where: {
                  riwayatId_mapelId: {
                    riwayatId: update.riwayatId,
                    mapelId: mapelId,
                  }
                },
                update: dataToUpdate,
                create: {
                  riwayatId: update.riwayatId,
                  mapelId: mapelId,
                  ...dataToUpdate
                }
              });

              // Auto-calculate nilaiAkhir so the grade appears in Input Nilai Kelas
              const mapel = await tx.mapel.findUnique({ where: { id: mapelId } });
              if (mapel) {
                const currentNilai = await tx.nilai.findUnique({
                  where: { riwayatId_mapelId: { riwayatId: update.riwayatId, mapelId } }
                });

                if (currentNilai) {
                  let nilaiAkhir: number | null = null;

                  if (mapel.jumlah_tes === 1) {
                    // For single-test mapels, nilaiAkhir = nilaiNihai directly
                    nilaiAkhir = currentNilai.nilaiNihai;
                  } else if (mapel.jumlah_tes === 3) {
                    // For 3-test mapels, calculate from u1/u2/n
                    if (currentNilai.nilaiUsbu1 !== null && currentNilai.nilaiUsbu2 !== null && currentNilai.nilaiNihai !== null) {
                      const riwayat = await tx.riwayatSantri.findUnique({
                        where: { id: update.riwayatId },
                        include: { program: true, kelas: true }
                      });
                      const isAkbarnas = riwayat?.program?.nama_indo?.toLowerCase().includes("akbarnas") ?? false;
                      const effectiveUsbu = riwayat?.jumlah_kolom_usbu ?? riwayat?.kelas?.jumlah_kolom_usbu ?? 0;

                      if (effectiveUsbu === 2) {
                        nilaiAkhir = calcMapelNilaiAkhirUsbuain2({ u1: currentNilai.nilaiUsbu1, u2: currentNilai.nilaiUsbu2 });
                      } else if (effectiveUsbu === 0) {
                        nilaiAkhir = calcMapelNilaiAkhir(
                          { u1: currentNilai.nilaiUsbu1, u2: currentNilai.nilaiUsbu2, n: currentNilai.nilaiNihai },
                          isAkbarnas
                        );
                      }
                    }
                  }

                  // Update nilaiAkhir
                  await tx.nilai.update({
                    where: { riwayatId_mapelId: { riwayatId: update.riwayatId, mapelId } },
                    data: { nilaiAkhir }
                  });
                }
              }
            }
          }
        }

        // Auto calculate is_tasmi based on configs if auto was active
        let newIsTasmi = update.is_tasmi;
        
        if (tasmiConfigs.length > 0 && update.is_tasmi_auto) {
          // fetch current fresh nilai
          const freshNilaiList = await tx.nilai.findMany({
            where: { riwayatId: update.riwayatId }
          });
          const freshMap = new Map(freshNilaiList.map(n => [n.mapelId, n]));
          
          let allFilled = true;
          for (const config of tasmiConfigs) {
            const mapelNilai = freshMap.get(config.mapelId);
            if (!mapelNilai) {
              allFilled = false;
              break;
            }
            if (config.kolom === 'u1' && mapelNilai.nilaiUsbu1 === null) allFilled = false;
            if (config.kolom === 'u2' && mapelNilai.nilaiUsbu2 === null) allFilled = false;
            if (config.kolom === 'n' && mapelNilai.nilaiNihai === null) allFilled = false;
          }
          newIsTasmi = allFilled;
        }

        if (newIsTasmi !== undefined) {
          await tx.riwayatSantri.update({
             where: { id: update.riwayatId },
             data: { is_tasmi: newIsTasmi }
          });
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving bulk tasmi grades:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
