"use client";

import React, { useState, useEffect } from "react";
import { ShieldCheck, Search, Info, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Database, ArrowRight, LayoutTemplate } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";

export default function QCBankSoalPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [programs, setPrograms] = useState<any[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<string>("ALL");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [orphanSoals, setOrphanSoals] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/admin/program")
      .then(res => res.json())
      .then(res => setPrograms(Array.isArray(res) ? res : []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedProgram]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ujian-usbu/qc-bank-soal?programId=${selectedProgram}`);
      if (!res.ok) throw new Error("Gagal mengambil data QC");
      const json = await res.json();
      setData(Array.isArray(json.aggregatesByUsbu) ? json.aggregatesByUsbu : (Array.isArray(json) ? json : []));
      setOrphanSoals(Array.isArray(json.orphanSoals) ? json.orphanSoals : []);
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const handleCleanup = async (mode: 'all' | 'single', soalId?: string) => {
    if (mode === 'all' && !confirm(`Yakin hapus SEMUA ${orphanSoals.length} soal anomali permanen?`)) return;
    if (mode === 'single' && !confirm("Hapus soal anomali ini?")) return;

    try {
      const qs = mode === 'all' ? `?mode=all&programId=${selectedProgram}` : `?mode=single&soalId=${soalId}`;
      const res = await fetch(`/api/admin/ujian-usbu/qc-bank-soal/cleanup${qs}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      const resJson = await res.json();
      
      toast.success(`Berhasil menghapus ${resJson.deletedSoalCount} soal anomali`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus soal anomali");
    }
  };

  // Hitung agregat health
  const statusMap = {
     "SIAP": { label: "Siap Ujian", color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2, ring: "ring-green-500" },
     "OVER": { label: "Bobot Lebih (> 100)", color: "bg-rose-100 text-rose-700 border-rose-200", icon: AlertTriangle, ring: "ring-rose-500" },
     "KURANG_BOBOT": { label: "Bobot Kurang (< 100)", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Info, ring: "ring-amber-500" },
     "KURANG_USBU": { label: "Soal Usbu Kosong", color: "bg-orange-100 text-orange-700 border-orange-200", icon: ShieldCheck, ring: "ring-orange-500" },
  };

  const allMapels = data.flatMap(u => u.mapels || []);
  const problems = allMapels.filter(d => d.status !== "SIAP");
  const allGood = allMapels.length > 0 && problems.length === 0;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* HEADER & FILTER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-gray-800 flex items-center gap-2">
            <ShieldCheck className="text-indigo-600" /> Quality Control Bank Soal
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitoring kelengkapan bobot, distribusi soal usbu, dan deteksi anomali bank soal.
          </p>
        </div>
        <div className="w-full md:w-auto relative min-w-[200px]">
          <select 
            className="input-field py-2.5 w-full bg-white shadow-sm font-semibold text-gray-800"
            value={selectedProgram}
            onChange={(e) => setSelectedProgram(e.target.value)}
          >
            <option value="ALL">-- Semua Program --</option>
            {programs.map((p: any) => (
              <option key={p.id} value={p.id}>{p.nama_indo}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ORPHAN ALERTS */}
      {!loading && orphanSoals.length > 0 && (
         <div className="bg-red-50 border-2 border-red-200 rounded-xl overflow-hidden shadow-sm mb-6">
            <div className="p-4 bg-red-100 flex items-center justify-between border-b border-red-200">
               <div className="flex items-center gap-2">
                 <AlertTriangle size={24} className="text-red-600" />
                 <h2 className="font-bold text-red-800 text-lg">Soal Anomali Terdeteksi ({orphanSoals.length})</h2>
               </div>
               <button 
                  onClick={() => handleCleanup('all')}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-colors shadow-sm"
               >
                 Sapu Bersih Semua
               </button>
            </div>
            <div className="p-4">
               <p className="text-sm text-red-700 mb-4 font-semibold">Terdapat soal-soal usbu' (ter-assign) yang tidak lagi memiliki "Jenis Soal" induk karena terhapus di masa lalu. Soal-soal ini masih akan muncul di ujian santri secara acak.</p>
               <div className="max-h-[300px] overflow-y-auto">
                 <table className="w-full text-left text-sm whitespace-nowrap bg-white rounded-lg overflow-hidden border border-red-100">
                   <thead className="bg-red-50 text-red-700 font-bold text-xs uppercase">
                     <tr>
                       <th className="px-4 py-3">Mapel</th>
                       <th className="px-4 py-3 min-w-[200px]">Potongan Pertanyaan</th>
                       <th className="px-4 py-3">Usbu</th>
                       <th className="px-4 py-3 text-right">Aksi</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-red-50">
                     {orphanSoals.map(s => (
                       <tr key={s.id}>
                         <td className="px-4 py-3 font-semibold text-gray-700">{s.mapelNama}</td>
                         <td className="px-4 py-3 text-gray-600" dir="auto">{s.pertanyaan}</td>
                         <td className="px-4 py-3 font-mono font-bold text-xs">U{s.usbuAssignments.join(', ')}</td>
                         <td className="px-4 py-3 text-right">
                           <button onClick={() => handleCleanup('single', s.id)} className="text-red-500 hover:text-red-700 bg-red-50 py-1 px-3 rounded-md font-bold text-xs transition-colors">Hapus</button>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>
         </div>
      )}

      {/* HEALTH CHECK ALERTS */}
      {!loading && data.length > 0 && (
        <div className="space-y-3">
          {allGood ? (
             <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg text-green-700"><CheckCircle2 size={24} /></div>
                <div>
                   <h3 className="font-bold text-green-800">Semua Mapel Aman & Siap!</h3>
                   <p className="text-sm text-green-700">Setiap mapel sudah mencapai total bobot 100 dan terisi di seluruh usbu.</p>
                </div>
             </div>
          ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {problems.map((prob, i) => {
                 let msg = "";
                 if (prob.status === "OVER") msg = `Total bobot mencapai ${prob.totalBobot}, melebihi batas 100!`;
                 else if (prob.status === "KURANG_BOBOT") msg = `Total bobot baru mencapai ${prob.totalBobot}, kurang dari 100!`;
                 else if (prob.status === "KURANG_USBU") msg = `Ada Usbu 1/2/3 yang masih belum memiliki soal!`;
                 
                 return (
                   <div key={i} className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 shadow-sm">
                      <div className="p-2 bg-rose-100 rounded-lg text-rose-700"><AlertTriangle size={20} /></div>
                      <div>
                         <h3 className="font-bold text-rose-800">{prob.mapelNama}</h3>
                         <p className="text-sm text-rose-700">{msg}</p>
                      </div>
                      <Link href="/admin/ujian-usbu/bank-soal" className="ml-auto p-2 bg-rose-200 text-rose-800 rounded-lg hover:bg-rose-300 transition-colors">
                         <ArrowRight size={16} />
                      </Link>
                   </div>
                 )
               })}
             </div>
          )}
        </div>
      )}

      {/* MAIN TABLE */}
      <div className="space-y-8">
         {loading ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center text-gray-500 font-bold flex flex-col items-center justify-center">
              <Search size={32} className="animate-pulse mb-3 text-indigo-300" />
              Menganalisis Bank Soal...
            </div>
         ) : data.length === 0 || allMapels.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border-dashed border-2 border-gray-200 p-12 text-center text-gray-400 flex flex-col items-center justify-center">
              <LayoutTemplate size={48} className="mb-4 text-gray-200" />
              Belum ada data bank soal untuk program ini.
            </div>
         ) : (
            data.map(uGroup => uGroup.mapels.length > 0 && (
              <div key={`usbu-${uGroup.usbu}`} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-indigo-600 px-6 py-3 border-b border-indigo-700 text-white flex items-center justify-between">
                  <h3 className="font-bold font-display uppercase tracking-wider text-sm flex items-center gap-2">
                    Tahap Usbu' {uGroup.usbu}
                  </h3>
                  <div className="text-[11px] font-medium opacity-90 flex items-center gap-4">
                    <span>{uGroup.mapels.length} Mapel terisi</span>
                    <span className="bg-indigo-700 px-2 py-1 flex items-center gap-1 rounded font-bold border border-indigo-500">
                       Total Poin: {Math.round(uGroup.mapels.reduce((sum: number, m: any) => sum + m.totalBobot, 0) * 100) / 100}
                    </span>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                     <thead>
                       <tr className="bg-slate-50 border-b text-slate-500 uppercase tracking-wider text-[11px] font-black">
                         <th className="px-6 py-4 w-10"></th>
                         <th className="px-6 py-4">Nama Mapel</th>
                         <th className="px-6 py-4">Total Soal</th>
                         <th className="px-6 py-4 min-w-[200px]">Jenis Soal</th>
                         <th className="px-6 py-4 text-center">Total Bobot</th>
                         <th className="px-6 py-4">Status QC</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-50">
                       {uGroup.mapels.map((d: any) => {
                          const rowKey = `${uGroup.usbu}-${d.mapelId}`;
                          const isExpanded = expandedRows.has(rowKey);
                          const cfg = statusMap[d.status as keyof typeof statusMap] || statusMap.SIAP;
                          const StatusIcon = cfg.icon;
                     
                     return (
                       <React.Fragment key={d.mapelId}>
                         <tr 
                           onClick={() => toggleRow(rowKey)}
                           className={`transition-colors cursor-pointer group ${isExpanded ? 'bg-indigo-50/30' : 'hover:bg-slate-50'}`}
                         >
                            <td className="px-6 py-4 text-gray-400">
                               <button className="p-1 bg-white rounded-md shadow-sm border text-gray-500 group-hover:text-indigo-600 transition-colors">
                                 {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                               </button>
                            </td>
                            <td className="px-6 py-4 font-bold text-gray-800 text-[15px]">
                               {d.mapelNama}
                            </td>
                            <td className="px-6 py-4 font-bold text-gray-600">
                               <span className="text-xl">{d.totalSoal}</span> <span className="text-xs font-normal">soal</span>
                            </td>
                            <td className="px-6 py-4 whitespace-normal">
                               <div className="flex flex-wrap gap-1.5">
                                 {d.jenisSoalBreakdown.slice(0, 3).map((js: any) => (
                                   <span key={js.id} className="text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 px-2 py-1 rounded-md">
                                     {js.nama} ({js.count})
                                   </span>
                                 ))}
                                 {d.jenisSoalBreakdown.length > 3 && (
                                   <span className="text-[10px] font-bold bg-slate-50 text-slate-400 px-2 py-1 flex items-center rounded-md">+{d.jenisSoalBreakdown.length - 3}</span>
                                 )}
                               </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                               <span className={`inline-block font-display font-black text-lg px-3 py-1 rounded-full ring-2 ring-offset-2 ${cfg.color} ${cfg.ring}`}>
                                 {d.totalBobot}
                               </span>
                            </td>
                            <td className="px-6 py-4">
                               <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border ${cfg.color}`}>
                                  <StatusIcon size={14} /> {cfg.label}
                               </div>
                            </td>
                         </tr>
                         
                         {/* EXPANDED CONTENT */}
                         {isExpanded && (
                           <tr>
                              <td colSpan={6} className="p-0 border-b-2 border-indigo-100">
                                 <div className="bg-indigo-50/50 p-6 shadow-inner relative">
                                    <h4 className="text-xs font-black uppercase text-indigo-400 tracking-wider mb-4 flex items-center gap-2">
                                       <Database size={14} /> Detail Komposisi Jenis Soal
                                    </h4>
                                    
                                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                                       {d.jenisSoalBreakdown.map((js: any) => (
                                          <div key={js.id} className="bg-white p-4 rounded-xl shadow-sm border border-indigo-50 flex items-center justify-between">
                                             <div>
                                                <div className="font-bold text-sm text-gray-800">{js.nama}</div>
                                                <div className="text-xs text-gray-500 mt-1">{js.count} Soal Terdaftar</div>
                                             </div>
                                             <div className="text-right">
                                                <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1">Bobot</div>
                                                <div className="text-xl font-black text-indigo-900">{Math.round(js.totalBobot * 100) / 100}</div>
                                             </div>
                                          </div>
                                       ))}
                                    </div>
                                    
                                    <div className="flex justify-end">
                                      <Link 
                                        href={`/admin/ujian-usbu/bank-soal`} 
                                        className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-sm font-bold rounded-xl shadow-sm transition-colors"
                                      >
                                        Bongkar Bank Soal Mapel ini <ArrowRight size={16} />
                                      </Link>
                                    </div>
                                 </div>
                              </td>
                           </tr>
                         )}
                       </React.Fragment>
                     )
                  })}
                </tbody>
             </table>
           </div>
         </div>
          ))
         )}
      </div>
    </div>
  );
}
