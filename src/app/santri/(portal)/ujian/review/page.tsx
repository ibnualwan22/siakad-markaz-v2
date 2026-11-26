"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle,
  X,
  ChevronRight,
  Layers,
  ArrowLeft,
  Clock,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  ReviewSoalDetail,
  ReviewKunciJawaban,
  ReviewJawabanSantri,
} from "@/components/ujian/ReviewQuestionBlocks";

function ReviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sesiId = searchParams.get("s");

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeMapelIdx, setActiveMapelIdx] = useState(0);

  useEffect(() => {
    if (!sesiId) {
      router.push("/santri/ujian");
      return;
    }

    fetch(`/api/santri/ujian/review?sesiId=${sesiId}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setData(json);
      })
      .catch((err) => {
        toast.error(err.message || "Gagal memuat review");
        router.push("/santri/ujian");
      })
      .finally(() => setLoading(false));
  }, [sesiId, router]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-gray-500">
        Memuat data review...
      </div>
    );
  }

  if (!data) return null;

  const activeMapel = data.mapels[activeMapelIdx];

  return (
    <div className="max-w-5xl mx-auto pb-12 min-w-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* HEADER — tidak sticky di HP agar layar kecil memanjang tidak terhalang */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 text-white shadow-xl shadow-indigo-200/50 mb-6 sm:mb-8 md:sticky md:top-4 z-20">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-indigo-200 mb-1">
              <CheckCircle size={15} />{" "}
              <span className="font-bold text-xs uppercase tracking-widest">
                Review Ujian
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-display font-black leading-tight drop-shadow-sm break-words">
              {data.paketNama}
            </h1>
            <div className="mt-1.5 text-indigo-100 text-xs sm:text-sm font-medium">
              Bahan ajar dan pembahasan kunci jawaban
            </div>
          </div>

          <button
            onClick={() => router.push("/santri/ujian")}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl flex items-center gap-2 font-bold text-xs sm:text-sm backdrop-blur-sm transition-all shrink-0"
          >
            <ArrowLeft size={15} /> Kembali
          </button>
        </div>

        {/* MAPEL TABS */}
        <div className="flex gap-2 overflow-x-auto mt-5 sm:mt-6 pb-1">
          {data.mapels.map((m: any, i: number) => (
            <button
              key={i}
              onClick={() => setActiveMapelIdx(i)}
              className={`shrink-0 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeMapelIdx === i
                  ? "bg-white text-indigo-700 shadow-md"
                  : "bg-white/10 text-indigo-50 border border-indigo-400/30 hover:bg-white/20"
              }`}
            >
              {m.namaMapel}
            </button>
          ))}
        </div>
      </div>

      {activeMapel && (
        <div className="space-y-5 sm:space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="min-w-0">
              <h2 className="text-lg sm:text-2xl font-black text-gray-800 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <Layers size={18} />
                </div>
                <span className="break-words">{activeMapel.namaMapel}</span>
              </h2>
              <p
                className="text-sm font-bold text-indigo-600 mt-1 font-arabic"
                dir="rtl"
              >
                {activeMapel.namaMapelArab}
              </p>
            </div>
            <div className="px-4 py-2.5 bg-gradient-to-tr from-gray-50 to-white rounded-xl border border-gray-200 shadow-inner">
              <div className="text-[10px] font-black uppercase text-gray-400 mb-0.5 tracking-wider">
                Total Skor
              </div>
              <div className="text-lg sm:text-xl font-black text-gray-800 leading-none">
                {activeMapel.totalScore}{" "}
                <span className="text-sm text-gray-400">
                  / {activeMapel.totalBobot}
                </span>
              </div>
            </div>
          </div>

          {activeMapel.groups.map((grp: any, gIdx: number) => (
            <div
              key={gIdx}
              className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100 overflow-hidden shadow-sm"
            >
              <div className="bg-gray-50 border-b border-gray-100 px-4 sm:px-6 py-3.5 flex flex-wrap justify-between items-center gap-2">
                <h3 className="font-bold text-gray-700 uppercase tracking-widest text-xs flex items-center gap-1.5">
                  <ChevronRight size={15} className="text-indigo-400 shrink-0" />
                  Tipe: {grp.tipeSoal.replace(/_/g, " ")}
                </h3>
                <div className="flex gap-2 text-xs font-bold font-mono">
                  <div className="px-2 py-1 bg-green-50 text-green-700 rounded-md border border-green-100">
                    {grp.summary.benar} Benar
                  </div>
                  <div className="px-2 py-1 bg-red-50 text-red-700 rounded-md border border-red-100">
                    {grp.summary.salah} Salah
                  </div>
                </div>
              </div>

              <div className="divide-y divide-gray-100">
                {grp.soalList.map((soal: any, sIdx: number) => (
                  <div
                    key={sIdx}
                    className="p-4 sm:p-6 transition-colors hover:bg-gray-50/40"
                  >
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                      <div className="flex items-center gap-2 sm:block shrink-0">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm shadow-sm">
                          {soal.nomor}
                        </div>
                        <div className="flex sm:hidden flex-wrap items-center gap-1.5">
                          {soal.isEssay ? (
                            <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                              Essay
                            </span>
                          ) : soal.isCorrect === true ? (
                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1">
                              <CheckCircle size={10} /> Benar
                            </span>
                          ) : soal.isCorrect === false ? (
                            <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1">
                              <X size={10} /> Salah
                            </span>
                          ) : (
                            <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1">
                              <Clock size={10} /> Parsial / Kosong
                            </span>
                          )}
                          <span className="text-[10px] font-bold text-gray-400">
                            Bobot: {soal.bobot}
                          </span>
                        </div>
                      </div>

                      <div className="flex-1 min-w-0 space-y-4">
                        <div className="hidden sm:flex items-center gap-2">
                          {soal.isEssay ? (
                            <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                              Essay
                            </span>
                          ) : soal.isCorrect === true ? (
                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1">
                              <CheckCircle size={10} /> Benar
                            </span>
                          ) : soal.isCorrect === false ? (
                            <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1">
                              <X size={10} /> Salah
                            </span>
                          ) : (
                            <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1">
                              <Clock size={10} /> Parsial / Kosong
                            </span>
                          )}
                          <span className="text-[10px] font-bold text-gray-400">
                            Bobot: {soal.bobot}
                          </span>
                        </div>

                        {/* Pertanyaan lengkap + gambar + opsi jawaban */}
                        <ReviewSoalDetail
                          soal={soal}
                          showKunciOnOptions={!soal.isEssay}
                        />

                        {/* BOXES */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          <div className="rounded-xl border border-gray-200 overflow-hidden flex flex-col min-w-0">
                            <div className="bg-gray-50 px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                              Jawaban Anda
                            </div>
                            <div className="p-3.5 bg-white flex-1 space-y-2 min-w-0">
                              <ReviewJawabanSantri
                                jaw={soal.jawabanSantri}
                                soal={soal}
                              />
                              {soal.isEssay && soal.jawabanSantri?.jawabanTeks && (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-orange-100 text-orange-700">
                                  <Clock size={13} />
                                  {soal.statusEssay === "SUDAH_DIKOREKSI"
                                    ? "Sudah Dinilai (Skor dirahasiakan sebelum sidang)"
                                    : "Menunggu Dikoreksi"}
                                </div>
                              )}
                            </div>
                          </div>

                          {!soal.isEssay && (
                            <div className="rounded-xl border border-green-200 overflow-hidden flex flex-col shadow-sm shadow-green-50 min-w-0">
                              <div className="bg-green-50 px-3 py-2 text-[10px] font-bold text-green-700 uppercase tracking-wider border-b border-green-200">
                                Kunci Jawaban Benar
                              </div>
                              <div className="p-3.5 bg-white flex-1 min-w-0">
                                <ReviewKunciJawaban soal={soal} />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[50vh]">
          Memuat...
        </div>
      }
    >
      <ReviewContent />
    </Suspense>
  );
}
