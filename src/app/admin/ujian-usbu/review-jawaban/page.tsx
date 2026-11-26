"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  CheckCircle,
  CheckCircle2,
  XCircle,
  Clock,
  X,
  Brain,
  Edit3,
  Save,
  AlertCircle,
  AlertTriangle,
  UserCheck,
  ChevronDown,
  Activity,
  BookOpen,
  Layers,
} from "lucide-react";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import { normalizeAnswerText } from "@/lib/arabic-utils";
import SoalText from "@/components/soal-text";
import {
  ReviewSoalDetail,
  ReviewKunciJawaban,
  ReviewJawabanSantri,
} from "@/components/ujian/ReviewQuestionBlocks";

// Tipe yang memiliki nilai pasti sehingga cocok pakai tombol Benarkan/Salahkan
const EXACT_TYPES = [
  "PG",
  "BENAR_SALAH",
  "MUFRODAT",
  "ISIAN_SAMPING",
  "ISIAN_BAWAH",
  "PG_MULTI",
];

export default function ReviewJawabanPage() {
  const [paketList, setPaketList] = useState<any[]>([]);
  const [kelasList, setKelasList] = useState<any[]>([]);

  const [selectedPaket, setSelectedPaket] = useState("");
  const [selectedKelas, setSelectedKelas] = useState("");

  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const [expandedSoalId, setExpandedSoalId] = useState<string | null>(null);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [editingJawabanId, setEditingJawabanId] = useState<string | null>(null);
  const [editScore, setEditScore] = useState<number | string>(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAIGrading, setIsAIGrading] = useState<string | null>(null);

  const [activeMapel, setActiveMapel] = useState<string>("");
  const [viewMode, setViewMode] = useState<"SOAL" | "SANTRI">("SOAL");
  const [santriLimits, setSantriLimits] = useState<Record<string, number>>({});

  const getLimit = (soalId: string) => santriLimits[soalId] || 20;

  // Load Initial Data (Paket & Kelas)
  useEffect(() => {
    Promise.all([
      fetch("/api/admin/ujian-usbu/sesi").then((r) => r.json()),
      fetch("/api/admin/kelas").then((r) => r.json()),
    ])
      .then(([pakets, kelass]) => {
        if (Array.isArray(pakets) && pakets.length > 0) {
          setPaketList(pakets);
          const active = pakets.find((p: any) => p.isActive);
          setSelectedPaket(active ? active.id : pakets[0].id);
        }

        if (Array.isArray(kelass) && kelass.length > 0) {
          setKelasList(kelass);
          setSelectedKelas(kelass[0].id);
        }
        setIsInitialLoad(false);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Gagal memuat filter!");
        setIsInitialLoad(false);
      });
  }, []);

  const fetchData = useCallback(
    async (silent = false) => {
      if (!selectedPaket || !selectedKelas) return;

      if (!silent) setIsLoading(true);
      try {
        const res = await fetch(
          `/api/admin/ujian-usbu/review-jawaban?sesiGlobalId=${selectedPaket}&kelasId=${selectedKelas}`,
        );
        if (!res.ok) throw new Error("Gagal mengambil data");

        const json = await res.json();
        setData(json);
      } catch (err: any) {
        toast.error(err.message || "Terjadi kesalahan sistem");
        setData([]);
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [selectedPaket, selectedKelas],
  );

  // Automatically adjust selectedKelas when selectedPaket changes
  useEffect(() => {
    if (!selectedPaket || kelasList.length === 0) return;

    const currentPaket = paketList.find((p) => p.id === selectedPaket);
    const validProgramIds = currentPaket
      ? currentPaket.paketUjianList.map((p: any) => p.programId)
      : [];
    const validClasses = currentPaket?.isSimulasi
      ? kelasList
      : kelasList.filter(
          (k) => k.programId && validProgramIds.includes(k.programId),
        );

    if (
      validClasses.length > 0 &&
      !validClasses.find((k) => k.id === selectedKelas)
    ) {
      setSelectedKelas(validClasses[0].id);
    }
  }, [selectedPaket, kelasList, paketList, selectedKelas]);

  // Refetch when filters change
  useEffect(() => {
    if (!isInitialLoad) {
      fetchData();
    }
  }, [fetchData, isInitialLoad]);

  const handleUpdateNilai = async (
    jawabanId: string,
    overrideVal?: number | null,
  ) => {
    setIsUpdating(true);
    try {
      const val =
        overrideVal !== undefined
          ? overrideVal
          : editScore === ""
            ? 0
            : Number(editScore);
      const res = await fetch("/api/admin/ujian-usbu/review-jawaban", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jawabanId, nilaiManual: val }),
      });
      if (!res.ok) throw new Error("Gagal update nilai");

      toast.success("Skor berhasil direvisi. Total dihitung ulang otomatis.");
      setEditingJawabanId(null);
      fetchData(true);
    } catch {
      toast.error("Gagal mengupdate nilai");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAIGradeSoal = async (soalId: string, jawabanSantri: any[]) => {
    const pendingIds = jawabanSantri
      .filter((j) => j.id && j.nilaiManual === null && !j.aiGraded)
      .map((j) => j.id);

    if (pendingIds.length === 0) {
      toast.error("Semua jawaban sudah dinilai!");
      return;
    }

    setIsAIGrading(soalId);
    let successCount = 0;

    toast.loading(
      `Memulai penilaian AI untuk ${pendingIds.length} jawaban...`,
      { id: "ai-grade" },
    );

    try {
      const batchSize = 5;
      for (let i = 0; i < pendingIds.length; i += batchSize) {
        const batch = pendingIds.slice(i, i + batchSize);

        const res = await fetch("/api/admin/ujian-usbu/ai-grade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jawabanIds: batch }),
        });

        if (res.ok) {
          const json = await res.json();
          if (json.processed) successCount += json.processed;
        }

        if (i + batchSize < pendingIds.length) {
          await new Promise((resolve) => setTimeout(resolve, 2500));
        }
      }

      toast.success(`Selesai! ${successCount} jawaban berhasil dinilai AI.`, {
        id: "ai-grade",
      });
      fetchData(true);
    } catch {
      toast.error("Terjadi kesalahan saat menghubungi server AI.", {
        id: "ai-grade",
      });
    } finally {
      setIsAIGrading(null);
    }
  };

  const handleBulkAiGrade = async () => {
    if (!selectedPaket) {
      toast.error("Pesan: Paket Ujian harus dipilih!");
      return;
    }

    const confirm = await Swal.fire({
      title: "Auto-Grade Seluruh Kelas?",
      text: "Sistem akan menilai SEMUA jawaban essay yang masih berstatus kosong untuk seluruh kelas di paket ini secara berjalan di belakang layar.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Ya, Mulai Penilaian AI (Background)",
      cancelButtonText: "Batal",
    });

    if (confirm.isConfirmed) {
      toast.loading("Mengirim perintah ke server...", { id: "bulk-ai" });
      try {
        const res = await fetch("/api/admin/ujian-usbu/start-bulk-ai-grade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sesiGlobalId: selectedPaket }),
        });

        const json = await res.json();
        if (!res.ok)
          throw new Error(json.error || "Gagal memulai background task");

        toast.dismiss("bulk-ai");

        Swal.fire({
          title: "Proses Diluncurkan!",
          text: "Nilai AI sedang berproses di sistem server (Background mode). Anda bebas untuk beralih halaman, menutup browser, atau mematikan laptop tanpa menghentikan proses ini.",
          icon: "success",
        });
      } catch (err: any) {
        toast.error(err.message, { id: "bulk-ai" });
      }
    }
  };

  const isNeedsTeacherReview = (jaw: any) =>
    Boolean(
      jaw?.id &&
        !jaw.reviewedByName &&
        (jaw.needsReview ||
          (jaw.aiFeedback &&
            /\[(?:Perlu Cek Guru|ERROR|FATAL)\]/i.test(jaw.aiFeedback))),
    );

  const renderFeedbackBox = (jaw: any, compact = false) => {
    if (!jaw?.aiFeedback) return null;
    const needsCheck = isNeedsTeacherReview(jaw);
    const cleanedFeedback = String(jaw.aiFeedback)
      .replace(/^\[Perlu Cek Guru\]\s*/i, "")
      .trim();

    return (
      <div
        className={`mt-2 text-xs rounded-lg border flex items-start gap-1.5 ${
          compact ? "p-2" : "p-2.5"
        } ${
          needsCheck
            ? "bg-amber-50 text-amber-950 border-amber-200"
            : "bg-purple-50 text-purple-800 border-purple-100"
        }`}
      >
        {needsCheck ? (
          <AlertTriangle
            size={13}
            className="shrink-0 mt-0.5 text-amber-600"
          />
        ) : (
          <Brain size={13} className="shrink-0 mt-0.5 text-purple-600" />
        )}
        <div className="min-w-0 leading-relaxed break-words">
          {needsCheck && (
            <span className="inline-block mr-1.5 px-1.5 py-0.5 rounded bg-amber-200/80 text-amber-900 font-bold text-[10px] uppercase tracking-wide align-middle">
              Perlu Cek Guru
            </span>
          )}
          <span>{cleanedFeedback}</span>
        </div>
      </div>
    );
  };

  const renderReviewMetaBadges = (jaw: any) => {
    if (!jaw?.id) return null;
    if (jaw.reviewedByName) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md max-w-[200px] leading-tight text-left">
          <UserCheck size={11} className="shrink-0" />
          <span className="break-words">
            Sudah direview ({jaw.reviewedByName})
          </span>
        </span>
      );
    }
    if (isNeedsTeacherReview(jaw)) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md whitespace-nowrap">
          <AlertTriangle size={11} className="shrink-0" />
          Perlu Cek Guru
        </span>
      );
    }
    if (jaw.aiGraded && jaw.nilaiManual !== null && jaw.nilaiManual !== undefined) {
      return (
        <span className="text-[10px] text-purple-600 flex items-center gap-0.5 font-semibold">
          <Brain size={10} /> AI
        </span>
      );
    }
    return null;
  };

  const renderStatus = (jaw: any, soal: any) => {
    if (!jaw.id) {
      return <span className="text-gray-400 text-xs italic">Kosong</span>;
    }

    if (jaw.nilaiManual !== null && jaw.nilaiManual !== undefined) {
      const pct =
        soal.bobot > 0 ? Math.round((jaw.nilaiManual / soal.bobot) * 100) : 0;
      const badgeCls =
        pct >= 70
          ? "text-green-700 bg-green-50 border border-green-200"
          : pct >= 40
            ? "text-orange-700 bg-orange-50 border border-orange-200"
            : "text-rose-700 bg-rose-50 border border-rose-200";
      return (
        <span className="inline-flex flex-col items-center gap-1">
          <span
            className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-md text-xs whitespace-nowrap ${badgeCls}`}
          >
            {pct >= 70 ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
            {Number(jaw.nilaiManual.toFixed(1))}/{soal.bobot}
          </span>
          {renderReviewMetaBadges(jaw)}
        </span>
      );
    }

    if (soal.tipeSoal.startsWith("ESSAY")) {
      if (jaw.jawabanTeks) {
        return (
          <span className="inline-flex flex-col items-center gap-1">
            <span className="inline-flex items-center gap-1 text-orange-700 font-bold bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-md text-xs whitespace-nowrap">
              <Clock size={13} /> Menunggu
            </span>
            {renderReviewMetaBadges(jaw)}
          </span>
        );
      }
      return <span className="text-gray-400 text-xs italic">Kosong</span>;
    }

    if (EXACT_TYPES.includes(soal.tipeSoal)) {
      let isBenar = false;

      if (soal.tipeSoal === "PG_MULTI") {
        const correctIds =
          soal.opsiList
            ?.filter((o: any) => o.isCorrect)
            .map((o: any) => o.id) || [];
        const selectedIds = jaw.jawabanData?.selectedIds || [];
        if (
          correctIds.length > 0 &&
          correctIds.length === selectedIds.length &&
          selectedIds.every((id: string) => correctIds.includes(id))
        ) {
          isBenar = true;
        }
      } else {
        const opsiBenar = soal.opsiList?.find((o: any) => o.isCorrect)?.id;
        if (jaw.opsiId && jaw.opsiId === opsiBenar) isBenar = true;
        else if (
          jaw.jawabanTeks &&
          soal.kunciJawaban &&
          normalizeAnswerText(jaw.jawabanTeks) ===
            normalizeAnswerText(soal.kunciJawaban)
        ) {
          isBenar = true;
        }
      }

      return (
        <span className="inline-flex flex-col items-center gap-1">
          {isBenar ? (
            <span className="inline-flex items-center gap-1 text-green-700 font-bold bg-green-50 border border-green-200 px-2 py-0.5 rounded-md text-xs whitespace-nowrap">
              <CheckCircle size={13} /> Benar
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-rose-700 font-bold bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md text-xs whitespace-nowrap">
              <X size={13} /> Salah
            </span>
          )}
          {renderReviewMetaBadges(jaw)}
        </span>
      );
    }

    return (
      <span className="inline-flex flex-col items-center gap-1">
        <span className="inline-flex items-center gap-1 text-orange-700 font-bold bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-md text-xs whitespace-nowrap">
          <Clock size={13} /> Belum Dihitung
        </span>
        {renderReviewMetaBadges(jaw)}
      </span>
    );
  };

  const renderAksiRevisi = (jaw: any, soal: any, compact = false) => {
    if (editingJawabanId === (jaw.id || "dummy")) {
      return (
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <input
            type="number"
            max={soal.bobot}
            min={0}
            value={editScore}
            onChange={(e) =>
              setEditScore(e.target.value === "" ? "" : Number(e.target.value))
            }
            className="neu-input w-20 py-1.5 px-2 text-center text-sm font-bold border rounded-lg focus:ring focus:ring-blue-200"
          />
          <button
            onClick={() => handleUpdateNilai(jaw.id)}
            disabled={isUpdating}
            className="px-2.5 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 disabled:opacity-50 inline-flex items-center gap-1"
          >
            <Save size={13} /> Simpan
          </button>
          <button
            onClick={() => setEditingJawabanId(null)}
            className="px-2 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-300 inline-flex items-center gap-1"
          >
            <X size={13} />
          </button>
        </div>
      );
    }

    if (!jaw.id) {
      return (
        <span className="text-gray-300 text-[10px] font-bold uppercase">-</span>
      );
    }

    if (EXACT_TYPES.includes(soal.tipeSoal)) {
      return (
        <div
          className={`flex flex-wrap gap-1.5 items-center ${
            compact ? "justify-start sm:justify-end" : "justify-end"
          }`}
        >
          <button
            disabled={isUpdating}
            onClick={() => {
              setEditingJawabanId(jaw.id);
              setEditScore(soal.bobot);
              setTimeout(() => handleUpdateNilai(jaw.id, soal.bobot), 0);
            }}
            className="px-2.5 py-1.5 bg-green-50 text-green-700 border border-green-200 font-bold rounded-lg hover:bg-green-100 inline-flex items-center gap-1 text-xs transition-colors"
          >
            <CheckCircle2 size={13} /> Benarkan
          </button>
          <button
            disabled={isUpdating}
            onClick={() => {
              setEditingJawabanId(jaw.id);
              setEditScore(0);
              setTimeout(() => handleUpdateNilai(jaw.id, 0), 0);
            }}
            className="px-2.5 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 font-bold rounded-lg hover:bg-rose-100 inline-flex items-center gap-1 text-xs transition-colors"
          >
            <XCircle size={13} /> Salahkan
          </button>
          {jaw.nilaiManual !== null && (
            <button
              disabled={isUpdating}
              onClick={() => {
                setEditingJawabanId(jaw.id);
                setEditScore(-1);
                setTimeout(() => handleUpdateNilai(jaw.id, null), 0);
              }}
              className="text-[11px] text-gray-500 hover:text-gray-800 underline font-medium px-1"
            >
              Reset Auto
            </button>
          )}
        </div>
      );
    }

    return (
      <div
        className={`flex flex-wrap gap-1.5 items-center ${
          compact ? "justify-start sm:justify-end" : "justify-end"
        }`}
      >
        {jaw.nilaiManual !== null && jaw.nilaiManual !== undefined && !jaw.reviewedByName && (
          <button
            disabled={isUpdating}
            onClick={() => handleUpdateNilai(jaw.id, jaw.nilaiManual)}
            title="Setujui nilai saat ini dan tandai sudah direview"
            className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold rounded-lg hover:bg-emerald-100 inline-flex items-center gap-1 text-xs transition-colors"
          >
            <UserCheck size={13} /> Setujui
          </button>
        )}
        {jaw.nilaiManual !== null && (
          <button
            disabled={isUpdating}
            onClick={() => {
              setEditingJawabanId(jaw.id);
              setEditScore(-1);
              setTimeout(() => handleUpdateNilai(jaw.id, null), 0);
            }}
            className="text-[11px] text-gray-500 hover:text-gray-800 underline font-medium"
          >
            Reset Auto
          </button>
        )}
        <button
          onClick={() => {
            setEditingJawabanId(jaw.id);
            setEditScore(jaw.nilaiManual !== null ? jaw.nilaiManual : 0);
          }}
          className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-50 inline-flex items-center gap-1.5 text-xs shadow-sm"
        >
          <Edit3 size={13} /> {jaw.nilaiManual !== null ? "Revisi Nilai" : "Beri Nilai"}
        </button>
      </div>
    );
  };

  // Grouping by Mapel and TipeSoal (View SOAL)
  const groupedData: Record<string, Record<string, any[]>> = {};
  if (!isLoading && data && data.length > 0) {
    data.forEach((soal: any) => {
      const mn = soal.mapelNama || "Tanpa Mapel";
      const ts = soal.tipeSoal || "UNDEFINED";
      if (!groupedData[mn]) groupedData[mn] = {};
      if (!groupedData[mn][ts]) groupedData[mn][ts] = [];
      groupedData[mn][ts].push(soal);
    });
  }

  // Grouping by Santri (View SANTRI)
  const groupedBySantri = useMemo(() => {
    const santriMap: Record<string, any> = {};
    if (!data || data.length === 0) return [];

    data.forEach((soal: any) => {
      const mapel = soal.mapelNama || "Tanpa Mapel";
      const tipeSoal = soal.tipeSoal || "UNDEFINED";

      soal.jawabanSantri.forEach((jaw: any) => {
        const sNama = jaw.santriNama || "Tanpa Nama";
        if (!santriMap[sNama]) {
          santriMap[sNama] = {
            nama: sNama,
            totalNilai: 0,
            needsReviewCount: 0,
            reviewedCount: 0,
            mapels: {},
            sesiStatus: jaw.sesiStatus,
          };
        }
        if (isNeedsTeacherReview(jaw)) {
          santriMap[sNama].needsReviewCount += 1;
        }
        if (jaw.reviewedByName) {
          santriMap[sNama].reviewedCount += 1;
        }

        if (!santriMap[sNama].mapels[mapel]) {
          santriMap[sNama].mapels[mapel] = {
            nama: mapel,
            totalNilaiMapel: 0,
            jawabanList: [],
            tipeSoalScores: {},
          };
        }

        if (!santriMap[sNama].mapels[mapel].tipeSoalScores[tipeSoal]) {
          santriMap[sNama].mapels[mapel].tipeSoalScores[tipeSoal] = 0;
        }

        let poin = 0;
        if (jaw.nilaiManual !== null && jaw.nilaiManual !== undefined) {
          poin = jaw.nilaiManual;
        } else if (EXACT_TYPES.includes(tipeSoal)) {
          let isBenar = false;
          if (tipeSoal === "PG_MULTI") {
            const correctIds =
              soal.opsiList
                ?.filter((o: any) => o.isCorrect)
                .map((o: any) => o.id) || [];
            const selectedIds = jaw.jawabanData?.selectedIds || [];
            if (
              correctIds.length > 0 &&
              correctIds.length === selectedIds.length &&
              selectedIds.every((id: string) => correctIds.includes(id))
            ) {
              isBenar = true;
            }
          } else {
            const opsiBenar = soal.opsiList?.find((o: any) => o.isCorrect)?.id;
            if (jaw.opsiId && jaw.opsiId === opsiBenar) isBenar = true;
            else if (
              jaw.jawabanTeks &&
              soal.kunciJawaban &&
              normalizeAnswerText(jaw.jawabanTeks) ===
                normalizeAnswerText(soal.kunciJawaban)
            ) {
              isBenar = true;
            }
          }
          if (isBenar) poin = soal.bobot;
        }

        santriMap[sNama].totalNilai += poin;
        santriMap[sNama].mapels[mapel].totalNilaiMapel += poin;
        santriMap[sNama].mapels[mapel].tipeSoalScores[tipeSoal] += poin;

        santriMap[sNama].mapels[mapel].jawabanList.push({
          soal,
          jawaban: jaw,
        });
      });
    });

    return Object.values(santriMap).sort((a, b) =>
      a.nama.localeCompare(b.nama),
    );
  }, [data]);

  if (isInitialLoad) {
    return (
      <div className="p-8 text-center text-gray-500 font-medium">
        Memuat data awal...
      </div>
    );
  }

  const currentPaket = paketList.find((p) => p.id === selectedPaket);
  const validProgramIds = currentPaket
    ? currentPaket.paketUjianList.map((p: any) => p.programId)
    : [];
  const filteredKelasList = currentPaket?.isSimulasi
    ? kelasList
    : kelasList.filter(
        (k) => k.programId && validProgramIds.includes(k.programId),
      );

  return (
    <div className="pb-20 md:pb-8 min-w-0">
      {/* HEADER & FILTER — non-sticky di HP agar tidak menutupi soal pada layar kecil memanjang */}
      <div
        className="bg-white p-3.5 sm:p-4 md:p-6 mb-4 sm:mb-6 rounded-2xl shadow-sm"
        style={{ border: "1px solid var(--color-surface-dark)" }}
      >
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold font-display flex items-center gap-2 text-gray-800">
              <Layers className="text-blue-500 shrink-0" size={22} />
              <span className="break-words">Review Jawaban Santri</span>
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Baca soal, opsi jawaban, kunci, serta koreksi penilaian santri per soal atau per santri.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex w-full lg:w-auto gap-2.5 sm:gap-3">
            <div className="w-full lg:w-48">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">
                Paket Ujian
              </label>
              <select
                className="neu-input w-full p-2 text-sm font-bold text-gray-700 bg-gray-50 border border-gray-200 focus:border-blue-400 focus:ring focus:ring-blue-100 rounded-lg"
                value={selectedPaket}
                onChange={(e) => setSelectedPaket(e.target.value)}
              >
                {paketList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama} {p.isActive ? "(AKTIF)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full lg:w-44">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">
                Kelas
              </label>
              <select
                className="neu-input w-full p-2 text-sm font-bold text-gray-700 bg-gray-50 border border-gray-200 focus:border-blue-400 focus:ring focus:ring-blue-100 rounded-lg"
                value={selectedKelas}
                onChange={(e) => setSelectedKelas(e.target.value)}
              >
                {filteredKelasList.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.nama}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2 lg:self-end">
              <button
                onClick={handleBulkAiGrade}
                disabled={!selectedPaket}
                className="w-full lg:w-auto bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm text-xs sm:text-sm disabled:opacity-50"
              >
                <Brain size={16} className="shrink-0" />
                <span>Auto-Grade Seluruh Kelas</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="min-w-0">
        {isLoading && (
          <div className="text-center p-12 text-gray-500">
            <Activity className="animate-spin mx-auto mb-3 text-blue-400" />{" "}
            Mengambil data ujian...
          </div>
        )}

        {!isLoading && data.length === 0 && (
          <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-8 sm:p-12 text-center shadow-sm">
            <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-700 mb-1">
              Soal Kosong
            </h3>
            <p className="text-sm text-gray-500">
              Tidak ada soal atau santri yang mengerjakan paket ini di kelas yang
              dipilih.
            </p>
          </div>
        )}

        {!isLoading && data.length > 0 && (
          <div className="space-y-5">
            {/* Mode Switch */}
            <div className="flex bg-gray-100 p-1 rounded-xl w-full sm:w-fit">
              <button
                onClick={() => setViewMode("SOAL")}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                  viewMode === "SOAL"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Berdasarkan Soal
              </button>
              <button
                onClick={() => setViewMode("SANTRI")}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                  viewMode === "SANTRI"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Berdasarkan Santri
              </button>
            </div>

            {/* MAPEL TABS */}
            <div className="flex overflow-x-auto gap-2 pb-1">
              {Object.keys(groupedData).map((mapelName, i) => {
                const isActive = activeMapel
                  ? activeMapel === mapelName
                  : i === 0;
                return (
                  <button
                    key={mapelName}
                    onClick={() => setActiveMapel(mapelName)}
                    className={`shrink-0 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors border ${
                      isActive
                        ? "bg-blue-600 text-white border-blue-600 shadow-md"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {mapelName}
                  </button>
                );
              })}
            </div>

            {viewMode === "SOAL" ? (
              <div className="space-y-8">
                {Object.entries(groupedData)
                  .filter(([mapelNama], i) =>
                    activeMapel ? activeMapel === mapelNama : i === 0,
                  )
                  .map(([mapelNama, typeGroups]) => (
                    <div key={mapelNama} className="space-y-6">
                      {/* MAPEL HEADER */}
                      <div className="flex items-center gap-2.5 pb-2 border-b-2 border-gray-200">
                        <div className="bg-blue-600 text-white rounded-lg p-1.5 shrink-0">
                          <Layers size={18} />
                        </div>
                        <h2 className="text-lg sm:text-xl font-bold font-display text-gray-800 uppercase tracking-wider break-words">
                          {mapelNama}
                        </h2>
                      </div>

                      <div className="space-y-6">
                        {Object.entries(typeGroups).map(([tipeSoal, soals]) => (
                          <div key={tipeSoal} className="space-y-3.5">
                            {/* TYPE HEADER */}
                            <div className="inline-flex items-center gap-2 bg-purple-50 text-purple-800 border border-purple-100 px-3 py-1.5 rounded-lg shadow-sm">
                              <span className="text-xs sm:text-sm font-bold tracking-wide">
                                {tipeSoal.replace(/_/g, " ")}
                              </span>
                              <span className="bg-purple-200 text-purple-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                {soals.length} Soal
                              </span>
                            </div>

                            <div className="space-y-3.5">
                              {soals.map((soal: any, idx: number) => {
                                const isExpanded = expandedSoalId === soal.id;
                                const answeredCount = soal.jawabanSantri.filter(
                                  (j: any) => j.id,
                                ).length;
                                const needsReviewCount =
                                  soal.jawabanSantri.filter((j: any) =>
                                    isNeedsTeacherReview(j),
                                  ).length;
                                const reviewedCount = soal.jawabanSantri.filter(
                                  (j: any) => Boolean(j.reviewedByName),
                                ).length;
                                const isEssay = soal.tipeSoal.startsWith("ESSAY");

                                return (
                                  <div
                                    key={soal.id}
                                    className={`bg-white rounded-xl shadow-sm border transition-all overflow-hidden ${
                                      isExpanded
                                        ? "border-blue-400 ring-2 ring-blue-100 shadow-md"
                                        : "border-gray-200 hover:border-gray-300"
                                    }`}
                                  >
                                    {/* SOAL HEADER - SELALU TERBACA DI HP */}
                                    <div
                                      className="p-3.5 sm:p-4 md:p-5 flex flex-col gap-3 cursor-pointer"
                                      onClick={() =>
                                        setExpandedSoalId(
                                          isExpanded ? null : soal.id,
                                        )
                                      }
                                    >
                                      {/* Baris Meta: Nomor, Bobot, Jumlah Menjawab, Tombol Buka */}
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="inline-flex bg-blue-50 text-blue-700 font-bold text-xs sm:text-sm px-2.5 py-1 rounded-md border border-blue-100">
                                            No {idx + 1}
                                          </span>
                                          <span className="text-[11px] uppercase font-bold tracking-wider text-gray-500">
                                            Bobot {soal.bobot}
                                          </span>
                                          <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                                            <Users_ico /> {answeredCount}/
                                            {soal.jawabanSantri.length}
                                          </span>
                                          {needsReviewCount > 0 && (
                                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md">
                                              <AlertTriangle size={11} />
                                              {needsReviewCount} Perlu Cek Guru
                                            </span>
                                          )}
                                          {reviewedCount > 0 && (
                                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                              <UserCheck size={11} />
                                              {reviewedCount} Direview
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                          {isEssay && answeredCount > 0 && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleAIGradeSoal(
                                                  soal.id,
                                                  soal.jawabanSantri,
                                                );
                                              }}
                                              disabled={isAIGrading === soal.id}
                                              className={`inline-flex items-center gap-1 py-1.5 px-2.5 rounded-lg text-[11px] font-bold uppercase transition ${
                                                isAIGrading === soal.id
                                                  ? "bg-purple-100 text-purple-400"
                                                  : "bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200"
                                              }`}
                                            >
                                              <Brain
                                                size={12}
                                                className={
                                                  isAIGrading === soal.id
                                                    ? "animate-pulse"
                                                    : ""
                                                }
                                              />
                                              {isAIGrading === soal.id
                                                ? "Proses..."
                                                : "Nilai AI"}
                                            </button>
                                          )}

                                          <button
                                            type="button"
                                            className={`inline-flex items-center gap-1 border py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                                              isExpanded
                                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                                : "bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700"
                                            }`}
                                          >
                                            {isExpanded
                                              ? "Tutup"
                                              : "Cek Santri"}
                                            <ChevronDown
                                              size={14}
                                              className={`transition-transform duration-200 ${
                                                isExpanded ? "rotate-180" : ""
                                              }`}
                                            />
                                          </button>
                                        </div>
                                      </div>

                                      {/* Konten Soal — saat belum dibuka tampil ringkas & terbaca penuh saat dibuka */}
                                      {!isExpanded ? (
                                        <div className="min-w-0 space-y-2">
                                          {soal.gambarUrl && (
                                            <div className="text-[11px] font-semibold text-blue-600">
                                              🖼️ Soal memiliki gambar (ketuk untuk lihat penuh)
                                            </div>
                                          )}
                                          <SoalText
                                            html={soal.pertanyaan || ""}
                                            className="text-sm sm:text-base text-gray-800 leading-relaxed prose prose-sm max-w-none break-words"
                                          />
                                          {Array.isArray(soal.opsiList) &&
                                            soal.opsiList.length > 0 && (
                                              <div className="flex flex-wrap gap-1.5 pt-1" dir="auto">
                                                {soal.opsiList.map(
                                                  (o: any, oIdx: number) => (
                                                    <span
                                                      key={o.id || oIdx}
                                                      className={`text-xs px-2 py-0.5 rounded-md border break-words max-w-full ${
                                                        o.isCorrect
                                                          ? "bg-green-50 border-green-200 text-green-800 font-semibold"
                                                          : "bg-gray-50 border-gray-200 text-gray-600"
                                                      }`}
                                                    >
                                                      <strong>
                                                        {String.fromCharCode(
                                                          65 + oIdx,
                                                        )}
                                                        .
                                                      </strong>{" "}
                                                      <SoalText
                                                        html={o.teks || ""}
                                                        className="inline break-words"
                                                      />
                                                    </span>
                                                  ),
                                                )}
                                              </div>
                                            )}
                                        </div>
                                      ) : (
                                        <div
                                          className="min-w-0 pt-1"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <ReviewSoalDetail
                                            soal={soal}
                                            showKunciOnOptions
                                          />
                                        </div>
                                      )}
                                    </div>

                                    {/* EXPANDED AREA - KUNCI & DAFTAR SANTRI */}
                                    {isExpanded && (
                                      <div className="border-t border-gray-200 bg-gray-50/50">
                                        <div className="p-3.5 sm:p-4 bg-green-50/40 border-b border-green-100">
                                          <h5 className="text-[11px] uppercase font-bold text-green-800 mb-2 tracking-wider">
                                            Referensi Kebenaran (Kunci)
                                          </h5>
                                          <ReviewKunciJawaban soal={soal} />
                                        </div>

                                        {/* MOBILE & TABLET VIEW (< lg): Kartu Santri Penuh (tidak menyempit di HP!) */}
                                        <div className="lg:hidden divide-y divide-gray-200 bg-white">
                                          {soal.jawabanSantri
                                            .slice(0, getLimit(soal.id))
                                            .map((jaw: any) => (
                                              <div
                                                key={jaw.id || jaw.santriNama}
                                                className="p-3.5 sm:p-4 space-y-3"
                                              >
                                                <div className="flex items-start justify-between gap-2">
                                                  <div className="min-w-0">
                                                    <div className="font-bold text-gray-800 text-sm break-words">
                                                      {jaw.santriNama}
                                                    </div>
                                                    <div className="text-[10px] text-gray-400 font-medium">
                                                      Status sesi:{" "}
                                                      {jaw.sesiStatus}
                                                    </div>
                                                  </div>
                                                  <div className="shrink-0">
                                                    {renderStatus(jaw, soal)}
                                                  </div>
                                                </div>

                                                <div className="min-w-0">
                                                  <div className="text-[10px] uppercase font-bold text-gray-400 mb-1">
                                                    Jawaban Santri
                                                  </div>
                                                  <ReviewJawabanSantri
                                                    jaw={jaw}
                                                    soal={soal}
                                                  />
                                                  {renderFeedbackBox(jaw)}
                                                </div>

                                                <div className="pt-2 border-t border-gray-100">
                                                  {renderAksiRevisi(
                                                    jaw,
                                                    soal,
                                                    true,
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                        </div>

                                        {/* DESKTOP VIEW (lg+): Tabel Rapi */}
                                        <div className="hidden lg:block overflow-x-auto">
                                          <table className="w-full text-left text-sm">
                                            <thead>
                                              <tr className="bg-gray-100/80 text-gray-500 uppercase tracking-wider text-[10px] font-bold border-b border-gray-200">
                                                <th className="px-4 py-3 w-48">
                                                  Nama Santri
                                                </th>
                                                <th className="px-4 py-3">
                                                  Jawaban Santri
                                                </th>
                                                <th className="px-4 py-3 w-32 text-center">
                                                  Status / Skor
                                                </th>
                                                <th className="px-4 py-3 text-right w-48">
                                                  Aksi Revisi
                                                </th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 bg-white">
                                              {soal.jawabanSantri
                                                .slice(0, getLimit(soal.id))
                                                .map((jaw: any) => (
                                                  <tr
                                                    key={
                                                      jaw.id || jaw.santriNama
                                                    }
                                                    className="hover:bg-gray-50/70 transition-colors align-top"
                                                  >
                                                    <td className="px-4 py-3">
                                                      <div className="font-bold text-gray-800 text-sm break-words">
                                                        {jaw.santriNama}
                                                      </div>
                                                      <div className="text-[10px] text-gray-400 font-medium">
                                                        Session:{" "}
                                                        {jaw.sesiStatus}
                                                      </div>
                                                    </td>

                                                    <td className="px-4 py-3 max-w-xl">
                                                      <ReviewJawabanSantri
                                                        jaw={jaw}
                                                        soal={soal}
                                                      />
                                                      {renderFeedbackBox(jaw, true)}
                                                    </td>

                                                    <td className="px-4 py-3 text-center">
                                                      {renderStatus(jaw, soal)}
                                                    </td>

                                                    <td className="px-4 py-3 text-right">
                                                      {renderAksiRevisi(
                                                        jaw,
                                                        soal,
                                                      )}
                                                    </td>
                                                  </tr>
                                                ))}
                                            </tbody>
                                          </table>
                                        </div>

                                        {/* LOAD MORE BUTTON */}
                                        {soal.jawabanSantri.length >
                                          getLimit(soal.id) && (
                                          <div className="p-3 bg-gray-50/80 border-t border-gray-100 flex justify-center">
                                            <button
                                              onClick={() =>
                                                setSantriLimits((p) => ({
                                                  ...p,
                                                  [soal.id]:
                                                    getLimit(soal.id) + 20,
                                                }))
                                              }
                                              className="text-xs font-bold text-blue-600 bg-blue-50/50 border border-blue-100 px-5 py-2 rounded-lg hover:bg-blue-100 transition-colors"
                                            >
                                              Tampilkan Lebih Banyak (
                                              {Math.min(
                                                getLimit(soal.id),
                                                soal.jawabanSantri.length,
                                              )}{" "}
                                              dari {soal.jawabanSantri.length}{" "}
                                              Santri)
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
            ) : (
              /* VIEW BERDASARKAN SANTRI */
              <div className="space-y-4">
                {groupedBySantri.map((santri: any) => {
                  const isExpanded = expandedStudentId === santri.nama;

                  return (
                    <div
                      key={santri.nama}
                      className={`bg-white rounded-xl shadow-sm border transition-all overflow-hidden ${
                        isExpanded
                          ? "border-blue-400 ring-2 ring-blue-100 shadow-md"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {/* HEADER SANTRI */}
                      <div
                        className="p-3.5 sm:p-4 md:p-5 flex flex-col sm:flex-row gap-3 sm:items-center justify-between cursor-pointer"
                        onClick={() =>
                          setExpandedStudentId(isExpanded ? null : santri.nama)
                        }
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base sm:text-lg font-bold text-gray-800 break-words">
                              {santri.nama}
                            </h3>
                            {santri.needsReviewCount > 0 && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md">
                                <AlertTriangle size={11} />
                                {santri.needsReviewCount} Perlu Cek Guru
                              </span>
                            )}
                            {santri.reviewedCount > 0 && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                <UserCheck size={11} />
                                {santri.reviewedCount} Direview
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 font-medium mt-0.5">
                            Status: {santri.sesiStatus}
                          </p>

                          <div className="flex flex-col gap-1.5 mt-2.5">
                            {Object.values(santri.mapels).map((m: any) => (
                              <div
                                key={m.nama}
                                className="flex flex-wrap items-center gap-1.5"
                              >
                                <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                                  {m.nama}: {m.totalNilaiMapel}
                                </span>
                                {Object.entries(m.tipeSoalScores || {}).map(
                                  ([ts, score]: [string, any]) => (
                                    <span
                                      key={ts}
                                      className="text-[10px] font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100"
                                    >
                                      {ts.replace(/_/g, " ")}: {score}
                                    </span>
                                  ),
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                          <div className="sm:text-right">
                            <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                              Total Skor
                            </div>
                            <div className="text-lg font-bold text-blue-600">
                              {santri.totalNilai}{" "}
                              <span className="text-xs text-gray-400 font-normal">
                                poin
                              </span>
                            </div>
                          </div>
                          <ChevronDown
                            size={20}
                            className={`text-gray-400 transition-transform duration-200 ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          />
                        </div>
                      </div>

                      {/* EXPANDED AREA PER SANTRI */}
                      {isExpanded && (
                        <div className="border-t border-gray-100 bg-gray-50/50 p-3 sm:p-4 md:p-6 space-y-6">
                          {Object.values(santri.mapels)
                            .filter((mapel: any) => {
                              const defaultMapel = Object.keys(groupedData)[0];
                              const currentActiveMapel =
                                activeMapel || defaultMapel;
                              return mapel.nama === currentActiveMapel;
                            })
                            .map((mapel: any) => (
                              <div key={mapel.nama} className="space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-gray-200 pb-2">
                                  <h4 className="font-bold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
                                    <Layers
                                      size={17}
                                      className="text-blue-500 shrink-0"
                                    />{" "}
                                    {mapel.nama}
                                  </h4>
                                  <div className="text-xs font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-md border border-green-200">
                                    Total Mapel: {mapel.totalNilaiMapel}
                                  </div>
                                </div>

                                <div className="space-y-4">
                                  {mapel.jawabanList.map(
                                    (item: any, idx: number) => {
                                      const { soal, jawaban: jaw } = item;
                                      return (
                                        <div
                                          key={soal.id}
                                          className="bg-white border border-gray-200 rounded-xl p-3.5 sm:p-4 md:p-5 shadow-sm space-y-4"
                                        >
                                          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-100">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                              <span className="bg-blue-50 text-blue-700 font-bold text-[10px] px-2 py-0.5 rounded border border-blue-100 uppercase tracking-wide">
                                                Soal {idx + 1}
                                              </span>
                                              <span className="bg-purple-50 text-purple-700 font-bold text-[10px] px-2 py-0.5 rounded border border-purple-100 uppercase tracking-wide">
                                                {soal.tipeSoal.replace(
                                                  /_/g,
                                                  " ",
                                                )}
                                              </span>
                                              <span className="text-[10px] text-gray-500 font-bold tracking-wider">
                                                Bobot: {soal.bobot}
                                              </span>
                                            </div>
                                            <div className="shrink-0">
                                              {renderStatus(jaw, soal)}
                                            </div>
                                          </div>

                                          {/* Soal lengkap + gambar + semua opsi jawaban */}
                                          <ReviewSoalDetail
                                            soal={soal}
                                            showKunciOnOptions
                                          />

                                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                                            <div className="bg-gray-50/70 border border-gray-200 rounded-xl p-3 min-w-0">
                                              <div className="text-[10px] uppercase font-bold text-gray-500 mb-2 tracking-wider">
                                                Kunci Jawaban Benar
                                              </div>
                                              <ReviewKunciJawaban soal={soal} />
                                            </div>

                                            <div className="bg-blue-50/20 border border-blue-100 rounded-xl p-3 min-w-0 flex flex-col justify-between">
                                              <div>
                                                <div className="text-[10px] uppercase font-bold text-gray-500 mb-2 tracking-wider">
                                                  Jawaban Santri
                                                </div>
                                                <ReviewJawabanSantri
                                                  jaw={jaw}
                                                  soal={soal}
                                                />

                                                {renderFeedbackBox(jaw)}
                                              </div>

                                              <div className="mt-4 pt-3 border-t border-gray-200/70">
                                                {renderAksiRevisi(
                                                  jaw,
                                                  soal,
                                                  true,
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    },
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Users_ico() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
  );
}
