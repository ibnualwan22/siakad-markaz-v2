"use client";

import { useEffect, useRef, useState } from "react";
import AutoFitText from "./AutoFitText";

const REF_W = 1600;

type FieldCfg = {
  x: number; // persen
  y: number; // persen
  fontSize: number; // px pada skala referensi
  align?: string;
  maxWidth?: number; // persen
  fontFamily?: string; // nama font, diatur lewat web (mis. "The Season", "Poppins")
  color?: string; // warna teks, mis. "#865b34"
};

const FIELD_LABEL: Record<string, string> = {
  nama: "Nama",
  juz: "Juz",
  predikat: "Predikat",
  periode: "Periode",
  tglCetak: "Tanggal Cetak",
};

export default function CetakTemplateClient({
  programKey,
  data,
  showPngButton,
}: {
  programKey: string;
  data: {
    nama: string;
    juz?: string;
    predikat?: string;
    periode: string;
    tglCetak?: string;
    template: { backgroundUrl: string | null; fieldPositions: Record<string, FieldCfg> };
  };
  showPngButton?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const pngRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [imgRatio, setImgRatio] = useState(9 / 16);
  const [pngDownloading, setPngDownloading] = useState(false);
  const [pngError, setPngError] = useState("");

  // Unduh syahadah sebagai PNG: render salinan panggung di luar layar
  // (ukuran penuh 1600px, tanpa transform skala) lalu tangkap html2canvas.
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
        width: REF_W,
        height: stageH,
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

  const bg = data.template.backgroundUrl;
  const fields = data.template.fieldPositions || {};

  useEffect(() => {
    if (!bg) return;
    const img = new Image();
    img.onload = () => setImgRatio(img.naturalHeight / img.naturalWidth);
    img.src = bg;
  }, [bg]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setScale(el.clientWidth / REF_W);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const stageH = Math.round(REF_W * imgRatio);

  const fieldText: Record<string, string> = {
    nama: data.nama,
    juz: data.juz ?? "",
    predikat: data.predikat ?? "",
    periode: data.periode,
    tglCetak: data.tglCetak ?? "",
  };

  // Nadi memakai teks Arab (rtl); syahadah organisasi memakai teks Latin (ltr).
  const fieldDirection = programKey === "nadi-hufadz" ? "rtl" : "ltr";

  const renderField = (key: string) => {
    const cfg = fields[key] as FieldCfg | undefined;
    if (!cfg) return null;
    const maxW = ((cfg.maxWidth || 80) / 100) * REF_W;
    const posStyle: React.CSSProperties = {
      position: "absolute",
      left: `${cfg.x}%`,
      top: `${cfg.y}%`,
      transform: "translate(-50%, -50%)",
      width: maxW,
      textAlign: (cfg.align as any) || "center",
      direction: fieldDirection,
      fontFamily: cfg.fontFamily || undefined,
      color: cfg.color || undefined,
    };
    if (key === "nama") {
      return (
        <AutoFitText
          key={key}
          text={fieldText[key]}
          baseFontSize={cfg.fontSize}
          maxWidth={maxW}
          style={{ ...posStyle, fontWeight: 700 }}
        />
      );
    }
    return (
      <div key={key} style={{ ...posStyle, fontSize: cfg.fontSize, lineHeight: 1.4 }}>
        {fieldText[key]}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-200 print:bg-white">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-stage-wrap { transform: none !important; width: 100% !important; }
          @page { size: landscape; margin: 0; }
        }
      `}</style>
      {/* Poppins untuk field syahadah organisasi. Font lain (mis. "The Season")
          dirujuk lewat nama family yang diatur di layout — tampil bila font
          tersebut tersedia di browser (terinstal / webfont yang dipasang). */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet" />

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

      <div ref={wrapRef} className="mx-auto max-w-6xl p-4 print:p-0 print:max-w-none">
        <div
          className="print-stage-wrap relative overflow-hidden bg-white shadow-lg print:shadow-none"
          style={{
            width: REF_W,
            height: stageH,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            marginBottom: -stageH * (1 - scale),
          }}
        >
          {bg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bg}
              alt="Template syahadah"
              className="absolute inset-0 w-full h-full object-fill"
              draggable={false}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400">
              Template belum memiliki background — upload di menu Template
            </div>
          )}
          {Object.keys(FIELD_LABEL).map(renderField)}
        </div>
      </div>

      {/* Salinan panggung ukuran penuh di luar layar, khusus tangkapan PNG. */}
      {showPngButton && (
        <div
          ref={pngRef}
          aria-hidden
          className="relative overflow-hidden bg-white"
          style={{ position: "fixed", left: -10000, top: 0, width: REF_W, height: stageH }}
        >
          {bg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bg}
              alt=""
              className="absolute inset-0 w-full h-full object-fill"
              draggable={false}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400">
              Template belum memiliki background — upload di menu Template
            </div>
          )}
          {Object.keys(FIELD_LABEL).map(renderField)}
        </div>
      )}
    </div>
  );
}
