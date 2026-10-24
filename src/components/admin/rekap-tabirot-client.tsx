"use client";

import { useState, useEffect } from "react";
import { Users, FileText } from "lucide-react";
import { LEMBAGA_FILTER_OPTIONS } from "@/lib/lembaga";
import * as XLSX from "xlsx";

type Kelompok = {
  id: string;
  tempat: string;
  bulanKe: number;
};

type SantriRecap = {
  santriId: string;
  santriNama: string;
  kelompokId: string;
  tempat: string;
  bulanKe: number;
  HADIR: number;
  IZIN: number;
  SAKIT: number;
  ALPHA: number;
};

// WIB Offset helper
function getWibDateString(offsetDays = 0): string {
  const wib = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
  wib.setDate(wib.getDate() + offsetDays);
  return wib.toISOString().split("T")[0];
}
function getFirstDayOfMonth(): string {
  const wib = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
  return `${wib.getFullYear()}-${String(wib.getMonth() + 1).padStart(2, "0")}-01`;
}

export function RekapTabirotClient() {
  const [dari, setDari] = useState(getFirstDayOfMonth());
  const [sampai, setSampai] = useState(getWibDateString());
  const [kelompokId, setKelompokId] = useState<string>("");
  const [filterLembaga, setFilterLembaga] = useState("SEMUA");
  const [kelompokList, setKelompokList] = useState<Kelompok[]>([]);
  const [data, setData] = useState<SantriRecap[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/absensi/tabirot")
      .then(res => res.json())
      .then(json => setKelompokList(json.data || []))
      .catch(err => console.error("Gagal load kelompok", err));
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ dari, sampai });
        if (kelompokId) params.append("kelompokId", kelompokId);
        if (filterLembaga !== "SEMUA") params.append("lembaga", filterLembaga);
        
        const res = await fetch(`/api/admin/absensi/rekap/tabirot?${params}`);
        if (!res.ok) throw new Error("Gagal mengambil data");
        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [dari, sampai, kelompokId, filterLembaga]);

  const handleExportExcel = () => {
    if (data.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(
      data.map((d, index) => ({
        "No": index + 1,
        "Nama Santri": d.santriNama,
        "Tempat": d.tempat,
        "Bulan Ke-": d.bulanKe,
        "Hadir": d.HADIR,
        "Izin": d.IZIN,
        "Sakit": d.SAKIT,
        "Alpha": d.ALPHA,
        "Total Record": d.HADIR + d.IZIN + d.SAKIT + d.ALPHA,
      }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Tabirot");
    XLSX.writeFile(workbook, `Rekap_Absen_Tabirot_${dari}_sd_${sampai}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <section className="neu-card-white p-6">
        <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
          Filter Rekap
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-muted)]">Dari Tanggal</label>
            <input
              type="date"
              value={dari}
              onChange={(e) => setDari(e.target.value)}
              className="rounded-2xl border border-[var(--color-surface-dark)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--color-text)] outline-none transition focus:border-blue-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-muted)]">Sampai Tanggal</label>
            <input
              type="date"
              value={sampai}
              onChange={(e) => setSampai(e.target.value)}
              className="rounded-2xl border border-[var(--color-surface-dark)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--color-text)] outline-none transition focus:border-blue-500"
            />
          </div>
          <div className="min-w-[200px] flex-1">
            <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-muted)]">Pilih Kelompok</label>
            <select
              value={kelompokId}
              onChange={(e) => setKelompokId(e.target.value)}
              className="w-full rounded-2xl border border-[var(--color-surface-dark)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--color-text)] outline-none transition focus:border-blue-500"
            >
              <option value="">Semua Kelompok</option>
              {kelompokList.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.tempat} — Bulan ke-{k.bulanKe}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[200px]">
            <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-muted)]">Lembaga</label>
            <select
              value={filterLembaga}
              onChange={(e) => setFilterLembaga(e.target.value)}
              className="w-full rounded-2xl border border-[var(--color-surface-dark)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--color-text)] outline-none transition focus:border-blue-500"
            >
              {LEMBAGA_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 rounded-2xl bg-green-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
            disabled={data.length === 0}
          >
            <FileText size={16} />
            Export Excel
          </button>
        </div>
      </section>

      {/* Table Result */}
      <section className="neu-card-white overflow-hidden">
        {isLoading ? (
          <div className="flex animate-pulse items-center justify-center py-20 text-sm font-medium text-[var(--color-text-subtle)]">
            Memuat data...
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-surface-light)] text-[var(--color-text-subtle)]">
              <Users size={32} />
            </div>
            <p className="font-bold text-[var(--color-text)]">Belum ada data</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1 max-w-sm">
              Tidak ditemukan data absensi untuk rentang tanggal dan filter kelompok tersebut.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[var(--color-surface-light)] text-[10px] font-bold tracking-wider uppercase text-[var(--color-text-subtle)]">
                <tr>
                  <th className="px-6 py-4">No</th>
                  <th className="px-6 py-4">Nama Santri</th>
                  <th className="px-6 py-4">Kelompok</th>
                  <th className="px-6 py-4 text-center text-blue-600">Hadir</th>
                  <th className="px-6 py-4 text-center text-indigo-500">Izin</th>
                  <th className="px-6 py-4 text-center text-[var(--color-warning)]">Sakit</th>
                  <th className="px-6 py-4 text-center text-[var(--color-danger)]">Alpha</th>
                  <th className="px-6 py-4 text-center">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-surface)] bg-white text-[var(--color-text)]">
                {data.map((row, idx) => {
                  const total = row.HADIR + row.IZIN + row.SAKIT + row.ALPHA;
                  return (
                    <tr key={`${row.santriId}_${row.kelompokId}`} className="transition-colors hover:bg-slate-50/50">
                      <td className="px-6 py-3 font-semibold text-[var(--color-text-muted)]">{idx + 1}</td>
                      <td className="px-6 py-3 font-bold">{row.santriNama}</td>
                      <td className="px-6 py-3">
                        <span className="font-semibold">{row.tempat}</span>
                        <span className="text-[var(--color-text-subtle)] ml-1 text-xs font-semibold">
                          (Bulan {row.bulanKe})
                        </span>
                      </td>
                      <td className="px-6 py-3 text-center font-bold">{row.HADIR || "-"}</td>
                      <td className="px-6 py-3 text-center font-bold text-indigo-500">{row.IZIN || "-"}</td>
                      <td className="px-6 py-3 text-center font-bold text-[var(--color-warning-dark)]">{row.SAKIT || "-"}</td>
                      <td className="px-6 py-3 text-center font-bold text-[var(--color-danger)]">{row.ALPHA || "-"}</td>
                      <td className="px-6 py-3 text-center font-black text-[var(--color-primary-dark)]">{total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
