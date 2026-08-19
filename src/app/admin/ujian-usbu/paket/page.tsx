"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, KeyRound, MonitorCheck, Save, Users, Clock, Play, ServerCog, CheckSquare, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

export default function SesiUjianPage() {
  const [sesiList, setSesiList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Data Master
  const [programList, setProgramList] = useState<any[]>([]);
  const [activeDufah, setActiveDufah] = useState("");
  
  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [usbuKe, setUsbuKe] = useState("1");
  const [durasiMenit, setDurasiMenit] = useState("120");
  const [acakSoal, setAcakSoal] = useState(true);
  const [acakOpsi, setAcakOpsi] = useState(true);
  const [isSimulasi, setIsSimulasi] = useState(false);
  
  // Program Selection
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [progRes, sesiRes, activeCtxRes] = await Promise.all([
        fetch("/api/admin/program?bypassFilter=true"),
        fetch("/api/admin/ujian-usbu/sesi"),
        fetch("/api/admin/active-context")
      ]);
      
      const programs = await progRes.json() || [];
      setProgramList(programs);
      setSesiList(await sesiRes.json() || []);
      
      const activeCtx = await activeCtxRes.json();
      if (activeCtx && activeCtx.activeDufah) {
        setActiveDufah(activeCtx.activeDufah);
      }

      // Initialize map: select all programs by default
      setSelectedPrograms(programs.map((p: any) => p.id));


    } catch {
      toast.error("Gagal memuat data awal");
    } finally {
      setLoading(false);
    }
  };

  const fetchSesiList = async () => {
    try {
      const res = await fetch("/api/admin/ujian-usbu/sesi");
      if (res.ok) setSesiList(await res.json());
    } catch {
      toast.error("Gagal refresh sesi");
    }
  };

  const handleCreateNew = () => {
    setUsbuKe("1");
    setDurasiMenit("120");
    setIsSimulasi(false);
    setSelectedPrograms(programList.map(p => p.id));
    setIsModalOpen(true);
  };

  const toggleProgramSelection = (progId: string) => {
    setSelectedPrograms(prev => {
      if (prev.includes(progId)) return prev.filter(id => id !== progId);
      return [...prev, progId];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPrograms.length === 0) {
      return toast.error("Pilih minimal satu program!");
    }

    const payload = {
      usbuKe: Number(usbuKe),
      durasiMenit: Number(durasiMenit),
      acakSoal,
      acakOpsi,
      isSimulasi,
      programIds: selectedPrograms
    };

    try {
      const res = await fetch("/api/admin/ujian-usbu/sesi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      toast.success("Sesi global ujian berhasil dibuat!");
      setIsModalOpen(false);
      fetchSesiList();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleToggleActive = async (id: string, currentState: boolean) => {
    if (currentState) {
      if (!confirm("Tutup sesi ujian ini?")) return;
    } else {
      if (!confirm(`Buka sesi ujian ini sekarang? Timer global ${durasiMenit} menit akan mulai berjalan untuk semua program di dalam sesi ini.`)) return;
    }

    try {
      const res = await fetch(`/api/admin/ujian-usbu/sesi/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: currentState ? "CLOSE" : "OPEN" })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      fetchSesiList();
      toast.success(currentState ? "Sesi ditutup" : "Sesi dibuka");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRefreshKode = async (id: string) => {
    if (!confirm("Generate kode akses baru? Sandi lama tidak akan bisa digunakan lagi.")) return;
    try {
      const res = await fetch(`/api/admin/ujian-usbu/sesi/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REFRESH_CODE" })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      fetchSesiList();
      toast.success("Kode akses diperbarui");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus sesi ujian global ini?")) return;
    try {
      const res = await fetch(`/api/admin/ujian-usbu/sesi/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Sesi berhasil dihapus");
      fetchSesiList();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRefreshSoal = async (id: string) => {
    if (!confirm("Refresh soal dari Bank Soal terbaru? Ini akan menghapus link soal lama dan mengambil ulang dari Bank Soal. Soal yang sudah dijawab santri akan tetap tersimpan.")) return;
    try {
      const res = await fetch(`/api/admin/ujian-usbu/sesi/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REFRESH_SOAL" })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message || "Soal berhasil di-refresh!");
      fetchSesiList();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Memuat data sesi ujian...</div>;

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display" style={{ color: "var(--color-text)" }}>Sesi Ujian Global</h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-subtle)" }}>Kelola ujian serentak, generator 1 kode akses untuk semua kelompok.</p>
        </div>
        <button onClick={handleCreateNew} className="neu-button-primary px-5 py-2.5 flex items-center justify-center gap-2 rounded-xl text-sm font-bold shadow-md hover:-translate-y-1 transition-all">
          <Plus size={16}/> Buat Sesi Serentak
        </button>
      </div>

      {sesiList.length === 0 ? (
        <div className="neu-card border-dashed p-12 text-center rounded-3xl bg-white shadow-sm flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mb-5 text-blue-500 ring-8 ring-blue-50/50">
            <MonitorCheck size={40} />
          </div>
          <h3 className="font-bold text-xl text-gray-800">Belum Ada Sesi Ujian</h3>
          <p className="mt-3 text-sm text-gray-500 mb-8 max-w-md font-medium leading-relaxed">Buat sesi ujian global untuk membuka ujian secara serentak di berbagai program tanpa perlu setting manual satu per satu.</p>
          <button onClick={handleCreateNew} className="bg-blue-600 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 hover:shadow-xl transition-all">
            Mulai Buat Sesi
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {sesiList.map(sesi => (
             <div key={sesi.id} className={`rounded-2xl overflow-hidden transition-all duration-300 shadow-sm border-2 ${sesi.isActive ? 'border-green-400 shadow-green-100/50 transform -translate-y-1' : 'border-gray-200 bg-white hover:shadow-gray-200/50'}`}>
               <div className={`p-5 flex gap-4 items-center justify-between border-b ${sesi.isActive ? 'bg-gradient-to-r from-emerald-500 to-green-400 text-white border-green-500' : 'bg-gray-50 text-gray-800 border-gray-100'}`}>
                 <div>
                   <div className={`text-[10px] uppercase font-bold tracking-widest mb-1.5 flex items-center gap-2 ${sesi.isActive ? 'text-green-100' : 'text-gray-500'}`}>
                     Sesi Global
                     {sesi.isSimulasi && <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-md text-[9px]">SIMULASI UMUM</span>}
                   </div>
                   <h3 className="font-black text-xl leading-tight">{sesi.nama}</h3>
                 </div>
                 <div className={`shrink-0 w-16 h-16 rounded-2xl font-display font-black text-2xl flex items-center justify-center shadow-inner border-2 ${sesi.isActive ? 'bg-white text-green-600 border-green-200' : 'bg-white text-gray-400 border-gray-100'}`}>
                   U{sesi.usbuKe}
                 </div>
               </div>
               
               <div className="p-6 bg-white">
                 <div className="flex flex-wrap gap-4 items-center mb-6">
                   <div className="flex-1 bg-gray-50 px-4 py-3 rounded-xl border border-gray-100 flex items-center gap-3">
                     <Users size={20} className="text-blue-500"/> 
                     <div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase">Program</div>
                        <div className="text-sm font-black text-gray-700">{sesi._count.paketUjianList} Aktif</div>
                     </div>
                   </div>
                   <div className="flex-1 bg-gray-50 px-4 py-3 rounded-xl border border-gray-100 flex items-center gap-3">
                     <Clock size={20} className="text-orange-500"/> 
                     <div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase">Durasi Timer</div>
                        <div className="text-sm font-black text-gray-700">{sesi.durasiMenit} Menit</div>
                     </div>
                   </div>
                 </div>

                 <div className="flex justify-between items-center bg-[var(--color-primary-50)] p-5 rounded-2xl border border-[var(--color-primary-200)] mb-5">
                   <div>
                     <div className="text-[11px] text-[var(--color-primary)] font-bold mb-1 uppercase tracking-widest">KODE AKSES GLOBAL</div>
                     <div className="font-mono text-3xl font-black tracking-[0.2em] text-[var(--color-primary-800)]">
                       {sesi.kodeAkses}
                     </div>
                   </div>
                   <button onClick={() => handleRefreshKode(sesi.id)} className="w-12 h-12 bg-white border border-[var(--color-primary-200)] shadow-sm hover:shadow-md hover:border-[var(--color-primary-400)] rounded-xl text-[var(--color-primary)] transition-all flex items-center justify-center active:scale-95" title="Generate kode baru">
                     <KeyRound size={22}/>
                   </button>
                 </div>
                 
                 <div className="mt-2">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Tautan Program & Paket:</p>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-2 pb-2">
                        {sesi.paketUjianList.length === 0 ? (
                           <div className="text-sm text-gray-400 italic">Tidak ada program karena tidak ada soal.</div>
                        ) : sesi.paketUjianList.map((paket: any) => (
                            <div key={paket.id} className="text-xs font-bold bg-white text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm hover:border-blue-300 transition-colors">
                                {paket.program.nama_indo} 
                                <span className={`px-2 py-0.5 rounded-md font-black text-[10px] ${paket._count.soalPaketList > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                    {paket._count.soalPaketList} Soal Link
                                </span>
                            </div>
                        ))}
                    </div>
                 </div>
               </div>

               <div className={`p-4 flex gap-3 ${sesi.isActive ? 'bg-green-50' : 'bg-gray-50 border-t border-gray-100'}`}>
                 <button 
                   onClick={() => handleToggleActive(sesi.id, sesi.isActive)}
                   className={`flex-1 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 ${sesi.isActive ? 'bg-white text-red-600 hover:bg-red-50 border-2 border-red-200' : 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-600)] shadow-blue-200'}`}
                 >
                   {sesi.isActive ? (
                     <>🔴 Akhiri Sesi Ujian</>
                   ) : (
                     <><Play size={18} fill="currentColor"/> Buka & Mulai Timer</>
                   )}
                 </button>
                 {!sesi.isActive && (
                   <button onClick={() => handleRefreshSoal(sesi.id)} className="w-14 items-center justify-center flex shrink-0 bg-white border-2 border-gray-200 text-blue-500 hover:bg-blue-50 hover:border-blue-200 rounded-xl transition-all" title="Refresh Soal dari Bank Soal">
                     <RefreshCw size={20}/>
                   </button>
                 )}
                 {!sesi.isActive && (
                   <button onClick={() => handleDelete(sesi.id)} className="w-14 items-center justify-center flex shrink-0 bg-white border-2 border-gray-200 text-red-500 hover:bg-red-50 hover:border-red-200 rounded-xl transition-all">
                     <Trash2 size={20}/>
                   </button>
                 )}
               </div>
             </div>
          ))}
        </div>
      )}

      {/* MODAL BUAT SESI */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto py-12">
          <div className="bg-white rounded-3xl w-full max-w-4xl flex flex-col shadow-2xl overflow-hidden border border-gray-100">
            
            <div className="px-8 py-6 border-b flex justify-between items-center bg-gray-50/80">
              <div>
                <h2 className="text-2xl font-bold font-display text-gray-800">Buat Sesi Ujian Serentak</h2>
                <p className="text-sm text-gray-500 font-medium mt-1">Sesi tunggal dengan 1 akses global untuk banyak program kelas.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-white bg-transparent transition-colors rounded-xl border border-transparent hover:border-gray-200 hover:shadow-sm">✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col md:flex-row">
              {/* Left Column - Meta Data */}
              <div className="w-full md:w-[40%] p-8 bg-gray-50/50 border-r border-gray-100 flex flex-col gap-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-gray-500">Duf'ah Aktif</label>
                  <div className="w-full p-3 text-sm font-black bg-blue-50 text-blue-800 rounded-xl border border-blue-100 flex items-center gap-2">
                    <CheckSquare size={16} /> {activeDufah}
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-gray-500">Ujian Untuk (Usbu')</label>
                  <select required value={usbuKe} onChange={e => setUsbuKe(e.target.value)} className="w-full p-3.5 text-sm font-bold bg-white border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                    <option value="1">Ujian Usbu' 1</option>
                    <option value="2">Ujian Usbu' 2</option>
                    <option value="3">Ujian Nihai / Usbu' 3</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-gray-500">Durasi Timer (Menit)</label>
                  <input required type="number" min="15" value={durasiMenit} onChange={e => setDurasiMenit(e.target.value)} className="w-full p-4 text-2xl font-black tracking-wider bg-white border border-gray-200 rounded-xl shadow-sm text-center text-blue-600 focus:ring-2 focus:ring-blue-500 outline-none" />
                  <p className="text-[11px] text-gray-400 mt-2 text-center font-semibold leading-relaxed">Timer terpusat: dihitung mundur sejak tombol "Buka & Mulai Timer" diklik.</p>
                </div>
                
                <div className="mt-2 p-5 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input type="checkbox" checked={acakSoal} onChange={e => setAcakSoal(e.target.checked)} className="w-5 h-5 rounded border-gray-300 accent-blue-600" />
                    <span className="text-sm font-bold text-gray-700 group-hover:text-blue-600 transition-colors">Acak Urutan Soal</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input type="checkbox" checked={acakOpsi} onChange={e => setAcakOpsi(e.target.checked)} className="w-5 h-5 rounded border-gray-300 accent-blue-600" />
                    <span className="text-sm font-bold text-gray-700 group-hover:text-blue-600 transition-colors">Acak Pilihan (A,B,C,D)</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group pt-4 border-t border-gray-100">
                    <input type="checkbox" checked={isSimulasi} onChange={e => setIsSimulasi(e.target.checked)} className="w-5 h-5 rounded border-gray-300 accent-purple-600" />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-gray-700 group-hover:text-purple-600 transition-colors">Jadikan Simulasi Universal</span>
                      <span className="text-[10px] text-gray-400 font-medium leading-tight mt-1">Akan muncul di dashboard SATUAN SELURUH PROGRAM. Nilai uji tidak akan merusak rapot.</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Right Column - Program Selection */}
              <div className="w-full md:w-[60%] p-8 flex flex-col h-[550px] bg-white">
                <div className="flex justify-between items-end mb-6 shrink-0">
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg mb-1">Target Kelas</h3>
                    <p className="text-xs text-gray-500 font-medium">Centang program yang akan diikutsertakan di Sesi ini.</p>
                  </div>
                  <div className="bg-gray-100 text-gray-600 border px-3 py-1.5 rounded-lg text-xs font-bold">
                    {selectedPrograms.length} Terpilih
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                    {programList.map(prog => {
                        const isSelected = selectedPrograms.includes(prog.id);
                        return (
                            <div key={prog.id} className={`flex items-center justify-between p-4 rounded-2xl transition-all duration-200 cursor-pointer ${isSelected ? 'bg-blue-50/50 outline outline-2 outline-blue-500 shadow-sm' : 'bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`} onClick={() => toggleProgramSelection(prog.id)}>
                                <div className="flex items-center gap-4">
                                    <div className={`flex items-center justify-center text-white rounded-md w-5 h-5 transition-colors ${isSelected ? 'bg-blue-600' : 'border-2 border-gray-300'}`}>
                                        {isSelected && <CheckSquare size={14} fill="currentColor" />}
                                    </div>
                                    <div className={`font-bold ${isSelected ? 'text-blue-900' : 'text-gray-600'}`}>{prog.nama_indo}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                
                <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end shrink-0">
                  <button type="submit" disabled={selectedPrograms.length === 0} className="w-full md:w-auto px-8 py-4 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-200 flex items-center justify-center gap-3 font-bold hover:bg-blue-700 hover:shadow-xl transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                    <ServerCog size={20}/> Generate Sesi untuk {selectedPrograms.length} Kelas
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
