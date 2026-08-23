"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

type DashboardSantri = {
  id: string;
  programNama: string;
  programId: string | null;
  kelasNama: string;
  kelasId: string | null;
  gender: string;
  isCheckedOut: boolean;
};

type ProgramItem = {
  id: string;
  nama_indo: string;
  kelasList: Array<{
    id: string;
    nama: string;
  }>;
};

const COLORS = [
  "#006666", "#008585", "#00A63D", "#34d399", "#0ea5e9", 
  "#38bdf8", "#7dd3fc", "#8b5cf6", "#a78bfa", "#FE9900",
  "#fbbf24", "#fcd34d", "#FF2157", "#f87171"
];

export function DashboardCharts({
  santriRows,
  programList,
}: {
  santriRows: DashboardSantri[];
  programList: ProgramItem[];
}) {
  const [isCopied, setIsCopied] = useState(false);

  const chartDataParent = useMemo(() => {
    const parentMap = new Map<string, number>();
    
    // Initialize all parent classes with 0
    programList.forEach((k) => {
      parentMap.set(k.nama_indo, 0);
    });
    
    // Add "Belum Ditempatkan"
    parentMap.set("Belum Ditempatkan", 0);

    santriRows.filter(s => !s.isCheckedOut).forEach((santri) => {
      const parentName = santri.programId === null ? "Belum Ditempatkan" : santri.programNama;
      const count = parentMap.get(parentName) || 0;
      parentMap.set(parentName, count + 1);
    });

    return Array.from(parentMap.entries()).map(([name, count]) => ({
      name,
      Jumlah: count,
    })).filter(item => item.Jumlah > 0 || item.name !== "Belum Ditempatkan"); // Only hide UNASSIGNED if 0
  }, [santriRows, programList]);

  const chartDataRuangan = useMemo(() => {
    const ruanganMap = new Map<string, number>();
    
    programList.forEach((k) => {
      if (k.kelasList.length === 0) {
        // If no ruangan, map it to parent
        ruanganMap.set(k.nama_indo, 0);
      } else {
        k.kelasList.forEach((nk) => {
          ruanganMap.set(nk.nama, 0);
        });
      }
    });
    
    ruanganMap.set("Belum Ditempatkan", 0);

    santriRows.filter(s => !s.isCheckedOut).forEach((santri) => {
      const roomName = santri.kelasId !== null 
        ? santri.kelasNama 
        : (santri.programId !== null ? santri.programNama : "Belum Ditempatkan");
      const count = ruanganMap.get(roomName) || 0;
      ruanganMap.set(roomName, count + 1);
    });

    return Array.from(ruanganMap.entries()).map(([name, count]) => ({
      name,
      value: count,
    })).filter((item) => item.value > 0);
  }, [santriRows, programList]);

  const classStats = useMemo(() => {
    const statsMap = new Map<string, { total: number; banin: number; banat: number }>();
    
    // Initialize empty stats for all valid classes
    programList.forEach((prog) => {
      prog.kelasList.forEach((k) => {
        statsMap.set(k.nama, { total: 0, banin: 0, banat: 0 });
      });
    });

    santriRows.filter(s => !s.isCheckedOut).forEach((s) => {
      if (s.kelasId && s.kelasNama) {
        let stats = statsMap.get(s.kelasNama);
        if (!stats) {
          stats = { total: 0, banin: 0, banat: 0 };
          statsMap.set(s.kelasNama, stats);
        }
        stats.total++;
        if (s.gender === "BANIN") stats.banin++;
        else if (s.gender === "BANAT") stats.banat++;
      }
    });

    return Array.from(statsMap.entries()).map(([kelasNama, stats]) => ({
      kelasNama,
      ...stats
    })).sort((a, b) => a.kelasNama.localeCompare(b.kelasNama));
  }, [santriRows, programList]);

  const handleCopyWA = () => {
    let text = "*Rekap Data Kelas Markaz Arabiyah*\n\n";
    classStats.forEach((c) => {
      if (c.total > 0) {
        text += `- ${c.kelasNama} ${c.total} : ${c.banin} Banin`;
        if (c.banat > 0) text += ` ${c.banat} Banat`;
        text += "\n";
      }
    });

    navigator.clipboard.writeText(text).then(() => {
      setIsCopied(true);
      toast.success("Berhasil disalin ke clipboard!");
      setTimeout(() => setIsCopied(false), 2000);
    }).catch(() => {
      toast.error("Gagal menyalin teks");
    });
  };

  const totalSantri = santriRows.length;
  const totalAktif = santriRows.filter(s => !s.isCheckedOut).length;
  const totalCheckout = santriRows.filter(s => s.isCheckedOut).length;
  
  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
         <div className="neu-card p-6 flex flex-col justify-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "var(--color-text-muted)" }}>Total Santri</p>
            <h3 className="mt-2 text-4xl font-black font-display" style={{ color: "var(--color-text)" }}>{totalSantri}</h3>
         </div>
         <div className="p-6 flex flex-col justify-center rounded-xl" style={{ background: "var(--color-primary)", boxShadow: "4px 4px 12px rgba(0,102,102,0.3), -3px -3px 8px rgba(0,133,133,0.15)", borderRadius: "var(--radius-xl)" }}>
            <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.7)" }}>Santri Aktif</p>
            <h3 className="mt-2 text-4xl font-black font-display text-white">{totalAktif}</h3>
         </div>
         <div className="neu-card p-6 flex flex-col justify-center border-l-4" style={{ borderColor: "var(--color-danger)" }}>
            <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "var(--color-danger)" }}>Santri Checkout</p>
            <h3 className="mt-2 text-4xl font-black font-display text-red-600">{totalCheckout}</h3>
         </div>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="neu-card-white p-6">
          <div className="mb-6">
            <h3 className="text-lg font-bold font-display" style={{ color: "var(--color-text)" }}>Distribusi per Program</h3>
            <p className="text-sm mt-1" style={{ color: "var(--color-text-subtle)" }}>Jumlah santri di masing-masing program/master kelas.</p>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartDataParent} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-surface-dark)" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: "var(--color-text-subtle)" }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: "var(--color-text-subtle)" }} 
                />
                <Tooltip 
                  cursor={{ fill: "var(--color-surface-light)" }}
                  contentStyle={{ borderRadius: 'var(--radius-lg)', border: 'none', boxShadow: 'var(--shadow-raised)', background: 'var(--bg-card)' }}
                />
                <Bar 
                  dataKey="Jumlah" 
                  fill="var(--color-primary)" 
                  radius={[6, 6, 0, 0]} 
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="neu-card-white p-6">
          <div className="mb-6">
            <h3 className="text-lg font-bold font-display" style={{ color: "var(--color-text)" }}>Distribusi per Ruangan</h3>
            <p className="text-sm mt-1" style={{ color: "var(--color-text-subtle)" }}>Sebaran jumlah santri di masing-masing rombongan belajar.</p>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartDataRuangan}
                  cx="50%"
                  cy="45%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => percent !== undefined ? `${name} (${(percent * 100).toFixed(0)}%)` : name}
                  labelLine={false}
                >
                  {chartDataRuangan.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: 'var(--radius-lg)', border: 'none', boxShadow: 'var(--shadow-raised)', background: 'var(--bg-card)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="neu-card-white p-6">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold font-display" style={{ color: "var(--color-text)" }}>Rincian Data Kelas</h3>
            <p className="text-sm mt-1" style={{ color: "var(--color-text-subtle)" }}>Tabel jumlah santri beserta sebaran Banin dan Banat.</p>
          </div>
          <button 
            onClick={handleCopyWA}
            className="neu-button flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold"
            style={{ color: "var(--color-text-muted)" }}
          >
            {isCopied ? <Check size={16} style={{ color: "var(--color-success)" }} /> : <Copy size={16} />}
            {isCopied ? "Tersalin!" : "Salin Format WA"}
          </button>
        </div>
        
        <div className="overflow-x-auto rounded-xl" style={{ boxShadow: "var(--shadow-inset-sm)" }}>
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead style={{ background: "var(--color-surface-light)" }}>
              <tr>
                <th className="px-6 py-4 text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: "var(--color-text-subtle)" }}>Nama Kelas</th>
                <th className="px-6 py-4 text-center text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: "var(--color-text-subtle)" }}>Total Santri</th>
                <th className="px-6 py-4 text-center text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: "var(--color-primary)" }}>Banin</th>
                <th className="px-6 py-4 text-center text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: "var(--color-danger)" }}>Banat</th>
              </tr>
            </thead>
            <tbody>
              {classStats.map((c, i) => (
                <tr key={c.kelasNama} className="transition-colors" style={{ borderBottom: "1px solid var(--color-surface)", background: i % 2 === 0 ? "white" : "var(--color-secondary)" }}>
                  <td className="px-6 py-4 font-bold" style={{ color: "var(--color-text)" }}>{c.kelasNama}</td>
                  <td className="px-6 py-4 text-center font-bold" style={{ color: "var(--color-text)" }}>{c.total}</td>
                  <td className="px-6 py-4 text-center font-bold" style={{ color: "var(--color-primary)" }}>{c.banin}</td>
                  <td className="px-6 py-4 text-center font-bold" style={{ color: "var(--color-danger)" }}>{c.banat}</td>
                </tr>
              ))}
              {classStats.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center font-medium" style={{ color: "var(--color-text-subtle)" }}>
                    Belum ada data kelas yang terdaftar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
