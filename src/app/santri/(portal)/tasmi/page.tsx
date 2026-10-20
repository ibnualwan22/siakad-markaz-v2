"use client";

import { useEffect, useState } from "react";
import { predikatDariNilai } from "@/lib/huffadz/surah";

type TasmiItem = {
  id: string;
  tanggal: string;
  surahNama: string;
  ayatDari: number;
  surahSampaiNama: string;
  ayatSampai: number;
  juz: number;
  durasiMenit: number;
  nilaiTahfidz: number;
  nilaiTahsin: number;
  nilaiTartil: number;
  nilaiAdab: number;
  rataRata: number;
  catatan: string | null;
};

type TasmiResponse = {
  isHufadz: boolean;
  total: number;
  terakhir: TasmiItem | null;
  items: TasmiItem[];
};

function formatTanggal(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function rentangText(r: TasmiItem) {
  if (r.surahSampaiNama === r.surahNama) {
    return `${r.surahNama} : ${r.ayatDari}–${r.ayatSampai}`;
  }
  return `${r.surahNama} : ${r.ayatDari} → ${r.surahSampaiNama} : ${r.ayatSampai}`;
}

function warnaNilai(v: number) {
  if (v < 70) return "bg-red-100 text-red-700";
  if (v < 80) return "bg-yellow-100 text-yellow-700";
  if (v < 90) return "bg-blue-100 text-blue-700";
  return "bg-green-100 text-green-700";
}

function NilaiBox({ label, nilai }: { label: string; nilai: number }) {
  return (
    <div className={`rounded-xl px-2 py-2.5 text-center ${warnaNilai(nilai)}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-2xl font-black leading-tight">{nilai}</div>
      <div className="text-sm font-bold leading-tight">{predikatDariNilai(nilai)}</div>
    </div>
  );
}

export default function TasmiSantriPage() {
  const [data, setData] = useState<TasmiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/santri/tasmi")
      .then((r) => {
        if (!r.ok) throw new Error("gagal");
        return r.json();
      })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="p-2 text-sm">Memuat hasil tasmi&apos;...</p>;
  if (error || !data)
    return <p className="p-2 text-sm text-red-600">Gagal memuat data. Silakan muat ulang halaman.</p>;

  if (!data.isHufadz) {
    return (
      <div className="rounded-2xl border bg-white p-6 text-center space-y-2">
        <div className="text-4xl">📖</div>
        <h1 className="text-lg font-bold">Khusus Program Hufadz</h1>
        <p className="text-sm text-gray-500">
          Halaman ini hanya tersedia untuk santri yang mengikuti program Hufadz.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Hasil Tasmi&apos; Saya</h1>
        <p className="text-sm text-gray-500">Seluruh penilaian tasmi&apos; yang telah diinput penilai untukmu.</p>
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border bg-white p-4 text-center">
          <div className="text-3xl font-black" style={{ color: "var(--color-primary)" }}>{data.total}</div>
          <div className="text-xs font-semibold text-gray-500 mt-1">Total Sesi Tasmi&apos;</div>
        </div>
        <div className="rounded-2xl border bg-white p-4 text-center">
          <div className="text-3xl font-black" style={{ color: "var(--color-primary)" }}>
            {data.terakhir ? data.terakhir.juz : "-"}
          </div>
          <div className="text-xs font-semibold text-gray-500 mt-1">Juz Tasmi&apos; Terakhir</div>
        </div>
      </div>
      {data.terakhir && (
        <p className="text-xs text-gray-500 -mt-1">
          Terakhir: {formatTanggal(data.terakhir.tanggal)} — {rentangText(data.terakhir)}
        </p>
      )}

      {data.items.length === 0 ? (
        <div className="rounded-2xl border bg-white p-6 text-center space-y-2">
          <div className="text-4xl">🕌</div>
          <p className="font-semibold">Belum ada hasil tasmi&apos;</p>
          <p className="text-sm text-gray-500">Hasil akan muncul di sini setelah penilai menginput penilaian tasmi&apos;-mu.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.items.map((r) => (
            <article key={r.id} className="rounded-2xl border bg-white p-4 space-y-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold leading-snug">{rentangText(r)}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{formatTanggal(r.tanggal)}</div>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-1 text-xs font-bold">
                  Juz {r.juz}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <NilaiBox label="Tahfidz" nilai={r.nilaiTahfidz} />
                <NilaiBox label="Tahsin" nilai={r.nilaiTahsin} />
                <NilaiBox label="Tartil" nilai={r.nilaiTartil} />
                <NilaiBox label="Adab" nilai={r.nilaiAdab} />
              </div>

              <div className="flex items-center justify-between border-t pt-2.5 text-sm">
                <span className="text-gray-500">
                  Rata-rata <span className="font-black text-gray-800">{r.rataRata}</span>
                  <span className="font-bold"> • {predikatDariNilai(r.rataRata)}</span>
                </span>
                {r.durasiMenit > 0 && <span className="text-xs text-gray-400">⏱ {r.durasiMenit} menit</span>}
              </div>

              {r.catatan && (
                <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm italic text-gray-600">
                  “{r.catatan}”
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
