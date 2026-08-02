import { getSantriSession } from "@/lib/santri-auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { CheckCircle2, ChevronRight, Calculator, Activity, ArrowLeft } from "lucide-react";

export default async function Page({ searchParams }: { searchParams: Promise<{ s: string }> }) {
  const session = await getSantriSession();
  if (!session) redirect("/santri-login");

  const { s: sesiId } = await searchParams;
  if (!sesiId) redirect("/santri/ujian");

  const sesi = await prisma.sesiUjianSantri.findUnique({
    where: { id: sesiId },
    include: {
      paket: {
        include: {
          soalPaketList: {
            include: {
              soal: {
                include: {
                  mapel: true
                }
              }
            }
          }
        }
      },
      jawabanList: true,
      riwayat: true
    }
  });

  if (!sesi) redirect("/santri/ujian");
  if (sesi.riwayat.santriId !== session.santriId) redirect("/santri/ujian");
  
  if (sesi.status === "MENGERJAKAN") {
    // Kalo blm redirect balik ke test
    redirect(`/santri/ujian/mengerjakan?s=${sesi.id}`);
  }

  // Calculate Mapel Results
  const soalPerMapel = new Map<string, any[]>();
  for (const sp of sesi.paket.soalPaketList) {
    const mapelId = sp.soal.mapelId;
    if (!soalPerMapel.has(mapelId)) soalPerMapel.set(mapelId, []);
    soalPerMapel.get(mapelId)!.push(sp.soal);
  }

  const jawabanMap = new Map<string, string | null>(); // soalId -> opsiId
  for (const j of sesi.jawabanList) {
    jawabanMap.set(j.soalId, j.opsiId);
  }

  const results = [];
  
  // Need to get opsi correct safely. We know it from db.
  const checkCorrects = await prisma.opsiSoalUsbu.findMany({
    where: {
      soal: {
        mapelId: { in: Array.from(soalPerMapel.keys()) }
      },
      isCorrect: true
    }
  });
  const correctOptionPerSoal = new Map(checkCorrects.map(o => [o.soalId, o.id]));

  for (const [mapelId, listSoal] of soalPerMapel.entries()) {
    let sumBobotTotal = 0;
    let sumSkorBenar = 0;
    let answeredCount = 0;
    let correctCount = 0;

    for (const soal of listSoal) {
      sumBobotTotal += soal.bobot;
      const jawabanSantri = jawabanMap.get(soal.id);
      
      if (jawabanSantri) {
        answeredCount++;
        const correctOptId = correctOptionPerSoal.get(soal.id);
        if (jawabanSantri === correctOptId) {
          sumSkorBenar += soal.bobot;
          correctCount++;
        }
      }
    }

    const nilaiAkhir = sumBobotTotal > 0 ? (sumSkorBenar / sumBobotTotal) * 100 : 0;
    
    results.push({
      mapel: listSoal[0].mapel.nama_indo,
      soalLength: listSoal.length,
      answeredCount,
      correctCount,
      bobotTotal: sumBobotTotal,
      skorBenar: sumSkorBenar,
      nilaiAkhir: Number(nilaiAkhir.toFixed(2))
    });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="bg-white rounded-3xl p-8 md:p-12 text-center shadow-sm border border-gray-100 flex flex-col items-center">
        <div className="w-20 h-20 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 size={40} className="drop-shadow-sm"/>
        </div>
        
        <h1 className="text-3xl md:text-4xl font-display font-bold text-gray-800 mb-3">Ujian Selesai!</h1>
        <p className="text-gray-500 text-lg max-w-lg mb-2">
          Terima kasih telah menyelesaikan ujian <strong>{sesi.paket.nama}</strong>.
        </p>
        
        {sesi.status === "AUTO_SUBMIT" && (
          <div className="mt-4 px-6 py-3 bg-rose-50 text-rose-700 font-medium rounded-xl text-sm border border-rose-100 max-w-sm mb-6 shadow-inset-sm">
             Ujian di-submit otomatis oleh sistem karena waktu habis atau keluar dari jendela ujian.
          </div>
        )}
        
        <div className="mt-8 bg-gradient-to-tr from-blue-50 to-blue-100/50 p-6 md:p-8 rounded-3xl w-full max-w-sm border border-blue-100">
           <div className="text-sm font-bold text-blue-600 uppercase tracking-widest mb-2 flex items-center justify-center gap-2">
             <Activity size={16}/> Skor Rata-Rata
           </div>
           <div className="text-6xl font-black text-blue-700 font-display drop-shadow-sm">
              {sesi.nilaiTotal}
           </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold font-display text-gray-800 mb-6 flex items-center gap-2">
           <Calculator className="text-[var(--color-primary)]"/> Rincian Nilai per Pelajaran
        </h2>

        <div className="space-y-4">
          {results.map((r, i) => (
             <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="font-bold text-[17px] text-gray-800 mb-1">{r.mapel}</h3>
                  <div className="text-sm text-gray-500 flex items-center justify-center sm:justify-start gap-4">
                    <span>Benar: <strong>{r.correctCount}</strong>/{r.soalLength} Soal</span>
                    <span>Skor Bobot: <strong>{r.skorBenar}</strong>/{r.bobotTotal}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="w-px h-12 bg-gray-100 hidden sm:block"></div>
                  <div className="text-center sm:text-right min-w-[5rem]">
                    <div className="text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">Total Nilai</div>
                    <div className="text-2xl font-black" style={{ color: r.nilaiAkhir < 60 ? 'var(--color-danger)' : 'var(--color-primary)' }}>
                      {r.nilaiAkhir}
                    </div>
                  </div>
                </div>
             </div>
          ))}
        </div>
      </div>

      <div className="pt-8 flex justify-center">
        <Link href="/santri/ujian" className="neu-button-primary px-8 py-3.5 rounded-xl font-bold text-sm tracking-wide shadow-md hover:shadow-lg transition flex items-center gap-2">
           <ArrowLeft size={18}/> Kembali ke Daftar Ujian
        </Link>
      </div>

    </div>
  );
}
