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

type Info = {
  riwayat: Riwayat[];
  dufahAktif: string;
  pendaftaranDibuka: boolean;
  sudahDaftar: boolean;
};

const BULAN_ID = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

/** "2026-10-14" -> "14 Okt 2026" */
function formatTanggalId(dateStr: string): string {
  const m = String(dateStr).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(dateStr).slice(0, 10);
  const bulan = BULAN_ID[Number(m[2]) - 1] || m[2];
  return `${Number(m[3])} ${bulan} ${m[1]}`;
}

export default function NadiHufadzSantriPage() {
  const [info, setInfo] = useState<Info | null>(null);
  const [loading, setLoading] = useState(true);
  const [daftarLoading, setDaftarLoading] = useState(false);
  const [daftarError, setDaftarError] = useState("");

  const load = () => {
    fetch("/api/santri/nadi-hufadz")
      .then((r) => r.json())
      .then((j) => setInfo({
        riwayat: j.riwayat || [],
        dufahAktif: j.dufahAktif || "",
        pendaftaranDibuka: !!j.pendaftaranDibuka,
        sudahDaftar: !!j.sudahDaftar,
      }))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const daftar = async () => {
    setDaftarLoading(true);
    setDaftarError("");
    try {
      const res = await fetch("/api/santri/nadi-hufadz", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mendaftar");
      load();
    } catch (e: any) {
      setDaftarError(e.message || "Gagal mendaftar");
    } finally {
      setDaftarLoading(false);
    }
  };

  if (loading) return <p className="p-6 text-sm">Memuat...</p>;
  if (!info) return <p className="p-6 text-sm">Gagal memuat data.</p>;

  const { riwayat, dufahAktif, pendaftaranDibuka, sudahDaftar } = info;

  return (
    <div className="space-y-6 p-4 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-black">Nadi Hufadz</h1>
        <p className="text-sm text-slate-500">Riwayat setoran harian dan syahadah Anda.</p>
      </div>

      {!sudahDaftar && dufahAktif !== "" && (
        pendaftaranDibuka ? (
          <div className="bg-white rounded-2xl border p-5">
            <p className="font-bold">Pendaftaran Nadi Hufadz {dufahAktif} dibuka</p>
            <p className="text-sm text-slate-500 mt-1">
              Daftar untuk mengikuti setoran harian dan tasmi&apos; pada {dufahAktif}.
            </p>
            {daftarError && <p className="text-sm text-red-600 mt-3">{daftarError}</p>}
            <button
              onClick={daftar}
              disabled={daftarLoading}
              className="mt-4 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
            >
              {daftarLoading ? "Mendaftar..." : "Daftar Nadi Hufadz"}
            </button>
          </div>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
            <p className="text-sm font-bold text-red-700">
              Pendaftaran Nadi Hufadz {dufahAktif} sudah ditutup. Silahkan tunggu pendaftaran di duf&apos;ah berikutnya.
            </p>
          </div>
        )
      )}

      {riwayat.length === 0 && sudahDaftar && (
        <div className="bg-white rounded-2xl border p-6 text-center text-sm text-slate-500">
          Anda belum pernah mengikuti Nadi Hufadz.
        </div>
      )}

      {riwayat.map((r) => (
        <div key={r.id} className="bg-white rounded-2xl border overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-lg leading-tight">{r.dufahNama}</p>
                <p className="text-xs text-slate-500 mt-1">Kehadiran: {r.kehadiran}/10</p>
              </div>
              {r.tasmi ? (
                <span className="shrink-0 text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full text-xs font-bold">
                  {r.tasmi.predikat}
                </span>
              ) : r.eligibleTasmi ? (
                <span className="shrink-0 text-blue-700 bg-blue-50 px-3 py-1 rounded-full text-xs font-bold">
                  Layak Tasmi&apos;
                </span>
              ) : null}
            </div>
            <div className="h-2 bg-slate-100 rounded-full mt-3 overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full"
                style={{ width: `${Math.min(100, (r.kehadiran / 10) * 100)}%` }}
              />
            </div>
          </div>

          <div className="p-5 space-y-5">
            <div>
              <h3 className="font-bold text-sm mb-3">Catatan Setoran Harian</h3>
              {r.setoran.length === 0 ? (
                <p className="text-slate-400 text-xs">Belum ada setoran.</p>
              ) : (
                <div className="space-y-3">
                  {r.setoran.map((s) => (
                    <div key={s.pertemuanKe} className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-sm">Pertemuan {s.pertemuanKe}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{formatTanggalId(s.tanggal)}</p>
                        </div>
                        <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded ${s.lulus ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                          {s.lulus ? "Lulus" : "Tidak lulus"}
                        </span>
                      </div>
                      <div className="border-t border-slate-100 my-3" />
                      <div className="space-y-2.5">
                        <div>
                          <p className="text-[11px] tracking-wide text-slate-400 font-bold">SETORAN</p>
                          <p className="text-sm font-medium mt-0.5">
                            {[s.juz && `Juz ${s.juz}`, s.surat, s.ayat && `Ayat ${s.ayat}`]
                              .filter(Boolean)
                              .join(" • ") || "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] tracking-wide text-slate-400 font-bold">PENYIMAK</p>
                          <p className="text-sm mt-0.5">{s.penyimak}</p>
                        </div>
                        {s.catatan && (
                          <div>
                            <p className="text-[11px] tracking-wide text-slate-400 font-bold">CATATAN</p>
                            <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 mt-1">
                              {s.catatan}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="border-t border-slate-100 mt-3 pt-3 flex items-end justify-between gap-2">
                        <p className="text-[11px] tracking-wide text-slate-400 font-bold">PARAF PENYIMAK</p>
                        <p className="text-sm font-medium border-t border-slate-400 pt-1 px-2">{s.penyimak}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {r.tasmi && (
              <div className="border-t pt-4">
                <h3 className="font-bold text-sm mb-2">Hasil Tasmi&apos;</h3>
                <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
                  <div><span className="text-slate-500 text-xs block">Juz</span><span dir="rtl" className="font-bold">{r.tasmi.juzTeks}</span></div>
                  <div><span className="text-slate-500 text-xs block">Predikat</span><span dir="rtl" className="font-bold">{r.tasmi.predikat}</span></div>
                  <div><span className="text-slate-500 text-xs block">Tanggal</span><span className="font-bold">{formatTanggalId(r.tasmi.tanggal)}</span></div>
                  <div><span className="text-slate-500 text-xs block">Penguji</span><span className="font-bold">{r.tasmi.penguji}</span></div>
                </div>
                <a
                  href={`/santri/nadi-hufadz/cetak/${r.id}`}
                  className="inline-block mt-4 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700"
                >
                  Lihat &amp; Unduh Syahadah (PNG)
                </a>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
