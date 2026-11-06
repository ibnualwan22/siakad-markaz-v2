"use client";

import { useRef, useState } from "react";
import { TemplateStage, TemplateStageZoom } from "./TemplateStage";
import { STAGE_H_PX, STAGE_W_PX } from "@/lib/template-layout";

// Halaman cetak syahadah template (Nadi Hufadz, MC Akbarnas, Munaqosah
// Hufadz, Lajnah, OSIM). Rendering dokumennya memakai TemplateStage —
// komponen yang sama dengan preview editor — dengan geometri mm
// (panggung 330 x 215 mm, posisi mm, font mm), sehingga yang diatur di
// editor = yang tercetak, seperti syahadah offline.
export default function CetakTemplateClient({
  programKey,
  data,
  showPngButton,
  bulkMode,
}: {
  programKey: string;
  // bulkMode: dipakai halaman cetak bulk (banyak panggung satu dokumen).
  // @page tidak dirender dari sini supaya tidak menimpa @page dokumen
  // bulk; aturan @media print untuk panggung tetap dirender.
  bulkMode?: boolean;
  data: {
    nama: string;
    juz?: string;
    predikat?: string;
    periode: string;
    tglCetak?: string;
    // Syahadah MC Akbarnas bulan 1.
    pembuka?: string;
    penghargaan?: string;
    tahunAjaran?: string;
    tanggalPemberian?: string;
    tauqi?: string;
    namaMudir?: string;
    signatureUrl?: string | null;
    // Syahadah Munaqosah Hufadz.
    kalimatJuz?: string;
    periodeLine?: string;
    tanggalPeriodeLine?: string;
    doa?: string;
    tanggalCetak?: string;
    qrLabel?: string;
    qrUrl?: string | null;
    tabelNilai?: {
      rows: { arab: string; nilai: number }[];
      rataRata: number;
      predikat: string;
    } | null;
    template: { backgroundUrl: string | null; fieldPositions: Record<string, any> };
  };
  showPngButton?: boolean;
}) {
  const pngRef = useRef<HTMLDivElement>(null);
  const [pngDownloading, setPngDownloading] = useState(false);
  const [pngError, setPngError] = useState("");

  // Unduh syahadah sebagai PNG: render salinan panggung di luar layar
  // (ukuran penuh 330mm = 1247px, tanpa zoom) lalu tangkap html2canvas.
  // Teks Arab dirender mesin browser sehingga shaping-nya benar.
  const downloadPng = async () => {
    const el = pngRef.current;
    if (!el) return;
    setPngDownloading(true);
    setPngError("");
    try {
      // Tunggu webfont (mis. Poppins) termuat agar PNG memakai font yang benar.
      try { await (document as any).fonts?.ready; } catch { /* abaikan */ }
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        width: Math.round(STAGE_W_PX),
        height: STAGE_H_PX,
      });
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
      if (!blob) throw new Error("gagal membuat PNG");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `syahadah-${programKey}-${data.nama.replace(/\s+/g, "-")}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      setPngError("Gagal mengunduh PNG (kemungkinan gambar template tidak mengizinkan CORS). Silakan pakai tombol Cetak / PDF.");
    } finally {
      setPngDownloading(false);
    }
  };

  const fieldText: Record<string, string> = {
    nama: data.nama,
    juz: data.juz ?? "",
    predikat: data.predikat ?? "",
    periode: data.periode,
    tglCetak: data.tglCetak ?? "",
    pembuka: data.pembuka ?? "",
    penghargaan: data.penghargaan ?? "",
    tahunAjaran: data.tahunAjaran ?? "",
    tanggalPemberian: data.tanggalPemberian ?? "",
    tauqi: data.tauqi ?? "",
    namaMudir: data.namaMudir ?? "",
    kalimatJuz: data.kalimatJuz ?? "",
    periodeLine: data.periodeLine ?? "",
    tanggalPeriodeLine: data.tanggalPeriodeLine ?? "",
    doa: data.doa ?? "",
    tanggalCetak: data.tanggalCetak ?? "",
    qrLabel: data.qrLabel ?? "",
  };

  const stageProps = {
    programKey,
    backgroundUrl: data.template.backgroundUrl,
    fieldPositions: data.template.fieldPositions || {},
    texts: fieldText,
    signatureUrl: data.signatureUrl,
    qrUrl: data.qrUrl,
    tabelNilai: data.tabelNilai ?? null,
  };

  // Kertas cetak: SEMUA program template memakai 330 x 215 mm landscape —
  // sama seperti syahadah offline — supaya preview sebangun dengan print.
  // @page WAJIB di level atas (bukan bersarang di @media) — bila bersarang,
  // Chrome mengabaikan ukuran/orientasinya dan jatuh ke default printer
  // (Letter portrait, 2 lembar).

  return (
    <div className={bulkMode ? "cetak-root print:bg-white" : "cetak-root min-h-screen bg-slate-200 print:bg-white"}>
      <style>{`
        ${bulkMode ? "" : `@page { size: 330mm 215mm; margin: 0; }`}
        @media print {
          .no-print { display: none !important; }
          .cetak-root { min-height: 0 !important; }
          .template-stage-zoom-inner { transform: none !important; margin-bottom: 0 !important; }
        }
      `}</style>
      {/* Poppins untuk field syahadah organisasi. Font lain (mis. "The Season")
          dirujuk lewat nama family yang diatur di layout — tampil bila font
          tersebut tersedia di browser (terinstal / webfont yang dipasang). */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet" />

      {!bulkMode && (
      <div className="no-print sticky top-0 z-10 bg-white/90 backdrop-blur border-b px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-bold">Cetak Syahadah — {programKey}</h1>
          <p className="text-sm text-slate-500">{data.nama}</p>
          {pngError && <p className="text-sm text-red-600 mt-1">{pngError}</p>}
        </div>
        <div className="flex gap-2 shrink-0">
          {showPngButton && (
            <button
              onClick={downloadPng}
              disabled={pngDownloading}
              className="px-5 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50"
            >
              {pngDownloading ? "Menyiapkan PNG..." : "Unduh PNG"}
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="px-5 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
          >
            Cetak / PDF
          </button>
        </div>
      </div>
      )}

      <div className="mx-auto max-w-6xl p-4 print:p-0 print:max-w-none">
        <TemplateStageZoom>
          <TemplateStage {...stageProps} className="shadow-lg print:shadow-none" />
        </TemplateStageZoom>
      </div>

      {/* Salinan panggung ukuran penuh di luar layar, khusus tangkapan PNG. */}
      {showPngButton && (
        <div
          ref={pngRef}
          aria-hidden
          className="relative overflow-hidden bg-white"
          style={{ position: "fixed", left: -10000, top: 0, width: "330mm", height: "215mm" }}
        >
          <TemplateStage {...stageProps} />
        </div>
      )}
    </div>
  );
}
