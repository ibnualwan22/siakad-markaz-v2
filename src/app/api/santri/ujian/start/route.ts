import { NextResponse } from "next/server";
import { getSantriSession } from "@/lib/santri-auth";
import prisma from "@/lib/prisma";

// Fisher-Yates array shuffle function
function shuffleArray(array: any[]) {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
}

export async function POST(req: Request) {
  try {
    const session = await getSantriSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { paketId, kodeAkses } = body;

    if (!paketId || !kodeAkses) {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
    }

    const paket = await prisma.paketUjian.findUnique({
      where: { id: paketId },
      include: {
        soalPaketList: {
          include: {
            soal: {
              include: {
                opsiList: true,
                jenisSoal: { select: { instruksi: true } }
              }
            }
          }
        },
        sesiGlobal: true
      }
    });

    if (!paket) {
      return NextResponse.json({ error: "Paket ujian tidak ditemukan" }, { status: 404 });
    }

    if (!paket.sesiGlobal.isActive) {
      return NextResponse.json({ error: "Ujian ini sedang ditutup" }, { status: 400 });
    }

    if (paket.sesiGlobal.kodeAkses !== kodeAkses) {
      return NextResponse.json({ error: "Kode akses salah" }, { status: 400 });
    }

    const santri = await prisma.santriInternal.findUnique({
      where: { id: session.santriId },
      include: {
        riwayatRecords: {
          orderBy: { dufahNama: 'desc' },
          take: 1
        }
      }
    });

    if (!santri || santri.riwayatRecords.length === 0) {
      return NextResponse.json({ error: "Riwayat santri tidak ditemukan" }, { status: 404 });
    }

    const riwayat = santri.riwayatRecords[0];

    // Cek apakah sudah ada sesi ujian
    let sesi = await prisma.sesiUjianSantri.findUnique({
      where: {
        paketId_riwayatId: {
          paketId,
          riwayatId: riwayat.id
        }
      },
      include: {
        jawabanList: true
      }
    });

    // Handle return soal secara tertutup (amankan kunci jawaban & acak)
    let soalDisajikan = paket.soalPaketList.map(sp => {
      let extractedData = sp.soal.dataTambahan ? (typeof sp.soal.dataTambahan === 'string' ? JSON.parse(sp.soal.dataTambahan) : JSON.parse(JSON.stringify(sp.soal.dataTambahan))) : null;

      if (extractedData) {
        if (sp.soal.tipeSoal === "MENJODOHKAN" && extractedData.pairs) {
          const lefts = extractedData.pairs.map((p: any) => p.left);
          const rights = shuffleArray(extractedData.pairs.map((p: any) => p.right));
          extractedData = { lefts, rights };
        } else if (sp.soal.tipeSoal === "MENGURUTKAN" && extractedData.items) {
          extractedData.items = shuffleArray(extractedData.items);
        } else if (sp.soal.tipeSoal === "KITABAH" && extractedData.huruf) {
          extractedData.huruf = shuffleArray(extractedData.huruf);
          delete extractedData.jawaban;
        } else if (sp.soal.tipeSoal === "DRAG_KATEGORI" && extractedData.items) {
          extractedData.categories = extractedData.categories || [];
          extractedData.items = shuffleArray(extractedData.items.map((it: any) => ({ text: it.text }))); // remove category
        } else if (sp.soal.tipeSoal === "ISIAN_SAMPING" || sp.soal.tipeSoal === "ISIAN_BAWAH") {
          delete extractedData.jawaban; // ensure no jawaban
        }
      }

      // Hapus isCorrect dari opsi
      const safeOpsi = sp.soal.opsiList.map((o: any) => {
         const { isCorrect, ...rest } = o;
         return rest;
      });

      return {
        soalId: sp.soal.id,
        mapelId: sp.soal.mapelId,
        pertanyaan: sp.soal.pertanyaan,
        gambarUrl: sp.soal.gambarUrl,
        grupSoalId: sp.soal.grupSoalId,
        tipeSoal: sp.soal.tipeSoal,
        perintah: sp.soal.jenisSoal?.instruksi || sp.soal.perintah,
        dataTambahan: extractedData,
        bobot: sp.soal.bobot,
        opsiList: paket.sesiGlobal.acakOpsi ? shuffleArray(safeOpsi) : safeOpsi,
        urutanAsli: sp.urutan
      };
    });

    if (paket.sesiGlobal.acakSoal) {
      // Kelompokkan berdasarkan mapelId agar mapel tidak tercampur
      const grouped = new Map<string, typeof soalDisajikan>();
      for (const s of soalDisajikan) {
        if (!grouped.has(s.mapelId)) grouped.set(s.mapelId, []);
        grouped.get(s.mapelId)!.push(s);
      }
      
      // Acak urutan Mapel
      const mapelKeys = shuffleArray(Array.from(grouped.keys()));
      
      const newSoalDisajikan: typeof soalDisajikan = [];
      for (const key of mapelKeys) {
        const soalPerMapel = grouped.get(key)!;
        
        // Pisahkan soal mandiri dan soal grup qiro'ah
        const grupMap = new Map<string, typeof soalDisajikan>();
        const soalMandiri: typeof soalDisajikan = [];
        
        for (const s of soalPerMapel) {
          if (s.grupSoalId) {
            if (!grupMap.has(s.grupSoalId)) grupMap.set(s.grupSoalId, []);
            grupMap.get(s.grupSoalId)!.push(s);
          } else {
            soalMandiri.push(s);
          }
        }
        
        // Gabungkan: setiap grup qiro'ah dianggap sebagai 1 "unit" soal
        // Soal induk + anak grup disatukan agar tidak terpisah saat diacak
        const units: (typeof soalDisajikan)[] = [];
        for (const s of soalMandiri) {
          const anakGrup = grupMap.get(s.soalId);
          if (anakGrup) {
            // Soal ini adalah induk grup — satukan dengan anak-anaknya
            units.push([s, ...anakGrup]);
            grupMap.delete(s.soalId);
          } else {
            units.push([s]);
          }
        }
        // Sisa grup yang induknya bukan di mapel ini (fallback)
        for (const [, anak] of grupMap) {
          units.push(anak);
        }
        
        // Acak unit-unit, lalu flatten
        const shuffledUnits = shuffleArray(units);
        for (const unit of shuffledUnits) {
          newSoalDisajikan.push(...unit);
        }
      }
      soalDisajikan = newSoalDisajikan;
    } else {
      soalDisajikan.sort((a, b) => a.urutanAsli - b.urutanAsli);
    }

    // Assign urutan baru untuk UI
    const soalFinal = soalDisajikan.map((s, i) => ({
      ...s,
      urutanUI: i + 1,
      // Hilangkan field isCorrect agar tidak bocor ke client
      opsiList: s.opsiList.map(o => ({
        id: o.id,
        teks: o.teks,
        gambarUrl: o.gambarUrl
      }))
    }));

    // Guard: pastikan ada soal
    if (soalFinal.length === 0) {
      return NextResponse.json({ 
        error: `Paket ujian ini belum memiliki soal. Hubungi pengawas untuk meng-generate ulang paket ujian setelah soal ditambahkan di Bank Soal.` 
      }, { status: 400 });
    }

    if (!sesi) {
      // Buat sesi baru
      sesi = await prisma.sesiUjianSantri.create({
        data: {
          paketId,
          riwayatId: riwayat.id,
          status: "MENGERJAKAN",
          waktuMulai: new Date(),
          jawabanList: {
            // Pre-create record jawaban kosong untuk mempermudah update nanti
            create: soalFinal.map((s) => ({
              soalId: s.soalId
            }))
          }
        },
        include: {
          jawabanList: true
        }
      });
    } else if (sesi.status !== "MENGERJAKAN") {
      return NextResponse.json({ error: "Ujian ini sudah diselesaikan" }, { status: 400 });
    } else {
      // Jika resume sesi, pastikan timer belum habis (waktuMulai + durasi + 5mnt toleransi)
      const durasiReal = paket.sesiGlobal.durasiMenit;
      const batasWaktu = new Date(sesi.waktuMulai.getTime() + (durasiReal + 5) * 60000);
      if (new Date() > batasWaktu) {
        // Auto-submit from server context
        await prisma.sesiUjianSantri.update({
          where: { id: sesi.id },
          data: { status: "AUTO_SUBMIT", waktuSelesai: new Date() }
        });
        return NextResponse.json({ error: "Waktu ujian telah habis!" }, { status: 400 });
      }
    }

    const serverNow = new Date().getTime();
    const wMulai = new Date(paket.sesiGlobal.waktuMulai!).getTime();
    const durasiDetik = paket.sesiGlobal.durasiMenit * 60;
    const wSelesai = wMulai + (durasiDetik * 1000);
    const sisaWaktuDetik = Math.max(0, Math.floor((wSelesai - serverNow) / 1000));

    // Merge dengan jawaban existing
    const sessionResponse = {
      sesiId: sesi.id,
      sisaWaktuDetik,
      durasiMenit: paket.sesiGlobal.durasiMenit,
      soal: soalFinal.map(s => {
        const jwbExist = sesi!.jawabanList.find(j => j.soalId === s.soalId);
        return {
          ...s,
          jawabanId: jwbExist?.id,
          opsiTerpilih: jwbExist?.opsiId || null,
          rpiId: jwbExist?.rpiId || null
        };
      })
    };

    return NextResponse.json(sessionResponse);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
