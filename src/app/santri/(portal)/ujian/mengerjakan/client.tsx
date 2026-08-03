"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Clock, ShieldAlert, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, Send } from "lucide-react";
import toast from "react-hot-toast";
import SoalText from "@/components/soal-text";

export default function ClientMengerjakanUjian() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sesiId = searchParams.get("s");

  const [examData, setExamData] = useState<any>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [secureMode, setSecureMode] = useState(false);

  // Anti-cheat refs
  const hasSubmitted = useRef(false);
  const isSaving = useRef(false);

  useEffect(() => {
    if (!sesiId) return router.replace("/santri/ujian");
    
    // Attempt to load from sessionStorage
    const stored = sessionStorage.getItem(`exam_${sesiId}`);
    if (!stored) {
      toast.error("Data ujian tidak ditemukan. Harap login kembali.");
      router.replace("/santri/ujian");
      return;
    }

    const parsed = JSON.parse(stored);
    
    // Validasi: data harus punya sisaWaktuDetik atau predictedEndTime (format baru)
    // Jika tidak ada keduanya, berarti data cache lama/rusak — hapus dan minta login ulang
    if (parsed.sisaWaktuDetik === undefined && !parsed.predictedEndTime) {
      sessionStorage.removeItem(`exam_${sesiId}`);
      toast.error("Sesi ujian kedaluwarsa. Silakan masuk ujian kembali dari menu Ujian.");
      router.replace("/santri/ujian");
      return;
    }

    // Hitung sisa waktu
    let remaining = 0;
    if (parsed.predictedEndTime) {
       // Resume: hitung dari prediksi absolute yang sudah disimpan
       remaining = Math.max(0, Math.floor((parsed.predictedEndTime - Date.now()) / 1000));
    } else {
       // Pertama kali di-load dari start API — simpan prediksi absolute
       parsed.predictedEndTime = Date.now() + (parsed.sisaWaktuDetik * 1000);
       sessionStorage.setItem(`exam_${sesiId}`, JSON.stringify(parsed));
       remaining = parsed.sisaWaktuDetik;
    }

    setExamData(parsed);
    setTimeLeft(remaining);

    // Jangan auto-submit di sini saat mount — biarkan timer effect yang menanganinya
    // setelah user benar-benar menekan tombol "Mulai Ujian"
  }, [sesiId, router]);

  // Grace period 2.5s before strict anti-cheat activates 
  // (to prevent 'blur'/'resize' triggering immediately on fullscreen animation)
  useEffect(() => {
    if (hasStarted) {
      const timer = setTimeout(() => setSecureMode(true), 2500);
      return () => clearTimeout(timer);
    }
  }, [hasStarted]);

  // Handle Fullscreen & Anti-Cheat
  useEffect(() => {
    if (!secureMode || hasSubmitted.current) return;

    // 1. Block Keyboard Shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) {
        e.preventDefault();
      }
      // Block F5, F11, F12
      if (['F5', 'F11', 'F12'].includes(e.key)) {
        e.preventDefault();
      }
    };

    // 2. Disable Context Menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // 3. Tab Visibility Change & Auto Submit
    const handleVisibilityChange = () => {
      if (document.hidden && !hasSubmitted.current) {
        // SANTRI CHEATED by switching tabs/windows!
        handleAutoSubmit("TAB_CLOSE");
      }
    };

    // 4. Before Unload confirmation (TIDAK LAGI AUTO-SUBMIT)
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasSubmitted.current) {
        e.preventDefault();
        e.returnValue = ''; // Required for most browsers to show confirmation dialog
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [secureMode, sesiId]);

  // Timer countdown effect — hanya menghitung mundur, tidak trigger auto-submit
  useEffect(() => {
    if (!hasStarted || hasSubmitted.current || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [hasStarted, timeLeft]);

  // Auto-submit saat waktu habis — terpisah dari timer agar tidak terjebak closure basi
  useEffect(() => {
    if (hasStarted && timeLeft <= 0 && !hasSubmitted.current && examData) {
      handleAutoSubmit("TIME_UP");
    }
  }, [timeLeft, hasStarted, examData]);


  const enterFullscreen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        toast.error("Browser Anda menolak fullscreen. Harap izinkan popup/fullscreen.");
      });
    }
  };

  const handleMulai = () => {
    enterFullscreen();
    setHasStarted(true);
  };

  const handleAutoSubmit = async (reason: string) => {
    if (hasSubmitted.current) return;
    hasSubmitted.current = true;
    setIsSubmitting(true);
    
    // Hapus local storage
    if (sesiId) sessionStorage.removeItem(`exam_${sesiId}`);
    
    // Keluar fullscreen
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }

    try {
      const res = await fetch("/api/santri/ujian/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sesiId, reason })
      });
      if (res.ok) {
        toast.error("Ujian otomatis di-submit karena alasan keamanan / waktu habis.");
        router.replace(`/santri/ujian/hasil?s=${sesiId}`);
      }
    } catch {
       router.replace("/santri/ujian");
    }
  };

  const handleManualSubmit = async () => {
    if (hasSubmitted.current) return;
    hasSubmitted.current = true;
    setIsSubmitting(true);
    
    if (sesiId) sessionStorage.removeItem(`exam_${sesiId}`);
    
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }

    try {
      const res = await fetch("/api/santri/ujian/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sesiId, reason: "MANUAL" })
      });
      if (res.ok) {
        toast.success("Berhasil mensubmit ujian Anda.");
        router.replace(`/santri/ujian/hasil?s=${sesiId}`);
      } else {
        throw new Error("Failed");
      }
    } catch (err) {
       toast.error("Gagal submit. Server tidak merespon.");
       router.replace("/santri/ujian");
    }
  };

  const handleAnswerSelect = async (soalId: string, opsiId: string) => {
    if (isSaving.current || hasSubmitted.current) return;
    
    // Optimistic UI Update
    const newExamData = { ...examData };
    const curSoal = newExamData.soal.find((s:any) => s.soalId === soalId);
    if (!curSoal) return;
    
    curSoal.opsiTerpilih = opsiId;
    setExamData(newExamData);
    sessionStorage.setItem(`exam_${sesiId}`, JSON.stringify(newExamData));
    
    // Async save to DB
    isSaving.current = true;
    try {
      await fetch("/api/santri/ujian/jawab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sesiId,
          soalId,
          opsiId
        })
      });
    } catch (error) {
      console.error("Gagal auto-save:", error);
      // Silently fail but user will still have local state
    } finally {
      isSaving.current = false;
    }
  };

  const toggleRagu = async () => {
    if (hasSubmitted.current) return;
    const curSoal = examData.soal[currentIdx];
    const newRagu = (curSoal.rpiId === "RAGU") ? null : "RAGU";
    
    const newExamData = { ...examData };
    newExamData.soal[currentIdx].rpiId = newRagu;
    setExamData(newExamData);
    sessionStorage.setItem(`exam_${sesiId}`, JSON.stringify(newExamData));
    
    try {
      await fetch("/api/santri/ujian/jawab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sesiId,
          soalId: curSoal.soalId,
          opsiId: curSoal.opsiTerpilih, // retain
          rpiId: newRagu
        })
      });
    } catch (e) {}
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!examData) return <div className="min-h-screen flex items-center justify-center bg-gray-100">Memuat Sesi...</div>;

  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-white md:bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-sm md:shadow-lg text-center border-t-8 border-t-blue-600">
          <div className="mx-auto w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6">
            <AlertTriangle size={32} />
          </div>
          <h1 className="text-2xl font-bold font-display text-gray-800 mb-2">Siap Memulai Ujian?</h1>
          <p className="text-gray-500 mb-6 px-4">
            Saat tombol ditekan, browser akan masuk mode <strong>Fullscreen</strong>. Jangan berpindah tab atau menutup jendela ujian.
          </p>
          <div className="bg-orange-50 text-orange-800 border border-orange-100 rounded-xl p-4 text-sm text-left mb-8 shadow-inner">
            <strong>PERINGATAN:</strong> Segala bentuk perpindahan jendela, notifikasi yang menggeser fokus browser, atau keluar dari Fullscreen akan otomatis menyelesaikan (Submit) ujian Anda.
          </div>
          <button 
            onClick={handleMulai}
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl text-lg hover:bg-blue-700 transition shadow-md shadow-blue-200"
          >
            SAYA SIAP, MULAI UJIAN
          </button>
        </div>
      </div>
    );
  }

  // EXAM UI (FULLSCREEN)
  if (!examData || !examData.soal || examData.soal.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center">
        <h2 className="text-xl font-bold mb-4">Memuat Data Ujian...</h2>
        <p className="text-gray-500 text-sm">Jika tidak memuat, silakan muat ulang halaman atau login kembali.</p>
      </div>
    );
  }

  // Failsafe jika currentIdx di luar batas (misal dari cache lama saat mapel ditambah admin)
  if (!examData.soal[currentIdx] && currentIdx > 0) {
    setCurrentIdx(0);
    return null;
  }

  const soal = examData.soal[currentIdx];
  const answeredCount = examData.soal.filter((s:any) => !!s.opsiTerpilih).length;
  const isLastQuestion = currentIdx === examData.soal.length - 1;

  if (showSummary) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex items-center justify-center">
        <div className="bg-white rounded-3xl max-w-2xl w-full p-8 shadow-xl">
          <h1 className="text-2xl font-bold font-display text-gray-800 mb-6 pb-4 border-b">Ringkasan Ujian</h1>
          
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-blue-50 p-4 rounded-2xl text-center border border-blue-100">
               <div className="text-3xl font-black text-blue-700 mb-1">{answeredCount}</div>
               <div className="text-xs font-bold text-blue-600 uppercase tracking-wider">Soal Terjawab</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-2xl text-center border border-gray-200">
               <div className="text-3xl font-black text-gray-700 mb-1">{examData.soal.length - answeredCount}</div>
               <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Belum Dijawab</div>
            </div>
          </div>

          <p className="text-gray-600 text-center mb-8">
            Apakah Anda yakin ingin menyelesaikan ujian? Anda tidak akan dapat kembali untuk mengubah jawaban.
          </p>

          <div className="flex gap-4">
             <button onClick={() => setShowSummary(false)} className="flex-1 py-3.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition">
               Batal, Kembali ke Soal
             </button>
             <button 
               onClick={handleManualSubmit}
               disabled={isSubmitting}
               className="flex-1 py-3.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-md shadow-green-200 transition flex justify-center items-center gap-2"
             >
               {isSubmitting ? "Mengirim Jawaban..." : <><Send size={18}/> Kumpulkan Jawaban</>}
             </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans selection:bg-blue-100">
      
      {/* Hide Global Navigasi Saat CBT */}
      {hasStarted && !hasSubmitted.current && !showSummary && (
        <style dangerouslySetInnerHTML={{__html: `
          aside { display: none !important; }
          .app-footer { display: none !important; }
          .santri-bottom-nav, nav.fixed.bottom-0 { display: none !important; }
          .santri-mobile-menu-btn { display: none !important; }
          body { overflow: hidden !important; overscroll-behavior: none; }
        `}} />
      )}
      
      {/* LEFT: Soal Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden px-4 md:px-0">
        
        {/* Header - Timer */}
        <div className="bg-white px-6 py-4 border-b flex justify-between items-center shadow-sm z-10 shrink-0 sticky top-0 md:static">
           <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-[var(--color-primary)] text-white font-bold text-lg rounded-xl flex items-center justify-center shadow-sm">
               {soal.urutanUI}
             </div>
             <div>
                <h1 className="font-bold text-sm text-gray-800 uppercase tracking-wide">SOAL {soal.urutanUI} DARI {examData.soal.length}</h1>
                <p className="text-[10px] sm:text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 mt-0.5 rounded-full inline-block">Mata Pelajaran</p>
             </div>
           </div>
           
           <div className={`flex items-center gap-2 px-4 py-2 bg-gradient-to-r rounded-xl shadow-inner font-mono font-bold text-lg md:text-xl transition-colors ${timeLeft < 300 ? 'from-red-600 to-rose-500 text-white shadow-red-200 animate-pulse' : 'from-gray-100 to-gray-50 text-gray-800 border'}`}>
             <Clock size={20} />
             {formatTime(timeLeft)}
           </div>
        </div>

        {/* Soal Content */}
        <div className="flex-1 overflow-y-auto w-full md:w-4/5 mx-auto p-4 md:p-8 scroll-smooth pb-32 md:pb-8">
           <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 mb-6">
              {soal.gambarUrl && (
                <div className="mb-6 flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={soal.gambarUrl} alt="Soal Image" className="max-w-full max-h-[300px] rounded-xl border border-gray-200 shadow-sm" />
                </div>
              )}
              <SoalText 
                html={soal.pertanyaan}
                className="text-base md:text-xl font-medium text-gray-800 leading-relaxed font-serif prose max-w-none block" 
              />
           </div>

           <div className="space-y-4">
             {soal.opsiList.map((opt:any, index:number) => {
               const isSelected = soal.opsiTerpilih === opt.id;
               return (
                 <label 
                   key={opt.id} 
                   className={`flex gap-4 p-4 md:p-5 rounded-2xl cursor-pointer transition-all border-2 group ${isSelected ? 'bg-blue-50 border-blue-500 shadow-sm shadow-blue-100' : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                 >
                   <div className="pt-0.5">
                     <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full border-2 flex items-center justify-center text-xs md:text-sm font-bold transition-colors ${isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 text-gray-500 group-hover:border-blue-400 group-hover:text-blue-500'}`}>
                       {String.fromCharCode(65 + index)}
                     </div>
                   </div>
                   <div className="flex-1">
                     <input 
                       type="radio" 
                       name={`opsi-${soal.soalId}`} 
                       className="hidden" 
                       checked={isSelected}
                       onChange={() => handleAnswerSelect(soal.soalId, opt.id)}
                     />
                     <SoalText
                       html={opt.teks}
                       className={`text-sm md:text-base transition-colors block ${isSelected ? 'font-medium text-blue-900' : 'text-gray-700'}`} 
                     />
                     {opt.gambarUrl && (
                       <div className="mt-3">
                         {/* eslint-disable-next-line @next/next/no-img-element */}
                         <img src={opt.gambarUrl} alt={`Opsi ${String.fromCharCode(65 + index)} Image`} className="max-w-full max-h-[200px] rounded-lg border border-gray-200 shadow-sm" />
                       </div>
                     )}
                   </div>
                 </label>
               );
             })}
           </div>
        </div>

        {/* Footer Navigation Overlay on Mobile */}
        <div className="fixed bottom-0 left-0 right-0 md:w-[calc(100%-20rem)] lg:w-[calc(100%-22rem)] bg-white border-t p-3 sm:p-4 flex gap-2 md:gap-4 justify-between items-center z-20 shadow-[0_-10px_40px_-5px_rgba(0,0,0,0.05)]">
           <button 
             onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
             disabled={currentIdx === 0}
             className="px-2 md:px-5 py-2.5 sm:py-3 rounded-xl bg-gray-100 font-bold text-gray-700 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition flex gap-1 sm:gap-2 items-center flex-1 sm:flex-none justify-center text-[11px] sm:text-sm"
           >
             <ChevronLeft size={18}/> <span className="hidden sm:inline">Soal</span> Sebelumnya
           </button>
           
           <button 
             onClick={toggleRagu}
             className={`px-3 md:px-5 py-2.5 sm:py-3 rounded-xl font-bold flex gap-1 sm:gap-2 items-center transition border flex-1 sm:flex-none justify-center text-[11px] sm:text-sm ${soal.rpiId === 'RAGU' ? 'bg-orange-50 border-orange-300 text-orange-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
           >
             {soal.rpiId === 'RAGU' ? <CheckCircle2 size={16}/> : <AlertTriangle size={16}/>} 
             Ragu<span className="hidden sm:inline">-Ragu</span>
           </button>
           
           <button 
             onClick={() => {
               if (isLastQuestion) setShowSummary(true);
               else setCurrentIdx(Math.min(examData.soal.length - 1, currentIdx + 1));
             }}
             className="px-2 md:px-5 py-2.5 sm:py-3 rounded-xl bg-blue-600 font-bold text-white hover:bg-blue-700 shadow-md shadow-blue-200 transition flex gap-1 sm:gap-2 items-center flex-1 sm:flex-none justify-center text-[11px] sm:text-sm"
           >
             {isLastQuestion ? (
               <><span className="hidden sm:inline">Selesai</span> Akhiri <CheckCircle2 size={18}/></>
             ) : (
               <><span className="hidden sm:inline">Soal</span> Berikutnya <ChevronRight size={18}/></>
             )}
           </button>
        </div>
      </div>

      {/* RIGHT: Grid Navigasi Soal (Desktop only by default, but hidden correctly in footer block on mobile if we wanted) */}
      <div className="hidden md:flex flex-col w-80 lg:w-88 bg-white border-l h-screen sticky top-0 shrink-0 shadow-[-5px_0_15px_-5px_rgba(0,0,0,0.02)]">
        <div className="p-5 border-b bg-gray-50/50">
          <h3 className="font-bold font-display text-gray-800">Navigasi Pengerjaan</h3>
          <div className="flex items-center gap-2 mt-2 pt-2 border-t">
            <div className="flex-1 bg-gray-200 h-2 rounded-full overflow-hidden">
               <div className="bg-green-500 h-full rounded-full transition-all" style={{ width: `${(answeredCount / examData.soal.length) * 100}%` }}></div>
            </div>
            <span className="text-xs font-bold text-gray-500">{answeredCount}/{examData.soal.length}</span>
          </div>
        </div>
        
        <div className="p-5 overflow-y-auto flex-1">
          <div className="grid grid-cols-5 lg:grid-cols-6 gap-2 xl:gap-3">
             {examData.soal.map((s:any, idx:number) => {
               const Active = currentIdx === idx;
               const Answered = !!s.opsiTerpilih;
               const Ragu = s.rpiId === "RAGU";
               
               let classes = "h-11 w-full rounded-lg font-bold text-sm flex items-center justify-center transition-all border-2 cursor-pointer shadow-sm active:scale-95 text-center ";
               
               if (Active) {
                 classes += "border-blue-600 ring-2 ring-blue-200 bg-white text-blue-700";
               } else if (Ragu) {
                 classes += "bg-orange-400 border-orange-500 text-white";
               } else if (Answered) {
                 classes += "bg-green-500 border-green-600 text-white";
               } else {
                 classes += "bg-white border-gray-200 text-gray-500 hover:border-gray-300";
               }

               return (
                 <button 
                   key={s.soalId}
                   onClick={() => setCurrentIdx(idx)}
                   className={classes}
                 >
                   {idx + 1}
                 </button>
               );
             })}
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50 shrink-0">
          <div className="flex flex-col gap-2 mb-4">
             <div className="flex items-center gap-2 text-xs font-semibold text-gray-600"><div className="w-4 h-4 bg-green-500 rounded border border-green-600 shrink-0"></div> Terjawab</div>
             <div className="flex items-center gap-2 text-xs font-semibold text-gray-600"><div className="w-4 h-4 bg-orange-400 rounded border border-orange-500 shrink-0"></div> Ragu-ragu</div>
             <div className="flex items-center gap-2 text-xs font-semibold text-gray-600"><div className="w-4 h-4 bg-white rounded border-2 border-gray-200 shrink-0"></div> Belum Dijawab</div>
          </div>
          <button 
             onClick={() => setShowSummary(true)} 
             className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 shadow-md transition-colors"
          >
             Selesai Ujian
          </button>
        </div>
      </div>
    </div>
  );
}
