"use client";

import { useEffect, useState } from "react";

type Setoran = {
  pertemuanKe: number;
  tanggal: string;
  juz: string | null;
  surat: string | null;
  ayat: string | null;
  lulus: boolean;
  penyimak: string;
  catatan: string | null;
};

type Riwayat = {
  id: string;
  dufahNama: string;
  kehadiran: number;
  eligibleTasmi: boolean;
  setoran: Setoran[];
  tasmi: { juzTeks: string; predikat: string; tanggal: string; penguji: string } | null;
};

export default function NadiHufadzSantriPage() {
  const [data, setData] = useState<Riwayat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/santri/nadi-hufadz")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="p-6 text-sm">Memuat...</p>;

  return (
    <div className="space-y-6 p-4 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-black">Nadi Hufadz</h1>
        <p className="text-sm text-slate-500">Riwayat setoran harian dan syahadah Anda.</p>
      </div>

      {data.length === 0 && (
        <div className="bg-white rounded-2xl border p-6 text-center text-sm text-slate-500">
          Anda belum pernah mengikuti Nadi Hufadz.
        </div>
      )}

      {data.map((r) => (
        <div key={r.id} className="bg-white rounded-2xl border overflow-hidden">
          <div className="bg-slate-50 px-5 py-4 border-b flex items-center justify-between">
            <div>
              <p className="font-bold">{r.dufahNama}</p>
              <p className="text-xs text-slate-500">Kehadiran: {r.kehadiran}/10</p>
            </div>
            {r.tasmi ? (
              <span className="text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full text-xs font-bold">
                {r.tasmi.predikat}
              </span>
            ) : r.eligibleTasmi ? (
              <span className="text-blue-700 bg-blue-50 px-3 py-1 rounded-full text-xs font-bold">
                Layak Tasmi&apos;
              </span>
            ) : null}
          </div>

          <div className="p-5 space-y-4">
            <div>
              <h3 className="font-bold text-sm mb-2">Catatan Setoran Harian</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-slate-500">
                    <tr>
                      <th className="py-2 pr-3">#</th>
                      <th className="py-2 pr-3">Tanggal</th>
                      <th className="py-2 pr-3">Setoran</th>
                      <th className="py-2 pr-3">Hasil</th>
                      <th className="py-2 pr-3">Penyimak</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {r.setoran.map((s) => (
                      <tr key={s.pertemuanKe}>
                        <td className="py-2 pr-3 font-bold">{s.pertemuanKe}</td>
                        <td className="py-2 pr-3">{String(s.tanggal).slice(0, 10)}</td>
                        <td className="py-2 pr-3">
                          {[s.juz && `Juz ${s.juz}`, s.surat, s.ayat && `Ayat ${s.ayat}`]
                            .filter(Boolean)
                            .join(" • ") || "-"}
                        </td>
                        <td className="py-2 pr-3">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${s.lulus ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                            {s.lulus ? "Lulus" : "Tidak lulus"}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-xs">{s.penyimak}</td>
                      </tr>
                    ))}
                    {r.setoran.length === 0 && (
                      <tr><td colSpan={5} className="py-4 text-center text-slate-400 text-xs">Belum ada setoran.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {r.tasmi && (
              <div className="border-t pt-4">
                <h3 className="font-bold text-sm mb-2">Hasil Tasmi&apos;</h3>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div><span className="text-slate-500 text-xs block">Juz</span><span dir="rtl" className="font-bold">{r.tasmi.juzTeks}</span></div>
                  <div><span className="text-slate-500 text-xs block">Predikat</span><span dir="rtl" className="font-bold">{r.tasmi.predikat}</span></div>
                  <div><span className="text-slate-500 text-xs block">Tanggal</span><span className="font-bold">{String(r.tasmi.tanggal).slice(0, 10)}</span></div>
                  <div><span className="text-slate-500 text-xs block">Penguji</span><span className="font-bold">{r.tasmi.penguji}</span></div>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
