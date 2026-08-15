"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Brain, Search, CheckCircle, Clock, Save, Edit3, X } from "lucide-react";
import toast from "react-hot-toast";

export default function EssayReviewPage() {
  const [filter, setFilter] = useState("ALL");
  const [filterKelas, setFilterKelas] = useState("ALL");
  const [data, setData] = useState<any>(null);
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editScore, setEditScore] = useState<number>(0);
  const [isAiGrading, setIsAiGrading] = useState(false);

  const mutate = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/ujian-usbu/essay-review?status=${filter}&kelasId=${filterKelas}`);
      const json = await res.json();
      setData(json);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [filter, filterKelas]);

  useEffect(() => {
    mutate();
  }, [mutate]);

  useEffect(() => {
    fetch("/api/admin/kelas")
      .then(r => r.json())
      .then(res => {
         if (Array.isArray(res)) setKelasList(res);
      })
      .catch(console.error);
  }, []);

  const handleManualGrade = async (id: string) => {
    try {
      const res = await fetch("/api/admin/ujian-usbu/essay-review", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, nilaiManual: editScore })
      });
      if (!res.ok) throw new Error("Gagal update");
      toast.success("Nilai berhasil diupdate");
      setEditingId(null);
      mutate(); // reload list
    } catch {
      toast.error("Gagal mengupdate nilai");
    }
  };

  const triggerAIGrade = async (ids: string[]) => {
    if (ids.length === 0) return toast.error("Tidak ada data untuk dinilai AI");
    setIsAiGrading(true);
    toast.loading("AI sedang menilai...", { id: "ai-grade" });
    try {
      const res = await fetch("/api/admin/ujian-usbu/ai-grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jawabanIds: ids })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal");
      toast.success(`Berhasil menilai ${json.processed} jawaban`, { id: "ai-grade" });
      mutate();
    } catch (e: any) {
       toast.error(e.message || "Gagal menghubungi Agnes AI", { id: "ai-grade" });
    } finally {
       setIsAiGrading(false);
    }
  };

  const gradeAllPendingAI = () => {
    if (!data) return;
    const essayTypes = ["ESSAY_PANJANG", "ESSAY_SINGKAT", "ESSAY_ARAB", "ESSAY_GAMBAR"];
    const pendingEssay = data.filter((d: any) => d.nilaiManual === null && essayTypes.includes(d.soal.tipeSoal)).map((d:any) => d.id);
    if (pendingEssay.length === 0) {
      return toast.error("Tidak ada Essay yang pending (semua sudah dinilai atau bukan essay).");
    }
    triggerAIGrade(pendingEssay);
  };

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold font-display text-gray-800">Review Essay (AI & Manual)</h1>
            <p className="text-gray-500">Berikan penilaian untuk soal bertipe essay dan isian manual.</p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
             <select className="input-field py-2.5 max-w-[150px]" value={filter} onChange={e => setFilter(e.target.value)}>
                <option value="ALL">Semua Jawaban</option>
                <option value="PENDING">Pending (Belum dinilai)</option>
                <option value="GRADED">Sudah Dinilai</option>
             </select>
             <select className="input-field py-2.5 max-w-[200px]" value={filterKelas} onChange={e => setFilterKelas(e.target.value)}>
                <option value="ALL">Semua Kelas</option>
                {kelasList.map(k => (
                  <option key={k.id} value={k.id}>{k.nama}</option>
                ))}
             </select>
             <button 
                onClick={gradeAllPendingAI}
                disabled={isAiGrading}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 px-4 rounded-xl flex items-center gap-2 shadow-sm whitespace-nowrap disabled:opacity-50"
             >
                <Brain size={18} className={isAiGrading ? "animate-pulse" : ""} /> 
                {isAiGrading ? "Memproses AI..." : "Grade All with AI"}
             </button>
          </div>
        </div>

        {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl">Error memuat data</div>}
        {isLoading && <div className="p-8 text-center text-gray-500">Memuat data...</div>}

        {!isLoading && data && data.length === 0 && (
          <div className="p-12 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 text-gray-500">
             Tidak ada jawaban yang butuh direview untuk filter ini.
          </div>
        )}

        {data && data.length > 0 && (
          <div className="space-y-4">
            {data.map((j: any) => (
              <div key={j.id} className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row gap-6">
                
                {/* Bagian Soal & Jawaban */}
                <div className="flex-1 space-y-4">
                   <div className="flex flex-wrap gap-2 items-center text-xs font-bold tracking-wider text-gray-500 uppercase">
                      <span className="bg-gray-100 px-2 py-1 rounded">{j.soal.tipeSoal.replace(/_/g, ' ')}</span>
                      <span>•</span>
                      <span>{j.soal.mapel.nama_indo || j.soal.mapel.nama}</span>
                      <span>•</span>
                      <span className="text-blue-600">Bobot: {j.soal.bobot}</span>
                      
                      {j.sesi?.riwayat?.kelas?.nama && (
                        <>
                          <span>•</span>
                          <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-100">
                             {j.sesi.riwayat.kelas.nama}
                          </span>
                        </>
                      )}
                   </div>
                   
                   <div className="bg-gray-50 p-4 rounded-xl prose prose-sm max-w-none text-gray-800" dangerouslySetInnerHTML={{ __html: j.soal.pertanyaan }} />
                   
                   <div className="grid md:grid-cols-2 gap-4">
                     <div>
                        <h4 className="text-xs font-bold text-gray-500 mb-2 uppercase">Kunci Jawaban</h4>
                        <div className="p-3 bg-green-50 border border-green-100 rounded-xl text-green-900 text-sm whitespace-pre-wrap">
                           {j.soal.kunciJawaban || "Tidak ada kunci jawaban."}
                        </div>
                     </div>
                     <div>
                        <h4 className="text-xs font-bold text-gray-500 mb-2 uppercase">Jawaban Santri</h4>
                        <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-900 font-medium text-sm whitespace-pre-wrap">
                           {j.jawabanTeks || "-"}
                        </div>
                     </div>
                   </div>

                   {/* Field AI Feedback jika ada */}
                   {j.aiFeedback && (
                      <div className="mt-4 p-4 bg-purple-50 border border-purple-100 rounded-xl">
                        <h4 className="text-xs font-bold text-purple-700 flex items-center gap-1 mb-1"><Brain size={14}/> Feedback AI Agnes:</h4>
                        <p className="text-sm text-purple-900">{j.aiFeedback}</p>
                      </div>
                   )}
                </div>

                {/* Bagian Penilaian */}
                <div className="w-full md:w-64 shrink-0 border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-6 flex flex-col justify-center">
                   
                   <div className="mb-4">
                     <p className="text-xs font-bold text-gray-500 uppercase mb-1">Status Penilaian</p>
                     {j.nilaiManual !== null ? (
                       <div className="flex items-center gap-2 text-green-600 font-bold text-sm bg-green-50 p-2 rounded-lg">
                          <CheckCircle size={16}/> Selesai Dinilai ({j.aiGraded ? 'AI' : 'Manual'})
                       </div>
                     ) : (
                       <div className="flex items-center gap-2 text-orange-500 font-bold text-sm bg-orange-50 p-2 rounded-lg">
                          <Clock size={16}/> Menunggu Penilaian
                       </div>
                     )}
                   </div>

                   {editingId === j.id ? (
                      <div className="bg-gray-50 p-3 rounded-xl border mb-3">
                         <label className="text-xs font-bold text-gray-600 block mb-1">Set Skor (Maks {j.soal.bobot})</label>
                         <input 
                           type="number" 
                           max={j.soal.bobot} min={0} 
                           value={editScore}
                           onChange={(e) => setEditScore(Number(e.target.value))}
                           className="w-full input-field py-2 text-lg font-bold mb-2"
                         />
                         <div className="flex gap-2">
                           <button onClick={() => handleManualGrade(j.id)} className="flex-1 bg-green-500 text-white font-bold py-1.5 rounded-lg text-sm hover:bg-green-600 flex items-center justify-center gap-1"><Save size={14}/> Simpan</button>
                           <button onClick={() => setEditingId(null)} className="p-1.5 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300"><X size={16}/></button>
                         </div>
                      </div>
                   ) : (
                      <div className="mb-4 text-center p-4 bg-gray-50 rounded-xl">
                         <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Skor Akhir</p>
                         <p className="text-4xl font-display font-black text-gray-800">
                           {j.nilaiManual !== null ? j.nilaiManual : '-'}
                           <span className="text-lg text-gray-400">/{j.soal.bobot}</span>
                         </p>
                      </div>
                   )}

                   {!editingId && (
                     <div className="flex flex-col gap-2">
                        <button 
                           onClick={() => { setEditingId(j.id); setEditScore(j.nilaiManual || 0); }}
                           className="w-full py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-lg text-sm flex items-center justify-center gap-1 transition"
                        >
                           <Edit3 size={14}/> {j.nilaiManual !== null ? 'Revisi Skor' : 'Nilai Manual'}
                        </button>
                        
                        {j.soal.tipeSoal === "ESSAY_PANJANG" && (
                          <button 
                             onClick={() => triggerAIGrade([j.id])}
                             disabled={isAiGrading}
                             className="w-full py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 font-bold rounded-lg text-sm flex items-center justify-center gap-1 transition disabled:opacity-50"
                          >
                             <Brain size={14}/> Nilai dengan AI
                          </button>
                        )}
                     </div>
                   )}

                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
