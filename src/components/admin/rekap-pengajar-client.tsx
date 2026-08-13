"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { FileText, Search, User, Clock, Calendar, Send, Edit3, Trash2, X, Save } from "lucide-react";
import toast from "react-hot-toast";

type PengajarRecord = {
  id: string;
  pengajar: string;
  kelas: string;
  tanggal: string;
  sesi: string;
  materi: string;
  waktuMulai: string;
  waktuSelesai: string;
  status?: string;
  isBadal?: boolean;
  isAsisten?: boolean;
  pengajarDigantikan?: string | null;
  atribut: {
    nametag: boolean;
    kopiah: boolean;
    bros: boolean;
  };
  terlambatMenit?: number;
  beritaAcara?: {
    id: string;
    konfirmasiHadir: boolean;
    catatan: string | null;
  } | null;
  beritaAcaraAktif?: boolean;
};

const HARI_OPTIONS = [
  { value: "ALL", label: "Semua Hari" },
  { value: "Senin", label: "Senin" },
  { value: "Selasa", label: "Selasa" },
  { value: "Rabu", label: "Rabu" },
  { value: "Kamis", label: "Kamis" },
  { value: "Jumat", label: "Jumat" },
  { value: "Sabtu", label: "Sabtu" },
  { value: "Minggu", label: "Minggu" },
];

export function RekapPengajarClient({ userRole = "", pengajarList = [], hasEditPerm = false }: { userRole?: string, pengajarList?: { id: string, nama: string }[], hasEditPerm?: boolean }) {
  const isAdmin = userRole === "ADMIN" || hasEditPerm;
  const searchParams = useSearchParams();
  const dari = searchParams.get("dari");
  const sampai = searchParams.get("sampai");
  const usbuVal = searchParams.get("usbu");

  const [data, setData] = useState<PengajarRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterHari, setFilterHari] = useState("ALL");
  const [filterKelas, setFilterKelas] = useState("ALL");
  const [filterPengajar, setFilterPengajar] = useState("ALL");

  // Edit modal state (Admin only)
  const [editingRecord, setEditingRecord] = useState<PengajarRecord | null>(null);
  const [editForm, setEditForm] = useState({ materi: "", waktuMulai: "", waktuSelesai: "", kopiah: false, nametag: false, bros: false, terlambatMenit: 0, isBadal: false, pengajarBadalId: "" });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const openEditModal = (r: PengajarRecord) => {
    setEditingRecord(r);
    setEditForm({ materi: r.materi !== "ALPHA (Belum Absen)" ? r.materi : "", waktuMulai: r.waktuMulai !== "-" ? r.waktuMulai : "", waktuSelesai: r.waktuSelesai !== "-" ? r.waktuSelesai : "", kopiah: r.atribut.kopiah, nametag: r.atribut.nametag, bros: r.atribut.bros, terlambatMenit: r.terlambatMenit || 0, isBadal: false, pengajarBadalId: "" });
  };

  const handleSaveEdit = async () => {
    if (!editingRecord) return;
    setIsSavingEdit(true);
    try {
      const res = await fetch("/api/admin/absensi/rekap/pengajar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingRecord.id, materi: editForm.materi, waktuMulai: editForm.waktuMulai, waktuSelesai: editForm.waktuSelesai, atributKopiah: editForm.kopiah, atributNametag: editForm.nametag, atributBros: editForm.bros, terlambatMenit: editForm.terlambatMenit, isBadal: editForm.isBadal, pengajarBadalId: editForm.pengajarBadalId })
      });
      const result = await res.json();
      if (result.success) {
        toast.success("Data berhasil diperbarui");
        if (editingRecord.id.startsWith("alpha_")) {
          const badalName = editForm.isBadal ? pengajarList.find(p => p.id === editForm.pengajarBadalId)?.nama || "Unknown" : editingRecord.pengajar;
          setData(prev => prev.map(d => d.id === editingRecord.id ? { ...d, id: result.data.id, status: "HADIR", materi: editForm.materi, waktuMulai: editForm.waktuMulai, waktuSelesai: editForm.waktuSelesai, atribut: { kopiah: editForm.kopiah, nametag: editForm.nametag, bros: editForm.bros }, terlambatMenit: editForm.terlambatMenit, pengajar: badalName, isBadal: editForm.isBadal, pengajarDigantikan: editForm.isBadal ? editingRecord.pengajar : null } : d));
        } else {
          setData(prev => prev.map(d => d.id === editingRecord.id ? { ...d, materi: editForm.materi, waktuMulai: editForm.waktuMulai, waktuSelesai: editForm.waktuSelesai, atribut: { kopiah: editForm.kopiah, nametag: editForm.nametag, bros: editForm.bros }, terlambatMenit: editForm.terlambatMenit } : d));
        }
        setEditingRecord(null);
      } else {
        toast.error(result.error || "Gagal memperbarui");
      }
    } catch { toast.error("Terjadi kesalahan"); } finally { setIsSavingEdit(false); }
  };

  const handleDeleteRecord = async (r: PengajarRecord) => {
    if (r.id.startsWith("alpha_") || r.status === "ALPHA") { toast.error("Tidak bisa menghapus record ALPHA"); return; }
    if (!confirm(`Hapus data absen ${r.pengajar} di ${r.kelas} ${r.sesi}?`)) return;
    try {
      const res = await fetch(`/api/admin/absensi/rekap/pengajar?id=${r.id}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) {
        toast.success("Data berhasil dihapus");
        setData(prev => prev.filter(d => d.id !== r.id));
      } else { toast.error(result.error || "Gagal menghapus"); }
    } catch { toast.error("Terjadi kesalahan"); }
  };

  useEffect(() => {
    if (!dari || !sampai) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ dari, sampai });
        const res = await fetch(`/api/admin/absensi/rekap/pengajar?${params}`);
        const result = await res.json();
        if (Array.isArray(result)) {
          setData(result);
        } else {
          setData([]);
        }
      } catch (e) {
        console.error("Gagal memuat rekap pengajar", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [dari, sampai]);

  // Unique kelas dan pengajar untuk dropdown filter
  const uniqueKelas = useMemo(() => Array.from(new Set(data.map(d => d.kelas))).sort(), [data]);
  const uniquePengajar = useMemo(() => Array.from(new Set(data.map(d => d.pengajar))).sort(), [data]);

  // Grouped by Tanggal → pengajar rows
  const filteredData = useMemo(() => {
    return data.filter(d => {
      const matchSearch =
        d.pengajar.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.kelas.toLowerCase().includes(searchQuery.toLowerCase());

      const hari = format(new Date(d.tanggal), "EEEE", { locale: id });
      const matchHari = filterHari === "ALL" || hari === filterHari;
      const matchKelas = filterKelas === "ALL" || d.kelas === filterKelas;
      const matchPengajar = filterPengajar === "ALL" || d.pengajar === filterPengajar;

      return matchSearch && matchHari && matchKelas && matchPengajar;
    });
  }, [data, searchQuery, filterHari, filterKelas, filterPengajar]);

  const groupedData = useMemo(() => {
    // Group by tanggal
    const groups: Record<string, PengajarRecord[]> = {};
    filteredData.forEach(d => {
      if (!groups[d.tanggal]) groups[d.tanggal] = [];
      groups[d.tanggal].push(d);
    });

    return Object.keys(groups).sort().map(tgl => ({
      tanggal: tgl,
      records: groups[tgl].sort((a, b) => {
        const nA = parseInt(a.sesi.replace("SESI_", "")) || 0;
        const nB = parseInt(b.sesi.replace("SESI_", "")) || 0;
        if (nA !== nB) return nA - nB;
        return a.pengajar.localeCompare(b.pengajar);
      })
    }));
  }, [filteredData]);

  const summaryByPengajar = useMemo(() => {
    const stats: Record<string, { total: number, berhalangan: number, terverifikasi: number, belum: number }> = {};
    
    filteredData.forEach(r => {
      if (!stats[r.pengajar]) {
        stats[r.pengajar] = { total: 0, berhalangan: 0, terverifikasi: 0, belum: 0 };
      }
      
      const st = stats[r.pengajar];
      st.total += 1;
      
      if (r.status === "ALPHA") {
        st.berhalangan += 1;
      } else if (!r.beritaAcaraAktif) {
        st.terverifikasi += 1;
      } else if (r.beritaAcara) {
        if (r.beritaAcara.konfirmasiHadir) {
          st.terverifikasi += 1;
        } else {
          st.berhalangan += 1;
        }
      } else {
        st.belum += 1;
      }
    });

    return Object.entries(stats).map(([nama, s]) => ({ nama, ...s })).sort((a, b) => a.nama.localeCompare(b.nama));
  }, [filteredData]);

  const exportToExcel = async () => {
    if (!dari || !sampai || !data.length) return;

    try {
      // Gunakan rentang tanggal dari filter (dari - sampai)
      const [sYear, sMonth, sDay] = dari.split("-").map(Number);
      const [eYear, eMonth, eDay] = sampai.split("-").map(Number);
      const exportStart = new Date(sYear, sMonth - 1, sDay);
      const exportEnd = new Date(eYear, eMonth - 1, eDay);

      // Gunakan data yang sedang difilter aktif di view
      const exportData = filteredData;

      const datesArray: Date[] = [];
      let curr = new Date(exportStart);
      while (curr <= exportEnd) {
        datesArray.push(new Date(curr));
        curr.setDate(curr.getDate() + 1);
      }

      // Grouping data for Excel: teacher -> kelas||sesi -> date -> record
      const grouped: Record<string, Record<string, Record<string, PengajarRecord>>> = {};
      
      exportData.forEach(r => {
        if (!grouped[r.pengajar]) grouped[r.pengajar] = {};
        const rowKey = `${r.kelas}||${r.sesi}`;
        if (!grouped[r.pengajar][rowKey]) grouped[r.pengajar][rowKey] = {};
        grouped[r.pengajar][rowKey][r.tanggal] = r;
      });

      const SESI_ROMAN: Record<string, string> = {
        "SESI_1": "I", "SESI_2": "II", "SESI_3": "III",
        "SESI_4": "IV", "SESI_5": "V", "SESI_6": "VI",
        "SESI_7": "VII", "SESI_8": "VIII", "SESI_9": "IX", "SESI_10": "X"
      };

      let html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel">
        <head>
          <meta charset="utf-8">
          <style>
            table { border-collapse: collapse; font-family: sans-serif; font-size: 12px; }
            th, td { border: 1px solid #000; padding: 5px; text-align: center; vertical-align: middle; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .blue { background-color: #4f81bd; color: #4f81bd; }
            .blue-white { background-color: #4f81bd; color: #fff; font-weight: bold; }
            .red { background-color: #ff4c4c; color: #fff; font-weight: bold; }
            .gray { background-color: #d9d9d9; }
            .white-red { background-color: #fff; color: #ff0000; font-weight: bold; }
          </style>
        </head>
        <body>
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Kelas</th>
                <th>Sesi</th>
                ${datesArray.map(d => `<th>${format(d, "d")} <br/> ${format(d, "EEE", { locale: id })}</th>`).join('')}
                <th>Ket. Atribut</th>
              </tr>
            </thead>
            <tbody>`;

      Object.keys(grouped).sort().forEach(teacher => {
        const rows = grouped[teacher];
        let firstRow = true;
        const rowKeys = Object.keys(rows).sort((a, b) => {
          const [kelasA, sesiA] = a.split("||");
          const [kelasB, sesiB] = b.split("||");
          const nA = parseInt(sesiA.replace("SESI_", "")) || 0;
          const nB = parseInt(sesiB.replace("SESI_", "")) || 0;
          if (nA !== nB) return nA - nB;
          return kelasA.localeCompare(kelasB);
        });
        
        rowKeys.forEach(rowKey => {
          const [kelas, sesi] = rowKey.split("||");
          html += `<tr>`;
          if (firstRow) {
            html += `<td rowspan="${rowKeys.length}"><b>${teacher}</b></td>`;
            firstRow = false;
          }
          html += `<td>${kelas}</td>`;
          html += `<td>${SESI_ROMAN[sesi] || sesi}</td>`;
          
          datesArray.forEach(dateObj => {
            const dateStr = format(dateObj, "yyyy-MM-dd");
            const record = rows[rowKey][dateStr];
            
            if (!record) {
              html += `<td class="gray"></td>`;
            } else if (record.status === "ALPHA") {
              html += `<td class="gray"></td>`;
            } else if (record.status === "HADIR") {
              if (record.terlambatMenit && record.terlambatMenit > 0) {
                html += `<td class="blue-white">-${record.terlambatMenit}</td>`;
              } else {
                html += `<td class="blue">Y</td>`;
              }
            } else {
              html += `<td></td>`;
            }
          });

          // Kolom keterangan atribut: kumpulkan hari di mana atribut tidak lengkap
          const missingAtributLines: string[] = [];
          datesArray.forEach(dateObj => {
            const dateStr = format(dateObj, "yyyy-MM-dd");
            const record = rows[rowKey][dateStr];
            if (record && record.status === "HADIR") {
              const missing: string[] = [];
              if (!record.atribut.kopiah) missing.push("Kopiah");
              if (!record.atribut.nametag) missing.push("Nametag");
              if (!record.atribut.bros) missing.push("Baju");
              if (missing.length > 0) {
                missingAtributLines.push(`${format(dateObj, "d")}: ${missing.join(", ")}`);
              }
            }
          });
          html += `<td class="white-red" style="text-align:left; font-size:10px; white-space:pre-line;">${missingAtributLines.join("\n")}</td>`;
          html += `</tr>`;
        });
        // Empty row separation
        html += `<tr><td colspan="${4 + datesArray.length}" style="border:none; height: 20px;"></td></tr>`;
      });

      html += `</tbody></table></body></html>`;

      let fileName = "Rekap";
      if (filterPengajar !== "ALL") {
        fileName += `_${filterPengajar.replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_')}`;
      } else {
        fileName += `_Pengajar`;
      }
      
      fileName += `_${format(exportStart, "MMMM_yyyy", { locale: id })}`;
      
      if (usbuVal && usbuVal !== "ALL") {
        fileName += `_Usbu_${usbuVal}`;
      }

      const blob = new Blob([html], { type: "application/vnd.ms-excel" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName}.xls`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Gagal export excel:", e);
      alert("Terjadi kesalahan saat meng-export Excel");
    }
  };

  const sendWaLaporan = async () => {
    const loaders = toast.loading("Mengirim Laporan WA Hari Ini...");
    try {
      // Panggil tanpa parameter agar otomatis mengambil hari ini (hari yang sedang aktif)
      const res = await fetch(`/api/cron/wa-rekap-pengajar`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengirim");
      
      if (data.success) {
        toast.success(data.message, { id: loaders });
      } else {
        toast.error(data.message || "Gagal mengirim pesan", { id: loaders });
      }
    } catch (err: any) {
      toast.error(err.message, { id: loaders });
    }
  };

  if (!dari || !sampai) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-[var(--color-surface-dark)]">
        <p className="font-bold text-[var(--color-text)]">Silakan pilih rentang tanggal atau Usbu&apos; terlebih dahulu.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="neu-card-white overflow-hidden flex flex-col">
        {/* Header + Filters */}
        <div className="p-6 border-b border-[var(--color-surface)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-[var(--color-text)]">Data Kehadiran Pengajar</h3>
              <p className="text-xs text-[var(--color-text-muted)] font-medium">Dikelompokkan berdasarkan Hari/Tanggal</p>
            </div>
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-subtle)]" />
              <input
                type="text"
                placeholder="Cari pengajar/kelas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-[var(--color-secondary)] border border-[var(--color-surface-dark)] rounded-xl outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all font-semibold"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={sendWaLaporan}
                disabled={isLoading || data.length === 0}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                title="Kirim ke 081227225453"
              >
                <Send className="h-4 w-4" />
                <span>Kirim WA Laporan</span>
              </button>
              <button
                onClick={exportToExcel}
                disabled={isLoading || data.length === 0}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <FileText className="h-4 w-4" />
                <span>Export Excel</span>
              </button>
            </div>
          </div>

          {/* Filter Row */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={filterHari}
              onChange={(e) => setFilterHari(e.target.value)}
              className="rounded-xl border border-[var(--color-surface-dark)] bg-white px-3 py-2 text-sm font-semibold text-[var(--color-text)] outline-none transition focus:border-violet-500"
            >
              {HARI_OPTIONS.map(h => (
                <option key={h.value} value={h.value}>{h.label}</option>
              ))}
            </select>

            <select
              value={filterKelas}
              onChange={(e) => setFilterKelas(e.target.value)}
              className="rounded-xl border border-[var(--color-surface-dark)] bg-white px-3 py-2 text-sm font-semibold text-[var(--color-text)] outline-none transition focus:border-violet-500"
            >
              <option value="ALL">Semua Kelas</option>
              {uniqueKelas.map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>

            <select
              value={filterPengajar}
              onChange={(e) => setFilterPengajar(e.target.value)}
              className="rounded-xl border border-[var(--color-surface-dark)] bg-white px-3 py-2 text-sm font-semibold text-[var(--color-text)] outline-none transition focus:border-violet-500"
            >
              <option value="ALL">Semua Pengajar</option>
              {uniquePengajar.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            {(filterHari !== "ALL" || filterKelas !== "ALL" || filterPengajar !== "ALL" || searchQuery) && (
              <button
                onClick={() => { setFilterHari("ALL"); setFilterKelas("ALL"); setFilterPengajar("ALL"); setSearchQuery(""); }}
                className="text-xs font-bold text-[var(--color-danger)] hover:text-[var(--color-danger)] transition"
              >
                Reset Filter
              </button>
            )}
          </div>

          {/* Verification Summary */}
          {summaryByPengajar.length > 0 && !isLoading && (
             <div className="mt-6 border border-[var(--color-surface-dark)] rounded-2xl overflow-hidden bg-white">
                <div className="bg-slate-50 px-4 py-3 border-b border-[var(--color-surface-dark)] flex items-center justify-between">
                   <h3 className="text-sm font-bold text-[var(--color-primary)]">Ringkasan Verifikasi & Kehadiran (Sesuai Filter)</h3>
                </div>
                <div className="max-h-[250px] overflow-y-auto custom-scrollbar">
                   <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-white sticky top-0 border-b border-[var(--color-surface-dark)] shadow-sm">
                         <tr>
                            <th className="px-4 py-2 font-bold text-[var(--color-text-muted)] text-[11px] uppercase">Pengajar</th>
                            <th className="px-4 py-2 font-bold text-[var(--color-text-muted)] text-[11px] uppercase text-center w-24">Total Sesi</th>
                            <th className="px-4 py-2 font-bold text-[var(--color-text-muted)] text-[11px] uppercase text-center w-28">Terverifikasi</th>
                            <th className="px-4 py-2 font-bold text-[var(--color-text-muted)] text-[11px] uppercase text-center w-28">Menunggu</th>
                            <th className="px-4 py-2 font-bold text-[var(--color-text-muted)] text-[11px] uppercase text-center w-36">Berhalangan Masuk</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-surface)]">
                         {summaryByPengajar.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition">
                               <td className="px-4 py-2 font-bold text-[var(--color-text)]">{item.nama}</td>
                               <td className="px-4 py-2 text-center font-bold text-[var(--color-primary)]">{item.total}</td>
                               <td className="px-4 py-2 text-center text-emerald-600 font-bold">{item.terverifikasi > 0 ? item.terverifikasi : "-"}</td>
                               <td className="px-4 py-2 text-center text-amber-500 font-bold">{item.belum > 0 ? item.belum : "-"}</td>
                               <td className="px-4 py-2 text-center text-red-500 font-bold">{item.berhalangan > 0 ? item.berhalangan : "-"}</td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
             </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-600"></div>
          </div>
        ) : groupedData.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center">
            <FileText className="h-10 w-10 text-[var(--color-text-subtle)] mb-4" />
            <p className="text-base font-bold text-[var(--color-text)]">Tidak ada data kehadiran</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-2">Belum ada absen pengajar pada periode yang dipilih.</p>
          </div>
        ) : (
          <div className="p-4 sm:p-6 bg-[var(--color-surface-light)] space-y-6">
            {groupedData.map((group) => (
              <div key={group.tanggal} className="bg-white border border-[var(--color-surface-dark)] rounded-2xl overflow-hidden shadow-sm">
                {/* Date Header */}
                <div className="bg-violet-50/50 p-4 border-b border-[var(--color-surface-dark)] flex items-center gap-3">
                  <div className="h-10 w-10 bg-violet-100 text-violet-700 rounded-xl flex items-center justify-center">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[var(--color-text)]">
                      {format(new Date(group.tanggal), "EEEE, d MMMM yyyy", { locale: id })}
                    </h4>
                    <p className="text-xs font-semibold text-[var(--color-text-muted)]">{group.records.length} Sesi Mengajar</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-[var(--color-secondary)] border-b border-[var(--color-surface-dark)]">
                      <tr>
                        <th className="px-4 py-3 font-bold text-[var(--color-text-muted)] text-xs uppercase tracking-wider">Pengajar</th>
                        <th className="px-4 py-3 font-bold text-[var(--color-text-muted)] text-xs uppercase tracking-wider">Sesi</th>
                        <th className="px-4 py-3 font-bold text-[var(--color-text-muted)] text-xs uppercase tracking-wider">Kelas</th>
                        <th className="px-4 py-3 font-bold text-[var(--color-text-muted)] text-xs uppercase tracking-wider">Materi</th>
                        <th className="px-4 py-3 font-bold text-[var(--color-text-muted)] text-xs uppercase tracking-wider text-center">Waktu</th>
                        <th className="px-4 py-3 font-bold text-[var(--color-text-muted)] text-xs uppercase tracking-wider text-center">Atribut</th>
                        <th className="px-4 py-3 font-bold text-[var(--color-text-muted)] text-xs uppercase tracking-wider text-center">Verifikasi</th>
                        {isAdmin && <th className="px-4 py-3 font-bold text-[var(--color-text-muted)] text-xs uppercase tracking-wider text-center w-20">Aksi</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-surface)]">
                      {group.records.map((r) => (
                        <tr key={r.id} className={`hover:bg-[var(--color-surface-light)] ${isAdmin ? 'cursor-pointer' : ''}`} onClick={() => { if (isAdmin) openEditModal(r); }}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 bg-violet-100 text-violet-700 rounded-lg flex items-center justify-center">
                                <User className="h-3.5 w-3.5" />
                              </div>
                              <span className="font-bold text-[var(--color-text)]">{r.pengajar}</span>
                            </div>
                            {r.isBadal && (
                              <div className="mt-1 ml-9">
                                <span className="inline-flex items-center rounded-md bg-[var(--color-warning-light)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-warning)]">BADAL</span>
                                {r.pengajarDigantikan && <span className="ml-1 text-[10px] text-[var(--color-text-muted)] font-medium">menggantikan {r.pengajarDigantikan}</span>}
                              </div>
                            )}
                            {r.isAsisten && (
                              <div className="mt-1 ml-9">
                                <span className="inline-flex items-center rounded-md bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-600 border border-teal-200">ASISTEN</span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center rounded-lg bg-[var(--color-surface)] px-2.5 py-1 text-xs font-bold text-[var(--color-text-muted)]">
                              {r.sesi.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-[var(--color-primary)]">{r.kelas}</td>
                          <td className="px-4 py-3 max-w-[200px] truncate" title={r.materi}>
                            {r.status === "ALPHA" ? (
                              <span className="text-[var(--color-text-muted)] font-medium px-2 py-1">-</span>
                            ) : (
                              r.materi
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {r.status === "ALPHA" ? (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[var(--color-text-muted)] text-xs font-bold font-mono">
                                -
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--color-surface)] text-[var(--color-text-muted)] text-xs font-bold font-mono">
                                <Clock className="w-3.5 h-3.5" />
                                {r.waktuMulai} - {r.waktuSelesai}
                                {r.terlambatMenit ? (
                                  <span className="ml-1 text-red-500 font-bold text-[10px]">(-{r.terlambatMenit}m)</span>
                                ) : null}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {r.status === "ALPHA" ? (
                               <span className="text-[var(--color-text-muted)] font-bold text-lg">-</span>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                {r.atribut.kopiah ? <span className="bg-[var(--color-primary-100)] text-[var(--color-primary)] text-[10px] font-bold px-1.5 py-0.5 rounded">Kopiah ✓</span> : <span className="bg-[var(--color-danger-light)] text-[var(--color-danger)] text-[10px] font-bold px-1.5 py-0.5 rounded">Kopiah X</span>}
                                {r.atribut.nametag ? <span className="bg-[var(--color-primary-100)] text-[var(--color-primary)] text-[10px] font-bold px-1.5 py-0.5 rounded">Tag ✓</span> : <span className="bg-[var(--color-danger-light)] text-[var(--color-danger)] text-[10px] font-bold px-1.5 py-0.5 rounded">Tag X</span>}
                                {r.atribut.bros ? <span className="bg-[var(--color-primary-100)] text-[var(--color-primary)] text-[10px] font-bold px-1.5 py-0.5 rounded">Bros ✓</span> : <span className="bg-[var(--color-danger-light)] text-[var(--color-danger)] text-[10px] font-bold px-1.5 py-0.5 rounded">Bros X</span>}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {r.status === "ALPHA" || !r.beritaAcaraAktif ? (
                               <span className="text-[var(--color-text-muted)] font-bold text-lg">-</span>
                            ) : (
                               r.beritaAcara ? (
                                  r.beritaAcara.konfirmasiHadir ? (
                                     <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200" title={r.beritaAcara.catatan || ""}>
                                        TERVERIFIKASI
                                     </span>
                                  ) : (
                                     <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-600 border border-red-200" title={r.beritaAcara.catatan || ""}>
                                        TDK HADIR
                                     </span>
                                  )
                               ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                     MENUNGGU
                                  </span>
                               )
                            )}
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => openEditModal(r)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition" title="Edit"><Edit3 size={14} /></button>
                                {r.status !== "ALPHA" && !r.id.startsWith("alpha_") && (
                                  <button onClick={() => handleDeleteRecord(r)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition" title="Hapus"><Trash2 size={14} /></button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setEditingRecord(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg text-[var(--color-text)]">Edit Absen Pengajar</h2>
              <button onClick={() => setEditingRecord(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition"><X size={20} /></button>
            </div>
            <div className="text-sm space-y-1 bg-[var(--color-surface-light)] rounded-xl p-3 border border-[var(--color-surface-dark)]">
              <p><span className="font-bold">Pengajar Asli:</span> {editingRecord.pengajar}</p>
              <p><span className="font-bold">Kelas:</span> {editingRecord.kelas} &middot; {editingRecord.sesi.replace('_', ' ')}</p>
              <p><span className="font-bold">Tanggal:</span> {editingRecord.tanggal}</p>
            </div>
            
            {editingRecord.id.startsWith("alpha_") && (
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                <label className="flex items-center gap-2 text-sm font-bold text-amber-900 cursor-pointer">
                  <input type="checkbox" checked={editForm.isBadal} onChange={e => setEditForm(f => ({...f, isBadal: e.target.checked}))} className="rounded border-amber-300 text-amber-600 focus:ring-amber-500" />
                  Gunakan Pengajar Badal
                </label>
                {editForm.isBadal && (
                  <div className="mt-3">
                    <label className="text-xs font-bold text-amber-800 uppercase tracking-wider block mb-1">Pilih Pengajar Badal</label>
                    <select value={editForm.pengajarBadalId} onChange={e => setEditForm(f => ({...f, pengajarBadalId: e.target.value}))} className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-amber-500">
                      <option value="">-- Pilih Pengajar --</option>
                      {pengajarList.map(p => (
                        <option key={p.id} value={p.id}>{p.nama}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Materi</label>
              <input type="text" value={editForm.materi} onChange={e => setEditForm(f => ({ ...f, materi: e.target.value }))} className="w-full border border-[var(--color-surface-dark)] rounded-xl px-3 py-2 text-sm mt-1 outline-none focus:border-violet-500" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Waktu Mulai</label>
                <input type="text" maxLength={5} placeholder="08:00" value={editForm.waktuMulai} onChange={e => { let v = e.target.value.replace(/[^0-9:]/g,''); if (v.length===2 && !v.includes(':') && v.length > editForm.waktuMulai.length) v+=':'; setEditForm(f => ({...f, waktuMulai: v})); }} className="w-full border border-[var(--color-surface-dark)] rounded-xl px-3 py-2 text-sm mt-1 outline-none focus:border-violet-500 font-mono" />
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Waktu Selesai</label>
                <input type="text" maxLength={5} placeholder="09:30" value={editForm.waktuSelesai} onChange={e => { let v = e.target.value.replace(/[^0-9:]/g,''); if (v.length===2 && !v.includes(':') && v.length > editForm.waktuSelesai.length) v+=':'; setEditForm(f => ({...f, waktuSelesai: v})); }} className="w-full border border-[var(--color-surface-dark)] rounded-xl px-3 py-2 text-sm mt-1 outline-none focus:border-violet-500 font-mono" />
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Telat (Mnt)</label>
                <input type="number" placeholder="0" value={editForm.terlambatMenit} onChange={e => setEditForm(f => ({...f, terlambatMenit: parseInt(e.target.value) || 0}))} className="w-full border border-[var(--color-surface-dark)] rounded-xl px-3 py-2 text-sm mt-1 outline-none focus:border-violet-500 font-mono" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 block">Atribut</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer"><input type="checkbox" checked={editForm.kopiah} onChange={e => setEditForm(f => ({...f, kopiah: e.target.checked}))} className="rounded" /> Kopiah</label>
                <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer"><input type="checkbox" checked={editForm.nametag} onChange={e => setEditForm(f => ({...f, nametag: e.target.checked}))} className="rounded" /> Nametag</label>
                <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer"><input type="checkbox" checked={editForm.bros} onChange={e => setEditForm(f => ({...f, bros: e.target.checked}))} className="rounded" /> Bros</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-surface)]">
              <button onClick={() => setEditingRecord(null)} className="px-4 py-2 text-sm font-bold rounded-xl border border-[var(--color-surface-dark)] hover:bg-[var(--color-surface-light)] transition">Batal</button>
              <button onClick={handleSaveEdit} disabled={isSavingEdit} className="px-4 py-2 text-sm font-bold rounded-xl bg-violet-600 text-white hover:bg-violet-700 transition disabled:opacity-50 flex items-center gap-2">
                <Save size={14} /> {isSavingEdit ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
