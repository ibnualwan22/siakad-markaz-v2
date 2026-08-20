"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Search, CheckCircle, CheckCircle2, XCircle, Clock, X, Brain, Edit3, Save, AlertCircle, ChevronDown, ChevronRight, Activity, BookOpen, Layers } from "lucide-react";
import toast from "react-hot-toast";

export default function ReviewJawabanPage() {
  const [paketList, setPaketList] = useState<any[]>([]);
  const [kelasList, setKelasList] = useState<any[]>([]);
  
  const [selectedPaket, setSelectedPaket] = useState("");
  const [selectedKelas, setSelectedKelas] = useState("");
  
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  const [expandedSoalId, setExpandedSoalId] = useState<string | null>(null);
  const [editingJawabanId, setEditingJawabanId] = useState<string | null>(null);
  const [editScore, setEditScore] = useState<number>(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAIGrading, setIsAIGrading] = useState<string | null>(null); // soal.id basis
  
  const [activeMapel, setActiveMapel] = useState<string>("");
  const [santriLimits, setSantriLimits] = useState<Record<string, number>>({});
  
  const getLimit = (soalId: string) => santriLimits[soalId] || 20;

  // Load Initial Data (Paket & Kelas)
  useEffect(() => {
    Promise.all([
      fetch("/api/admin/ujian-usbu/sesi").then(r => r.json()),
      fetch("/api/admin/kelas").then(r => r.json())
    ]).then(([pakets, kelass]) => {
      if (Array.isArray(pakets) && pakets.length > 0) {
        setPaketList(pakets);
        // Default select active or first
        const active = pakets.find((p: any) => p.isActive);
        setSelectedPaket(active ? active.id : pakets[0].id);
      }
      
      if (Array.isArray(kelass) && kelass.length > 0) {
        setKelasList(kelass);
        setSelectedKelas(kelass[0].id);
      }
      setIsInitialLoad(false);
    }).catch((err) => {
      console.error(err);
      toast.error("Gagal memuat filter!");
      setIsInitialLoad(false);
    });
  }, []);

  const fetchData = useCallback(async () => {
    if (!selectedPaket || !selectedKelas) return;
    
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/ujian-usbu/review-jawaban?sesiGlobalId=${selectedPaket}&kelasId=${selectedKelas}`);
      if (!res.ok) throw new Error("Gagal mengambil data");
      
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan sistem");
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedPaket, selectedKelas]);

  // Refetch when filters change
  useEffect(() => {
    if (!isInitialLoad) {
      fetchData();
    }
  }, [fetchData, isInitialLoad]);

  const handleUpdateNilai = async (jawabanId: string, overrideVal?: number | null) => {
    setIsUpdating(true);
    try {
      const val = overrideVal !== undefined ? overrideVal : editScore;
      const res = await fetch("/api/admin/ujian-usbu/review-jawaban", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jawabanId, nilaiManual: val })
      });
      if (!res.ok) throw new Error("Gagal update nilai");
      
      toast.success("Skor berhasil direvisi. Total dihitung ulang otomatis.");
      setEditingJawabanId(null);
      // Reload table to get the latest scores immediately
      fetchData();
    } catch (err) {
      toast.error("Gagal mengupdate nilai");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAIGradeSoal = async (soalId: string, jawabanSantri: any[]) => {
    // Kumpulkan semua ID jawaban yang belum dinilai
    const pendingIds = jawabanSantri
       .filter(j => j.id && j.nilaiManual === null && !j.aiGraded)
       .map(j => j.id);

    if (pendingIds.length === 0) {
       toast.error("Semua jawaban sudah dinilai!");
       return;
    }

    setIsAIGrading(soalId);
    let successCount = 0;
    
    toast.loading(`Memulai penilaian AI untuk ${pendingIds.length} jawaban...`, { id: "ai-grade" });
    
    try {
       // Kita batch per 5 supaya tidak limit
       const batchSize = 5;
       for (let i = 0; i < pendingIds.length; i += batchSize) {
         const batch = pendingIds.slice(i, i + batchSize);
         
         const res = await fetch("/api/admin/ujian-usbu/ai-grade", {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({ jawabanIds: batch })
         });
         
         if (res.ok) {
           const json = await res.json();
           if (json.processed) successCount += json.processed;
         }
         
         // Jeda 2.5 detik antar batch (Gemini rate-limit prevention)
         if (i + batchSize < pendingIds.length) {
           await new Promise(resolve => setTimeout(resolve, 2500));
         }
       }
       
       toast.success(`Selesai! ${successCount} jawaban berhasil dinilai AI.`, { id: "ai-grade" });
       fetchData(); // reload
    } catch (err) {
       toast.error("Terjadi kesalahan saat menghubungi server AI.", { id: "ai-grade" });
    } finally {
       setIsAIGrading(null);
    }
  };

  // Tipe yang memiliki nilai pasti sehingga lebih cocok pakai tombol Benarkan/Salahkan
  const EXACT_TYPES = ["PG", "BENAR_SALAH", "MUFRODAT", "ISIAN_SAMPING", "ISIAN_BAWAH", "PG_MULTI"];

  const renderStatus = (jaw: any, soal: any) => {
    if (!jaw.id) return <span className="text-gray-400 text-xs italic">Kosong</span>;

    // Jika nilaiManual sudah terisi (berlaku untuk essay DAN structured types)
    if (jaw.nilaiManual !== null && jaw.nilaiManual !== undefined) {
      const pct = soal.bobot > 0 ? Math.round((jaw.nilaiManual / soal.bobot) * 100) : 0;
      const color = pct >= 70 ? 'green' : pct >= 40 ? 'orange' : 'rose';
      return (
        <span className="inline-flex flex-col items-center gap-0.5">
          <span className={`inline-flex items-center gap-1 text-${color}-700 font-bold bg-${color}-50 px-2 py-0.5 rounded text-xs`}>
            {pct >= 70 ? <CheckCircle size={14}/> : <AlertCircle size={14}/>}
            {Number(jaw.nilaiManual.toFixed(1))}/{soal.bobot}
          </span>
          {jaw.aiGraded && <span className="text-[10px] text-purple-600 flex items-center gap-0.5"><Brain size={10}/> AI</span>}
        </span>
      );
    }

    // Essay tanpa nilaiManual
    if (soal.tipeSoal.startsWith("ESSAY")) {
      if (jaw.jawabanTeks) {
        return (
          <span className="inline-flex items-center gap-1 text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded text-xs">
            <Clock size={14}/> Menunggu
          </span>
        );
      }
      return <span className="text-gray-400 text-xs italic">Kosong</span>;
    }

    // PG / Benar Salah / Isian (exact match)
    if (["PG", "BENAR_SALAH", "MUFRODAT", "ISIAN_SAMPING", "ISIAN_BAWAH"].includes(soal.tipeSoal)) {
      const opsiBenar = soal.opsiList?.find((o: any) => o.isCorrect)?.id;
      let isBenar = false;
      if (jaw.opsiId && jaw.opsiId === opsiBenar) isBenar = true;
      else if (jaw.jawabanTeks && soal.kunciJawaban && jaw.jawabanTeks.trim().toLowerCase() === soal.kunciJawaban.trim().toLowerCase()) isBenar = true;
      
      return isBenar ? (
        <span className="inline-flex items-center gap-1 text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded text-xs"><CheckCircle size={14}/> Benar</span>
      ) : (
        <span className="inline-flex items-center gap-1 text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded text-xs"><X size={14}/> Salah</span>
      );
    }

    // Structured types yang belum ada nilaiManual → menunggu submit / belum dihitung
    return (
      <span className="inline-flex items-center gap-1 text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded text-xs">
        <Clock size={14}/> Belum Dihitung
      </span>
    );
  };

  // ======== RENDER KUNCI JAWABAN ========
  const renderKunciJawaban = (soal: any) => {
    // PG / Benar Salah
    if (soal.tipeSoal === "PG" || soal.tipeSoal === "BENAR_SALAH" || soal.tipeSoal === "MUFRODAT") {
      const opsiBenar = soal.opsiList?.filter((o:any) => o.isCorrect);
      if (opsiBenar?.length > 0) {
         return (
           <div className="space-y-1">
             {opsiBenar.map((o: any) => (
               <div key={o.id} className="text-sm font-medium text-green-800 bg-green-50 p-2 rounded border border-green-100">{o.teks}</div>
             ))}
           </div>
         );
      }
      return <div className="text-xs text-gray-400 italic">Tidak ditandai kunci</div>;
    }

    // PG Multi
    if (soal.tipeSoal === "PG_MULTI") {
      const opsiBenar = soal.opsiList?.filter((o:any) => o.isCorrect);
      if (opsiBenar?.length > 0) {
         return (
           <div className="flex flex-wrap gap-1">
             {opsiBenar.map((o: any) => (
               <span key={o.id} className="text-xs font-medium text-green-800 bg-green-50 px-2 py-1 rounded border border-green-100">{o.teks}</span>
             ))}
           </div>
         );
      }
    }

    // Essay / Isian
    if (soal.kunciJawaban) {
      return <div className="text-sm font-medium text-green-800 bg-green-50 p-2 rounded border border-green-100 whitespace-pre-wrap">{soal.kunciJawaban}</div>;
    }

    // TABEL TASRIF
    if (soal.tipeSoal === "TABEL_TASRIF" && soal.dataTambahan?.rows) {
      return (
        <div className="overflow-x-auto">
          <table className="text-xs border border-green-200 rounded">
            <tbody>
              {soal.dataTambahan.rows.map((row: any, rIdx: number) => (
                <tr key={rIdx} className="border-b border-green-100">
                  {(row.cells || []).map((cell: any, cIdx: number) => (
                    <td key={cIdx} className={`px-2 py-1 border-r border-green-100 ${cell.isBlank ? 'bg-green-50 font-bold text-green-800' : 'bg-white text-gray-700'}`}>
                      {cell.isBlank ? `✎ ${cell.value}` : cell.value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-[10px] text-gray-400 mt-1">Sel ✎ = kosong yang harus diisi santri. Nilai di sampingnya = jawaban benar.</div>
        </div>
      );
    }

    // MENJODOHKAN
    if (soal.tipeSoal === "MENJODOHKAN" && soal.dataTambahan?.lefts && soal.dataTambahan?.rights) {
      return (
        <div className="space-y-1">
          {soal.dataTambahan.lefts.map((left: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="bg-green-50 text-green-800 px-2 py-1 rounded border border-green-100 font-medium">{left}</span>
              <span className="text-gray-400">→</span>
              <span className="bg-green-50 text-green-800 px-2 py-1 rounded border border-green-100 font-medium">{soal.dataTambahan.rights[i]}</span>
            </div>
          ))}
        </div>
      );
    }

    // MENGURUTKAN
    if (soal.tipeSoal === "MENGURUTKAN" && soal.dataTambahan?.items) {
      return (
        <div className="flex flex-wrap gap-1">
          {soal.dataTambahan.items.map((item: any, i: number) => (
            <span key={i} className="text-xs font-medium text-green-800 bg-green-50 px-2 py-1 rounded border border-green-100">{i+1}. {item}</span>
          ))}
        </div>
      );
    }

    // DRAG KATEGORI
    if (soal.tipeSoal === "DRAG_KATEGORI" && soal.dataTambahan?.items) {
      const grouped: Record<string, string[]> = {};
      soal.dataTambahan.items.forEach((d: any) => {
        if (!grouped[d.category]) grouped[d.category] = [];
        grouped[d.category].push(d.text);
      });
      return (
        <div className="space-y-1">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} className="text-xs">
              <span className="font-bold text-green-700">{cat}:</span>{" "}
              <span className="text-green-800">{items.join(", ")}</span>
            </div>
          ))}
        </div>
      );
    }

    // DRAG TO BLANK / PARAGRAF RUMPANG
    if ((soal.tipeSoal === "DRAG_TO_BLANK" || soal.tipeSoal === "PARAGRAF_RUMPANG") && soal.dataTambahan?.blanks) {
      return (
        <div className="flex flex-wrap gap-1">
          {soal.dataTambahan.blanks.map((b: any, i: number) => (
            <span key={i} className="text-xs font-medium text-green-800 bg-green-50 px-2 py-1 rounded border border-green-100">Blank {b.index+1}: {b.jawaban}</span>
          ))}
        </div>
      );
    }

    // STABILO SYNTAX
    if (soal.tipeSoal === "STABILO_SYNTAX" && soal.dataTambahan?.words && soal.dataTambahan?.answers) {
      return (
        <div className="flex flex-wrap gap-2 text-xs">
          {soal.dataTambahan.words.map((w: any, i: number) => {
            const wordStr = typeof w === 'string' ? w : w.text;
            const cat = soal.dataTambahan.answers[String(i)];
            if (!cat) return <span key={i} className="text-gray-600">{wordStr}</span>;
            return (
              <span key={i} className="inline-flex flex-col items-center">
                <span className="font-bold text-gray-800">{wordStr}</span>
                <span className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded-[4px] text-[10px] mt-0.5">{cat}</span>
              </span>
            );
          })}
        </div>
      );
    }

    // JARING RELASI
    if (soal.tipeSoal === "JARING_RELASI" && soal.dataTambahan?.connections) {
      return (
        <div className="space-y-1">
          {soal.dataTambahan.connections.map((c: any, i: number) => (
            <div key={i} className="flex flex-wrap items-center gap-1 text-xs">
              <span className="bg-green-50 text-green-800 px-2 py-1 rounded font-medium">{soal.dataTambahan.lefts?.[c.left] || `L${c.left}`}</span>
              <span className="text-gray-400">→</span>
              {(c.right || []).map((r: number) => (
                <span key={r} className="bg-green-50 text-green-800 px-2 py-1 rounded font-medium">{soal.dataTambahan.rights?.[r] || `R${r}`}</span>
              ))}
            </div>
          ))}
        </div>
      );
    }

    // SUSUN HURUF
    if (soal.tipeSoal === "SUSUN_HURUF" && soal.dataTambahan?.hurufAcak) {
      return (
        <div className="text-sm font-medium text-green-800 bg-green-50 p-2 rounded border border-green-100">
          {soal.kunciJawaban || soal.dataTambahan.jawaban || soal.dataTambahan.hurufAcak.join('')}
        </div>
      );
    }

    if (soal.dataTambahan) {
       return <div className="text-xs text-gray-500 italic p-2 bg-gray-50 border rounded">Kunci tersimpan di dataTambahan (tipe: {soal.tipeSoal})</div>;
    }

    return <div className="text-xs text-gray-400 italic">Tidak ada referensi kunci</div>;
  };

  // ======== RENDER JAWABAN SANTRI ========
  const renderJawabanSantri = (jaw: any, soal: any) => {
    if (!jaw.id) return <span className="text-gray-400 italic text-sm">Tidak menjawab</span>;

    // PG / Benar Salah
    if (["PG", "BENAR_SALAH", "MUFRODAT", "ISIAN_SAMPING", "ISIAN_BAWAH"].includes(soal.tipeSoal)) {
      const selected = soal.opsiList?.find((o:any) => o.id === jaw.opsiId);
      const isCorrect = selected?.isCorrect;
      return (
        <div className={`text-sm font-medium p-2 rounded border ${isCorrect ? 'text-green-800 bg-green-50/50 border-green-100' : 'text-rose-800 bg-rose-50/50 border-rose-100'}`}>
          {selected?.teks || jaw.jawabanTeks || "-"}
        </div>
      );
    }

    // Essay types
    if (soal.tipeSoal.startsWith("ESSAY") && jaw.jawabanTeks) {
      return <div className="text-sm font-medium text-blue-900 bg-blue-50/50 p-2 rounded border border-blue-100 whitespace-pre-wrap">{jaw.jawabanTeks}</div>;
    }

    // TABEL TASRIF
    if (soal.tipeSoal === "TABEL_TASRIF" && jaw.jawabanData?.cells && soal.dataTambahan?.rows) {
      const cells = jaw.jawabanData.cells;
      return (
        <div className="overflow-x-auto">
          <table className="text-xs border border-blue-200 rounded">
            <tbody>
              {soal.dataTambahan.rows.map((row: any, rIdx: number) => (
                <tr key={rIdx} className="border-b border-blue-100">
                  {(row.cells || []).map((cell: any, cIdx: number) => {
                    if (!cell.isBlank) {
                      return <td key={cIdx} className="px-2 py-1 border-r border-gray-100 bg-white text-gray-600">{cell.value}</td>;
                    }
                    const key = `${rIdx}-${cIdx}`;
                    const studentAns = cells[key] || "";
                    const possibleAnswers = (cell.value || "").split("|").map((k: string) => k.trim().toLowerCase());
                    const isCorrect = studentAns.trim() !== "" && possibleAnswers.includes(studentAns.trim().toLowerCase());
                    return (
                      <td key={cIdx} className={`px-2 py-1 border-r font-bold ${isCorrect ? 'bg-green-50 text-green-800 border-green-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
                        {studentAns || <span className="text-gray-300 italic">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    // MENJODOHKAN
    if (soal.tipeSoal === "MENJODOHKAN" && jaw.jawabanData?.pairs && soal.dataTambahan?.lefts) {
      return (
        <div className="space-y-1">
          {jaw.jawabanData.pairs.map((jp: any, i: number) => {
            const trueIdx = soal.dataTambahan.lefts.indexOf(jp.left);
            const isCorrect = trueIdx !== -1 && soal.dataTambahan.rights[trueIdx] === jp.right;
            return (
              <div key={i} className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${isCorrect ? 'bg-green-50 border border-green-100' : 'bg-rose-50 border border-rose-100'}`}>
                <span className="font-medium">{jp.left}</span>
                <span className="text-gray-400">→</span>
                <span className="font-medium">{jp.right}</span>
                {isCorrect ? <CheckCircle size={12} className="text-green-600 ml-auto"/> : <X size={12} className="text-rose-600 ml-auto"/>}
              </div>
            );
          })}
        </div>
      );
    }

    // SUSUN HURUF
    if (soal.tipeSoal === "SUSUN_HURUF" && jaw.jawabanData?.susunanIndices && soal.dataTambahan?.hurufAcak) {
      const studentAnsText = jaw.jawabanData.susunanIndices.map((i: number) => soal.dataTambahan.hurufAcak[i]).join('');
      let targetAnsText = '';
      if (soal.kunciJawaban || soal.dataTambahan.jawaban) {
        targetAnsText = (soal.kunciJawaban || soal.dataTambahan.jawaban).replace(/\s+/g, '');
      } else {
        targetAnsText = soal.dataTambahan.hurufAcak.join('').replace(/\s+/g, '');
      }
      const isCorrect = studentAnsText.replace(/\s+/g, '') === targetAnsText;
      return (
        <div className={`text-sm font-medium p-2 rounded border flex justify-between items-center ${isCorrect ? 'text-green-800 bg-green-50/50 border-green-100' : 'text-rose-800 bg-rose-50/50 border-rose-100'}`}>
          <span>{studentAnsText}</span>
          {isCorrect ? <CheckCircle size={14} className="text-green-600"/> : <X size={14} className="text-rose-600"/>}
        </div>
      );
    }

    // DRAG TO BLANK / PARAGRAF RUMPANG
    if ((soal.tipeSoal === "DRAG_TO_BLANK" || soal.tipeSoal === "PARAGRAF_RUMPANG") && jaw.jawabanData?.answers && soal.dataTambahan?.blanks) {
      return (
        <div className="flex flex-wrap gap-1">
          {soal.dataTambahan.blanks.map((b: any, i: number) => {
            const studentAns = (jaw.jawabanData.answers[b.index] || "").trim();
            const possibleAnswers = (b.jawaban || "").split("|").map((k: string) => k.trim().toLowerCase());
            const isCorrect = studentAns !== "" && possibleAnswers.includes(studentAns.toLowerCase());
            return (
              <span key={i} className={`text-xs font-medium px-2 py-1 flex items-center gap-1 inline-block rounded border ${isCorrect ? 'text-green-800 bg-green-50 border-green-100' : 'text-rose-800 bg-rose-50 border-rose-100'}`}>
                B{b.index+1}: {studentAns || <span className="text-gray-400 italic">kosong</span>} {isCorrect ? <CheckCircle size={10} className="text-green-600"/> : <X size={10} className="text-rose-600"/>}
              </span>
            );
          })}
        </div>
      );
    }

    // DRAG KATEGORI
    if (soal.tipeSoal === "DRAG_KATEGORI" && jaw.jawabanData?.items && soal.dataTambahan?.items) {
      return (
        <div className="flex flex-wrap gap-1">
          {jaw.jawabanData.items.map((jitem: any, i: number) => {
            const found = soal.dataTambahan.items.find((d: any) => d.text === jitem.text);
            const isCorrect = found && found.category === jitem.category;
            return (
              <span key={i} className={`text-xs font-medium px-2 flex items-center gap-1 py-1 rounded border ${isCorrect ? 'text-green-800 bg-green-50 border-green-100' : 'text-rose-800 bg-rose-50 border-rose-100'}`}>
                {jitem.text} <span className="opacity-70">({jitem.category})</span> {isCorrect ? <CheckCircle size={10} className="text-green-600"/> : <X size={10} className="text-rose-600"/>}
              </span>
            );
          })}
        </div>
      );
    }

    // IDENTIFIKASI KESALAHAN
    if (soal.tipeSoal === "IDENTIFIKASI_KESALAHAN" && jaw.jawabanData) {
      if (soal.dataTambahan?.correctIndex !== undefined) {
        const sIdx = jaw.jawabanData.selectedIndex ?? (jaw.jawabanData.selectedIndices ? jaw.jawabanData.selectedIndices[0] : -1);
        const isCorrect = sIdx === soal.dataTambahan.correctIndex;
        const words = soal.dataTambahan.words || [];
        return (
          <div className={`text-sm font-medium flex justify-between p-2 rounded border ${isCorrect ? 'text-green-800 bg-green-50/50 border-green-100' : 'text-rose-800 bg-rose-50/50 border-rose-100'}`}>
            <span>Pilihan: {words[sIdx] || `Kata ke-${sIdx+1}`}</span>
            {isCorrect ? <CheckCircle size={14} className="text-green-600"/> : <X size={14} className="text-rose-600"/>}
          </div>
        );
      }
    }

    // STABILO SYNTAX
    if (soal.tipeSoal === "STABILO_SYNTAX" && jaw.jawabanData?.assignments && soal.dataTambahan?.words) {
      const trueAnswers = soal.dataTambahan.answers || {};
      return (
        <div className="flex flex-wrap gap-2 text-xs">
          {soal.dataTambahan.words.map((w: any, i: number) => {
            const wordStr = typeof w === 'string' ? w : w.text;
            const assignedCat = jaw.jawabanData.assignments[String(i)] || jaw.jawabanData.assignments[i];
            const trueCat = trueAnswers[String(i)];
            if (!assignedCat) return <span key={i} className="text-gray-400">{wordStr}</span>;
            const isCorrect = assignedCat === trueCat;
            return (
              <span key={i} className={`inline-flex flex-col items-center border rounded px-1.5 py-1 ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-rose-50 border-rose-200'}`}>
                <span className="font-bold text-gray-800">{wordStr}</span>
                <span className={`px-1 rounded-[4px] text-[10px] mt-0.5 font-bold ${isCorrect ? 'text-green-700' : 'text-rose-700'}`}>{assignedCat}</span>
              </span>
            );
          })}
        </div>
      );
    }
    
    // JARING RELASI
    if (soal.tipeSoal === "JARING_RELASI" && jaw.jawabanData?.connections) {
      const trueGraph = new Map<number, number[]>();
      (soal.dataTambahan?.connections || []).forEach((c: any) => trueGraph.set(c.left, c.right || []));
      
      return (
        <div className="space-y-1">
          {jaw.jawabanData.connections.map((c: any, i: number) => {
             const trueRights = trueGraph.get(c.left) || [];
             return (
               <div key={i} className="flex flex-wrap items-center gap-1 text-xs p-1 border rounded bg-gray-50">
                  <span className="font-medium bg-white px-2 py-0.5 rounded shadow-sm">{soal.dataTambahan?.lefts?.[c.left] || `L${c.left}`}</span>
                  <span className="text-gray-400">→</span>
                  {(c.right || []).map((r: number) => {
                    const isCorrect = trueRights.includes(r);
                    return <span key={r} className={`px-2 flex items-center gap-0.5 py-0.5 rounded border border-transparent font-medium ${isCorrect ? 'bg-green-100 text-green-800 border-green-200' : 'bg-rose-100 text-rose-800 border-rose-200'}`}>{soal.dataTambahan?.rights?.[r] || `R${r}`} {isCorrect?<CheckCircle size={10}/>:<X size={10}/>}</span>;
                  })}
               </div>
             );
          })}
        </div>
      );
    }

    // MENGURUTKAN
    if (soal.tipeSoal === "MENGURUTKAN" && jaw.jawabanData?.items && soal.dataTambahan?.items) {
      return (
        <div className="flex flex-wrap gap-1">
          {jaw.jawabanData.items.map((item: any, i: number) => {
            const isCorrect = item === soal.dataTambahan.items[i];
            return (
              <span key={i} className={`text-xs font-medium px-2 py-1 rounded border ${isCorrect ? 'text-green-800 bg-green-50 border-green-100' : 'text-rose-800 bg-rose-50 border-rose-100'}`}>
                {i+1}. {item}
              </span>
            );
          })}
        </div>
      );
    }

    // PG MULTI
    if (soal.tipeSoal === "PG_MULTI" && jaw.jawabanData?.selectedIds) {
      const correctIds = soal.opsiList?.filter((o: any) => o.isCorrect).map((o: any) => o.id) || [];
      return (
        <div className="flex flex-wrap gap-1">
          {jaw.jawabanData.selectedIds.map((selId: string, i: number) => {
            const opsi = soal.opsiList?.find((o: any) => o.id === selId);
            const isCorrect = correctIds.includes(selId);
            return (
              <span key={i} className={`text-xs font-medium px-2 py-1 rounded border ${isCorrect ? 'text-green-800 bg-green-50 border-green-100' : 'text-rose-800 bg-rose-50 border-rose-100'}`}>
                {opsi?.teks || selId}
              </span>
            );
          })}
        </div>
      );
    }

    // Generic fallback for other structured types with jawabanData
    if (jaw.jawabanData) {
      return <div className="text-xs text-blue-800 p-2 bg-blue-50 border border-blue-100 rounded overflow-x-auto max-w-full">Jawaban terstruktur tersedia (lihat skor)</div>;
    }

    if (jaw.jawabanTeks) {
      return <div className="text-sm font-medium text-blue-900 bg-blue-50/50 p-2 rounded border border-blue-100 whitespace-pre-wrap">{jaw.jawabanTeks}</div>;
    }

    return <span className="text-gray-400 italic">Tidak menjawab</span>;
  };

  // Grouping by Mapel and TipeSoal
  const groupedData: Record<string, Record<string, any[]>> = {};
  if (!isLoading && data && data.length > 0) {
    data.forEach((soal: any) => {
      const mn = soal.mapelNama || 'Tanpa Mapel';
      const ts = soal.tipeSoal || 'UNDEFINED';
      if (!groupedData[mn]) groupedData[mn] = {};
      if (!groupedData[mn][ts]) groupedData[mn][ts] = [];
      groupedData[mn][ts].push(soal);
    });
  }

  if (isInitialLoad) {
    return <div className="p-8 text-center text-gray-500 font-medium">Memuat data awal...</div>;
  }

  return (
    <div className="pb-20 md:pb-8">
      {/* HEADER & FILTER */}
      <div className="bg-white p-4 md:p-6 mb-6 rounded-b-2xl shadow-sm sticky top-0 md:static z-20" style={{ borderBottom: "1px solid var(--color-surface-dark)" }}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold font-display flex items-center gap-2 text-gray-800">
               <Layers className="text-blue-500"/> Review Jawaban Santri
            </h1>
            <p className="text-sm text-gray-500 mt-1">Lakukan komparasi dan koreksi penilaian untuk setiap soal dari seluruh santri di kelas tertentu.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row w-full md:w-auto gap-3">
             <div className="w-full sm:w-48">
               <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Paket Ujian</label>
               <select className="neu-input w-full p-2 text-sm font-bold text-gray-700 bg-gray-50 border border-gray-200 focus:border-blue-400 focus:ring focus:ring-blue-100 rounded-lg" value={selectedPaket} onChange={e => setSelectedPaket(e.target.value)}>
                  {paketList.map(p => (
                    <option key={p.id} value={p.id}>{p.nama} {p.isActive ? "(AKTIF)" : ""}</option>
                  ))}
               </select>
             </div>
             
             <div className="w-full sm:w-48">
               <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Kelas</label>
               <select className="neu-input w-full p-2 text-sm font-bold text-gray-700 bg-gray-50 border border-gray-200 focus:border-blue-400 focus:ring focus:ring-blue-100 rounded-lg" value={selectedKelas} onChange={e => setSelectedKelas(e.target.value)}>
                  {kelasList.map(k => (
                    <option key={k.id} value={k.id}>{k.nama}</option>
                  ))}
               </select>
             </div>
          </div>
        </div>
      </div>
      
      {/* CONTENT AREA */}
      <div className="px-4 md:px-6">
        {isLoading && <div className="text-center p-12 text-gray-500"><Activity className="animate-spin mx-auto mb-3 text-blue-400"/> Mengambil data ujian...</div>}
        
        {!isLoading && data.length === 0 && (
           <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center shadow-sm">
              <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4"/>
              <h3 className="text-lg font-bold text-gray-700 mb-1">Soal Kosong</h3>
              <p className="text-sm text-gray-500">Tidak ada soal atau santri yang mengerjakan paket ini di kelas yang dipilih.</p>
           </div>
        )}
        
        {!isLoading && data.length > 0 && (
           <div className="space-y-6">
              
              {/* MAPEL TABS */}
              <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-2">
                {Object.keys(groupedData).map((mapelName, i) => {
                  const isActive = activeMapel ? activeMapel === mapelName : i === 0;
                  return (
                  <button
                    key={mapelName}
                    onClick={() => setActiveMapel(mapelName)}
                    className={`shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-colors border ${isActive ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                  >
                     {mapelName}
                  </button>
                )})}
              </div>

              <div className="space-y-12 mt-6">
                 {Object.entries(groupedData)
                    .filter(([mapelNama], i) => (activeMapel ? activeMapel === mapelNama : i === 0))
                    .map(([mapelNama, typeGroups]) => (
                <div key={mapelNama} className="bg-transparent rounded-2xl">
                  {/* MAPEL HEADER */}
                  <div className="flex items-center gap-3 mb-6 pb-2 border-b-2 border-gray-200">
                    <div className="bg-blue-600 text-white rounded p-1.5"><Layers size={20}/></div>
                    <h2 className="text-xl font-bold font-display text-gray-800 uppercase tracking-wider">{mapelNama}</h2>
                  </div>
                  
                  <div className="space-y-8 pl-0 md:pl-4">
                    {Object.entries(typeGroups).map(([tipeSoal, soals]) => (
                      <div key={tipeSoal} className="space-y-4">
                        {/* TYPE HEADER */}
                        <div className="inline-flex items-center gap-2 bg-purple-50 text-purple-800 border border-purple-100 px-3 py-1.5 rounded-lg shadow-sm">
                          <span className="text-sm font-bold tracking-wide">{tipeSoal.replace(/_/g, ' ')}</span>
                          <span className="bg-purple-200 text-purple-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{soals.length} Soal</span>
                        </div>
                        
                        <div className="space-y-4">
                          {soals.map((soal: any, idx: number) => {
                             const isExpanded = expandedSoalId === soal.id;
                             const answeredCount = soal.jawabanSantri.filter((j: any) => j.id).length;
                             const isEssay = soal.tipeSoal.startsWith("ESSAY");
                             
                             return (
                                <div key={soal.id} className={`bg-white rounded-xl shadow-sm border transition-all ${isExpanded ? 'border-primary ring-2 ring-primary/10 shadow-md transform -translate-y-0.5' : 'border-gray-200 hover:border-gray-300'}`}>
                                   
                                   {/* SOAL HEADER - CLICKABLE */}
                                   <div 
                                     className="p-4 md:p-5 flex flex-col md:flex-row gap-4 md:items-start cursor-pointer"
                                     onClick={() => setExpandedSoalId(isExpanded ? null : soal.id)}
                                   >
                                     {/* Info Number & Meta */}
                                     <div className="shrink-0 md:w-48">
                                        <div className="flex items-center gap-2 mb-2">
                                           <div className="flex bg-blue-50 text-blue-700 font-bold text-sm px-2.5 py-1 rounded-md border border-blue-100 shadow-sm items-center justify-center shrink-0">
                                             No {idx + 1}
                                           </div>
                                           <span className="text-[10px] uppercase font-bold tracking-widest text-gray-400">Bobot {soal.bobot}</span>
                                        </div>
                                     </div>
                                     
                                     {/* Content Soal */}
                                     <div className="flex-1 min-w-0">
                                        <div className="prose prose-sm max-w-none text-gray-800 !mb-0 max-h-32 overflow-hidden relative break-words" dangerouslySetInnerHTML={{ __html: soal.pertanyaan }} />
                                        {!isExpanded && (
                                           <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent pointer-events-none md:hidden"></div>
                                        )}
                                     </div>
                                     
                                     {/* Expand Indicator & Action */}
                                     <div className="shrink-0 flex items-center justify-between md:flex-col md:items-end gap-3 self-stretch md:w-48 border-t md:border-t-0 md:border-l pt-3 md:pt-0 md:pl-4">
                                        <div className="flex flex-col items-end gap-1.5 w-full">
                                           <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500">
                                              <Users_ico/> {answeredCount}/{soal.jawabanSantri.length} 
                                              <span className="font-medium text-[10px] truncate hidden md:block">menjawab</span>
                                           </div>
                                           
                                           {isEssay && answeredCount > 0 && (
                                             <button 
                                               onClick={(e) => { e.stopPropagation(); handleAIGradeSoal(soal.id, soal.jawabanSantri); }}
                                               disabled={isAIGrading === soal.id}
                                               className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[10px] font-bold uppercase transition mt-1 ${isAIGrading === soal.id ? 'bg-purple-100 text-purple-400' : 'bg-purple-50 hover:bg-purple-100 text-purple-600 border border-purple-100'}`}
                                             >
                                                <Brain size={12} className={isAIGrading === soal.id ? "animate-pulse" : ""} />
                                                {isAIGrading === soal.id ? "Proses..." : "Nilai AI"}
                                             </button>
                                           )}
                                        </div>
                                        
                                        <button className={`w-full flex items-center justify-center gap-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${isExpanded ? 'bg-primary/10 text-primary border-primary/20' : ''}`}>
                                           {isExpanded ? 'Tutup' : 'Cek Santri'}
                                           <ChevronDown size={14} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                        </button>
                                     </div>
                                   </div>
                                   
                                   {/* EXPANDED AREA - STUDENT LIST */}
                                   {isExpanded && (
                                     <div className="border-t border-gray-100 bg-gray-50/50 rounded-b-xl overflow-hidden">
                                        <div className="p-4 bg-purple-50/50 border-b border-purple-100/50">
                                           <h5 className="text-[11px] uppercase font-bold text-gray-500 mb-2">Referensi Kebenaran (Kunci)</h5>
                                           {renderKunciJawaban(soal)}
                                        </div>
                                        
                                        <div className="overflow-x-auto">
                                          <table className="w-full text-left text-sm table-fixed min-w-[600px]">
                                            <thead>
                                              <tr className="bg-gray-100/80 text-gray-500 uppercase tracking-wider text-[10px] font-bold border-b border-gray-200">
                                                <th className="px-4 py-3 w-48">Nama Santri</th>
                                                <th className="px-4 py-3">Jawaban Santri</th>
                                                <th className="px-4 py-3 w-32 text-center">Status / Skor</th>
                                                <th className="px-4 py-3 text-right w-40">Aksi Revisi</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 bg-white">
                                               {soal.jawabanSantri.slice(0, getLimit(soal.id)).map((jaw: any) => (
                                                 <tr key={jaw.id || jaw.santriNama} className="hover:bg-gray-50 transition-colors">
                                                   <td className="px-4 py-3">
                                                      <div className="font-bold text-gray-800 text-sm truncate">{jaw.santriNama}</div>
                                                      <div className="text-[10px] text-gray-400 font-medium">Session: {jaw.sesiStatus}</div>
                                                   </td>
                                                   
                                                   <td className="px-4 py-3">
                                                      {renderJawabanSantri(jaw, soal)}
                                                      {jaw.aiFeedback && (
                                                        <div className="mt-2 text-xs p-2 bg-purple-50 text-purple-800 rounded border border-purple-100 flex items-start gap-1.5">
                                                          <Brain size={12} className="shrink-0 mt-0.5 text-purple-600"/>
                                                          <span className="leading-relaxed">{jaw.aiFeedback}</span>
                                                        </div>
                                                      )}
                                                   </td>
                                                   
                                                   <td className="px-4 py-3 text-center align-middle">
                                                      {renderStatus(jaw, soal)}
                                                   </td>
                                                   
                                                   <td className="px-4 py-3 text-right">
                                                      {editingJawabanId === (jaw.id || "dummy") ? (
                                                         <div className="flex flex-col items-end gap-1.5">
                                                            <input 
                                                              type="number" 
                                                              max={soal.bobot} min={0} 
                                                              value={editScore}
                                                              onChange={(e) => setEditScore(Number(e.target.value))}
                                                              className="neu-input w-20 py-1.5 px-2 text-center text-sm font-bold border rounded-lg focus:ring focus:ring-blue-200"
                                                            />
                                                            <div className="flex justify-end gap-1">
                                                              <button onClick={() => handleUpdateNilai(jaw.id)} disabled={isUpdating} className="p-1.5 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"><Save size={14}/></button>
                                                              <button onClick={() => setEditingJawabanId(null)} className="p-1.5 bg-gray-200 text-gray-600 rounded hover:bg-gray-300"><X size={14}/></button>
                                                            </div>
                                                         </div>
                                                      ) : jaw.id ? (
                                                        EXACT_TYPES.includes(soal.tipeSoal) ? (
                                                          <div className="flex flex-col gap-1 items-end w-24 ml-auto">
                                                            <button 
                                                              disabled={isUpdating}
                                                              onClick={() => { setEditingJawabanId(jaw.id); setEditScore(soal.bobot); setTimeout(() => handleUpdateNilai(jaw.id, soal.bobot), 0); }}
                                                              className="w-full px-2 py-1 bg-green-50 text-green-700 border border-green-200 font-bold rounded hover:bg-green-100 flex items-center justify-center gap-1 text-[10px] transition-colors"
                                                            >
                                                              <CheckCircle2 size={12}/> Benarkan
                                                            </button>
                                                            <button 
                                                              disabled={isUpdating}
                                                              onClick={() => { setEditingJawabanId(jaw.id); setEditScore(0); setTimeout(() => handleUpdateNilai(jaw.id, 0), 0); }}
                                                              className="w-full px-2 py-1 bg-rose-50 text-rose-700 border border-rose-200 font-bold rounded hover:bg-rose-100 flex items-center justify-center gap-1 text-[10px] transition-colors"
                                                            >
                                                              <XCircle size={12}/> Salahkan
                                                            </button>
                                                            {jaw.nilaiManual !== null && (
                                                              <button disabled={isUpdating} onClick={() => { setEditingJawabanId(jaw.id); setEditScore(-1); setTimeout(() => handleUpdateNilai(jaw.id, null), 0); }} className="text-[9px] text-gray-400 mt-0.5 hover:text-gray-600 underline">Reset Auto</button>
                                                            )}
                                                          </div>
                                                        ) : (
                                                          <React.Fragment>
                                                            <button 
                                                              onClick={() => { setEditingJawabanId(jaw.id); setEditScore(jaw.nilaiManual !== null ? jaw.nilaiManual : 0); }}
                                                              className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-50 flex items-center gap-1.5 ml-auto text-xs"
                                                            >
                                                              <Edit3 size={13}/> {jaw.nilaiManual !== null ? 'Revisi' : 'Beri Nilai'}
                                                            </button>
                                                            {jaw.nilaiManual !== null && (
                                                              <button disabled={isUpdating} onClick={() => { setEditingJawabanId(jaw.id); setEditScore(-1); setTimeout(() => handleUpdateNilai(jaw.id, null), 0); }} className="text-[10px] text-gray-400 mt-2 block w-full text-right hover:text-gray-600 underline">Reset Auto</button>
                                                            )}
                                                          </React.Fragment>
                                                        )
                                                      ) : (
                                                        <span className="text-gray-300 text-[10px] font-bold uppercase block">-</span>
                                                      )}
                                                   </td>
                                                 </tr>
                                               ))}
                                            </tbody>
                                          </table>
                                        </div>
                                        
                                        {/* LOAD MORE BUTTON */}
                                        {soal.jawabanSantri.length > getLimit(soal.id) && (
                                           <div className="p-3 bg-gray-50/80 border-t border-gray-100 flex justify-center">
                                             <button 
                                               onClick={() => setSantriLimits(p => ({ ...p, [soal.id]: getLimit(soal.id) + 20 }))}
                                               className="text-xs font-bold text-blue-600 bg-blue-50/50 border border-blue-100 px-6 py-2 rounded-lg hover:bg-blue-100 transition-colors"
                                             >
                                               Tampilkan Lebih Banyak ({Math.min(getLimit(soal.id), soal.jawabanSantri.length)} dari {soal.jawabanSantri.length} Santri)
                                             </button>
                                           </div>
                                        )}
                                     </div>
                                   )}
                                </div>
                             );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Users_ico() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
  );
}
