"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { id as dateFnsId } from "date-fns/locale";

type TranskripItem = {
  mapel: string;
  bobot: number;
  bobotUsbu: number;
  masukAkumulasi: boolean;
  b1: { u1: number | null, u2: number | null, n: number | null, avg?: number | null };
  b2: { u1: number | null, u2: number | null, n: number | null, avg?: number | null };
  nilaiAkhir: number | null;
};

export function TranskripDocument({
  staticPrint = false,
  santriName,
  programName,
  isAkbarnas,
  items,
  rataRataAkhir,
}: {
  staticPrint?: boolean;
  santriName: string;
  programName: string;
  isAkbarnas: boolean;
  items: TranskripItem[];
  rataRataAkhir: number;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted && !staticPrint) return null;

  const computeAvg = (extractor: (item: TranskripItem) => number | null) => {
    let totalScore = 0;
    let totalBobot = 0;
    for (const item of items) {
      if (!item.masukAkumulasi) continue;
      const val = extractor(item);
      if (val !== null && val !== undefined) {
        totalScore += val * item.bobotUsbu;
        totalBobot += item.bobotUsbu;
      }
    }
    if (totalBobot === 0) return "-";
    return Math.round(totalScore / totalBobot).toString();
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="mx-auto w-[210mm] bg-white min-h-[297mm] shadow-xl md:p-12 p-4 text-black print:shadow-none print:w-full print:p-0" style={{ pageBreakAfter: "always" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-hidden { display: none !important; }
        }
      `}} />

      <div className="print-hidden mb-8 flex items-center justify-end border-b pb-4">
        <button onClick={handlePrint} className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800">
          Cetak Transkrip (PDF/Print)
        </button>
      </div>

      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold uppercase tracking-widest text-slate-900">Transkrip Detail Perhitungan Nilai</h2>
        <h3 className="text-xl font-bold text-slate-700 mt-2">MARKAZ ARABIYAH</h3>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 text-sm font-bold text-slate-800">
        <div>
          <p>NAMA SANTRI : <span className="font-normal">{santriName.toUpperCase()}</span></p>
        </div>
        <div className="text-right">
          <p>PROGRAM : <span className="font-normal">{programName.toUpperCase()}</span></p>
        </div>
      </div>

      <div className="overflow-hidden border border-black">
        <table className="w-full text-center text-xs">
          <thead className="bg-slate-100 font-bold">
            {isAkbarnas ? (
              <>
                <tr>
                  <th rowSpan={2} className="border border-black p-2">Mata Pelajaran</th>
                  <th rowSpan={2} className="border border-black p-2">Bobot Akhir</th>
                  <th colSpan={4} className="border border-black p-2">Bulan 1</th>
                  <th colSpan={4} className="border border-black p-2">Bulan 2</th>
                  <th rowSpan={2} className="border border-black p-2 bg-emerald-50">Nilai Syahadah (Gabungan)</th>
                </tr>
                <tr>
                  <th className="border border-black p-2">P1</th>
                  <th className="border border-black p-2">P2</th>
                  <th className="border border-black p-2">Nihai</th>
                  <th className="border border-black p-2 bg-amber-50">Rata-rata</th>
                  <th className="border border-black p-2">P1</th>
                  <th className="border border-black p-2">P2</th>
                  <th className="border border-black p-2">Nihai</th>
                  <th className="border border-black p-2 bg-amber-50">Rata-rata</th>
                </tr>
              </>
            ) : (
              <tr>
                <th className="border border-black p-2">Mata Pelajaran</th>
                <th className="border border-black p-2">Bobot Akhir</th>
                <th className="border border-black p-2">Pekan 1</th>
                <th className="border border-black p-2">Pekan 2</th>
                <th className="border border-black p-2">Nihai</th>
                <th className="border border-black p-2 bg-amber-50">Rata-rata</th>
                <th className="border border-black p-2 bg-emerald-50">Nilai Syahadah (Gabungan)</th>
              </tr>
            )}
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx}>
                <td className="border border-black p-2 text-left font-bold">{item.mapel}</td>
                <td className="border border-black p-2">{item.masukAkumulasi ? item.bobot : "-"}</td>
                <td className="border border-black p-2">{item.b1.u1 !== null ? Math.round(item.b1.u1) : "-"}</td>
                <td className="border border-black p-2">{item.b1.u2 !== null ? Math.round(item.b1.u2) : "-"}</td>
                <td className="border border-black p-2">{item.b1.n !== null ? Math.round(item.b1.n) : "-"}</td>
                <td className="border border-black p-2 bg-amber-50/50 font-bold">{item.b1.avg !== null && item.b1.avg !== undefined ? Math.round(item.b1.avg) : "-"}</td>
                {isAkbarnas && (
                  <>
                    <td className="border border-black p-2">{item.b2.u1 !== null ? Math.round(item.b2.u1) : "-"}</td>
                    <td className="border border-black p-2">{item.b2.u2 !== null ? Math.round(item.b2.u2) : "-"}</td>
                    <td className="border border-black p-2">{item.b2.n !== null ? Math.round(item.b2.n) : "-"}</td>
                    <td className="border border-black p-2 bg-amber-50/50 font-bold">{item.b2.avg !== null && item.b2.avg !== undefined ? Math.round(item.b2.avg) : "-"}</td>
                  </>
                )}
                <td className="border border-black p-2 bg-emerald-50/30 font-bold">
                  {item.nilaiAkhir !== null ? (
                    <div className="flex flex-col items-center">
                      <span>{item.nilaiAkhir.toFixed(2)}</span>
                      <span className="text-[9px] text-emerald-700 font-black">({Math.round(item.nilaiAkhir)})</span>
                    </div>
                  ) : "-"}
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={2} className="border border-black p-2 text-right font-bold uppercase bg-slate-50">
                Rata-Rata Usbu' (Seluruh Mapel)
              </td>
              <td className="border border-black p-2 font-bold bg-slate-50">{computeAvg(i => i.b1.u1)}</td>
              <td className="border border-black p-2 font-bold bg-slate-50">{computeAvg(i => i.b1.u2)}</td>
              <td className="border border-black p-2 font-bold bg-slate-50">{computeAvg(i => i.b1.n)}</td>
              <td className="border border-black p-2 font-bold bg-amber-100/50">{computeAvg(i => i.b1.avg ?? null)}</td>
              {isAkbarnas ? (
                <>
                  <td className="border border-black p-2 font-bold bg-slate-50">{computeAvg(i => i.b2.u1)}</td>
                  <td className="border border-black p-2 font-bold bg-slate-50">{computeAvg(i => i.b2.u2)}</td>
                  <td className="border border-black p-2 font-bold bg-slate-50">{computeAvg(i => i.b2.n)}</td>
                  <td className="border border-black p-2 font-bold bg-amber-100/50">{computeAvg(i => i.b2.avg ?? null)}</td>
                  <td className="border border-black p-2 font-bold bg-emerald-50"></td>
                </>
              ) : (
                <td className="border border-black p-2 font-bold bg-emerald-50"></td>
              )}
            </tr>
            <tr>
              <td colSpan={isAkbarnas ? 10 : 6} className="border border-black p-3 text-right font-bold uppercase tracking-widest bg-slate-100">
                Total Rata-Rata Akhir (Nilai Syahadah)
              </td>
              <td className="border border-black p-3 font-bold bg-emerald-100 text-emerald-800">
                <div className="flex flex-col items-center">
                  <span className="text-base">{rataRataAkhir.toFixed(2)}</span>
                  <span className="text-lg font-black">({Math.round(rataRataAkhir)})</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-8 text-sm text-slate-600">
        <p className="font-bold mb-2">Keterangan Perhitungan Syahadah:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Nilai Akhir (Per Mapel):</strong> Rata-rata dari seluruh nilai pekanan yang ada di mapel tersebut.</li>
          <li><strong>Total Rata-Rata Akhir:</strong> <code className="bg-slate-100 px-1 py-0.5 rounded text-rose-600">Σ (Nilai Akhir × Bobot Akhir) ÷ Σ Bobot Akhir</code></li>
          <li>Mapel yang tidak masuk akumulasi tidak memiliki bobot dan tidak dijumlahkan ke hasil akhir.</li>
        </ul>
      </div>

      <div className="mt-16 flex justify-end">
        <div className="text-center w-64">
          <p className="text-sm">Pare, {format(new Date(), "dd MMMM yyyy", { locale: dateFnsId })}</p>
          <p className="font-bold text-sm">Bagian Kurikulum</p>
          <div className="h-24"></div>
          <p className="font-bold text-sm underline">......................................</p>
        </div>
      </div>
    </div>
  );
}
