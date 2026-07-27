"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { ChevronLeft, FileText, ChevronDown, ChevronRight, Search, Copy, ClipboardCheck, AlertTriangle, Send, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { StackedProgressBar } from "@/components/admin/stacked-progress-bar";

type SantriDetail = {
  id: string;
  riwayatId: string;
  namaSantri: string;
  sakan: string;
  kelas: string;
  sesi?: string | null;
  kategoriId?: string | null;
  kegiatanNama?: string | null;
  status: "HADIR" | "IZIN" | "SAKIT" | "ALPHA";
  keterangan: string;
  tanggal: string; // YYYY-MM-DD
  usbu: string;
  isLibur?: boolean;
};

type EditingCell = {
  riwayatId: string;
  namaSantri: string;
  tanggal: string;
  sesi?: string;
  kategoriId?: string;
  currentStatus?: "HADIR" | "IZIN" | "SAKIT" | "ALPHA";
  keterangan: string;
};

const STATUS_CONFIG = [
  { key: "HADIR", label: "Hadir", color: "#10b981", light: "bg-[var(--color-primary-50)] text-[var(--color-primary)] border-[var(--color-primary-100)]" },
  { key: "IZIN", label: "Izin", color: "#6366f1", light: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { key: "SAKIT", label: "Sakit", color: "#f59e0b", light: "bg-[var(--color-warning-light)] text-[var(--color-warning)] border-[var(--color-warning)]" },
  { key: "ALPHA", label: "Alpha", color: "#f43f5e", light: "bg-[var(--color-danger-light)] text-[var(--color-danger)] border-[var(--color-danger)]" },
];

export function AbsensiRekapDetailClient({ allowedKelasId }: { allowedKelasId?: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const type = searchParams.get("type");
  const kategoriId = searchParams.get("kategoriId");
  const dari = searchParams.get("dari");
  const sampai = searchParams.get("sampai");
  const title = searchParams.get("title") || "Rincian Absen";

  const [data, setData] = useState<SantriDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  
  // Inline edit state
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [isSavingCell, setIsSavingCell] = useState(false);

  useEffect(() => {
    if (!type || !dari || !sampai) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ type, dari, sampai });
        if (kategoriId) params.append("kategoriId", kategoriId);
        if (allowedKelasId) params.append("kelasId", allowedKelasId);

        const res = await fetch(`/api/admin/absensi/rekap/detail?${params}`);
        const result = await res.json();
        if (Array.isArray(result)) {
          setData(result);
        } else {
          setData([]);
        }
      } catch (e) {
        console.error("Gagal memuat detail absensi", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [type, kategoriId, dari, sampai]);

  // Aggregate stats
  const stats = useMemo(() => {
    const counts = { HADIR: 0, IZIN: 0, SAKIT: 0, ALPHA: 0 };
    data.forEach((r) => {
      if (!r.isLibur) {
        if (r.status in counts) counts[r.status as keyof typeof counts]++;
      }
    });

    const total = counts.HADIR + counts.IZIN + counts.SAKIT + counts.ALPHA;

    const barData = [
      { name: "Hadir", total: counts.HADIR },
      { name: "Izin", total: counts.IZIN },
      { name: "Sakit", total: counts.SAKIT },
      { name: "Alpha", total: counts.ALPHA },
    ];

    return { counts, total, barData };
  }, [data]);

  // --- Santri dengan ketidakhadiran >= 12 (untuk type=kelas) ---
  const santriSP = useMemo(() => {
    if (type !== "kelas") return [];
    const map = new Map<string, { nama: string; kelas: string; total: number }>();
    data.forEach((r) => {
      if (!r.isLibur && r.status !== "HADIR") {
        const key = r.namaSantri;
        if (!map.has(key)) map.set(key, { nama: r.namaSantri, kelas: r.kelas, total: 0 });
        map.get(key)!.total++;
      }
    });
    return Array.from(map.values()).filter((s) => s.total >= 12).sort((a, b) => a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama));
  }, [data, type]);

  // Group by Kelas/Sakan
  const groupedData = useMemo(() => {
    const filteredData = data.filter(d =>
      d.namaSantri.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.kelas.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const groups: Record<string, typeof filteredData> = {};
    filteredData.forEach(d => {
      const g = type === "kelas" ? d.kelas : d.sakan;
      const key = g || "Tidak Diketahui";
      if (!groups[key]) groups[key] = [];
      groups[key].push(d);
    });

    // Sort groups alphabetically
    const keys = Object.keys(groups).sort();
    return keys.map(k => ({
      groupName: k,
      records: groups[k]
    }));
  }, [data, searchQuery, type]);

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    groupedData.forEach(g => {
      next[g.groupName] = true;
    });
    setExpandedGroups(next);
  }

  const collapseAll = () => setExpandedGroups({});

  // --- Inline Edit Logic ---
  const handleInlineSave = async (newStatus: "HADIR" | "IZIN" | "SAKIT" | "ALPHA" | "KOSONG") => {
    if (!editingCell) return;
    setIsSavingCell(true);
    const toastId = toast.loading("Updating status...");
    
    try {
      let endpoint = "";
      let payload: any = {
        tanggal: editingCell.tanggal,
        absenList: [{
          riwayatId: editingCell.riwayatId,
          status: newStatus,
          keterangan: editingCell.keterangan || ""
        }]
      };

      if (type === "kelas") {
        endpoint = "/api/admin/absensi/kelas";
        payload.sesi = editingCell.sesi;
      } else if (type === "kegiatan") {
        endpoint = "/api/admin/absensi/kegiatan-harian";
        payload.kategoriId = editingCell.kategoriId;
      } else if (type === "sakan") {
        endpoint = "/api/admin/absensi/sakan";
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!result.success) throw new Error(result.error || "Gagal update");

      // Update local state directly so UI updates without reload
      setData(prev => {
        let newData = [...prev];
        const idx = newData.findIndex(d => 
          d.riwayatId === editingCell.riwayatId && 
          d.tanggal === editingCell.tanggal && 
          (type === "kelas" ? d.sesi === editingCell.sesi : 
           type === "kegiatan" ? d.kategoriId === editingCell.kategoriId : true)
        );

        if (newStatus === "KOSONG") {
          if (idx !== -1) newData.splice(idx, 1);
        } else {
          if (idx !== -1) {
            newData[idx].status = newStatus;
          } else {
            // Need to fake a SantriDetail record because they were NULL previously
            // This is slightly tricky, we reload the whole page if adding a new record from empty to be safe
            // For now, let's just do a quick reload or construct mock if missing
            window.location.reload(); 
            return prev;
          }
        }
        return newData;
      });

      toast.success("Tersimpan!", { id: toastId });
      setEditingCell(null);
    } catch(err: any) {
      toast.error(err.message, { id: toastId });
    } finally {
      setIsSavingCell(false);
    }
  };

  // --- Clipboard State ---
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyToClipboard = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    });
  }, []);

  // --- Generate Laporan Pemanggilan (type=kegiatan) ---
  const generateLaporanPemanggilan = useCallback(() => {
    const alphaRecords = data.filter((r) => !r.isLibur && r.status === "ALPHA");
    if (alphaRecords.length === 0) return "";
    const header = `يرجي  من الأسماء المكتوبة أدناه الاتجاه إلى الرواق التنفيذي في قسم الأمن والانضباط بعد الدراسة\n\nDiharapkan semua nama-nama yang tertulis dibawah ini, untuk menghadap ke ruang pengurus dibagian keamanan dan kedisiplinan setelah pembelajaran\n`;
    const names = alphaRecords.map((r, i) => `${i + 1}. ${r.namaSantri} - ${r.sakan}`).join("\n");
    const footer = `\nسأنتظركم حتى الساعة الواحدة\nSaya tunggu sampai jam dari jam 11.45- 13.00\n\nNB : *tanda 1x menandakan tidak hadir pemanggilan 1x,tanda 2x menandakan tidak hadir pemanggilan 2x, tanda 3x tidak hadir pemanggilan 3x dan jika sudah sampai 3x maka akan berlaku SP 1 ,tambahan bagi yang telat ataupun tidak hadir*`;
    return `${header}\n${names}\n${footer}`;
  }, [data]);

  const sendWaLaporanMingguan = async () => {
    if (!dari || !sampai) return;
    const loaders = toast.loading("Mengirim Laporan WA...");
    try {
      const params = new URLSearchParams({ dari, sampai });
      const res = await fetch(`/api/cron/wa-rekap-santri?${params}`);
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal mengirim");
      
      if (result.success) {
        toast.success(result.message, { id: loaders });
      } else {
        toast.error(result.message || "Gagal mengirim pesan", { id: loaders });
      }
    } catch (err: any) {
      toast.error(err.message, { id: loaders });
    }
  };

  // --- Generate Rekap Alfa Mingguan (type=kelas) ---
  const generateRekapAlfaMingguan = useCallback(() => {
    const alphaRecords = data.filter((r) => !r.isLibur && r.status === "ALPHA");
    if (alphaRecords.length === 0) return "";
    
    // Tentukan usbu label dari data
    const usbuLabels = Array.from(new Set(data.map(r => r.usbu)));
    const rawTitle = usbuLabels.length === 1 ? usbuLabels[0] : usbuLabels.join(" & ");
    
    let usbuTitle = rawTitle.toUpperCase();
    if (rawTitle.toLowerCase().includes("usbu")) {
      const num = rawTitle.replace(/\D/g, "");
      usbuTitle = `PEKAN KE-${num}`;
    } else if (rawTitle.toLowerCase() === "nihai") {
      usbuTitle = "PEKAN NIHAI";
    }
    
    let result = `REKAP ALPA ${usbuTitle}\n`;

    // Group alpha by kelas
    const byKelas: Record<string, typeof alphaRecords> = {};
    alphaRecords.forEach((r) => {
      if (!byKelas[r.kelas]) byKelas[r.kelas] = [];
      byKelas[r.kelas].push(r);
    });

    Object.keys(byKelas).sort().forEach((kelas) => {
      result += ` ${kelas.toUpperCase()}\n`;
      // Group by tanggal
      const byTanggal: Record<string, typeof alphaRecords> = {};
      byKelas[kelas].forEach((r) => {
        if (!byTanggal[r.tanggal]) byTanggal[r.tanggal] = [];
        byTanggal[r.tanggal].push(r);
      });
      Object.keys(byTanggal).sort().forEach((tgl) => {
        const dateFormatted = format(new Date(tgl), "EEEE, dd MMMM yyyy", { locale: id });
        result += `📚${dateFormatted}\n`;
        
        // Group by namaSantri to combine sessions
        const bySantri: Record<string, string[]> = {};
        byTanggal[tgl].forEach((r) => {
          if (!bySantri[r.namaSantri]) bySantri[r.namaSantri] = [];
          if (r.sesi) bySantri[r.namaSantri].push(r.sesi);
        });

        Object.keys(bySantri).sort().forEach((nama) => {
          const sessions = Array.from(new Set(bySantri[nama]));
          if (sessions.length > 0) {
            const nums = sessions
              .map(s => parseInt(s.replace("SESI_", "")))
              .filter(n => !isNaN(n))
              .sort((a, b) => a - b);
            
            let sesiStr = "";
            if (nums.length > 0) {
              let res = [];
              let start = nums[0];
              let end = nums[0];
              for (let i = 1; i < nums.length; i++) {
                if (nums[i] === end + 1) {
                  end = nums[i];
                } else {
                  res.push(start === end ? `${start}` : `${start}-${end}`);
                  start = nums[i];
                  end = nums[i];
                }
              }
              res.push(start === end ? `${start}` : `${start}-${end}`);
              sesiStr = res.join(", ");
            }
            result += `* ${nama}, sesi ${sesiStr}\n`;
          } else {
            result += `* ${nama}\n`;
          }
        });
        result += "\n";
      });
    });
    return result.trim();
  }, [data]);

  // --- Generate Laporan SP (type=kelas, santri >= 12x) ---
  const generateLaporanSP = useCallback(() => {
    if (santriSP.length === 0) return "";
    let result = `*DATA TOTAL KETIDAKHADIRAN 12 / LEBIH*\n`;
    const byKelas: Record<string, typeof santriSP> = {};
    santriSP.forEach((s) => {
      if (!byKelas[s.kelas]) byKelas[s.kelas] = [];
      byKelas[s.kelas].push(s);
    });
    Object.keys(byKelas).sort().forEach((kelas) => {
      result += `\n*${kelas.toUpperCase()}*\n`;
      byKelas[kelas].forEach((s, i) => {
        result += `${i + 1}. ${s.nama} ${s.total}\n`;
      });
    });
    return result.trim();
  }, [santriSP]);

  if (!type || !dari || !sampai) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-[var(--color-surface-dark)]">
        <p className="font-bold text-[var(--color-text)]">Parameter tidak lengkap</p>
        <button onClick={() => router.back()} className="mt-4 text-violet-600 font-bold">Kembali</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header Navigation */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-3xl border border-[var(--color-surface-dark)] shadow-sm">
        <button
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-surface)] hover:bg-[var(--color-surface-dark)] text-[var(--color-text-muted)] transition"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-[var(--color-text)]">{title}</h2>
          <p className="text-xs font-semibold text-[var(--color-text-muted)]">
            {dari} <span className="mx-1 font-normal text-[var(--color-text-subtle)]">s/d</span> {sampai}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-600"></div>
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 text-center bg-white rounded-3xl border border-[var(--color-surface-dark)] border-dashed">
          <FileText className="h-10 w-10 text-[var(--color-text-subtle)] mb-4" />
          <p className="text-base font-bold text-[var(--color-text)]">Tidak ada data kehadiran</p>
          <p className="text-sm text-[var(--color-text-muted)] mt-2">Belum ada absen pada periode yang dipilih.</p>
        </div>
      ) : (
        <>
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar Chart Card */}
            <div className="p-6 neu-card-white">
              <h3 className="text-sm font-bold text-[var(--color-text)] mb-6">Distribusi Kehadiran</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.barData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip
                      cursor={{ fill: '#f1f5f9' }}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={50}>
                      {stats.barData.map((entry, index) => {
                        const color = STATUS_CONFIG.find(c => c.label === entry.name)?.color || "#cbd5e1";
                        return <Cell key={`cell-${index}`} fill={color} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Summary Card + Stacked Bar */}
            <div className="p-6 neu-card-white">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {STATUS_CONFIG.map((s) => {
                  const val = stats.counts[s.key as keyof typeof stats.counts];
                  return (
                    <div key={s.key} className="rounded-2xl border border-[var(--color-surface)] p-4 text-center bg-[var(--color-surface-light)]">
                      <p className="text-2xl font-black text-[var(--color-text)]">{val.toLocaleString("id-ID")}</p>
                      <div className="flex items-center justify-center gap-1.5 mt-1">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="text-xs font-bold text-[var(--color-text-muted)]">{s.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <StackedProgressBar
                hadir={stats.counts.HADIR}
                izin={stats.counts.IZIN}
                sakit={stats.counts.SAKIT}
                alpha={stats.counts.ALPHA}
                height="h-4"
              />
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs font-semibold text-[var(--color-text-subtle)]">Total: {stats.total.toLocaleString("id-ID")} catatan</p>
                <p className="text-sm font-black text-[var(--color-primary)]">
                  {stats.total > 0 ? Math.round((stats.counts.HADIR / stats.total) * 100) : 0}% Hadir
                </p>
              </div>
            </div>
          </div>

          {/* === AKSI CEPAT: COPY BUTTONS === */}
          {type === "kegiatan" && stats.counts.ALPHA > 0 && (
            <div className="rounded-[var(--radius-2xl)] border border-[var(--color-warning)] bg-[var(--color-warning-light)] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-[var(--color-warning)] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-[var(--color-warning)]">
                    {stats.counts.ALPHA} santri tercatat Alfa pada kegiatan ini
                  </p>
                  <p className="text-xs text-[var(--color-warning)] font-medium mt-0.5">
                    Salin laporan pemanggilan untuk dikirim ke grup WhatsApp
                  </p>
                </div>
              </div>
              <button
                onClick={() => copyToClipboard(generateLaporanPemanggilan(), "pemanggilan")}
                className="flex items-center gap-2 rounded-xl bg-[var(--color-warning)] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--color-warning)] shrink-0"
              >
                {copiedKey === "pemanggilan" ? <ClipboardCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiedKey === "pemanggilan" ? "Tersalin!" : "📋 Salin Laporan Pemanggilan"}
              </button>
            </div>
          )}

          {type === "kelas" && (
            <div className="space-y-4">
              {/* Tombol Copy Rekap Alfa Mingguan */}
              {stats.counts.ALPHA > 0 && (
                <div className="rounded-[var(--radius-2xl)] border border-violet-200 bg-violet-50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-violet-800">📋 Rekap Alfa Mingguan</p>
                    <p className="text-xs text-violet-600 font-medium mt-0.5">
                      Salin daftar santri yang alfa per kelas per hari (format WhatsApp)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={sendWaLaporanMingguan}
                      className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 shrink-0"
                      title="Kirim ke +62 821-3228-9500"
                    >
                      <Send className="h-4 w-4" />
                      Kirim WA Laporan
                    </button>
                    <button
                      onClick={() => copyToClipboard(generateRekapAlfaMingguan(), "alfaMingguan")}
                      className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-violet-700 shrink-0"
                    >
                      {copiedKey === "alfaMingguan" ? <ClipboardCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copiedKey === "alfaMingguan" ? "Tersalin!" : "Salin Rekap Alfa"}
                    </button>
                  </div>
                </div>
              )}

              {/* Panel Santri SP (>= 12x ketidakhadiran) */}
              {santriSP.length > 0 && (
                <div className="rounded-[var(--radius-2xl)] border border-[var(--color-danger)] bg-[var(--color-danger-light)] p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-[var(--color-danger)] shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-rose-800">
                          🚨 {santriSP.length} Santri dengan Ketidakhadiran ≥ 12 Kali
                        </p>
                        <p className="text-xs text-[var(--color-danger)] font-medium mt-0.5">
                          Salin data ini untuk proses Surat Peringatan (SP)
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => copyToClipboard(generateLaporanSP(), "sp")}
                      className="flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-rose-700 shrink-0"
                    >
                      {copiedKey === "sp" ? <ClipboardCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copiedKey === "sp" ? "Tersalin!" : "🚨 Salin Data SP"}
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {santriSP.map((s) => (
                      <div key={s.nama} className="flex items-center justify-between bg-white rounded-xl border border-[var(--color-danger-light)] px-3 py-2">
                        <div>
                          <p className="text-sm font-bold text-[var(--color-text)]">{s.nama}</p>
                          <p className="text-[11px] font-semibold text-[var(--color-text-muted)]">{s.kelas}</p>
                        </div>
                        <span className="text-lg font-black text-[var(--color-danger)]">{s.total}×</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Grouped Data Wrapper */}
          <div className="neu-card-white overflow-hidden flex flex-col">
            <div className="p-6 border-b border-[var(--color-surface)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-[var(--color-text)]">Data Terperinci</h3>
                <p className="text-xs text-[var(--color-text-muted)] font-medium">
                  {type === "kelas" ? "Berdasarkan Kelas" : "Berdasarkan Sakan / Lokasi"}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-subtle)]" />
                  <input
                    type="text"
                    placeholder="Cari santri..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 text-sm bg-[var(--color-secondary)] border border-[var(--color-surface-dark)] rounded-xl outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all font-semibold"
                  />
                </div>

                {/* Expand / Collapse Controls */}
                <div className="hidden sm:flex bg-[var(--color-surface)] p-1 rounded-xl">
                  <button onClick={expandAll} className="px-3 py-1.5 text-xs font-bold text-[var(--color-text-muted)] hover:bg-white hover:shadow-sm rounded-lg transition">Buka Semua</button>
                  <button onClick={collapseAll} className="px-3 py-1.5 text-xs font-bold text-[var(--color-text-muted)] hover:bg-white hover:shadow-sm rounded-lg transition">Tutup</button>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6 bg-[var(--color-surface-light)] space-y-4">
              {groupedData.length === 0 ? (
                <p className="text-center font-semibold text-[var(--color-text-subtle)] py-10">Pencarian tidak ditemukan</p>
              ) : (
                groupedData.map((group) => {
                  const isExpanded = !!expandedGroups[group.groupName];

                  // Compute stats per group
                  const gCounts = { HADIR: 0, IZIN: 0, SAKIT: 0, ALPHA: 0 };
                  group.records.forEach(r => {
                    const k = r.status as keyof typeof gCounts;
                    if (k in gCounts) gCounts[k]++;
                  });
                  const gTotal = group.records.length;
                  const gHadirPct = gTotal > 0 ? Math.round((gCounts.HADIR / gTotal) * 100) : 0;

                  return (
                    <div key={group.groupName} className="bg-white border border-[var(--color-surface-dark)] rounded-2xl overflow-hidden transition-all shadow-sm">
                      {/* Accordion Header */}
                      <button
                        onClick={() => toggleGroup(group.groupName)}
                        className="w-full flex items-center justify-between p-4 hover:bg-[var(--color-secondary)] transition text-left"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700 transition-transform ${isExpanded ? "rotate-90" : ""}`}>
                            <ChevronRight className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="font-bold text-[var(--color-text)] text-base">{group.groupName}</h4>
                            <div className="flex items-center gap-3 mt-1 text-xs text-[var(--color-text-muted)] font-semibold">
                              <span>{gTotal} Siswa</span>
                              <span className="w-1 h-1 rounded-full bg-slate-300" />
                              <span className="text-[var(--color-primary)]">{gHadirPct}% Hadir</span>
                            </div>
                          </div>
                        </div>

                        {/* Visual stacked bar di sebelah kanan header */}
                        <div className="hidden md:block w-40 lg:w-56">
                          <StackedProgressBar
                            hadir={gCounts.HADIR}
                            izin={gCounts.IZIN}
                            sakit={gCounts.SAKIT}
                            alpha={gCounts.ALPHA}
                            showLabels={false}
                            height="h-2"
                          />
                        </div>
                      </button>

                      {/* Accordion Body */}
                      {isExpanded && (
                        <div className="border-t border-[var(--color-surface)] bg-[var(--color-surface-light)] p-4 flow-root overflow-hidden">
                          {type === "kelas" ? (
                            // MATRIX RENDERER
                            (() => {
                              const datesInClass = Array.from(new Set(group.records.map(r => r.tanggal))).sort();
                              const santris = Array.from(new Set(group.records.map(r => r.namaSantri))).sort();
                              
                              // Deteksi sesi yang ada di data grup ini (bukan hardcode)
                              const sesiSet = new Set(group.records.map(r => r.sesi).filter(Boolean) as string[]);
                              const sessionKeys = Array.from(sesiSet).sort((a, b) => {
                                const numA = parseInt(a.replace("SESI_", ""));
                                const numB = parseInt(b.replace("SESI_", ""));
                                return numA - numB;
                              });

                              // Group dates by Usbu
                              const weeksMap = new Map<string, string[]>();
                              datesInClass.forEach(date => {
                                const sampleRecord = group.records.find(r => r.tanggal === date);
                                const wk = sampleRecord ? sampleRecord.usbu : "Usbu'";
                                if (!weeksMap.has(wk)) weeksMap.set(wk, []);
                                weeksMap.get(wk)!.push(date);
                              });
                              const weeks = Array.from(weeksMap.entries()).map(([wk, dts]) => ({ wk, dates: dts }));

                              const recordMap = new Map();
                              group.records.forEach(r => recordMap.set(`${r.namaSantri}_${r.tanggal}_${r.sesi}`, r));

                              return (
                                <div className="overflow-x-auto w-full rounded-xl border border-[var(--color-surface-dark)] bg-white shadow-sm relative">
                                  <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
                                    <thead className="bg-[var(--color-secondary)]">
                                      <tr>
                                        <th rowSpan={2} className="px-4 py-3 border-b border-r-2 border-[var(--color-surface-dark)] font-bold text-[var(--color-text)] sticky left-0 bg-[var(--color-secondary)] z-20 min-w-[120px] max-w-[120px] md:min-w-[200px] md:max-w-none">NAMA SANTRI</th>
                                        {weeks.map((week, wIdx) => (
                                          <React.Fragment key={`wh1-${week.wk}`}>
                                            {week.dates.map(date => (
                                              <th key={`dh1-${date}`} colSpan={sessionKeys.length + 1} className="px-4 py-2 text-center border-b border-r-2 border-[var(--color-surface-dark)] font-bold text-[var(--color-text)]">
                                                {format(new Date(date), "EEEE, d MMM yyyy", { locale: id })}
                                              </th>
                                            ))}
                                            <th key={`wh1-sum-${week.wk}`} colSpan={4} className="px-4 py-2 text-center border-b border-r-4 border-slate-400 font-bold text-[var(--color-text)] bg-[var(--color-surface)]">
                                              {week.wk}
                                            </th>
                                          </React.Fragment>
                                        ))}
                                        <th colSpan={4} className="px-4 py-2 text-center border-b border-l-4 border-slate-400 font-black text-[var(--color-text)] bg-[var(--color-primary-50)]">
                                          TOTAL
                                        </th>
                                      </tr>
                                      <tr>
                                        {weeks.map((week) => (
                                          <React.Fragment key={`wh2-${week.wk}`}>
                                            {week.dates.map(date => (
                                              <React.Fragment key={`dh2-${date}`}>
                                                {sessionKeys.map((s, i) => (
                                                  <th key={`${date}-${s}`} className="px-2 py-2 text-center border-b border-r border-[var(--color-surface-dark)] text-xs font-semibold text-[var(--color-text-muted)] min-w-[32px]">
                                                    {parseInt(s.replace("SESI_", ""))}
                                                  </th>
                                                ))}
                                                <th className="px-2 py-2 text-center border-b border-r-2 border-[var(--color-surface-dark)] text-[10px] font-bold text-[var(--color-text-muted)] bg-[var(--color-surface-light)] min-w-[40px]">
                                                  JML
                                                </th>
                                              </React.Fragment>
                                            ))}
                                            <th className="px-2 py-2 text-center text-xs font-bold text-[var(--color-primary)] bg-[var(--color-surface)] border-b border-r border-[var(--color-surface-dark)]">H</th>
                                            <th className="px-2 py-2 text-center text-xs font-bold text-indigo-600 bg-[var(--color-surface)] border-b border-r border-[var(--color-surface-dark)]">I</th>
                                            <th className="px-2 py-2 text-center text-xs font-bold text-[var(--color-warning)] bg-[var(--color-surface)] border-b border-r border-[var(--color-surface-dark)]">S</th>
                                            <th className="px-2 py-2 text-center text-xs font-bold text-[var(--color-danger)] bg-[var(--color-surface)] border-b border-r-4 border-slate-400">A</th>
                                          </React.Fragment>
                                        ))}
                                        <th className="px-2 py-2 text-center text-xs font-black text-[var(--color-primary)] bg-[var(--color-primary-50)] border-b border-r border-[var(--color-surface-dark)]">H</th>
                                        <th className="px-2 py-2 text-center text-xs font-black text-indigo-700 bg-[var(--color-primary-50)] border-b border-r border-[var(--color-surface-dark)]">I</th>
                                        <th className="px-2 py-2 text-center text-xs font-black text-[var(--color-warning)] bg-[var(--color-primary-50)] border-b border-r border-[var(--color-surface-dark)]">S</th>
                                        <th className="px-2 py-2 text-center text-xs font-black text-[var(--color-danger)] bg-[var(--color-primary-50)] border-b">A</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {santris.map((santri, idx) => {
                                        let totalH = 0, totalI = 0, totalS = 0, totalA = 0;
                                        return (
                                          <tr key={santri} className="hover:bg-[var(--color-surface-light)] group">
                                            <td className="px-4 py-2 text-sm font-semibold text-[var(--color-text)] border-b border-r-2 border-[var(--color-surface-dark)] sticky left-0 bg-white group-hover:bg-[var(--color-secondary)] z-10 min-w-[120px] max-w-[120px] md:min-w-[200px] md:max-w-none truncate">
                                              <span className="text-[var(--color-text-subtle)] mr-2 text-xs w-4 inline-block">{idx + 1}</span>
                                              {santri}
                                            </td>
                                            {weeks.map((week) => {
                                              let weekH = 0, weekI = 0, weekS = 0, weekA = 0;
                                              return (
                                                <React.Fragment key={`row-${santri}-w-${week.wk}`}>
                                                  {week.dates.map(date => {
                                                    let dayH = 0, dayI = 0, dayS = 0, dayA = 0;
                                                    return (
                                                      <React.Fragment key={`row-${santri}-d-${date}`}>
                                                        {sessionKeys.map((sesi) => {
                                                          const rec = recordMap.get(`${santri}_${date}_${sesi}`);
                                                          let cellContent = <span className="text-slate-200">-</span>;
                                                          if (rec) {
                                                            if (rec.isLibur) {
                                                              cellContent = <span className="opacity-70 text-rose-600 text-[10px] font-bold uppercase" title={`Libur: ${rec.status || 'Tidak ada'}`}>LBR</span>;
                                                            } else {
                                                              if (rec.status === "HADIR") { cellContent = <span className="font-bold text-emerald-500">✓</span>; dayH++; weekH++; totalH++; }
                                                              else if (rec.status === "IZIN") { cellContent = <span className="font-bold text-indigo-500">I</span>; dayI++; weekI++; totalI++; }
                                                              else if (rec.status === "SAKIT") { cellContent = <span className="font-bold text-amber-500">S</span>; dayS++; weekS++; totalS++; }
                                                              else if (rec.status === "ALPHA") { cellContent = <span className="font-bold text-[var(--color-danger)]">X</span>; dayA++; weekA++; totalA++; }
                                                            }
                                                          }
                                                            const rId = group.records.find(r => r.namaSantri === santri)?.riwayatId || "";
                                                            return (
                                                              <td key={`${santri}-${date}-${sesi}`} 
                                                                  onClick={() => setEditingCell({ riwayatId: rId, namaSantri: santri, tanggal: date, sesi: sesi, currentStatus: rec?.status, keterangan: rec?.keterangan || "" })}
                                                                  className="px-2 py-2 text-center border-b border-r border-[var(--color-surface-dark)] cursor-pointer hover:bg-slate-100 transition-colors relative group-hover:bg-slate-50"
                                                              >
                                                                {cellContent}
                                                              </td>
                                                            );
                                                        })}
                                                        <td className="px-1 py-1 text-center border-b border-r-2 border-[var(--color-surface-dark)] bg-[var(--color-surface-light)] align-top content-center">
                                                          <div className="flex flex-col gap-[2px] text-[10px] items-center min-w-[28px]">
                                                            {dayH > 0 && <span className="text-[var(--color-primary)] font-bold bg-[var(--color-primary-100)]/50 w-full rounded">H:{dayH}</span>}
                                                            {dayI > 0 && <span className="text-indigo-700 font-bold bg-indigo-100/50 w-full rounded">I:{dayI}</span>}
                                                            {dayS > 0 && <span className="text-[var(--color-warning)] font-bold bg-[var(--color-warning-light)]/50 w-full rounded">S:{dayS}</span>}
                                                            {dayA > 0 && <span className="text-[var(--color-danger)] font-bold bg-[var(--color-danger-light)]/50 w-full rounded">A:{dayA}</span>}
                                                            {dayH === 0 && dayI === 0 && dayS === 0 && dayA === 0 && <span className="text-[var(--color-text-subtle)]">-</span>}
                                                          </div>
                                                        </td>
                                                      </React.Fragment>
                                                    );
                                                  })}
                                                  <td className="px-2 py-2 text-center text-xs font-bold text-[var(--color-primary)] bg-[var(--color-surface)] border-b border-r border-[var(--color-surface-dark)]">{weekH}</td>
                                                  <td className="px-2 py-2 text-center text-xs font-bold text-indigo-700 bg-[var(--color-surface)] border-b border-r border-[var(--color-surface-dark)]">{weekI}</td>
                                                  <td className="px-2 py-2 text-center text-xs font-bold text-[var(--color-warning)] bg-[var(--color-surface)] border-b border-r border-[var(--color-surface-dark)]">{weekS}</td>
                                                  <td className="px-2 py-2 text-center text-xs font-bold text-[var(--color-danger)] bg-[var(--color-surface)] border-b border-r-4 border-slate-400">{weekA}</td>
                                                </React.Fragment>
                                              );
                                            })}
                                            <td className="px-2 py-2 text-center text-sm font-black text-[var(--color-primary-dark)] bg-[var(--color-primary-50)] border-b border-r border-[var(--color-surface-dark)]">{totalH}</td>
                                            <td className="px-2 py-2 text-center text-sm font-black text-indigo-800 bg-[var(--color-primary-50)] border-b border-r border-[var(--color-surface-dark)]">{totalI}</td>
                                            <td className="px-2 py-2 text-center text-sm font-black text-[var(--color-warning)] bg-[var(--color-primary-50)] border-b border-r border-[var(--color-surface-dark)]">{totalS}</td>
                                            <td className="px-2 py-2 text-center text-sm font-black text-rose-800 bg-[var(--color-primary-50)] border-b">{totalA}</td>
                                          </tr>
                                        );
                                      })}
                                      {santris.length === 0 && (
                                        <tr>
                                          <td className="px-4 py-8 text-center text-[var(--color-text-muted)]" colSpan={100}>Tidak ada data yang tersedia</td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              );
                            })()
                          ) : type === "sakan" ? (
                            // MATRIX RENDERER FOR SAKAN
                            (() => {
                              const datesInGroup = Array.from(new Set(group.records.map(r => r.tanggal))).sort();
                              const santris = Array.from(new Set(group.records.map(r => r.namaSantri))).sort();

                              const recordMap = new Map();
                              group.records.forEach(r => recordMap.set(`${r.namaSantri}_${r.tanggal}`, r));

                              return (
                                <div className="overflow-x-auto w-full rounded-xl border border-[var(--color-surface-dark)] bg-white shadow-sm relative">
                                  <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
                                    <thead className="bg-[var(--color-secondary)]">
                                      <tr>
                                        <th rowSpan={2} className="px-4 py-3 border-b border-r-2 border-[var(--color-surface-dark)] font-bold text-[var(--color-text)] sticky left-0 bg-[var(--color-secondary)] z-20 min-w-[120px] max-w-[120px] md:min-w-[200px] md:max-w-none uppercase text-xs tracking-wider">NAMA SANTRI</th>
                                        {datesInGroup.map(date => (
                                          <th key={`dh1-${date}`} rowSpan={2} className="px-1.5 py-2 text-center border-b border-r border-[var(--color-surface-dark)] font-semibold text-[var(--color-text-muted)] min-w-[36px] text-xs">
                                            <div className="flex flex-col items-center">
                                              <span className="text-[10px] text-[var(--color-text-subtle)]">{format(new Date(date), "E", { locale: id })}</span>
                                              <span>{format(new Date(date), "d", { locale: id })}</span>
                                            </div>
                                          </th>
                                        ))}
                                        <th colSpan={4} className="px-3 py-2 text-center border-b border-l-4 border-slate-400 font-black text-[var(--color-text)] bg-[var(--color-primary-50)] text-xs">
                                          TOTAL
                                        </th>
                                      </tr>
                                      <tr>
                                        <th className="px-2 py-1.5 text-center text-xs font-black text-[var(--color-primary)] bg-[var(--color-primary-50)] border-b border-l-4 border-slate-400 border-r border-[var(--color-surface-dark)]">H</th>
                                        <th className="px-2 py-1.5 text-center text-xs font-black text-indigo-700 bg-[var(--color-primary-50)] border-b border-r border-[var(--color-surface-dark)]">I</th>
                                        <th className="px-2 py-1.5 text-center text-xs font-black text-[var(--color-warning)] bg-[var(--color-primary-50)] border-b border-r border-[var(--color-surface-dark)]">S</th>
                                        <th className="px-2 py-1.5 text-center text-xs font-black text-[var(--color-danger)] bg-[var(--color-primary-50)] border-b">A</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {santris.map((santri, idx) => {
                                        let totalH = 0, totalI = 0, totalS = 0, totalA = 0;
                                        return (
                                          <tr key={santri} className="hover:bg-[var(--color-surface-light)] group">
                                            <td className="px-4 py-2 text-[13px] font-semibold text-[var(--color-text)] border-b border-r-2 border-[var(--color-surface-dark)] sticky left-0 bg-white group-hover:bg-[var(--color-secondary)] z-10 transition-colors min-w-[120px] max-w-[120px] md:min-w-[200px] md:max-w-none truncate">
                                              <span className="text-[var(--color-text-subtle)] mr-2 text-[11px] w-4 inline-block">{idx + 1}</span>
                                              {santri}
                                            </td>
                                            {datesInGroup.map(date => {
                                              const rec = recordMap.get(`${santri}_${date}`);
                                              let cellContent = <span className="text-slate-200 text-xs font-medium">-</span>;
                                              if (rec) {
                                                if (rec.status === "HADIR") { cellContent = <span className="font-bold text-emerald-500 text-base">✓</span>; totalH++; }
                                                else if (rec.status === "IZIN") { cellContent = <span className="font-bold text-indigo-500 text-sm">I</span>; totalI++; }
                                                else if (rec.status === "SAKIT") { cellContent = <span className="font-bold text-amber-500 text-sm">S</span>; totalS++; }
                                                else if (rec.status === "ALPHA") { cellContent = <span className="font-bold text-[var(--color-danger)] text-sm">X</span>; totalA++; }
                                              }
                                              return (
                                                <td key={`${santri}-${date}`} 
                                                    onClick={() => setEditingCell({ riwayatId: rec?.riwayatId || "", namaSantri: santri, tanggal: date, currentStatus: rec?.status, keterangan: rec?.keterangan || "" })}
                                                    className="p-0 border-b border-r border-[var(--color-surface)] align-middle cursor-pointer"
                                                >
                                                  <div className="flex items-center justify-center w-full h-full min-h-[32px] hover:bg-slate-100 transition-colors">
                                                    {cellContent}
                                                  </div>
                                                </td>
                                              );
                                            })}
                                            <td className="px-2 py-2 text-center text-sm font-black text-[var(--color-primary-dark)] bg-[var(--color-primary-50)] border-b border-r border-[var(--color-surface-dark)] border-l-4">{totalH}</td>
                                            <td className="px-2 py-2 text-center text-sm font-black text-indigo-800 bg-[var(--color-primary-50)] border-b border-r border-[var(--color-surface-dark)]">{totalI}</td>
                                            <td className="px-2 py-2 text-center text-sm font-black text-[var(--color-warning)] bg-[var(--color-primary-50)] border-b border-r border-[var(--color-surface-dark)]">{totalS}</td>
                                            <td className="px-2 py-2 text-center text-sm font-black text-rose-800 bg-[var(--color-primary-50)] border-b">{totalA}</td>
                                          </tr>
                                        );
                                      })}
                                      {santris.length === 0 && (
                                        <tr>
                                          <td className="px-4 py-8 text-center text-[var(--color-text-muted)]" colSpan={100}>Tidak ada data yang tersedia</td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              );
                            })()
                          ) : (
                            // MATRIX RENDERER FOR KEGIATAN GLOBAL
                            (() => {
                              const uniqueEvents = Array.from(new Set(group.records.map(r => `${r.tanggal}|${r.kegiatanNama}`)))
                                .map(str => {
                                  const [tgl, keg] = str.split("|");
                                  return { tanggal: tgl, kegName: keg };
                                })
                                .sort((a, b) => a.tanggal.localeCompare(b.tanggal));

                              const santris = Array.from(new Set(group.records.map(r => r.namaSantri))).sort();
                              const recordMap = new Map();
                              group.records.forEach(r => recordMap.set(`${r.namaSantri}_${r.kegiatanNama}_${r.tanggal}`, r));

                              return (
                                <div className="overflow-x-auto w-full rounded-xl border border-[var(--color-surface-dark)] bg-white shadow-sm relative">
                                  <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
                                    <thead className="bg-[var(--color-secondary)]">
                                      <tr>
                                        <th rowSpan={2} className="px-4 py-3 border-b border-r-2 border-[var(--color-surface-dark)] font-bold text-[var(--color-text)] sticky left-0 bg-[var(--color-secondary)] z-20 min-w-[120px] max-w-[120px] md:min-w-[200px] md:max-w-none uppercase text-xs tracking-wider">NAMA SANTRI</th>
                                        {uniqueEvents.map((ev, i) => (
                                          <th key={`keg-${i}`} className="px-1 py-2 text-center border-b border-x border-[var(--color-surface-dark)] font-bold text-[var(--color-text)] bg-[var(--color-warning-light)]/50 text-[10px] leading-tight whitespace-normal break-words max-w-[80px]" title={ev.kegName || ""}>
                                            {ev.kegName || "-"}
                                          </th>
                                        ))}
                                        <th colSpan={4} className="px-3 py-2 text-center border-b border-l-4 border-slate-400 font-black text-[var(--color-text)] bg-[var(--color-primary-50)] text-xs">
                                          TOTAL
                                        </th>
                                      </tr>
                                      <tr>
                                        {uniqueEvents.map((ev, i) => (
                                          <th key={`date-${i}`} className="px-1.5 py-1.5 text-center border-b border-[var(--color-surface-dark)] border-x font-bold text-[var(--color-text-muted)] min-w-[36px] text-xs">
                                            <div className="flex flex-col items-center">
                                              <span className="text-[10px] text-[var(--color-text-subtle)]">{format(new Date(ev.tanggal), "E", { locale: id })}</span>
                                              <span>{format(new Date(ev.tanggal), "d", { locale: id })}</span>
                                            </div>
                                          </th>
                                        ))}
                                        <th className="px-2 py-1.5 text-center text-xs font-black text-[var(--color-primary)] bg-[var(--color-primary-50)] border-b border-r border-[var(--color-surface-dark)]">H</th>
                                        <th className="px-2 py-1.5 text-center text-xs font-black text-indigo-700 bg-[var(--color-primary-50)] border-b border-r border-[var(--color-surface-dark)]">I</th>
                                        <th className="px-2 py-1.5 text-center text-xs font-black text-[var(--color-warning)] bg-[var(--color-primary-50)] border-b border-r border-[var(--color-surface-dark)]">S</th>
                                        <th className="px-2 py-1.5 text-center text-xs font-black text-[var(--color-danger)] bg-[var(--color-primary-50)] border-b">A</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {santris.map((santri, idx) => {
                                        let totalH = 0, totalI = 0, totalS = 0, totalA = 0;
                                        return (
                                          <tr key={santri} className="hover:bg-[var(--color-surface-light)] group">
                                            <td className="px-4 py-2 text-[13px] font-semibold text-[var(--color-text)] border-b border-r-2 border-[var(--color-surface-dark)] sticky left-0 bg-white group-hover:bg-[var(--color-secondary)] z-10 transition-colors min-w-[120px] max-w-[120px] md:min-w-[200px] md:max-w-none truncate">
                                              <span className="text-[var(--color-text-subtle)] mr-2 text-[11px] w-4 inline-block">{idx + 1}</span>
                                              {santri}
                                            </td>
                                            {uniqueEvents.map((ev, i) => {
                                              const rec = recordMap.get(`${santri}_${ev.kegName}_${ev.tanggal}`);
                                              let cellContent = <span className="text-slate-200 text-xs font-medium">-</span>;
                                              if (rec) {
                                                if (rec.status === "HADIR") { cellContent = <span className="font-bold text-emerald-500 text-base">✓</span>; totalH++; }
                                                else if (rec.status === "IZIN") { cellContent = <span className="font-bold text-indigo-500 text-sm">I</span>; totalI++; }
                                                else if (rec.status === "SAKIT") { cellContent = <span className="font-bold text-amber-500 text-sm">S</span>; totalS++; }
                                                else if (rec.status === "ALPHA") { cellContent = <span className="font-bold text-[var(--color-danger)] text-sm">X</span>; totalA++; }
                                              }
                                              return (
                                                <td key={`cell-${i}`} className="p-0 border-b border-x border-[var(--color-surface)] align-middle">
                                                  <div className="flex items-center justify-center w-full h-full min-h-[32px] hover:bg-[var(--color-secondary)]">
                                                    {cellContent}
                                                  </div>
                                                </td>
                                              );
                                            })}
                                            <td className="px-2 py-2 text-center text-sm font-black text-[var(--color-primary-dark)] bg-[var(--color-primary-50)] border-b border-r border-[var(--color-surface-dark)] border-l-2">{totalH}</td>
                                            <td className="px-2 py-2 text-center text-sm font-black text-indigo-800 bg-[var(--color-primary-50)] border-b border-r border-[var(--color-surface-dark)]">{totalI}</td>
                                            <td className="px-2 py-2 text-center text-sm font-black text-[var(--color-warning)] bg-[var(--color-primary-50)] border-b border-r border-[var(--color-surface-dark)]">{totalS}</td>
                                            <td className="px-2 py-2 text-center text-sm font-black text-rose-800 bg-[var(--color-primary-50)] border-b">{totalA}</td>
                                          </tr>
                                        );
                                      })}
                                      {santris.length === 0 && (
                                        <tr>
                                          <td className="px-4 py-8 text-center text-[var(--color-text-muted)]" colSpan={100}>Tidak ada data yang tersedia</td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              );
                            })()
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      {/* INLINE EDIT MODAL */}
      {editingCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-sm rounded-[var(--radius-2xl)] bg-white shadow-2xl border border-[var(--color-surface-dark)] overflow-hidden scale-in-center">
            <div className="p-5 border-b border-[var(--color-surface-dark)] bg-slate-50 relative">
              <button 
                onClick={() => setEditingCell(null)}
                className="absolute right-4 top-4 text-slate-400 hover:text-[var(--color-danger)] transition-colors bg-white hover:bg-rose-50 rounded-full p-1"
              >
                <X className="h-5 w-5" />
              </button>
              <h3 className="font-bold text-[var(--color-text)] text-lg mb-0.5">Edit Absensi</h3>
              <p className="text-xs font-semibold text-[var(--color-text-muted)] truncate max-w-[90%]">
                {editingCell.namaSantri}
              </p>
              <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                {format(new Date(editingCell.tanggal), "eeee, dd MMM yyyy", { locale: id })} {editingCell.sesi ? `• ${editingCell.sesi.replace("SESI_", "Sesi ")}` : ""}
              </p>
            </div>
            
            <div className="p-5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
                Ubah Status
              </label>
              <div className="grid grid-cols-2 gap-2 mb-6">
                {(["HADIR", "IZIN", "SAKIT", "ALPHA", "KOSONG"] as ("HADIR"|"IZIN"|"SAKIT"|"ALPHA"|"KOSONG")[]).map(st => (
                  <button
                    key={st}
                    onClick={() => handleInlineSave(st)}
                    disabled={isSavingCell}
                    className={`flex items-center justify-center gap-2 py-3 px-2 rounded-xl text-xs font-bold transition-all border ${
                      editingCell.currentStatus === st 
                        ? st === "HADIR" ? "bg-[var(--color-primary)] text-white border-[var(--color-primary-dark)]" 
                          : st === "IZIN" ? "bg-indigo-600 text-white border-indigo-700" 
                          : st === "SAKIT" ? "bg-[var(--color-warning)] text-white border-amber-600" 
                          : st === "ALPHA" ? "bg-[var(--color-danger)] text-white border-rose-600" 
                          : "bg-slate-600 text-white border-slate-700"
                        : st === "KOSONG" ? "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100" 
                        : "bg-white text-[var(--color-text)] border-[var(--color-surface-dark)] hover:border-[var(--color-primary)] hover:shadow-sm"
                    } disabled:opacity-50`}
                  >
                    {st === "KOSONG" ? "Hapus Data" : st}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
