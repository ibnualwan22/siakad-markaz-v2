"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Clock, ShieldAlert, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, Send, Grid3X3, X } from "lucide-react";
import toast from "react-hot-toast";
import SoalText from "@/components/soal-text";
import QuestionRenderer from "@/components/ujian/QuestionRenderer";

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
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Anti-cheat refs
  const hasSubmitted = useRef(false);

  const wakeLockRef = useRef<any>(null);
  const baselineHeightRef = useRef<number>(0);
  const showSummaryRef = useRef(false);

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

  // Sync ref so async anti-cheat callbacks can check current summary state
  useEffect(() => {
    showSummaryRef.current = showSummary;
  }, [showSummary]);

  // Wake Lock API to prevent screen from sleeping during the exam
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator && !hasSubmitted.current) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch (err: any) {
      console.warn(`Wake Lock request failed: ${err.message}`);
    }
  };

  useEffect(() => {
    if (hasStarted && !hasSubmitted.current) {
      requestWakeLock();
      
      // Re-request if visibility changes back to visible (though our anti-cheat usually handles tab switches)
      const handleVisChange = () => {
        if (document.visibilityState === 'visible') {
          requestWakeLock();
        }
      };
      
      document.addEventListener("visibilitychange", handleVisChange);
      
      return () => {
        document.removeEventListener("visibilitychange", handleVisChange);
        if (wakeLockRef.current) {
          wakeLockRef.current.release().catch(() => {});
          wakeLockRef.current = null;
        }
      };
    }
  }, [hasStarted]);

  // Handle Fullscreen & Anti-Cheat
  useEffect(() => {
    if (!secureMode || hasSubmitted.current) return;

    // ── Platform Detection ──
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    // 1. Block Keyboard Shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) {
        e.preventDefault();
      }
      if (['F5', 'F11', 'F12'].includes(e.key)) {
        e.preventDefault();
      }
    };

    // 2. Disable Context Menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // 3. Tab Visibility Change & Auto Submit
    //    iOS: grace 5s (swipe gesture / notifikasi sekilas bisa trigger hidden)
    //    Android: grace 5s (cukup untuk notifikasi sekilas, tapi tidak cukup untuk buka WA/ChatGPT)
    const VISIBILITY_GRACE = isIOS ? 5000 : 5000;
    let visibilityTimer: ReturnType<typeof setTimeout> | null = null;
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Tab kembali visible — batalkan pending submit
        if (visibilityTimer) { clearTimeout(visibilityTimer); visibilityTimer = null; }
        return;
      }
      if (hasSubmitted.current) return;

      visibilityTimer = setTimeout(() => {
        if (document.hidden && !hasSubmitted.current && !showSummaryRef.current) {
          handleAutoSubmit("TAB_CLOSE");
        }
      }, VISIBILITY_GRACE);
    };

    // 4. Before Unload confirmation
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasSubmitted.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    // 5. Blur Detection — catches floating/overlay apps
    //    iOS: grace 8s (Safari toolbar collapse/expand sering trigger blur)
    //    Android: grace 5s
    let blurTimer: ReturnType<typeof setTimeout> | null = null;
    const BLUR_GRACE = isIOS ? 8000 : 5000;

    const isVirtualKeyboardOpen = () => {
      if (window.visualViewport) {
        return window.innerHeight - window.visualViewport.height > 150;
      }
      return false;
    };

    const handleBlur = () => {
      if (hasSubmitted.current) return;
      if (isVirtualKeyboardOpen()) return;

      blurTimer = setTimeout(() => {
        if (!document.hasFocus() && !hasSubmitted.current && !showSummaryRef.current && !isVirtualKeyboardOpen()) {
          handleAutoSubmit("FLOATING_APP");
        }
      }, BLUR_GRACE);
    };

    const handleFocus = () => {
      if (blurTimer) { clearTimeout(blurTimer); blurTimer = null; }
    };

    // 6. Periodic Focus Check — backup for devices where blur doesn't fire
    //    DIMATIKAN di iOS karena hasFocus() sering false saat animasi keyboard
    let focusCheckInterval: ReturnType<typeof setInterval> | undefined;
    if (!isIOS) {
      focusCheckInterval = setInterval(() => {
        if (!document.hasFocus() && !document.hidden && !hasSubmitted.current && !showSummaryRef.current) {
          if (isVirtualKeyboardOpen()) return;
          handleAutoSubmit("FOCUS_LOST");
        }
      }, 5000);
    }

    // 7. Split-Screen Detection (Android only)
    //    Bandingkan innerHeight saat ini vs baseline saat mulai ujian
    //    Jika menyusut >35% tanpa keyboard → split-screen terdeteksi
    //    PENTING: Skip saat orientasi berubah (auto-rotate)
    const orientationGraceRef = { active: false };
    
    const handleOrientationChange = () => {
      // Saat rotasi layar, update baseline dan beri grace period 1.5s
      orientationGraceRef.active = true;
      setTimeout(() => {
        baselineHeightRef.current = window.innerHeight;
        orientationGraceRef.active = false;
      }, 1500);
    };

    const handleResize = () => {
      if (hasSubmitted.current || isIOS || showSummaryRef.current) return;
      if (orientationGraceRef.active) return; // Skip saat rotasi

      const baseline = baselineHeightRef.current;
      if (!baseline) return;

      const currentHeight = window.innerHeight;
      const shrinkRatio = currentHeight / baseline;

      // Cek apakah ini rotasi (luas layar relatif sama) atau split-screen (luas menyusut)
      const currentArea = window.innerWidth * window.innerHeight;
      const baselineArea = (window.screen?.width || window.innerWidth) * (window.screen?.height || window.innerHeight);
      const areaShrink = baselineArea > 0 ? currentArea / baselineArea : 1;

      // Split-screen: height menyusut >35% DAN luas layar juga menyusut >30%
      if (shrinkRatio < 0.65 && areaShrink < 0.7 && !isVirtualKeyboardOpen()) {
        handleAutoSubmit("SPLIT_SCREEN");
      }
    };

    // Listen untuk orientation change event
    window.addEventListener("orientationchange", handleOrientationChange);

    // 8. Keyboard-Aware Auto-Scroll — saat keyboard muncul, scroll input ke tengah
    const handleViewportResize = () => {
      const active = document.activeElement as HTMLElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        setTimeout(() => {
          active.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("resize", handleResize);
    window.visualViewport?.addEventListener("resize", handleViewportResize);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleOrientationChange);
      window.visualViewport?.removeEventListener("resize", handleViewportResize);
      if (focusCheckInterval) clearInterval(focusCheckInterval);
      if (blurTimer) clearTimeout(blurTimer);
      if (visibilityTimer) clearTimeout(visibilityTimer);
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

  // Polling Real-Time Force Submit Detection
  // Mengecek ke server setiap 15 detik apakah sesi ini sudah dipaksa submit oleh admin
  useEffect(() => {
    if (!hasStarted || hasSubmitted.current || !sesiId) return;

    const pullStatus = async () => {
      try {
        const res = await fetch(`/api/santri/ujian/status?sesiId=${sesiId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status && data.status !== "MENGERJAKAN" && !hasSubmitted.current) {
          hasSubmitted.current = true;
          // Keluar fullscreen
          if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          }
          toast.error("Ujian telah diakhiri oleh Pengawas/Admin.");
          router.replace(`/santri/ujian/hasil?s=${sesiId}`);
        }
      } catch (err) {
        // Abaikan error jaringan saat polling
      }
    };

    const interval = setInterval(pullStatus, 15000);
    return () => clearInterval(interval);
  }, [hasStarted, sesiId, router]);

  // Track Fullscreen status for fallback UI
  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

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
    baselineHeightRef.current = window.innerHeight;
    enterFullscreen();
    setHasStarted(true);
  };

  // ===== FLUSH SEMUA JAWABAN KE DB SEBELUM SUBMIT =====
  const flushAllAnswersToDb = async () => {
    // 1. Tunggu queue selesai diproses
    while (isProcessingQueueRef.current || saveQueueRef.current.length > 0) {
      await new Promise(r => setTimeout(r, 300));
    }

    // 2. Final batch sync — kirim SEMUA jawaban dari sessionStorage ke DB
    const stored = sessionStorage.getItem(`exam_${sesiId}`);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (!parsed.soal) return;
      const answeredSoal = parsed.soal.filter((s: any) =>
        s.opsiTerpilih || s.jawabanTeks || (s.jawabanData && Object.keys(s.jawabanData).length > 0)
      );
      // Kirim semua jawaban secara paralel (batch) — lebih cepat dari serial
      await Promise.allSettled(
        answeredSoal.map((s: any) => {
          const payload: any = {};
          if (s.opsiTerpilih) payload.opsiId = s.opsiTerpilih;
          if (s.jawabanTeks) payload.jawabanTeks = s.jawabanTeks;
          if (s.jawabanData && Object.keys(s.jawabanData).length > 0) payload.jawabanData = s.jawabanData;
          if (s.rpiId) payload.rpiId = s.rpiId;
          return fetch("/api/santri/ujian/jawab", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sesiId, soalId: s.soalId, ...payload })
          });
        })
      );
    } catch (e) {
      console.error("[FLUSH] Error pada final flush:", e);
    }
  };

  const handleAutoSubmit = async (reason: string) => {
    if (hasSubmitted.current) return;
    hasSubmitted.current = true;
    setIsSubmitting(true);

    // PENTING: Flush semua jawaban ke DB sebelum submit
    await flushAllAnswersToDb();
    
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

    // PENTING: Flush semua jawaban ke DB sebelum submit
    await flushAllAnswersToDb();
    
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

  // ===== QUEUE-BASED SAVE SYSTEM =====
  // Instead of dropping saves when one is in-flight (old isSaving.current guard),
  // we queue them and process sequentially with retry.
  const saveQueueRef = useRef<Array<{ soalId: string; payload: any }>>([]);
  const isProcessingQueueRef = useRef(false);
  const failedSoalIdsRef = useRef<Set<string>>(new Set());
  const [unsavedCount, setUnsavedCount] = useState(0);

  const processQueue = async () => {
    if (isProcessingQueueRef.current || hasSubmitted.current) return;
    isProcessingQueueRef.current = true;

    while (saveQueueRef.current.length > 0) {
      const item = saveQueueRef.current[0];
      let success = false;

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch("/api/santri/ujian/jawab", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sesiId,
              soalId: item.soalId,
              ...item.payload
            })
          });
          if (res.ok) {
            success = true;
            failedSoalIdsRef.current.delete(item.soalId);
            break;
          }
        } catch (error) {
          // Network error — retry after delay
        }
        if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
      }

      saveQueueRef.current.shift();

      if (!success) {
        // Track failed save so batch sync can retry it
        failedSoalIdsRef.current.add(item.soalId);
        console.error(`[SAVE] Gagal simpan jawaban soal ${item.soalId} setelah 3 percobaan — batch sync akan mencoba ulang`);
      }

      setUnsavedCount(saveQueueRef.current.length + failedSoalIdsRef.current.size);
    }

    isProcessingQueueRef.current = false;
  };

  const handleAnswerSubmit = async (soalId: string, payload: { opsiId?: string, jawabanTeks?: string, jawabanData?: any }) => {
    if (hasSubmitted.current) return;
    
    // Optimistic UI + SessionStorage Update (always succeeds)
    const newExamData = { ...examData };
    const curSoal = newExamData.soal.find((s:any) => s.soalId === soalId);
    if (!curSoal) return;
    
    if (payload.opsiId !== undefined) curSoal.opsiTerpilih = payload.opsiId;
    if (payload.jawabanTeks !== undefined) curSoal.jawabanTeks = payload.jawabanTeks;
    if (payload.jawabanData !== undefined) curSoal.jawabanData = payload.jawabanData;

    setExamData(newExamData);
    sessionStorage.setItem(`exam_${sesiId}`, JSON.stringify(newExamData));
    
    // Replace existing queue entry for same soalId (latest answer wins)
    saveQueueRef.current = saveQueueRef.current.filter(q => q.soalId !== soalId);
    saveQueueRef.current.push({ soalId, payload });
    setUnsavedCount(saveQueueRef.current.length);

    // Trigger queue processing
    processQueue();
  };

  // Periodic batch sync: every 30 seconds, push ALL answers from sessionStorage to DB as failsafe
  // Juga berjalan segera saat pertama kali start (delay 5 detik)
  useEffect(() => {
    if (!hasStarted || hasSubmitted.current || !sesiId) return;

    const batchSync = async () => {
      if (hasSubmitted.current || isProcessingQueueRef.current) return;
      const stored = sessionStorage.getItem(`exam_${sesiId}`);
      if (!stored) return;
      
      try {
        const parsed = JSON.parse(stored);
        if (!parsed.soal) return;
        
        // Kirim SEMUA jawaban yang sudah terisi
        const answeredSoal = parsed.soal.filter((s: any) => 
          s.opsiTerpilih || s.jawabanTeks || (s.jawabanData && Object.keys(s.jawabanData).length > 0)
        );
        
        let syncedCount = 0;
        for (const s of answeredSoal) {
          if (hasSubmitted.current) break;
          const payload: any = {};
          if (s.opsiTerpilih) payload.opsiId = s.opsiTerpilih;
          if (s.jawabanTeks) payload.jawabanTeks = s.jawabanTeks;
          if (s.jawabanData && Object.keys(s.jawabanData).length > 0) payload.jawabanData = s.jawabanData;
          if (s.rpiId) payload.rpiId = s.rpiId;
          
          try {
            const res = await fetch("/api/santri/ujian/jawab", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sesiId, soalId: s.soalId, ...payload })
            });
            if (res.ok) {
              failedSoalIdsRef.current.delete(s.soalId);
              syncedCount++;
            }
          } catch (e) {
            // Will retry on next batch sync cycle
          }
        }

        if (syncedCount > 0) {
          setUnsavedCount(saveQueueRef.current.length + failedSoalIdsRef.current.size);
        }
      } catch (e) {
        console.error("[BATCH-SYNC] Error:", e);
      }
    };

    // Jalankan batch sync pertama kali setelah 5 detik
    const initialTimeout = setTimeout(batchSync, 5000);
    // Lalu repeat setiap 30 detik
    const interval = setInterval(batchSync, 30000);
    return () => { clearTimeout(initialTimeout); clearInterval(interval); };
  }, [hasStarted, sesiId]);

  const toggleRagu = async () => {
    if (hasSubmitted.current) return;
    const curSoal = examData.soal[currentIdx];
    const newRagu = (curSoal.rpiId === "RAGU") ? null : "RAGU";
    
    const newExamData = { ...examData };
    newExamData.soal[currentIdx].rpiId = newRagu;
    setExamData(newExamData);
    sessionStorage.setItem(`exam_${sesiId}`, JSON.stringify(newExamData));
    
    // Kirim melalui queue system (bukan fetch langsung) — termasuk semua field
    const payload: any = { rpiId: newRagu };
    if (curSoal.opsiTerpilih) payload.opsiId = curSoal.opsiTerpilih;
    if (curSoal.jawabanTeks) payload.jawabanTeks = curSoal.jawabanTeks;
    if (curSoal.jawabanData && Object.keys(curSoal.jawabanData).length > 0) payload.jawabanData = curSoal.jawabanData;
    
    saveQueueRef.current = saveQueueRef.current.filter(q => q.soalId !== curSoal.soalId);
    saveQueueRef.current.push({ soalId: curSoal.soalId, payload });
    setUnsavedCount(saveQueueRef.current.length + failedSoalIdsRef.current.size);
    processQueue();
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
          {/iPad|iPhone|iPod/.test(typeof navigator !== 'undefined' ? navigator.userAgent : '') && (
            <div className="bg-blue-50 text-blue-800 border border-blue-100 rounded-xl p-4 text-sm text-left mb-4 shadow-inner">
              <strong>📱 Pengguna iPhone:</strong> Fullscreen tidak didukung di Safari/Chrome iOS. Pastikan Anda tidak membuka notifikasi, Control Center, atau berpindah aplikasi selama ujian berlangsung.
            </div>
          )}
          <div className="bg-orange-50 text-orange-800 border border-orange-100 rounded-xl p-4 text-sm text-left mb-8 shadow-inner">
            <strong>PERINGATAN:</strong> Segala bentuk perpindahan jendela, notifikasi yang menggeser fokus browser, membuka layar belah dua (split-screen), atau keluar dari Fullscreen akan otomatis menyelesaikan (Submit) ujian Anda.
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
  const soal = examData.soal[currentIdx];
  const sameTypeSoals = examData.soal.filter((s:any) => s.tipeSoal === soal.tipeSoal);
  const currentTypeIdx = sameTypeSoals.findIndex((s:any) => s.soalId === soal.soalId) + 1;
  const currentTypeTotal = sameTypeSoals.length;
  const readableType = (soal.tipeSoal || "Soal").replace(/_/g, ' ');

  const isAnswered = (s: any) => !!s.opsiTerpilih || !!s.jawabanTeks || (s.jawabanData && Object.keys(s.jawabanData).length > 0);
  const answeredCount = examData.soal.filter(isAnswered).length;
  const isLastQuestion = currentIdx === examData.soal.length - 1;

  const raguList = examData.soal.filter((s:any) => s.rpiId === "RAGU");
  const unansweredList = examData.soal.filter((s:any) => !isAnswered(s));
  const canSubmit = raguList.length === 0 && unansweredList.length === 0;

  if (showSummary) {
    return (
      <div className="fixed inset-0 bg-gray-50 flex flex-col font-sans z-50 overflow-hidden">
        <style dangerouslySetInnerHTML={{__html: `
          aside { display: none !important; }
          .app-footer { display: none !important; }
          .santri-bottom-nav, nav.fixed.bottom-0 { display: none !important; }
          .santri-mobile-menu-btn { display: none !important; }
          body { overflow: hidden !important; overscroll-behavior: none; }
        `}} />
        <div className="flex-1 overflow-y-auto p-4 md:p-8 flex items-center justify-center">
        <div className="bg-white rounded-3xl max-w-2xl w-full p-6 md:p-8 shadow-xl">
          <h1 className="text-xl md:text-2xl font-bold font-display text-gray-800 mb-6 pb-4 border-b">Ringkasan Ujian</h1>
          
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-green-50 p-3 md:p-4 rounded-2xl text-center border border-green-100">
               <div className="text-2xl md:text-3xl font-black text-green-700 mb-1">{answeredCount - raguList.filter(isAnswered).length}</div>
               <div className="text-[10px] md:text-xs font-bold text-green-600 uppercase tracking-wider">Terjawab</div>
            </div>
            <div className="bg-orange-50 p-3 md:p-4 rounded-2xl text-center border border-orange-100">
               <div className="text-2xl md:text-3xl font-black text-orange-600 mb-1">{raguList.length}</div>
               <div className="text-[10px] md:text-xs font-bold text-orange-500 uppercase tracking-wider">Ragu-Ragu</div>
            </div>
            <div className="bg-gray-50 p-3 md:p-4 rounded-2xl text-center border border-gray-200">
               <div className="text-2xl md:text-3xl font-black text-gray-700 mb-1">{unansweredList.length}</div>
               <div className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-wider">Belum Dijawab</div>
            </div>
          </div>

          {/* Daftar soal bermasalah */}
          {(raguList.length > 0 || unansweredList.length > 0) && (
            <div className="mb-6 space-y-4">
              {raguList.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                  <h3 className="text-sm font-bold text-orange-700 mb-2 flex items-center gap-2">
                    <AlertTriangle size={16}/> Soal Ragu-Ragu ({raguList.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {raguList.map((s:any) => {
                      const idx = examData.soal.findIndex((x:any) => x.soalId === s.soalId);
                      return (
                        <button
                          key={s.soalId}
                          onClick={() => { setCurrentIdx(idx); setShowSummary(false); }}
                          className="w-10 h-10 rounded-lg bg-orange-400 text-white font-bold text-sm flex items-center justify-center hover:bg-orange-500 transition-all shadow-sm active:scale-95"
                        >
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {unansweredList.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <h3 className="text-sm font-bold text-red-700 mb-2 flex items-center gap-2">
                    <ShieldAlert size={16}/> Soal Belum Dijawab ({unansweredList.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {unansweredList.map((s:any) => {
                      const idx = examData.soal.findIndex((x:any) => x.soalId === s.soalId);
                      return (
                        <button
                          key={s.soalId}
                          onClick={() => { setCurrentIdx(idx); setShowSummary(false); }}
                          className="w-10 h-10 rounded-lg bg-red-400 text-white font-bold text-sm flex items-center justify-center hover:bg-red-500 transition-all shadow-sm active:scale-95"
                        >
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <p className="text-xs text-center text-gray-500 font-medium">
                Klik nomor soal di atas untuk menuju soal tersebut.
              </p>
            </div>
          )}

          {!canSubmit && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 text-center">
              <p className="text-sm font-bold text-yellow-800">
                ⚠️ Anda belum bisa mengumpulkan jawaban.
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                Pastikan semua soal sudah dijawab dan tidak ada yang ditandai ragu-ragu.
              </p>
            </div>
          )}

          <div className="flex gap-3">
             <button onClick={() => setShowSummary(false)} className="flex-1 py-3 md:py-3.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition text-sm">
               Kembali ke Soal
             </button>
             <button 
               onClick={handleManualSubmit}
               disabled={isSubmitting || !canSubmit}
               className={`flex-1 py-3 md:py-3.5 font-bold rounded-xl shadow-md transition flex justify-center items-center gap-2 text-sm ${
                 canSubmit 
                   ? 'bg-green-600 text-white hover:bg-green-700 shadow-green-200' 
                   : 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
               }`}
             >
               {isSubmitting ? "Mengirim..." : <><Send size={16}/> Kumpulkan Jawaban</>}
             </button>
          </div>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-50 flex flex-col md:flex-row font-sans selection:bg-blue-100 overflow-hidden z-50">
      
      {/* Hide Global Navigasi Saat CBT */}
      {hasStarted && !hasSubmitted.current && !showSummary && (
        <style dangerouslySetInnerHTML={{__html: `
          aside { display: none !important; }
          .app-footer { display: none !important; }
          .santri-bottom-nav, nav.fixed.bottom-0 { display: none !important; }
          .santri-mobile-menu-btn { display: none !important; }
          body { overscroll-behavior: none; }
        `}} />
      )}
      
      {/* LEFT: Soal Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden px-0 bg-white">
        
        {/* Header - Timer */}
        <div className="bg-white px-4 md:px-6 py-2.5 md:py-4 border-b flex justify-between items-center shadow-sm z-10 shrink-0">
           <div className="flex items-center gap-2 md:gap-3">
             <div className="w-8 h-8 md:w-10 md:h-10 bg-[var(--color-primary)] text-white font-bold text-sm md:text-lg rounded-lg md:rounded-xl flex items-center justify-center shadow-sm">
               {currentTypeIdx}
             </div>
             <div>
                <h1 className="font-bold text-xs md:text-sm text-gray-800 uppercase tracking-wide">{readableType} {currentTypeIdx} / {currentTypeTotal}</h1>
                <p className="text-[9px] md:text-xs font-semibold text-gray-400 bg-gray-100 px-1.5 md:px-2 py-0.5 mt-0.5 rounded-full inline-block">Mata Pelajaran</p>
             </div>
           </div>
           
           <div className="flex items-center gap-2">
             {/* Fullscreen Fallback Toggle */}
             {!isFullscreen && hasStarted && !hasSubmitted.current && (
               <button 
                 onClick={enterFullscreen}
                 className="px-3 py-1.5 md:py-2 rounded-lg bg-orange-100 text-orange-600 hover:bg-orange-200 transition font-bold text-xs"
               >
                 Abaikan ini dan Kembali ke Fullscreen
               </button>
             )}
             
             {/* Mobile Nav Toggle */}
             <button 
               onClick={() => setShowMobileNav(!showMobileNav)}
               className="md:hidden p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
             >
               <Grid3X3 size={18} />
             </button>
             {unsavedCount > 0 && (
               <div className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-lg text-[10px] font-bold animate-pulse" title={`${unsavedCount} jawaban sedang disimpan...`}>
                 ⏳ {unsavedCount}
               </div>
             )}
             <div className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-gradient-to-r rounded-lg md:rounded-xl shadow-inner font-mono font-bold text-base md:text-xl transition-colors ${timeLeft < 300 ? 'from-red-600 to-rose-500 text-white shadow-red-200 animate-pulse' : 'from-gray-100 to-gray-50 text-gray-800 border'}`}>
               <Clock size={16} className="md:w-5 md:h-5" />
               {formatTime(timeLeft)}
             </div>
           </div>
        </div>

        {/* Mobile Navigator Overlay */}
        {showMobileNav && (
          <div className="md:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setShowMobileNav(false)}>
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl p-5 max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-800">Navigasi Soal</h3>
                <button onClick={() => setShowMobileNav(false)} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200"><X size={18}/></button>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex-1 bg-gray-200 h-2 rounded-full overflow-hidden">
                  <div className="bg-green-500 h-full rounded-full transition-all" style={{ width: `${(answeredCount / examData.soal.length) * 100}%` }}></div>
                </div>
                <span className="text-xs font-bold text-gray-500">{answeredCount}/{examData.soal.length}</span>
              </div>
              <div className="flex flex-col gap-4 mb-4">
                 {(() => {
                    const grouped = examData.soal.reduce((acc: any, s:any) => {
                       if (!acc[s.tipeSoal]) acc[s.tipeSoal] = [];
                       acc[s.tipeSoal].push(s);
                       return acc;
                    }, {});
                    return Object.entries(grouped).map(([type, list]: [string, any]) => (
                       <div key={type}>
                          <h4 className="text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-wide">{type.replace(/_/g, ' ')}</h4>
                          <div className="grid grid-cols-5 gap-2">
                            {list.map((s:any, idx:number) => {
                              const globalIdx = examData.soal.findIndex((x:any) => x.soalId === s.soalId);
                              const Active = currentIdx === globalIdx;
                              const Answered = isAnswered(s);
                              const Ragu = s.rpiId === "RAGU";
                              let cls = "h-12 w-full rounded-xl font-bold text-base flex items-center justify-center transition-all border-2 cursor-pointer shadow-sm active:scale-95 ";
                              if (Active) cls += "border-blue-600 ring-2 ring-blue-200 bg-white text-blue-700";
                              else if (Ragu) cls += "bg-orange-400 border-orange-500 text-white";
                              else if (Answered) cls += "bg-green-500 border-green-600 text-white";
                              else cls += "bg-white border-gray-200 text-gray-500";
                              return <button key={s.soalId} onClick={() => { setCurrentIdx(globalIdx); setShowMobileNav(false); }} className={cls}>{idx+1}</button>;
                            })}
                          </div>
                       </div>
                    ));
                 })()}
              </div>
              <div className="flex gap-3 text-[10px] font-semibold text-gray-500 justify-center">
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500 rounded border border-green-600"></div> Terjawab</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-orange-400 rounded border border-orange-500"></div> Ragu</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-white rounded border-2 border-gray-200"></div> Belum</div>
              </div>
            </div>
          </div>
        )}

        {/* Soal Content */}
        <div className="flex-1 overflow-y-auto w-full md:w-4/5 mx-auto p-4 md:p-8 scroll-smooth pb-8">
           
           {soal.perintah && (
             <div className="bg-blue-50 border-l-4 border-blue-600 p-4 mb-4 md:mb-6 rounded-r-xl shadow-sm">
                <h3 className="font-bold text-sm text-blue-900 mb-1 flex items-center gap-2">
                   <Grid3X3 size={16} /> Arah Pengerjaan Bagian {readableType}
                </h3>
                <SoalText html={soal.perintah} className="text-sm text-blue-800 prose prose-sm max-w-none" />
             </div>
           )}

           {/* Qiro'ah Parent Passage — ditampilkan jika soal ini adalah anak grup */}
           {soal.grupSoalId && (() => {
             const parentSoal = examData.soal.find((s:any) => s.soalId === soal.grupSoalId);
             if (!parentSoal) return null;
             return (
               <div className="bg-purple-50/50 rounded-3xl p-6 md:p-8 shadow-sm border-2 border-purple-200 mb-4">
                 <div className="flex items-center gap-2 mb-3">
                   <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-md bg-purple-100 text-purple-600">Bacaan Qiro&apos;ah</span>
                 </div>
                 {parentSoal.gambarUrl && (
                   <div className="mb-4 flex justify-center">
                     {/* eslint-disable-next-line @next/next/no-img-element */}
                     <img src={parentSoal.gambarUrl} alt="Bacaan" className="max-w-full max-h-[300px] rounded-xl border border-purple-200 shadow-sm" />
                   </div>
                 )}
                 <SoalText 
                   html={parentSoal.pertanyaan}
                   className="text-base md:text-lg font-medium text-gray-800 leading-relaxed font-serif prose max-w-none block" 
                 />
               </div>
             );
           })()}

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

           <QuestionRenderer 
             soal={soal}
             onAnswer={(payload) => handleAnswerSubmit(soal.soalId, payload)}
           />
        </div>

        {/* Footer Navigation Area */}
        <div className="w-full shrink-0 bg-white border-t p-3 sm:p-4 flex gap-2 md:gap-4 justify-between items-center z-20 shadow-[0_-10px_40px_-5px_rgba(0,0,0,0.05)]">
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
      <div className="hidden md:flex flex-col w-80 lg:w-88 bg-white border-l h-full sticky top-0 shrink-0 shadow-[-5px_0_15px_-5px_rgba(0,0,0,0.02)]">
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
           <div className="flex flex-col gap-6">
             {(() => {
                const grouped = examData.soal.reduce((acc: any, s:any) => {
                   if (!acc[s.tipeSoal]) acc[s.tipeSoal] = [];
                   acc[s.tipeSoal].push(s);
                   return acc;
                }, {});
                return Object.entries(grouped).map(([type, list]: [string, any]) => (
                   <div key={type}>
                      <h4 className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">{type.replace(/_/g, ' ')}</h4>
                      <div className="grid grid-cols-5 lg:grid-cols-6 gap-2 xl:gap-3">
                         {list.map((s:any, idx:number) => {
                           const globalIdx = examData.soal.findIndex((x:any) => x.soalId === s.soalId);
                           const Active = currentIdx === globalIdx;
                           const Answered = isAnswered(s);
                           const Ragu = s.rpiId === "RAGU";
                           
                           let classes = "h-10 w-full rounded-lg font-bold text-sm flex items-center justify-center transition-all border-2 cursor-pointer shadow-sm active:scale-95 text-center ";
                           if (Active) classes += "border-blue-600 ring-2 ring-blue-200 bg-white text-blue-700";
                           else if (Ragu) classes += "bg-orange-400 border-orange-500 text-white";
                           else if (Answered) classes += "bg-green-500 border-green-600 text-white";
                           else classes += "bg-white border-gray-200 text-gray-500 hover:border-gray-300";

                           return (
                             <button key={s.soalId} onClick={() => setCurrentIdx(globalIdx)} className={classes}>
                               {idx + 1}
                             </button>
                           );
                         })}
                      </div>
                   </div>
                ));
             })()}
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
