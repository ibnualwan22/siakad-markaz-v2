"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, X, ChevronRight, Layers, ArrowLeft, Clock } from "lucide-react";
import toast from "react-hot-toast";

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
    return <div className="flex h-[60vh] items-center justify-center text-gray-500">Memuat data review...</div>;
  }

  if (!data) return null;

  // Adaptasi logic admin untuk rendering jawaban santri & kunci (Non-essay)
  const renderKunciJawaban = (soal: any) => {
    if (soal.isEssay) return null;

    // PG / Benar Salah
    if (soal.tipeSoal === "PG" || soal.tipeSoal === "BENAR_SALAH" || soal.tipeSoal === "MUFRODAT") {
      const opsiBenar = soal.opsiList?.filter((o: any) => o.isCorrect);
      if (opsiBenar?.length > 0) {
        return (
          <div className="space-y-1">
            {opsiBenar.map((o: any) => (
              <div key={o.id} className="text-sm font-medium text-green-800 bg-green-50 p-2 rounded border border-green-100">{o.teks}</div>
            ))}
          </div>
        );
      }
      return <div className="text-xs text-gray-400 italic">Kunci tidak diatur</div>;
    }

    // PG Multi
    if (soal.tipeSoal === "PG_MULTI" && soal.opsiList) {
      const opsiBenar = soal.opsiList.filter((o: any) => o.isCorrect);
      if (opsiBenar.length > 0) {
        return (
          <div className="flex flex-wrap gap-1">
            {opsiBenar.map((o: any) => (
              <span key={o.id} className="text-xs font-medium text-green-800 bg-green-50 px-2 py-1 rounded border border-green-100">{o.teks}</span>
            ))}
          </div>
        );
      }
    }

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
            <span key={i} className="text-xs font-medium text-green-800 bg-green-50 px-2 py-1 rounded border border-green-100">{i + 1}. {item}</span>
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
            <span key={i} className="text-xs font-medium text-green-800 bg-green-50 px-2 py-1 rounded border border-green-100">Kosong {b.index + 1}: {b.jawaban}</span>
          ))}
        </div>
      );
    }

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

    if (soal.tipeSoal === "SUSUN_HURUF" && soal.dataTambahan?.hurufAcak) {
      return (
        <div className="text-sm font-medium text-green-800 bg-green-50 p-2 rounded border border-green-100">
          {soal.kunciJawaban || soal.dataTambahan.jawaban || soal.dataTambahan.hurufAcak.join('')}
        </div>
      );
    }

    return <div className="text-xs text-gray-400 italic font-mono">-</div>;
  };

  const renderJawabanSantri = (soal: any) => {
    const jaw = soal.jawabanSantri;

    // Khusus Essay
    if (soal.isEssay) {
      if (!jaw?.jawabanTeks) return <span className="text-gray-400 italic text-sm">Tidak menjawab</span>;
      return (
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-200 whitespace-pre-wrap leading-relaxed">
            {jaw.jawabanTeks}
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-orange-100 text-orange-700">
            <Clock size={14} /> {soal.statusEssay === "SUDAH_DIKOREKSI" ? "Sudah Dinilai (Skor dirahasiakan sebelum sidang)" : "Menunggu Dikoreksi"}
          </div>
        </div>
      );
    }

    if (!jaw) return <span className="text-gray-400 italic text-sm">Tidak menjawab</span>;

    // PG / Benar Salah
    if (["PG", "BENAR_SALAH", "MUFRODAT", "ISIAN_SAMPING", "ISIAN_BAWAH"].includes(soal.tipeSoal)) {
      const selected = soal.opsiList?.find((o: any) => o.id === jaw.opsiId);
      return (
        <div className={`text-sm font-medium p-2.5 border rounded-lg ${soal.isCorrect === true ? 'text-green-800 bg-green-50 border-green-100' : 'text-rose-800 bg-rose-50 border-rose-100'}`}>
          {selected?.teks || jaw.jawabanTeks || "-"}
        </div>
      );
    }

    // TABEL TASRIF
    if (soal.tipeSoal === "TABEL_TASRIF" && jaw.jawabanData?.cells && soal.dataTambahan?.rows) {
      const cells = jaw.jawabanData.cells;
      return (
        <div className="overflow-x-auto">
          <table className="text-xs border border-gray-200 rounded">
            <tbody>
              {soal.dataTambahan.rows.map((row: any, rIdx: number) => (
                <tr key={rIdx} className="border-b border-gray-100">
                  {(row.cells || []).map((cell: any, cIdx: number) => {
                    if (!cell.isBlank) {
                      return <td key={cIdx} className="px-2 py-1.5 border-r border-gray-100 bg-gray-50 text-gray-600">{cell.value}</td>;
                    }
                    const key = `${rIdx}-${cIdx}`;
                    const studentAns = cells[key] || "";
                    const possibleAnswers = (cell.value || "").split("|").map((k: string) => k.trim().toLowerCase());
                    const isCellCorrect = studentAns.trim() !== "" && possibleAnswers.includes(studentAns.trim().toLowerCase());
                    return (
                      <td key={cIdx} className={`px-2 py-1.5 border-r font-bold ${isCellCorrect ? 'bg-green-50 text-green-800' : 'bg-rose-50 text-rose-800'}`}>
                        {studentAns || <span className="text-gray-300 italic">—</span>}
                        {studentAns && (isCellCorrect ? <CheckCircle size={10} className="inline ml-1 text-green-500" /> : <X size={10} className="inline ml-1 text-rose-500" />)}
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

    // JARING RELASI
    if (soal.tipeSoal === "JARING_RELASI" && jaw.jawabanData?.connections) {
      const trueGraph = new Map<number, number[]>();
      (soal.dataTambahan?.connections || []).forEach((c: any) => trueGraph.set(c.left, c.right || []));

      return (
        <div className="space-y-1.5">
          {jaw.jawabanData.connections.map((c: any, i: number) => {
            const trueRights = trueGraph.get(c.left) || [];
            return (
              <div key={i} className="flex flex-wrap items-center gap-1.5 text-xs p-1.5 border border-gray-200 rounded bg-gray-50">
                <span className="font-medium bg-white px-2 py-1 rounded shadow-sm">{soal.dataTambahan?.lefts?.[c.left] || `L${c.left}`}</span>
                <span className="text-gray-400">→</span>
                {(c.right || []).map((r: number) => {
                  const isCrr = trueRights.includes(r);
                  return <span key={r} className={`px-2 flex items-center gap-1 py-1 rounded font-medium ${isCrr ? 'bg-green-100 text-green-800' : 'bg-rose-100 text-rose-800'}`}>{soal.dataTambahan?.rights?.[r] || `R${r}`} {isCrr ? <CheckCircle size={12} /> : <X size={12} />}</span>;
                })}
              </div>
            );
          })}
        </div>
      );
    }

    // MENJODOHKAN
    if (soal.tipeSoal === "MENJODOHKAN" && jaw.jawabanData?.pairs && soal.dataTambahan?.lefts) {
      return (
        <div className="space-y-1">
          {jaw.jawabanData.pairs.map((jp: any, i: number) => {
            const trueIdx = soal.dataTambahan.lefts.indexOf(jp.left);
            const isPairCorrect = trueIdx !== -1 && soal.dataTambahan.rights[trueIdx] === jp.right;
            return (
              <div key={i} className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded border ${isPairCorrect ? 'bg-green-50 border-green-100 text-green-800' : 'bg-rose-50 border-rose-100 text-rose-800'}`}>
                <span className="font-medium">{jp.left}</span>
                <span className="text-gray-400">→</span>
                <span className="font-medium">{jp.right}</span>
                {isPairCorrect ? <CheckCircle size={14} className="text-green-600 ml-auto" /> : <X size={14} className="text-rose-600 ml-auto" />}
              </div>
            );
          })}
        </div>
      );
    }

    // DRAG_KATEGORI
    if (soal.tipeSoal === "DRAG_KATEGORI" && jaw.jawabanData?.items && soal.dataTambahan?.items) {
      return (
        <div className="flex flex-wrap gap-1.5">
          {jaw.jawabanData.items.map((jitem: any, i: number) => {
            const found = soal.dataTambahan.items.find((d: any) => d.text === jitem.text);
            const isItemCorrect = found && found.category === jitem.category;
            return (
              <span key={i} className={`text-xs font-medium px-2 py-1.5 flex items-center gap-1.5 rounded border ${isItemCorrect ? 'text-green-800 bg-green-50 border-green-100' : 'text-rose-800 bg-rose-50 border-rose-100'}`}>
                {jitem.text} <span className="opacity-70">({jitem.category})</span> {isItemCorrect ? <CheckCircle size={12} className="text-green-600" /> : <X size={12} className="text-rose-600" />}
              </span>
            );
          })}
        </div>
      );
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
            const isCrr = assignedCat === trueCat;
            return (
              <span key={i} className={`inline-flex flex-col items-center border rounded px-1.5 py-1 ${isCrr ? 'bg-green-50 border-green-200' : 'bg-rose-50 border-rose-200'}`}>
                <span className="font-bold text-gray-800">{wordStr}</span>
                <span className={`px-1 rounded-[4px] text-[10px] mt-0.5 font-bold ${isCrr ? 'text-green-700' : 'text-rose-700'}`}>{assignedCat}</span>
              </span>
            );
          })}
        </div>
      );
    }

    // DRAG_TO_BLANK / PARAGRAF_RUMPANG
    if ((soal.tipeSoal === "DRAG_TO_BLANK" || soal.tipeSoal === "PARAGRAF_RUMPANG") && jaw.jawabanData?.answers && soal.dataTambahan?.blanks) {
      return (
        <div className="flex flex-wrap gap-1.5">
          {soal.dataTambahan.blanks.map((b: any, i: number) => {
            const studentAns = (jaw.jawabanData.answers[b.index] || "").trim();
            const possibleAnswers = (b.jawaban || "").split("|").map((k: string) => k.trim().toLowerCase());
            const isAnsCorrect = studentAns !== "" && possibleAnswers.includes(studentAns.toLowerCase());
            return (
              <span key={i} className={`text-xs font-medium px-2 py-1.5 flex items-center gap-1.5 inline-block rounded border ${isAnsCorrect ? 'text-green-800 bg-green-50 border-green-100' : 'text-rose-800 bg-rose-50 border-rose-100'}`}>
                Kosong {b.index + 1}: {studentAns || <span className="text-gray-400 italic">kosong</span>} {isAnsCorrect ? <CheckCircle size={12} className="text-green-600" /> : <X size={12} className="text-rose-600" />}
              </span>
            );
          })}
        </div>
      );
    }

    if (soal.tipeSoal === "SUSUN_HURUF" && jaw.jawabanData?.susunanIndices && soal.dataTambahan?.hurufAcak) {
      const studentAnsText = jaw.jawabanData.susunanIndices.map((i: number) => soal.dataTambahan.hurufAcak[i]).join('');
      return (
        <div className={`text-sm font-medium p-2.5 rounded-lg border flex justify-between items-center ${soal.isCorrect ? 'text-green-800 bg-green-50 border-green-100' : 'text-rose-800 bg-rose-50 border-rose-100'}`}>
          <span>{studentAnsText}</span>
          {soal.isCorrect ? <CheckCircle size={16} className="text-green-600" /> : <X size={16} className="text-rose-600" />}
        </div>
      );
    }

    // PG MULTI
    if (soal.tipeSoal === "PG_MULTI" && jaw.jawabanData?.selectedIds) {
      const correctIds = soal.opsiList?.filter((o: any) => o.isCorrect).map((o: any) => o.id) || [];
      return (
        <div className="flex flex-wrap gap-1.5">
          {jaw.jawabanData.selectedIds.map((selId: string, i: number) => {
            const opsi = soal.opsiList?.find((o: any) => o.id === selId);
            const isOpsiCorrect = correctIds.includes(selId);
            return (
              <span key={i} className={`text-xs font-medium px-2.5 py-1.5 rounded-md border ${isOpsiCorrect ? 'text-green-800 bg-green-50 border-green-100' : 'text-rose-800 bg-rose-50 border-rose-100'}`}>
                {opsi?.teks || selId}
              </span>
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
            const isItCorrect = item === soal.dataTambahan.items[i];
            return (
              <span key={i} className={`text-xs font-medium px-2 py-1.5 rounded border ${isItCorrect ? 'text-green-800 bg-green-50 border-green-100' : 'text-rose-800 bg-rose-50 border-rose-100'}`}>
                {i + 1}. {item}
              </span>
            );
          })}
        </div>
      );
    }

    if (jaw.jawabanTeks) {
      return <div className="text-sm font-medium p-2.5 rounded-lg bg-gray-50 border border-gray-200 outline-none">{jaw.jawabanTeks}</div>;
    }

    return <span className="text-gray-400 italic">Tidak menjawab / Format struktural kompleks</span>;
  };

  const activeMapel = data.mapels[activeMapelIdx];

  return (
    <div className="max-w-5xl mx-auto pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* HEADER */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-indigo-200/50 mb-8 sticky top-4 z-20">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-200 mb-1">
              <CheckCircle size={16} /> <span className="font-bold text-xs uppercase tracking-widest">Review Ujian</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-display font-black leading-tight drop-shadow-sm">{data.paketNama}</h1>
            <div className="mt-2 text-indigo-100 text-sm font-medium">Bahan ajar dan pembahasan kunci jawaban</div>
          </div>

          <button onClick={() => router.push("/santri/ujian")} className="px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl flex items-center gap-2 font-bold text-sm backdrop-blur-sm transition-all focus:ring-2 ring-white">
            <ArrowLeft size={16} /> Kembali
          </button>
        </div>

        {/* MAPEL TABS */}
        <div className="flex gap-2 overflow-x-auto mt-8 pb-2 custom-scrollbar">
          {data.mapels.map((m: any, i: number) => (
            <button
              key={i}
              onClick={() => setActiveMapelIdx(i)}
              className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeMapelIdx === i
                  ? 'bg-white text-indigo-700 shadow-md transform -translate-y-0.5'
                  : 'bg-white/10 text-indigo-50 border border-indigo-400/30 hover:bg-white/20'
                }`}
            >
              {m.namaMapel}
            </button>
          ))}
        </div>
      </div>

      {activeMapel && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div>
              <h2 className="text-2xl font-black text-gray-800 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Layers size={18} />
                </div>
                {activeMapel.namaMapel}
              </h2>
              <p className="text-sm font-bold text-indigo-600 mt-1 font-arabic" dir="rtl">{activeMapel.namaMapelArab}</p>
            </div>
            <div className="mt-4 sm:mt-0 px-5 py-3 bg-gradient-to-tr from-gray-50 to-white rounded-xl border border-gray-200 shadow-inner flex items-center gap-4">
              <div>
                <div className="text-[10px] font-black uppercase text-gray-400 mb-0.5 tracking-wider">Total Skor</div>
                <div className="text-xl font-black text-gray-800 leading-none">{activeMapel.totalScore} <span className="text-sm text-gray-400">/ {activeMapel.totalBobot}</span></div>
              </div>
            </div>
          </div>

          {activeMapel.groups.map((grp: any, gIdx: number) => (
            <div key={gIdx} className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="bg-gray-50 border-b border-gray-100 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="font-bold text-gray-700 uppercase tracking-widest text-xs flex items-center gap-2">
                  <ChevronRight size={16} className="text-indigo-400" />
                  Tipe: {grp.tipeSoal.replace(/_/g, ' ')}
                </h3>
                <div className="flex gap-3 text-xs font-bold font-mono">
                  <div className="px-2 py-1 bg-green-50 text-green-700 rounded-md border border-green-100">{grp.summary.benar} Benar</div>
                  <div className="px-2 py-1 bg-red-50 text-red-700 rounded-md border border-red-100">{grp.summary.salah} Salah</div>
                </div>
              </div>

              <div className="divide-y divide-gray-100">
                {grp.soalList.map((soal: any, sIdx: number) => (
                  <div key={sIdx} className="p-6 transition-colors hover:bg-gray-50/50">
                    <div className="flex gap-4">
                      <div className="shrink-0 w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm shadow-sm">
                        {soal.nomor}
                      </div>
                      <div className="flex-1 min-w-0">
                        {soal.isEssay ? (
                          <div className="flex items-center gap-2 mb-3">
                            <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Essay</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 mb-3">
                            {soal.isCorrect === true ? (
                              <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"><CheckCircle size={10} /> Benar</span>
                            ) : soal.isCorrect === false ? (
                              <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"><X size={10} /> Salah</span>
                            ) : (
                              <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"><Clock size={10} /> Parsial / Kosong</span>
                            )}
                            <span className="text-[10px] font-bold text-gray-400">Bobot: {soal.bobot}</span>
                          </div>
                        )}

                        {/* PERTANYAAN */}
                        {soal.gambarUrl && (
                          <div className="mb-4">
                            <img src={soal.gambarUrl} alt="Soal" className="max-w-md w-full h-auto rounded-xl border object-contain bg-white" />
                          </div>
                        )}
                        <div className="font-serif text-lg leading-relaxed text-gray-800 mb-6" dir="auto" dangerouslySetInnerHTML={{ __html: soal.pertanyaan }} />

                        {/* BOXES */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* JAWABAN SANTRI */}
                          <div className="rounded-xl border border-gray-200 overflow-hidden flex flex-col">
                            <div className="bg-gray-50 px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                              Jawaban Anda
                            </div>
                            <div className="p-4 bg-white flex-1 flex flex-col justify-center">
                              {renderJawabanSantri(soal)}
                            </div>
                          </div>

                          {/* KUNCI JAWABAN */}
                          {!soal.isEssay && (
                            <div className="rounded-xl border border-green-200 overflow-hidden flex flex-col shadow-sm shadow-green-50">
                              <div className="bg-green-50 px-3 py-2 text-[10px] font-bold text-green-700 uppercase tracking-wider border-b border-green-200">
                                Kunci Jawaban Benar
                              </div>
                              <div className="p-4 bg-white flex-1 flex flex-col justify-center">
                                {renderKunciJawaban(soal)}
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
    <Suspense fallback={<div className="flex items-center justify-center h-[50vh]">Memuat...</div>}>
      <ReviewContent />
    </Suspense>
  );
}
