"use client";

import React from "react";
import { CheckCircle, X } from "lucide-react";
import SoalText from "@/components/soal-text";
import { normalizeAnswerText } from "@/lib/arabic-utils";

const OPTION_TYPES = [
  "PG",
  "PG_MULTI",
  "BENAR_SALAH",
  "MUFRODAT",
  "ISIAN_SAMPING",
  "ISIAN_BAWAH",
];

function getMenjodohkanPairs(dataTambahan: any): Array<{ left: string; right: string }> {
  if (!dataTambahan) return [];
  if (Array.isArray(dataTambahan.pairs)) {
    return dataTambahan.pairs.map((p: any) => ({
      left: String(p?.left ?? ""),
      right: String(p?.right ?? ""),
    }));
  }
  if (Array.isArray(dataTambahan.lefts) && Array.isArray(dataTambahan.rights)) {
    return dataTambahan.lefts.map((left: any, i: number) => ({
      left: String(left ?? ""),
      right: String(dataTambahan.rights[i] ?? ""),
    }));
  }
  return [];
}

function getJaringItems(dataTambahan: any): { lefts: string[]; rights: string[] } {
  const lefts = Array.isArray(dataTambahan?.leftItems)
    ? dataTambahan.leftItems
    : Array.isArray(dataTambahan?.lefts)
      ? dataTambahan.lefts
      : [];
  const rights = Array.isArray(dataTambahan?.rightItems)
    ? dataTambahan.rightItems
    : Array.isArray(dataTambahan?.rights)
      ? dataTambahan.rights
      : [];
  return { lefts, rights };
}

function getBlankStudentAnswer(answers: Record<string, string> | undefined, blank: any, idx: number): string {
  if (!answers) return "";
  const rawIdx = blank?.index;
  const candidates = [
    rawIdx !== undefined ? String(rawIdx) : null,
    rawIdx !== undefined ? String(Number(rawIdx) + 1) : null,
    String(idx + 1),
    String(idx),
  ].filter(Boolean) as string[];
  for (const key of candidates) {
    if (answers[key] !== undefined && answers[key] !== null) {
      return String(answers[key]).trim();
    }
  }
  return "";
}

function getBlankLabelNumber(blanks: any[], blank: any, idx: number): number {
  const hasZero = blanks.some((b: any) => Number(b?.index) === 0);
  if (blank?.index !== undefined && blank?.index !== null && !Number.isNaN(Number(blank.index))) {
    return hasZero ? Number(blank.index) + 1 : Number(blank.index);
  }
  return idx + 1;
}

/**
 * Menampilkan isi soal secara penuh & terbaca di semua ukuran layar:
 * - Bacaan Qiro'ah induk (bila soal anak grup)
 * - Gambar soal (bila ada)
 * - Teks pertanyaan penuh (dengan arah teks otomatis Arab/Latin)
 * - Semua opsi jawaban / konteks soal (opsi PG/BS/Mufrodat/Isian, paragraf rumpang,
 *   bank kata, huruf acak, daftar segmen/kategori) agar pengajar tahu persis apa
 *   yang dilihat santri.
 */
export function ReviewSoalDetail({
  soal,
  showKunciOnOptions = true,
}: {
  soal: any;
  showKunciOnOptions?: boolean;
}) {
  const dt = soal.dataTambahan;
  const opsiList: any[] = Array.isArray(soal.opsiList) ? soal.opsiList : [];

  return (
    <div className="space-y-3 min-w-0">
      {/* Bacaan Qiro'ah Induk bila ada */}
      {soal.grupInduk && (
        <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-3 sm:p-4">
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-purple-700">
            Bacaan Qiro&apos;ah
          </div>
          {soal.grupInduk.gambarUrl && (
            <div className="mb-3 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={soal.grupInduk.gambarUrl}
                alt="Gambar bacaan"
                className="max-w-full max-h-[240px] rounded-lg border border-purple-200 object-contain bg-white"
              />
            </div>
          )}
          <SoalText
            html={soal.grupInduk.pertanyaan}
            className="text-sm sm:text-base text-gray-800 leading-relaxed prose prose-sm max-w-none break-words"
          />
        </div>
      )}

      {/* Perintah bagian soal (ringkas) */}
      {soal.perintah && (
        <div className="rounded-lg border-l-4 border-blue-400 bg-blue-50/60 px-3 py-2 text-xs text-blue-900">
          <SoalText
            html={soal.perintah}
            className="prose prose-xs max-w-none break-words"
          />
        </div>
      )}

      {/* Gambar soal */}
      {soal.gambarUrl && (
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={soal.gambarUrl}
            alt="Gambar soal"
            className="max-w-full max-h-[260px] rounded-xl border border-gray-200 object-contain bg-white"
          />
        </div>
      )}

      {/* Teks pertanyaan penuh */}
      <SoalText
        html={soal.pertanyaan || ""}
        className="text-sm sm:text-base text-gray-800 leading-relaxed prose prose-sm max-w-none break-words"
      />

      {/* Opsi Jawaban untuk PG / PG_MULTI / BENAR_SALAH / MUFRODAT / ISIAN_SAMPING / ISIAN_BAWAH */}
      {OPTION_TYPES.includes(soal.tipeSoal) && opsiList.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Opsi Jawaban ({opsiList.length})
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {opsiList.map((o: any, idx: number) => {
              const isKunci = showKunciOnOptions && Boolean(o.isCorrect);
              return (
                <div
                  key={o.id || idx}
                  className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-xs sm:text-sm min-w-0 ${
                    isKunci
                      ? "border-green-300 bg-green-50 text-green-900 font-semibold"
                      : "border-gray-200 bg-white text-gray-700"
                  }`}
                >
                  <span
                    className={`shrink-0 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      isKunci
                        ? "bg-green-600 text-white"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <div className="flex-1 min-w-0 break-words">
                    <SoalText html={o.teks || ""} className="break-words" />
                    {o.gambarUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={o.gambarUrl}
                        alt={`Opsi ${String.fromCharCode(65 + idx)}`}
                        className="mt-1.5 max-h-24 max-w-full rounded border border-gray-200 object-contain bg-white"
                      />
                    )}
                  </div>
                  {isKunci && (
                    <span className="shrink-0 inline-flex items-center gap-0.5 rounded bg-green-600/15 px-1.5 py-0.5 text-[10px] font-bold text-green-700">
                      <CheckCircle size={11} /> Kunci
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Paragraf & Bank Kata untuk PARAGRAF_RUMPANG / DRAG_TO_BLANK */}
      {(soal.tipeSoal === "PARAGRAF_RUMPANG" || soal.tipeSoal === "DRAG_TO_BLANK") &&
        dt?.paragraf && (
          <div className="rounded-xl border border-cyan-200 bg-cyan-50/40 p-3 space-y-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-800">
              Teks Paragraf
            </div>
            <div
              className="text-sm sm:text-base leading-loose text-gray-800 whitespace-pre-wrap break-words font-serif"
              dir="auto"
            >
              {String(dt.paragraf)
                .split(/(\{\{\d+\}\})/g)
                .map((part, i) => {
                  const m = part.match(/\{\{(\d+)\}\}/);
                  if (m) {
                    return (
                      <span
                        key={i}
                        className="mx-1 inline-block rounded bg-cyan-100 border border-cyan-300 px-2 py-0.5 font-sans text-xs font-bold text-cyan-900"
                      >
                        [{m[1]}]
                      </span>
                    );
                  }
                  return <React.Fragment key={i}>{part}</React.Fragment>;
                })}
            </div>
            {Array.isArray(dt.wordBank) && dt.wordBank.length > 0 && (
              <div className="pt-2 border-t border-cyan-200/70">
                <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-700 mb-1.5">
                  Bank Kata
                </div>
                <div className="flex flex-wrap gap-1.5" dir="auto">
                  {dt.wordBank.map((w: string, i: number) => (
                    <span
                      key={i}
                      className="rounded-lg border border-cyan-200 bg-white px-2.5 py-1 text-xs font-bold text-cyan-900"
                    >
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      {/* Huruf / Kata acak untuk SUSUN_HURUF & KITABAH */}
      {soal.tipeSoal === "SUSUN_HURUF" && Array.isArray(dt?.hurufAcak) && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 mb-1.5">
            Potongan Kata / Huruf Acak
          </div>
          <div className="flex flex-wrap gap-1.5" dir="rtl">
            {dt.hurufAcak.map((h: string, i: number) => (
              <span
                key={i}
                className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-sm font-bold text-indigo-900"
              >
                {h}
              </span>
            ))}
          </div>
        </div>
      )}

      {soal.tipeSoal === "KITABAH" && Array.isArray(dt?.huruf) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800 mb-1.5">
            Huruf Disediakan
          </div>
          <div className="flex flex-wrap gap-1.5" dir="rtl">
            {dt.huruf.map((h: string, i: number) => (
              <span
                key={i}
                className="rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-base font-bold text-amber-900"
              >
                {h}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Kategori & Item untuk DRAG_KATEGORI */}
      {soal.tipeSoal === "DRAG_KATEGORI" && Array.isArray(dt?.categories) && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700 mb-1.5">
            Pilihan Kategori
          </div>
          <div className="flex flex-wrap gap-1.5" dir="auto">
            {dt.categories.map((c: string, i: number) => (
              <span
                key={i}
                className="rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-xs font-bold text-blue-800"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Kalimat lengkap untuk IDENTIFIKASI_KESALAHAN */}
      {soal.tipeSoal === "IDENTIFIKASI_KESALAHAN" &&
        (Array.isArray(dt?.segments) || Array.isArray(dt?.words)) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800 mb-1.5">
              Segmen Kalimat
            </div>
            <div className="flex flex-wrap gap-1.5" dir="auto">
              {(dt.segments || dt.words).map((seg: any, i: number) => {
                const text = typeof seg === "string" ? seg : seg?.text;
                return (
                  <span
                    key={i}
                    className="rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-sm font-serif text-gray-800"
                  >
                    {text}
                  </span>
                );
              })}
            </div>
          </div>
        )}
    </div>
  );
}

/**
 * Tabel Matrix (TABEL_TASRIF) dengan arah RTL (kanan -> kiri) persis seperti
 * tampilan yang dikerjakan santri, lengkap dengan header kolom & label baris.
 */
function ReviewTabelTasrif({
  dataTambahan,
  studentCells,
  mode,
}: {
  dataTambahan: any;
  studentCells?: Record<string, string>;
  mode: "kunci" | "santri";
}) {
  const headers: string[] = Array.isArray(dataTambahan?.headers)
    ? dataTambahan.headers
    : [];
  const rows: any[] = Array.isArray(dataTambahan?.rows)
    ? dataTambahan.rows
    : [];
  const hasRowLabels = rows.some((r) => r?.label !== undefined && r?.label !== "");

  if (rows.length === 0) {
    return <span className="text-xs text-gray-400 italic">Data tabel kosong</span>;
  }

  return (
    <div className="w-full max-w-full overflow-x-auto rounded-lg border border-amber-200 bg-white">
      <table
        dir="rtl"
        className="w-max min-w-full border-collapse text-center text-xs sm:text-sm"
      >
        {headers.length > 0 && (
          <thead className="bg-amber-100/80 text-amber-950 border-b border-amber-200">
            <tr>
              {hasRowLabels && (
                <th className="sticky right-0 z-10 bg-amber-100 px-2.5 py-1.5 font-bold border-l border-amber-200 whitespace-nowrap" />
              )}
              {headers.map((h, i) => (
                <th
                  key={i}
                  className="px-2.5 py-1.5 font-bold border-r border-amber-200/70 whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row: any, rIdx: number) => (
            <tr
              key={rIdx}
              className="border-b border-amber-100 last:border-none"
            >
              {hasRowLabels && (
                <td className="sticky right-0 z-10 bg-amber-50 px-2.5 py-1.5 font-bold text-amber-900 border-l border-amber-200 whitespace-nowrap shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">
                  {row.label}
                </td>
              )}
              {(row.cells || []).map((cell: any, cIdx: number) => {
                if (mode === "kunci") {
                  return (
                    <td
                      key={cIdx}
                      className={`px-2.5 py-1.5 border-r border-amber-100 whitespace-nowrap ${
                        cell.isBlank
                          ? "bg-green-50 font-bold text-green-800"
                          : "bg-white text-gray-600"
                      }`}
                    >
                      {cell.isBlank ? `✎ ${cell.value}` : cell.value}
                    </td>
                  );
                }

                if (!cell.isBlank) {
                  return (
                    <td
                      key={cIdx}
                      className="px-2.5 py-1.5 border-r border-amber-100 bg-gray-50/70 text-gray-600 whitespace-nowrap"
                    >
                      {String(cell.value || "").split("|")[0].trim()}
                    </td>
                  );
                }

                const key = `${rIdx}-${cIdx}`;
                const rawStudentAns = studentCells?.[key] || "";
                const studentAns = normalizeAnswerText(rawStudentAns);
                const possibleAnswers = String(cell.value || "")
                  .split("|")
                  .map((k: string) => normalizeAnswerText(k));
                const isCorrect =
                  studentAns !== "" && possibleAnswers.includes(studentAns);

                return (
                  <td
                    key={cIdx}
                    className={`px-2.5 py-1.5 border-r border-amber-100 font-bold whitespace-nowrap ${
                      isCorrect
                        ? "bg-green-50 text-green-800"
                        : "bg-rose-50 text-rose-800"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      <span>
                        {rawStudentAns || (
                          <span className="text-gray-300 italic">—</span>
                        )}
                      </span>
                      {rawStudentAns &&
                        (isCorrect ? (
                          <CheckCircle size={12} className="text-green-600 shrink-0" />
                        ) : (
                          <X size={12} className="text-rose-600 shrink-0" />
                        ))}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {mode === "kunci" && (
        <div className="px-2.5 py-1 text-[10px] text-gray-500 bg-amber-50/40 border-t border-amber-100">
          Arah kanan → kiri (RTL). Sel bertanda ✎ adalah kolom isian santri beserta kunci benarnya.
        </div>
      )}
    </div>
  );
}

/** Render kunci jawaban untuk semua 14+ tipe soal secara rapi & responsif. */
export function ReviewKunciJawaban({ soal }: { soal: any }) {
  const dt = soal.dataTambahan;

  // PG / Benar Salah / Mufrodat / Isian dengan opsi
  if (["PG", "BENAR_SALAH", "MUFRODAT", "ISIAN_SAMPING", "ISIAN_BAWAH"].includes(soal.tipeSoal)) {
    const opsiBenar = soal.opsiList?.filter((o: any) => o.isCorrect) || [];
    if (opsiBenar.length > 0) {
      return (
        <div className="space-y-1.5">
          {opsiBenar.map((o: any) => (
            <div
              key={o.id}
              className="text-sm font-medium text-green-900 bg-green-50 px-3 py-2 rounded-lg border border-green-200 break-words"
              dir="auto"
            >
              <SoalText html={o.teks || ""} className="break-words" />
            </div>
          ))}
        </div>
      );
    }
    if (soal.kunciJawaban) {
      return (
        <div
          className="text-sm font-medium text-green-900 bg-green-50 px-3 py-2 rounded-lg border border-green-200 whitespace-pre-wrap break-words"
          dir="auto"
        >
          {soal.kunciJawaban}
        </div>
      );
    }
    return <div className="text-xs text-gray-400 italic">Tidak ditandai kunci</div>;
  }

  // PG Multi
  if (soal.tipeSoal === "PG_MULTI") {
    const opsiBenar = soal.opsiList?.filter((o: any) => o.isCorrect) || [];
    if (opsiBenar.length > 0) {
      return (
        <div className="flex flex-wrap gap-1.5" dir="auto">
          {opsiBenar.map((o: any) => (
            <span
              key={o.id}
              className="text-xs sm:text-sm font-medium text-green-900 bg-green-50 px-2.5 py-1 rounded-lg border border-green-200 break-words"
            >
              <SoalText html={o.teks || ""} className="inline break-words" />
            </span>
          ))}
        </div>
      );
    }
    return <div className="text-xs text-gray-400 italic">Tidak ditandai kunci</div>;
  }

  // TABEL TASRIF (RTL kanan -> kiri)
  if (soal.tipeSoal === "TABEL_TASRIF" && dt?.rows) {
    return <ReviewTabelTasrif dataTambahan={dt} mode="kunci" />;
  }

  // MENJODOHKAN (dukung format pairs maupun lefts/rights)
  if (soal.tipeSoal === "MENJODOHKAN") {
    const pairs = getMenjodohkanPairs(dt);
    if (pairs.length > 0) {
      return (
        <div className="space-y-1.5">
          {pairs.map((p, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm bg-green-50/70 border border-green-200 rounded-lg px-2.5 py-1.5"
            >
              <span className="font-semibold text-green-900 break-words" dir="auto">
                <SoalText html={p.left} className="inline break-words" />
              </span>
              <span className="text-green-600 font-bold">→</span>
              <span className="font-semibold text-green-900 break-words" dir="auto">
                <SoalText html={p.right} className="inline break-words" />
              </span>
            </div>
          ))}
        </div>
      );
    }
  }

  // MENGURUTKAN
  if (soal.tipeSoal === "MENGURUTKAN" && Array.isArray(dt?.items)) {
    return (
      <div className="flex flex-wrap gap-1.5" dir="auto">
        {dt.items.map((item: any, i: number) => (
          <span
            key={i}
            className="text-xs sm:text-sm font-medium text-green-900 bg-green-50 px-2.5 py-1 rounded-lg border border-green-200 break-words"
          >
            {i + 1}. <SoalText html={String(item || "")} className="inline break-words" />
          </span>
        ))}
      </div>
    );
  }

  // DRAG KATEGORI
  if (soal.tipeSoal === "DRAG_KATEGORI" && Array.isArray(dt?.items)) {
    const grouped: Record<string, string[]> = {};
    dt.items.forEach((d: any) => {
      const cat = d.category || "Lainnya";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(d.text);
    });
    return (
      <div className="space-y-1.5">
        {Object.entries(grouped).map(([cat, items]) => (
          <div
            key={cat}
            className="text-xs sm:text-sm bg-green-50/70 border border-green-200 rounded-lg px-2.5 py-1.5 break-words"
            dir="auto"
          >
            <span className="font-bold text-green-800">{cat}:</span>{" "}
            <span className="text-green-900">{items.join(" ، ")}</span>
          </div>
        ))}
      </div>
    );
  }

  // DRAG TO BLANK / PARAGRAF RUMPANG
  if (soal.tipeSoal === "DRAG_TO_BLANK" || soal.tipeSoal === "PARAGRAF_RUMPANG") {
    if (Array.isArray(dt?.blanks) && dt.blanks.length > 0) {
      return (
        <div className="flex flex-wrap gap-1.5" dir="auto">
          {dt.blanks.map((b: any, i: number) => (
            <span
              key={i}
              className="text-xs sm:text-sm font-medium text-green-900 bg-green-50 px-2.5 py-1 rounded-lg border border-green-200 break-words"
            >
              Isian {getBlankLabelNumber(dt.blanks, b, i)}: {b.jawaban}
            </span>
          ))}
        </div>
      );
    }
    if (soal.kunciJawaban) {
      const parts = String(soal.kunciJawaban).split("|");
      return (
        <div className="flex flex-wrap gap-1.5" dir="auto">
          {parts.map((ans, i) => (
            <span
              key={i}
              className="text-xs sm:text-sm font-medium text-green-900 bg-green-50 px-2.5 py-1 rounded-lg border border-green-200 break-words"
            >
              Isian {i + 1}: {ans.trim()}
            </span>
          ))}
        </div>
      );
    }
  }

  // STABILO SYNTAX (RTL untuk kalimat Arab)
  if (soal.tipeSoal === "STABILO_SYNTAX" && Array.isArray(dt?.words) && dt?.answers) {
    return (
      <div className="flex flex-wrap gap-2 text-xs sm:text-sm" dir="rtl">
        {dt.words.map((w: any, i: number) => {
          const wordStr = typeof w === "string" ? w : w.text;
          const cat = dt.answers[String(i)];
          if (!cat) {
            return (
              <span key={i} className="text-gray-600 self-center">
                {wordStr}
              </span>
            );
          }
          return (
            <span
              key={i}
              className="inline-flex flex-col items-center rounded-lg border border-green-200 bg-green-50/70 px-2 py-1"
            >
              <span className="font-bold text-gray-900">{wordStr}</span>
              <span className="bg-green-200/80 text-green-900 px-1.5 py-0.5 rounded text-[10px] font-bold mt-0.5">
                {cat}
              </span>
            </span>
          );
        })}
      </div>
    );
  }

  // JARING RELASI (dukung leftItems/rightItems maupun lefts/rights)
  if (soal.tipeSoal === "JARING_RELASI" && Array.isArray(dt?.connections)) {
    const { lefts, rights } = getJaringItems(dt);
    return (
      <div className="space-y-1.5">
        {dt.connections.map((c: any, i: number) => (
          <div
            key={i}
            className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm bg-green-50/60 border border-green-200 rounded-lg px-2.5 py-1.5"
          >
            <span className="bg-white border border-green-200 text-green-900 px-2 py-0.5 rounded font-semibold break-words" dir="auto">
              {lefts[c.left] || `Kiri ${c.left + 1}`}
            </span>
            <span className="text-green-600 font-bold">→</span>
            {(c.right || []).map((r: number) => (
              <span
                key={r}
                className="bg-green-100 text-green-900 px-2 py-0.5 rounded font-semibold break-words"
                dir="auto"
              >
                {rights[r] || `Kanan ${r + 1}`}
              </span>
            ))}
          </div>
        ))}
      </div>
    );
  }

  // IDENTIFIKASI KESALAHAN
  if (soal.tipeSoal === "IDENTIFIKASI_KESALAHAN") {
    if (Array.isArray(dt?.segments)) {
      const errorSegs = dt.segments.filter((s: any) => s.isError);
      if (errorSegs.length > 0) {
        return (
          <div className="flex flex-wrap gap-1.5" dir="auto">
            {errorSegs.map((s: any, i: number) => (
              <span
                key={i}
                className="text-xs sm:text-sm font-bold text-green-900 bg-green-50 px-2.5 py-1 rounded-lg border border-green-200"
              >
                {s.text}
              </span>
            ))}
          </div>
        );
      }
    }
    if (dt?.correctIndex !== undefined && Array.isArray(dt?.words)) {
      return (
        <div
          className="text-sm font-medium text-green-900 bg-green-50 px-3 py-2 rounded-lg border border-green-200 break-words"
          dir="auto"
        >
          Kata salah: <strong>{dt.words[dt.correctIndex]}</strong>
          {soal.kunciJawaban ? ` — ${soal.kunciJawaban}` : ""}
        </div>
      );
    }
  }

  // SUSUN HURUF
  if (soal.tipeSoal === "SUSUN_HURUF") {
    const target =
      soal.kunciJawaban ||
      dt?.jawaban ||
      (Array.isArray(dt?.hurufAcak) ? dt.hurufAcak.join(" ") : "");
    if (target) {
      return (
        <div
          className="text-sm sm:text-base font-bold text-green-900 bg-green-50 px-3 py-2 rounded-lg border border-green-200 break-words"
          dir="auto"
        >
          {target}
        </div>
      );
    }
  }

  // KITABAH
  if (soal.tipeSoal === "KITABAH") {
    const target =
      soal.kunciJawaban ||
      dt?.jawaban ||
      (Array.isArray(dt?.huruf) ? dt.huruf.join("") : "");
    if (target) {
      return (
        <div
          className="text-sm sm:text-base font-bold text-green-900 bg-green-50 px-3 py-2 rounded-lg border border-green-200 break-words"
          dir="auto"
        >
          {target}
        </div>
      );
    }
  }

  // Essay / Isian / fallback kunciJawaban
  if (soal.kunciJawaban) {
    return (
      <div
        className="text-sm font-medium text-green-900 bg-green-50 px-3 py-2 rounded-lg border border-green-200 whitespace-pre-wrap break-words"
        dir="auto"
      >
        {soal.kunciJawaban}
      </div>
    );
  }

  return (
    <div className="text-xs text-gray-400 italic">Tidak ada referensi kunci</div>
  );
}

/** Render jawaban santri untuk semua 14+ tipe soal secara rapi & responsif. */
export function ReviewJawabanSantri({
  jaw,
  soal,
}: {
  jaw: any;
  soal: any;
}) {
  if (!jaw || (!jaw.id && !jaw.opsiId && !jaw.jawabanTeks && !jaw.jawabanData)) {
    return <span className="text-gray-400 italic text-xs sm:text-sm">Tidak menjawab</span>;
  }

  const dt = soal.dataTambahan;

  // PG / Benar Salah / Mufrodat / Isian
  if (
    ["PG", "BENAR_SALAH", "MUFRODAT", "ISIAN_SAMPING", "ISIAN_BAWAH"].includes(
      soal.tipeSoal,
    )
  ) {
    const selected = soal.opsiList?.find((o: any) => o.id === jaw.opsiId);
    const isCorrect = selected
      ? Boolean(selected.isCorrect)
      : Boolean(
          jaw.jawabanTeks &&
            soal.kunciJawaban &&
            normalizeAnswerText(jaw.jawabanTeks) ===
              normalizeAnswerText(soal.kunciJawaban),
        );
    const displayHtml = selected?.teks || jaw.jawabanTeks || "";
    if (!displayHtml) {
      return <span className="text-gray-400 italic text-xs sm:text-sm">Tidak menjawab</span>;
    }
    return (
      <div
        className={`text-sm font-medium px-3 py-2 rounded-lg border break-words ${
          isCorrect
            ? "text-green-900 bg-green-50/70 border-green-200"
            : "text-rose-900 bg-rose-50/70 border-rose-200"
        }`}
        dir="auto"
      >
        <SoalText html={displayHtml} className="break-words" />
        {selected?.gambarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={selected.gambarUrl}
            alt="Pilihan santri"
            className="mt-2 max-h-24 max-w-full rounded border border-gray-200 object-contain bg-white"
          />
        )}
      </div>
    );
  }

  // Essay types
  if (soal.tipeSoal.startsWith("ESSAY")) {
    if (!jaw.jawabanTeks) {
      return <span className="text-gray-400 italic text-xs sm:text-sm">Tidak menjawab</span>;
    }
    return (
      <div
        className="text-sm font-medium text-blue-950 bg-blue-50/60 px-3 py-2 rounded-lg border border-blue-200 whitespace-pre-wrap break-words leading-relaxed"
        dir="auto"
      >
        {jaw.jawabanTeks}
      </div>
    );
  }

  // TABEL TASRIF (RTL kanan -> kiri)
  if (soal.tipeSoal === "TABEL_TASRIF" && dt?.rows) {
    return (
      <ReviewTabelTasrif
        dataTambahan={dt}
        studentCells={jaw.jawabanData?.cells || {}}
        mode="santri"
      />
    );
  }

  // MENJODOHKAN (dukung pairs maupun lefts/rights)
  if (soal.tipeSoal === "MENJODOHKAN" && Array.isArray(jaw.jawabanData?.pairs)) {
    const keyPairs = getMenjodohkanPairs(dt);
    return (
      <div className="space-y-1.5">
        {jaw.jawabanData.pairs.map((jp: any, i: number) => {
          const matchedKey = keyPairs.find((kp) => kp.left === jp.left);
          const isCorrect = matchedKey ? matchedKey.right === jp.right : false;
          return (
            <div
              key={i}
              className={`flex flex-wrap items-center gap-1.5 text-xs sm:text-sm px-2.5 py-1.5 rounded-lg border ${
                isCorrect
                  ? "bg-green-50 border-green-200 text-green-900"
                  : "bg-rose-50 border-rose-200 text-rose-900"
              }`}
            >
              <span className="font-medium break-words" dir="auto">
                <SoalText html={String(jp.left || "")} className="inline break-words" />
              </span>
              <span className="text-gray-400">→</span>
              <span className="font-medium break-words" dir="auto">
                <SoalText html={String(jp.right || "")} className="inline break-words" />
              </span>
              {isCorrect ? (
                <CheckCircle size={13} className="text-green-600 ml-auto shrink-0" />
              ) : (
                <X size={13} className="text-rose-600 ml-auto shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // SUSUN HURUF
  if (
    soal.tipeSoal === "SUSUN_HURUF" &&
    Array.isArray(jaw.jawabanData?.susunanIndices) &&
    Array.isArray(dt?.hurufAcak)
  ) {
    const studentAnsText = jaw.jawabanData.susunanIndices
      .map((i: number) => dt.hurufAcak[i] ?? "")
      .join(" ");
    const targetRaw =
      soal.kunciJawaban || dt.jawaban || dt.hurufAcak.join("");
    const isCorrect =
      normalizeAnswerText(studentAnsText).replace(/\s+/g, "") ===
      normalizeAnswerText(targetRaw).replace(/\s+/g, "");
    return (
      <div
        className={`text-sm font-medium px-3 py-2 rounded-lg border flex justify-between items-center gap-2 break-words ${
          isCorrect
            ? "text-green-900 bg-green-50/70 border-green-200"
            : "text-rose-900 bg-rose-50/70 border-rose-200"
        }`}
        dir="auto"
      >
        <span className="break-words">{studentAnsText || "-"}</span>
        {isCorrect ? (
          <CheckCircle size={14} className="text-green-600 shrink-0" />
        ) : (
          <X size={14} className="text-rose-600 shrink-0" />
        )}
      </div>
    );
  }

  // KITABAH
  if (soal.tipeSoal === "KITABAH" && jaw.jawabanTeks) {
    const target =
      soal.kunciJawaban ||
      dt?.jawaban ||
      (Array.isArray(dt?.huruf) ? dt.huruf.join("") : "");
    const isCorrect =
      target !== "" &&
      normalizeAnswerText(jaw.jawabanTeks).replace(/\s+/g, "") ===
        normalizeAnswerText(target).replace(/\s+/g, "");
    return (
      <div
        className={`text-sm sm:text-base font-bold px-3 py-2 rounded-lg border flex justify-between items-center gap-2 break-words ${
          isCorrect
            ? "text-green-900 bg-green-50/70 border-green-200"
            : "text-rose-900 bg-rose-50/70 border-rose-200"
        }`}
        dir="auto"
      >
        <span>{jaw.jawabanTeks}</span>
        {isCorrect ? (
          <CheckCircle size={14} className="text-green-600 shrink-0" />
        ) : (
          <X size={14} className="text-rose-600 shrink-0" />
        )}
      </div>
    );
  }

  // DRAG TO BLANK / PARAGRAF RUMPANG
  if (
    (soal.tipeSoal === "DRAG_TO_BLANK" || soal.tipeSoal === "PARAGRAF_RUMPANG") &&
    jaw.jawabanData?.answers
  ) {
    const blanks = Array.isArray(dt?.blanks)
      ? dt.blanks
      : soal.kunciJawaban
        ? String(soal.kunciJawaban)
            .split("|")
            .map((j, idx) => ({ index: idx + 1, jawaban: j.trim() }))
        : Object.keys(jaw.jawabanData.answers).map((k) => ({
            index: Number(k),
            jawaban: "",
          }));

    return (
      <div className="flex flex-wrap gap-1.5" dir="auto">
        {blanks.map((b: any, i: number) => {
          const rawStudentAns = getBlankStudentAnswer(
            jaw.jawabanData.answers,
            b,
            i,
          );
          const studentAns = normalizeAnswerText(rawStudentAns);
          const possibleAnswers = String(b.jawaban || "")
            .split("|")
            .map((k: string) => normalizeAnswerText(k))
            .filter(Boolean);
          const isCorrect =
            studentAns !== "" && possibleAnswers.includes(studentAns);
          return (
            <span
              key={i}
              className={`text-xs sm:text-sm font-medium px-2.5 py-1 inline-flex items-center gap-1 rounded-lg border break-words ${
                isCorrect
                  ? "text-green-900 bg-green-50 border-green-200"
                  : "text-rose-900 bg-rose-50 border-rose-200"
              }`}
            >
              <span>
                Isian {getBlankLabelNumber(blanks, b, i)}:{" "}
                {rawStudentAns || (
                  <span className="text-gray-400 italic">kosong</span>
                )}
              </span>
              {isCorrect ? (
                <CheckCircle size={12} className="text-green-600 shrink-0" />
              ) : (
                <X size={12} className="text-rose-600 shrink-0" />
              )}
            </span>
          );
        })}
      </div>
    );
  }

  // DRAG KATEGORI
  if (
    soal.tipeSoal === "DRAG_KATEGORI" &&
    Array.isArray(jaw.jawabanData?.items) &&
    Array.isArray(dt?.items)
  ) {
    return (
      <div className="flex flex-wrap gap-1.5" dir="auto">
        {jaw.jawabanData.items.map((jitem: any, i: number) => {
          const found = dt.items.find((d: any) => d.text === jitem.text);
          const isCorrect = Boolean(found && found.category === jitem.category);
          return (
            <span
              key={i}
              className={`text-xs sm:text-sm font-medium px-2.5 py-1 inline-flex items-center gap-1 rounded-lg border break-words ${
                isCorrect
                  ? "text-green-900 bg-green-50 border-green-200"
                  : "text-rose-900 bg-rose-50 border-rose-200"
              }`}
            >
              <span>
                {jitem.text}{" "}
                <span className="opacity-75">({jitem.category})</span>
              </span>
              {isCorrect ? (
                <CheckCircle size={12} className="text-green-600 shrink-0" />
              ) : (
                <X size={12} className="text-rose-600 shrink-0" />
              )}
            </span>
          );
        })}
      </div>
    );
  }

  // IDENTIFIKASI KESALAHAN (dukung segments+selectedIndices & words+correctIndex)
  if (soal.tipeSoal === "IDENTIFIKASI_KESALAHAN" && jaw.jawabanData) {
    if (Array.isArray(dt?.segments)) {
      const selectedIndices: number[] = Array.isArray(
        jaw.jawabanData.selectedIndices,
      )
        ? jaw.jawabanData.selectedIndices
        : [];
      if (selectedIndices.length === 0) {
        return <span className="text-gray-400 italic text-xs sm:text-sm">Tidak memilih segmen</span>;
      }
      return (
        <div className="flex flex-wrap gap-1.5" dir="auto">
          {selectedIndices.map((sIdx) => {
            const seg = dt.segments[sIdx];
            const isCorrect = Boolean(seg?.isError);
            return (
              <span
                key={sIdx}
                className={`text-xs sm:text-sm font-medium px-2.5 py-1 inline-flex items-center gap-1 rounded-lg border ${
                  isCorrect
                    ? "text-green-900 bg-green-50 border-green-200"
                    : "text-rose-900 bg-rose-50 border-rose-200"
                }`}
              >
                <span>{seg?.text || `Kata ke-${sIdx + 1}`}</span>
                {isCorrect ? (
                  <CheckCircle size={12} className="text-green-600 shrink-0" />
                ) : (
                  <X size={12} className="text-rose-600 shrink-0" />
                )}
              </span>
            );
          })}
        </div>
      );
    }

    if (dt?.correctIndex !== undefined) {
      const sIdx =
        jaw.jawabanData.selectedIndex ??
        (Array.isArray(jaw.jawabanData.selectedIndices)
          ? jaw.jawabanData.selectedIndices[0]
          : -1);
      const isCorrect = sIdx === dt.correctIndex;
      const words = Array.isArray(dt.words) ? dt.words : [];
      return (
        <div
          className={`text-sm font-medium flex justify-between items-center gap-2 px-3 py-2 rounded-lg border ${
            isCorrect
              ? "text-green-900 bg-green-50/70 border-green-200"
              : "text-rose-900 bg-rose-50/70 border-rose-200"
          }`}
          dir="auto"
        >
          <span>Pilihan: {words[sIdx] || `Kata ke-${sIdx + 1}`}</span>
          {isCorrect ? (
            <CheckCircle size={14} className="text-green-600 shrink-0" />
          ) : (
            <X size={14} className="text-rose-600 shrink-0" />
          )}
        </div>
      );
    }
  }

  // STABILO SYNTAX (RTL untuk kalimat Arab)
  if (
    soal.tipeSoal === "STABILO_SYNTAX" &&
    jaw.jawabanData?.assignments &&
    Array.isArray(dt?.words)
  ) {
    const trueAnswers = dt.answers || {};
    return (
      <div className="flex flex-wrap gap-2 text-xs sm:text-sm" dir="rtl">
        {dt.words.map((w: any, i: number) => {
          const wordStr = typeof w === "string" ? w : w.text;
          const assignedCat =
            jaw.jawabanData.assignments[String(i)] ||
            jaw.jawabanData.assignments[i];
          const trueCat = trueAnswers[String(i)];
          if (!assignedCat) {
            return (
              <span key={i} className="text-gray-400 self-center">
                {wordStr}
              </span>
            );
          }
          const isCorrect = assignedCat === trueCat;
          return (
            <span
              key={i}
              className={`inline-flex flex-col items-center border rounded-lg px-2 py-1 ${
                isCorrect
                  ? "bg-green-50 border-green-200"
                  : "bg-rose-50 border-rose-200"
              }`}
            >
              <span className="font-bold text-gray-900">{wordStr}</span>
              <span
                className={`px-1 rounded text-[10px] mt-0.5 font-bold ${
                  isCorrect ? "text-green-700" : "text-rose-700"
                }`}
              >
                {assignedCat}
              </span>
            </span>
          );
        })}
      </div>
    );
  }

  // JARING RELASI (dukung leftItems/rightItems maupun lefts/rights)
  if (
    soal.tipeSoal === "JARING_RELASI" &&
    Array.isArray(jaw.jawabanData?.connections)
  ) {
    const { lefts, rights } = getJaringItems(dt);
    const trueGraph = new Map<number, number[]>();
    (dt?.connections || []).forEach((c: any) =>
      trueGraph.set(c.left, c.right || []),
    );

    return (
      <div className="space-y-1.5">
        {jaw.jawabanData.connections.map((c: any, i: number) => {
          const trueRights = trueGraph.get(c.left) || [];
          return (
            <div
              key={i}
              className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm px-2.5 py-1.5 border border-gray-200 rounded-lg bg-gray-50"
            >
              <span
                className="font-semibold bg-white border border-gray-200 px-2 py-0.5 rounded break-words"
                dir="auto"
              >
                {lefts[c.left] || `Kiri ${c.left + 1}`}
              </span>
              <span className="text-gray-400">→</span>
              {(c.right || []).map((r: number) => {
                const isCorrect = trueRights.includes(r);
                return (
                  <span
                    key={r}
                    className={`px-2 py-0.5 inline-flex items-center gap-1 rounded border font-semibold break-words ${
                      isCorrect
                        ? "bg-green-100 text-green-900 border-green-200"
                        : "bg-rose-100 text-rose-900 border-rose-200"
                    }`}
                    dir="auto"
                  >
                    <span>{rights[r] || `Kanan ${r + 1}`}</span>
                    {isCorrect ? (
                      <CheckCircle size={11} className="shrink-0" />
                    ) : (
                      <X size={11} className="shrink-0" />
                    )}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  // MENGURUTKAN
  if (
    soal.tipeSoal === "MENGURUTKAN" &&
    Array.isArray(jaw.jawabanData?.items) &&
    Array.isArray(dt?.items)
  ) {
    return (
      <div className="flex flex-wrap gap-1.5" dir="auto">
        {jaw.jawabanData.items.map((item: any, i: number) => {
          const isCorrect = item === dt.items[i];
          return (
            <span
              key={i}
              className={`text-xs sm:text-sm font-medium px-2.5 py-1 rounded-lg border break-words ${
                isCorrect
                  ? "text-green-900 bg-green-50 border-green-200"
                  : "text-rose-900 bg-rose-50 border-rose-200"
              }`}
            >
              {i + 1}. <SoalText html={String(item || "")} className="inline break-words" />
            </span>
          );
        })}
      </div>
    );
  }

  // PG MULTI
  if (soal.tipeSoal === "PG_MULTI" && Array.isArray(jaw.jawabanData?.selectedIds)) {
    const correctIds =
      soal.opsiList?.filter((o: any) => o.isCorrect).map((o: any) => o.id) || [];
    if (jaw.jawabanData.selectedIds.length === 0) {
      return <span className="text-gray-400 italic text-xs sm:text-sm">Tidak memilih opsi</span>;
    }
    return (
      <div className="flex flex-wrap gap-1.5" dir="auto">
        {jaw.jawabanData.selectedIds.map((selId: string, i: number) => {
          const opsi = soal.opsiList?.find((o: any) => o.id === selId);
          const isCorrect = correctIds.includes(selId);
          return (
            <span
              key={i}
              className={`text-xs sm:text-sm font-medium px-2.5 py-1 inline-flex items-center gap-1 rounded-lg border break-words ${
                isCorrect
                  ? "text-green-900 bg-green-50 border-green-200"
                  : "text-rose-900 bg-rose-50 border-rose-200"
              }`}
            >
              <SoalText html={opsi?.teks || selId} className="inline break-words" />
              {isCorrect ? (
                <CheckCircle size={12} className="text-green-600 shrink-0" />
              ) : (
                <X size={12} className="text-rose-600 shrink-0" />
              )}
            </span>
          );
        })}
      </div>
    );
  }

  // Fallback teks
  if (jaw.jawabanTeks) {
    return (
      <div
        className="text-sm font-medium text-blue-950 bg-blue-50/60 px-3 py-2 rounded-lg border border-blue-200 whitespace-pre-wrap break-words"
        dir="auto"
      >
        {jaw.jawabanTeks}
      </div>
    );
  }

  if (jaw.jawabanData) {
    return (
      <div className="text-xs text-blue-800 p-2 bg-blue-50 border border-blue-100 rounded-lg overflow-x-auto max-w-full">
        Jawaban terstruktur tersedia (lihat skor)
      </div>
    );
  }

  return <span className="text-gray-400 italic text-xs sm:text-sm">Tidak menjawab</span>;
}
