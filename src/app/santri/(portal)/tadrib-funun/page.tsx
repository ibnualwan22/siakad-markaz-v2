"use client";

import { useEffect, useState } from "react";

type Hadir = {
  pertemuanKe: number;
  tanggal: string;
  pencatat: string;
};

type Riwayat = {
  id: string;
  dufahNama: string;
  tanggalDaftar: string;
  jenis: { id: string; nama: string };
  kehadiran: number;
  minHadir: number;
  eligible: boolean;
  diterbitkan: boolean;
  diterbitkanAt: string | null;
  diterbitkanOleh: string | null;
  hadir: Hadir[];
};

type Jenis = {
  id: string;
  nama: string;
  deskripsi: string | null;
  minHadir: number;
};

type Info = {
  riwayat: Riwayat[];
  dufahAktif: string;
  pendaftaranDibuka: boolean;
  sudahDaftar: boolean;
  jenisTerdaftarIds: string[];
  jenisList: Jenis[];
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

export default function TadribFununSantriPage() {
  const [info, setInfo] = useState<Info | null>(null);
  const [loading, setLoading] = useState(true);
  const [jenisId, setJenisId] = useState("");
  const [daftarLoading, setDaftarLoading] = useState(false);
  const [daftarError, setDaftarError] = useState("");

  const load = () => {
    fetch("/api/santri/tadrib-funun")
      .then((r) => r.json())
      .then((j) =>
        setInfo({
          riwayat: j.riwayat || [],
          dufahAktif: j.dufahAktif || "",
          pendaftaranDibuka: !!j.pendaftaranDibuka,
          sudahDaftar: !!j.sudahDaftar,
          jenisTerdaftarIds: j.jenisTerdaftarIds || [],
          jenisList: j.jenisList || [],
        })
      )
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const daftar = async () => {
    if (!jenisId) return setDaftarError("Pilih jenis ekstrakurikuler dulu");
    setDaftarLoading(true);
    setDaftarError("");
    try {
      const res = await fetch("/api/santri/tadrib-funun", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jenisId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mendaftar");
      setJenisId("");
      load();
    } catch (e: any) {
      setDaftarError(e.message || "Gagal mendaftar");
    } finally {
      setDaftarLoading(false);
    }
  };

  if (loading) return <p className="p-6 text-sm">Memuat...</p>;
  if (!info) return <p className="p-6 text-sm">Gagal memuat data.</p>;

  const { riwayat, dufahAktif, pendaftaranDibuka, sudahDaftar, jenisTerdaftarIds, jenisList } = info;

  // Jenis yang masih bisa diikuti pada dufah aktif (belum terdaftar).
  // Satu santri boleh mengikuti lebih dari satu jenis per dufah.
  const jenisTerdaftar = new Set(jenisTerdaftarIds);
  const jenisBisaDiikuti = jenisList.filter((j) => !jenisTerdaftar.has(j.id));

  return (
    <div className="space-y-6 p-4 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-black">Tadrib Funun</h1>
        <p className="text-sm text-slate-500">
          Ekstrakurikuler — daftar, ikuti pertemuan, dan dapatkan syahadah bila kehadiran memenuhi batas minimal.
        </p>
      </div>

      {sudahDaftar && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
          <p className="text-sm font-bold text-emerald-700">
            Anda terdaftar di {jenisTerdaftarIds.length} jenis pada {dufahAktif}
            {jenisBisaDiikuti.length > 0 ? " — Anda masih bisa menambah jenis lain di bawah ini." : "."}
          </p>
        </div>
      )}

      {dufahAktif !== "" && (
        pendaftaranDibuka ? (
          jenisBisaDiikuti.length > 0 ? (
          <div className="bg-white rounded-2xl border p-5">
            <p className="font-bold">Pendaftaran Tadrib Funun {dufahAktif} dibuka</p>
            <p className="text-sm text-slate-500 mt-1">
              Pilih jenis ekstrakurikuler yang ingin Anda ikuti. Anda bisa mengikuti lebih dari satu jenis.
            </p>
            {jenisList.length === 0 ? (
              <p className="text-sm text-slate-500 mt-3">Belum ada jenis yang dibuka.</p>
            ) : (
              <>
                <select
                  value={jenisId}
                  onChange={(e) => setJenisId(e.target.value)}
                  className="w-full mt-4 px-3 py-2.5 border rounded-xl text-sm bg-white"
                >
                  <option value="">Pilih jenis...</option>
                  {jenisBisaDiikuti.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.nama} — min. hadir {j.minHadir}x{ j.deskripsi ? ` (${j.deskripsi})` : "" }
                    </option>
                  ))}
                </select>
                {daftarError && <p className="text-sm text-red-600 mt-3">{daftarError}</p>}
                <button
                  onClick={daftar}
                  disabled={daftarLoading || !jenisId}
                  className="mt-4 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
                >
                  {daftarLoading ? "Mendaftar..." : "Daftar Tadrib Funun"}
                </button>
              </>
            )}
          </div>
          ) : (
            <div className="bg-white rounded-2xl border p-5">
              <p className="font-bold">Anda sudah terdaftar di semua jenis Tadrib Funun {dufahAktif}</p>
              <p className="text-sm text-slate-500 mt-1">
                Tidak ada lagi jenis yang bisa diikuti pada dufah ini.
              </p>
            </div>
          )
        ) : jenisTerdaftarIds.length === 0 ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
            <p className="text-sm font-bold text-red-700">
              Pendaftaran Tadrib Funun {dufahAktif} sudah ditutup. Silahkan tunggu pendaftaran di duf&apos;ah berikutnya.
            </p>
          </div>
        ) : null
      )}

      {riwayat.length === 0 && (
        <div className="bg-white rounded-2xl border p-6 text-center text-sm text-slate-500">
          Anda belum pernah mengikuti Tadrib Funun.
        </div>
      )}

      {riwayat.map((r) => (
        <div key={r.id} className="bg-white rounded-2xl border overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-lg leading-tight">{r.jenis.nama}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {r.dufahNama} • Kehadiran: {r.kehadiran}/{r.minHadir} • Daftar {formatTanggalId(r.tanggalDaftar)}
                </p>
              </div>
              {r.diterbitkan ? (
                <span className="shrink-0 text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full text-xs font-bold">
                  Syahadah Terbit
                </span>
              ) : r.eligible ? (
                <span className="shrink-0 text-blue-700 bg-blue-50 px-3 py-1 rounded-full text-xs font-bold">
                  Layak Syahadah — menunggu diterbitkan admin
                </span>
              ) : null}
            </div>
            <div className="h-2 bg-slate-100 rounded-full mt-3 overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full"
                style={{ width: `${Math.min(100, (r.kehadiran / Math.max(1, r.minHadir)) * 100)}%` }}
              />
            </div>
          </div>

          <div className="p-5 space-y-5">
            <div>
              <h3 className="font-bold text-sm mb-3">Catatan Kehadiran</h3>
              {r.hadir.length === 0 ? (
                <p className="text-slate-400 text-xs">Belum ada kehadiran.</p>
              ) : (
                <div className="space-y-2">
                  {r.hadir.map((h) => (
                    <div key={h.pertemuanKe} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm">
                      <span className="font-bold">Pertemuan {h.pertemuanKe}</span>
                      <span className="text-slate-500">{formatTanggalId(h.tanggal)}</span>
                      <span className="text-slate-500">Dicatat: {h.pencatat}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {r.diterbitkan && (
              <div className="border-t pt-4">
                <h3 className="font-bold text-sm mb-2">Syahadah</h3>
                <p className="text-sm text-slate-500">
                  Diterbitkan {r.diterbitkanAt ? formatTanggalId(r.diterbitkanAt) : ""}
                  {r.diterbitkanOleh ? ` oleh ${r.diterbitkanOleh}` : ""}.
                </p>
                <a
                  href={`/santri/tadrib-funun/cetak/${r.id}`}
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
