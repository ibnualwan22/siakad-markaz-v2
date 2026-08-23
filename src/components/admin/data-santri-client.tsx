"use client";

import { useState, useMemo } from "react";
import { Search, Download, X, Phone, Copy, ChevronLeft, ChevronRight, ArrowUpDown, Users, Filter } from "lucide-react";
import toast from "react-hot-toast";
import type { SantriDufahRow } from "@/app/admin/data-santri/page";

type SortField = "nama" | "bulanKe" | "kabupaten" | "sakan" | "programNama" | "kelasNama";
type SortDir = "asc" | "desc";

const COLUMN_DEFS = [
  { key: "nama", label: "Nama Santri" },
  { key: "lokasi", label: "Sakan / Kamar / Lemari" },
  { key: "kabupaten", label: "Kabupaten" },
  { key: "programKelas", label: "Program & Kelas" },
  { key: "bulanKe", label: "Bulan Ke" },
  { key: "kategori", label: "Kategori" },
  { key: "noWaSantri", label: "No. WA Santri" },
  { key: "gender", label: "Gender" },
] as const;

function normalizeWaNumber(raw: string): string {
  if (!raw || raw === "-") return "";
  let num = raw.replace(/[^0-9+]/g, "");
  if (num.startsWith("+")) num = num.slice(1);
  if (num.startsWith("08")) num = "62" + num.slice(1);
  if (num.startsWith("8")) num = "62" + num;
  return num;
}

function KategoriBadge({ kategori }: { kategori: string }) {
  const colors: Record<string, string> = {
    BARU: "bg-blue-50 text-[var(--color-info)] border-blue-200",
    LAMA: "bg-[var(--color-primary-50)] text-[var(--color-primary)] border-[var(--color-primary-100)]",
    KSU: "bg-purple-50 text-purple-700 border-purple-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${colors[kategori] ?? "bg-[var(--color-secondary)] text-[var(--color-text-muted)] border-[var(--color-surface-dark)]"}`}>
      {kategori}
    </span>
  );
}

function GenderBadge({ gender }: { gender: string }) {
  const isBanin = gender === "BANIN";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${isBanin ? "bg-sky-50 text-sky-700 border-sky-200" : "bg-pink-50 text-pink-700 border-pink-200"}`}>
      {isBanin ? "Banin" : "Banat"}
    </span>
  );
}

export function DataSantriClient({
  rows,
  uniqueSakans,
  uniquePrograms,
  uniqueKelas,
}: {
  rows: SantriDufahRow[];
  uniqueSakans: string[];
  uniquePrograms: string[];
  uniqueKelas: string[];
}) {
  // Filters
  const [search, setSearch] = useState("");
  const [filterGender, setFilterGender] = useState("ALL");
  const [filterKategori, setFilterKategori] = useState("ALL");
  const [filterSakan, setFilterSakan] = useState("ALL");
  const [filterProgram, setFilterProgram] = useState("ALL");
  const [filterKelas, setFilterKelas] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");

  // Sort
  const [sortField, setSortField] = useState<SortField>("nama");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Pagination
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  // Export modal
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportCols, setExportCols] = useState<Record<string, boolean>>(
    Object.fromEntries(COLUMN_DEFS.map((c) => [c.key, true]))
  );

  // Filter + search
  const filtered = useMemo(() => {
    let data = [...rows];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter((r) => r.nama.toLowerCase().includes(q) || r.id.includes(q));
    }
    if (filterGender !== "ALL") data = data.filter((r) => r.gender === filterGender);
    if (filterKategori !== "ALL") data = data.filter((r) => r.kategori === filterKategori);
    if (filterSakan !== "ALL") data = data.filter((r) => r.sakan === filterSakan);
    if (filterProgram !== "ALL") data = data.filter((r) => r.programNama === filterProgram);
    if (filterKelas !== "ALL") data = data.filter((r) => r.kelasNama === filterKelas);
    if (filterStatus === "CHECK_OUT") data = data.filter((r) => r.isCheckedOut);
    if (filterStatus === "AKTIF") data = data.filter((r) => !r.isCheckedOut);
    return data;
  }, [rows, search, filterGender, filterKategori, filterSakan, filterProgram, filterKelas, filterStatus]);

  // Sort
  const sorted = useMemo(() => {
    const data = [...filtered];
    data.sort((a, b) => {
      let cmp = 0;
      if (sortField === "bulanKe") {
        cmp = a.bulanKe - b.bulanKe;
      } else {
        const va = (a as any)[sortField] ?? "";
        const vb = (b as any)[sortField] ?? "";
        cmp = String(va).localeCompare(String(vb), "id");
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return data;
  }, [filtered, sortField, sortDir]);

  // Pagination calc
  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice((safePage - 1) * perPage, safePage * perPage);

  // Stats
  const totalBanin = filtered.filter((r) => r.gender === "BANIN").length;
  const totalBanat = filtered.filter((r) => r.gender === "BANAT").length;
  const totalBaru = filtered.filter((r) => r.kategori === "BARU").length;
  const totalLama = filtered.filter((r) => r.kategori === "LAMA").length;
  const totalKsu = filtered.filter((r) => r.kategori === "KSU").length;
  const totalCheckout = filtered.filter((r) => r.isCheckedOut).length;

  const hasFilters = search || filterGender !== "ALL" || filterKategori !== "ALL" || filterSakan !== "ALL" || filterProgram !== "ALL" || filterKelas !== "ALL" || filterStatus !== "ALL";

  function resetFilters() {
    setSearch(""); setFilterGender("ALL"); setFilterKategori("ALL");
    setFilterSakan("ALL"); setFilterProgram("ALL"); setFilterKelas("ALL");
    setFilterStatus("ALL");
    setPage(1);
  }

  async function handleForceCheckout(id: string, nama: string) {
    if (!confirm(`Apakah Anda yakin ingin melakukan Force Checkout pada santri ${nama}? Aksi ini akan menonaktifkan santri secara sepihak.`)) return;
    const toastId = toast.loading("Memproses Checkout...");
    try {
      const res = await fetch(`/api/admin/checkout/${id}/force-checkout`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal checkout");
      toast.success("Santri berhasil dicheckout", { id: toastId });
      window.location.reload();
    } catch (e: any) {
      toast.error(e.message, { id: toastId });
    }
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  function copyWa(num: string) {
    navigator.clipboard.writeText(num).then(() => toast.success("Nomor WA disalin!"));
  }

  async function handleExport() {
    const XLSX = await import("xlsx");
    const headerMap: Record<string, string> = {
      nama: "Nama Santri",
      lokasi: "Sakan / Kamar / Lemari",
      kabupaten: "Kabupaten",
      programKelas: "Program & Kelas",
      bulanKe: "Bulan Ke",
      kategori: "Kategori",
      noWaSantri: "No. WA Santri",
      gender: "Gender",
    };

    const selectedKeys = COLUMN_DEFS.filter((c) => exportCols[c.key]).map((c) => c.key);
    const headers = selectedKeys.map((k) => headerMap[k]);

    const dataRows = sorted.map((r) =>
      selectedKeys.map((k) => {
        if (k === "lokasi") return `${r.sakan} / ${r.kamar} / ${r.nomorLemari}`;
        if (k === "programKelas") return `${r.programNama} - ${r.kelasNama}`;
        if (k === "gender") return r.gender === "BANIN" ? "Banin" : "Banat";
        return (r as any)[k];
      })
    );

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    
    // Auto-fit column widths
    const colWidths = headers.map((h, i) => {
      const maxLen = Math.max(h.length, ...dataRows.map((row) => String(row[i] ?? "").length));
      return { wch: Math.min(maxLen + 2, 50) };
    });
    ws["!cols"] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Santri");
    XLSX.writeFile(wb, `Data_Santri_Dufah_${new Date().toISOString().slice(0, 10)}.xlsx`);
    setShowExportModal(false);
    toast.success("File Excel berhasil diunduh!");
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[var(--color-text)] md:text-4xl">Data Santri Duf&apos;ah</h1>
          <p className="text-base text-[var(--color-text-muted)] mt-1">Data lengkap santri aktif pada duf&apos;ah saat ini.</p>
        </div>
        <button
          onClick={() => setShowExportModal(true)}
          className="flex items-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-md shadow-[var(--color-primary-100)] transition-all hover:shadow-lg"
        >
          <Download size={16} />
          Export Excel
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Santri", value: filtered.length, color: "bg-[var(--color-text)] text-white" },
          { label: "Banin", value: totalBanin, color: "bg-sky-50 text-sky-700 border border-sky-200" },
          { label: "Banat", value: totalBanat, color: "bg-pink-50 text-pink-700 border border-pink-200" },
          { label: "Baru", value: totalBaru, color: "bg-blue-50 text-[var(--color-info)] border border-blue-200" },
          { label: "Lama", value: totalLama, color: "bg-[var(--color-primary-50)] text-[var(--color-primary)] border border-[var(--color-primary-100)]" },
          { label: "KSU", value: totalKsu, color: "bg-purple-50 text-purple-700 border border-purple-200" },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl px-4 py-3 ${s.color}`}>
            <p className="text-[11px] font-bold uppercase tracking-wider opacity-70">{s.label}</p>
            <p className="text-2xl font-black mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="neu-card-white p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-muted)]">
          <Filter size={16} />
          Filter & Pencarian
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-subtle)]" />
            <input
              type="text"
              placeholder="Cari nama atau NIS..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[var(--color-surface-dark)] bg-[var(--color-secondary)] text-sm font-medium focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-50)] transition"
            />
          </div>
          <select value={filterGender} onChange={(e) => { setFilterGender(e.target.value); setPage(1); }} className="rounded-xl neu-input">
            <option value="ALL">Semua Gender</option>
            <option value="BANIN">Banin</option>
            <option value="BANAT">Banat</option>
          </select>
          <select value={filterKategori} onChange={(e) => { setFilterKategori(e.target.value); setPage(1); }} className="rounded-xl neu-input">
            <option value="ALL">Semua Kategori</option>
            <option value="BARU">Baru</option>
            <option value="LAMA">Lama</option>
            <option value="KSU">KSU</option>
          </select>
          <select value={filterSakan} onChange={(e) => { setFilterSakan(e.target.value); setPage(1); }} className="rounded-xl neu-input">
            <option value="ALL">Semua Sakan</option>
            {uniqueSakans.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterProgram} onChange={(e) => { setFilterProgram(e.target.value); setFilterKelas("ALL"); setPage(1); }} className="rounded-xl neu-input">
            <option value="ALL">Semua Program</option>
            {uniquePrograms.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={filterKelas} onChange={(e) => { setFilterKelas(e.target.value); setPage(1); }} className="rounded-xl neu-input">
            <option value="ALL">Semua Kelas</option>
            {(filterProgram !== "ALL"
              ? [...new Set(rows.filter((r) => r.programNama === filterProgram).map((r) => r.kelasNama).filter((k) => k !== "-"))].sort()
              : uniqueKelas
            ).map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} className="rounded-xl neu-input">
            <option value="ALL">Semua Status</option>
            <option value="AKTIF">Aktif</option>
            <option value="CHECK_OUT">Telah Check Out</option>
          </select>
          {hasFilters && (
            <button onClick={resetFilters} className="flex items-center justify-center gap-1.5 text-sm font-bold text-[var(--color-danger)] bg-[var(--color-danger-light)] hover:bg-[var(--color-danger-light)] px-3 py-2.5 rounded-xl border border-[var(--color-danger)] transition">
              <X size={14} /> Reset Filter
            </button>
          )}
        </div>
        {hasFilters && (
          <p className="text-xs font-semibold text-[var(--color-text-muted)]">
            Menampilkan <span className="text-[var(--color-primary)] font-bold">{filtered.length}</span> dari <span className="font-bold">{rows.length}</span> santri
          </p>
        )}
      </div>

      {/* Table */}
      <div className="neu-card-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-secondary)] border-b border-[var(--color-surface-dark)]">
                <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-[var(--color-text-muted)] w-12">No</th>
                {([
                  { field: "nama" as SortField, label: "Nama Santri", sortable: true },
                  { field: "sakan" as SortField, label: "Sakan / Kamar / Lemari", sortable: true },
                  { field: "kabupaten" as SortField, label: "Kabupaten", sortable: true },
                  { field: "programNama" as SortField, label: "Program & Kelas", sortable: true },
                  { field: "bulanKe" as SortField, label: "Bulan Ke", sortable: true },
                  { field: "" as SortField, label: "Kategori", sortable: false },
                  { field: "" as SortField, label: "No. WA Santri", sortable: false },
                  { field: "" as SortField, label: "Gender", sortable: false },
                  { field: "" as SortField, label: "Aksi", sortable: false },
                ]).map((col, i) => (
                  <th key={i} className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-[var(--color-text-muted)]">
                    {col.sortable ? (
                      <button onClick={() => toggleSort(col.field)} className="flex items-center gap-1 hover:text-[var(--color-primary)] transition">
                        {col.label}
                        <ArrowUpDown size={12} className={sortField === col.field ? "text-[var(--color-primary)]" : "text-[var(--color-text-subtle)]"} />
                      </button>
                    ) : col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-surface)]">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <Users size={48} className="mx-auto text-[var(--color-text-subtle)] mb-3" />
                    <p className="text-sm font-bold text-[var(--color-text-muted)]">Tidak ada data santri yang cocok</p>
                    <p className="text-xs text-[var(--color-text-subtle)] mt-1">Coba ubah filter atau kata kunci pencarian</p>
                  </td>
                </tr>
              ) : paginated.map((r, i) => {
                const waNum = normalizeWaNumber(r.noWaSantri);
                return (
                  <tr key={r.id} className={`transition-colors ${r.isCheckedOut ? "bg-red-50/50 hover:bg-red-50" : "hover:bg-[var(--color-primary-50)]/30"}`}>
                    <td className="px-4 py-3 text-[var(--color-text-subtle)] font-semibold">{(safePage - 1) * perPage + i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <p className={`font-bold ${r.isCheckedOut ? "text-red-900" : "text-[var(--color-text)]"}`}>{r.nama}</p>
                        {r.isCheckedOut && (
                          <span className="px-1.5 py-0.5 text-[9px] font-black tracking-wide bg-red-100 text-red-600 rounded">CHECK OUT</span>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--color-text-subtle)] font-mono mt-0.5">{r.id}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[var(--color-text)]">{r.sakan}</p>
                      <p className="text-[11px] text-[var(--color-text-subtle)] mt-0.5">Kamar {r.kamar} / Lemari {r.nomorLemari}</p>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)] font-medium">{r.kabupaten}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[var(--color-text)]">{r.programNama}</p>
                      {r.kelasNama !== "-" && <p className="text-[11px] text-[var(--color-text-subtle)] mt-0.5">Kelas {r.kelasNama}</p>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-[var(--color-warning-light)] text-[var(--color-warning)] font-black text-sm border border-[var(--color-warning)]">
                        {r.bulanKe}
                      </span>
                    </td>
                    <td className="px-4 py-3"><KategoriBadge kategori={r.kategori} /></td>
                    <td className="px-4 py-3">
                      {r.noWaSantri && r.noWaSantri !== "-" ? (
                        <div className="flex items-center gap-1.5">
                          <a
                            href={`https://wa.me/${waNum}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] font-semibold text-xs bg-[var(--color-primary-50)] hover:bg-[var(--color-primary-100)] px-2 py-1 rounded-lg border border-[var(--color-primary-100)] transition"
                            title="Buka WhatsApp"
                          >
                            <Phone size={12} />
                            WA
                          </a>
                          <button
                            onClick={() => copyWa(r.noWaSantri)}
                            className="text-[var(--color-text-subtle)] hover:text-[var(--color-text-muted)] p-1 rounded-lg hover:bg-[var(--color-surface)] transition"
                            title="Salin nomor"
                          >
                            <Copy size={12} />
                          </button>
                          <span className="text-xs text-[var(--color-text-muted)] font-mono hidden xl:inline">{r.noWaSantri}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--color-text-subtle)]">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3"><GenderBadge gender={r.gender} /></td>
                    <td className="px-4 py-3 text-center">
                      {!r.isCheckedOut && (
                        <button 
                          onClick={() => handleForceCheckout(r.id, r.nama)} 
                          className="px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300 font-bold text-[10px] transition shrink-0 whitespace-nowrap"
                        >
                          Checkout
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-[var(--color-surface-dark)] bg-[var(--color-surface-light)]">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-muted)] font-medium">Per halaman:</span>
            <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }} className="rounded-lg border border-[var(--color-surface-dark)] bg-white px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
              {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="text-xs text-[var(--color-text-subtle)] font-medium ml-2">
              {(safePage - 1) * perPage + 1}–{Math.min(safePage * perPage, sorted.length)} dari {sorted.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-dark)] disabled:opacity-30 disabled:cursor-not-allowed transition">
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pg: number;
              if (totalPages <= 5) { pg = i + 1; }
              else if (safePage <= 3) { pg = i + 1; }
              else if (safePage >= totalPages - 2) { pg = totalPages - 4 + i; }
              else { pg = safePage - 2 + i; }
              return (
                <button key={pg} onClick={() => setPage(pg)} className={`h-8 w-8 rounded-lg text-xs font-bold transition ${pg === safePage ? "bg-[var(--color-primary)] text-white shadow" : "hover:bg-[var(--color-surface-dark)] text-[var(--color-text-muted)]"}`}>
                  {pg}
                </button>
              );
            })}
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-dark)] disabled:opacity-30 disabled:cursor-not-allowed transition">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-text)]/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-[var(--color-surface-dark)] flex items-center justify-between">
              <h3 className="text-lg font-black text-[var(--color-text)]">Export ke Excel</h3>
              <button onClick={() => setShowExportModal(false)} className="p-1.5 rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-text-subtle)] hover:text-[var(--color-text-muted)] transition">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-[var(--color-text-muted)] mb-4">Pilih kolom yang ingin diexport:</p>
              <div className="flex gap-2 mb-4">
                <button onClick={() => setExportCols(Object.fromEntries(COLUMN_DEFS.map((c) => [c.key, true])))} className="text-xs font-bold text-[var(--color-primary)] bg-[var(--color-primary-50)] hover:bg-[var(--color-primary-100)] px-3 py-1.5 rounded-lg border border-[var(--color-primary-100)] transition">
                  Pilih Semua
                </button>
                <button onClick={() => setExportCols(Object.fromEntries(COLUMN_DEFS.map((c) => [c.key, false])))} className="text-xs font-bold text-[var(--color-text-muted)] bg-[var(--color-secondary)] hover:bg-[var(--color-surface)] px-3 py-1.5 rounded-lg border border-[var(--color-surface-dark)] transition">
                  Hapus Semua
                </button>
              </div>
              <div className="space-y-2">
                {COLUMN_DEFS.map((c) => (
                  <label key={c.key} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[var(--color-secondary)] cursor-pointer transition">
                    <input
                      type="checkbox"
                      checked={exportCols[c.key] ?? true}
                      onChange={(e) => setExportCols((prev) => ({ ...prev, [c.key]: e.target.checked }))}
                      className="h-4 w-4 rounded border-[var(--color-surface-dark)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                    />
                    <span className="text-sm font-semibold text-[var(--color-text)]">{c.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[var(--color-surface-dark)] bg-[var(--color-secondary)] flex items-center justify-between">
              <p className="text-xs text-[var(--color-text-subtle)] font-medium">
                {sorted.length} data akan diexport
                {hasFilters && " (sesuai filter)"}
              </p>
              <button
                onClick={handleExport}
                disabled={!COLUMN_DEFS.some((c) => exportCols[c.key])}
                className="flex items-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] disabled:bg-[var(--color-surface-dark)] text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-md transition"
              >
                <Download size={16} />
                Download .xlsx
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
