"use client";

import { useEffect, useRef, useState } from "react";
import {
  OFFLINE_FIELD_KEYS,
  OFFLINE_STAGE_H_MM,
  OFFLINE_STAGE_H_PX,
  OFFLINE_STAGE_W_MM,
  OFFLINE_STAGE_W_PX,
} from "@/lib/syahadah-offline";

// Halaman cetak/unduh syahadah offline (A4 portrait, kertas pre-printed).
// SATU jalur render untuk preview layar, print admin, dan PNG santri:
// panggung 210 x 297 mm, posisi % -> mm, font pt — tanpa skala yang
// berubah antara layar dan print (WYSIWYG). Beda mode:
// - admin: background tampil di preview, DISEMBUNYIKAN saat print; offset
//   printer diterapkan ke field; tombol Cetak / PDF.
// - santri: background ikut tercetak & ikut di PNG; tanpa offset; tombol
//   Unduh PNG + Cetak / PDF.
type OfflineTemplate = {
  backgroundUrl: string | null;
  fieldPositions: Record<string, any>;
  locked: boolean;
  offsetX: number;
  offsetY: number;
};

/** Nama satu baris yang font-nya mengecil otomatis bila kepanjangan
 *  (diukur canvas dalam pt, dirender dalam pt — sebangun dengan panggung). */
function AutoFitTextPt({
  text,
  basePt,
  maxWidthMm,
  fontFamily,
  style,
}: {
  text: string;
  basePt: number;
  maxWidthMm: number;
  fontFamily?: string;
  style?: React.CSSProperties;
}) {
  const [pt, setPt] = useState(basePt);
  useEffect(() => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const family = fontFamily ? `"${fontFamily}"` : "sans-serif";
    ctx.font = `${(basePt * 96) / 72}px ${family}`;
    const w = ctx.measureText(text).width;
    const maxW = (maxWidthMm * 96) / 25.4;
    if (w > maxW && w > 0) {
      setPt(Math.max(8, Math.floor((maxW / w) * basePt)));
    } else {
      setPt(basePt);
    }
  }, [text, basePt, maxWidthMm, fontFamily]);

  return (
    <div
      style={{
        ...style,
        fontSize: `${pt}pt`,
        lineHeight: 1.2,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "clip",
      }}
    >
      {text}
    </div>
  );
}

export default function CetakSyahadahOfflineClient({
  programKey,
  data,
  mode,
}: {
  programKey: string;
  data: {
    nama: string;
    texts: Record<string, string>;
    qrDataUrl: string | null;
    template: OfflineTemplate | null;
  };
  mode: "admin" | "santri";
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const pngRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pngDownloading, setPngDownloading] = useState(false);
  const [pngError, setPngError] = useState("");

  const bg = data.template?.backgroundUrl || null;
  const fields = data.template?.fieldPositions || {};
  const offsetX = mode === "admin" ? data.template?.offsetX || 0 : 0;
  const offsetY = mode === "admin" ? data.template?.offsetY || 0 : 0;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setScale(el.clientWidth / OFFLINE_STAGE_W_PX);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Unduh syahadah penuh (desain + isi) sebagai PNG: render salinan
  // panggung di luar layar (ukuran penuh 794px, tanpa transform skala)
  // lalu tangkap html2canvas. Teks Arab dirender mesin browser sehingga
  // shaping-nya benar.
  const downloadPng = async () => {
    const el = pngRef.current;
    if (!el) return;
    setPngDownloading(true);
    setPngError("");
    try {
      try { await (document as any).fonts?.ready; } catch { /* abaikan */ }
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        width: OFFLINE_STAGE_W_PX,
        height: OFFLINE_STAGE_H_PX,
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

  const renderField = (key: string) => {
    const cfg = fields[key];
    if (!cfg) return null;
    const xMm = ((cfg.x ?? 50) / 100) * OFFLINE_STAGE_W_MM;
    const yMm = ((cfg.y ?? 50) / 100) * OFFLINE_STAGE_H_MM;
    const maxWMm = ((cfg.maxWidth ?? 80) / 100) * OFFLINE_STAGE_W_MM;
    const fontPt = cfg.fontSize ?? 13;

    if (key === "qr") {
      const sizeMm = maxWMm;
      if (!data.qrDataUrl) {
        // Admin: kotak penanda di preview saja (tidak ikut tercetak).
        if (mode !== "admin") return null;
        return (
          <div
            key={key}
            className="no-print absolute border-2 border-dashed border-slate-400 bg-white/70 flex items-center justify-center"
            style={{
              left: `${xMm}mm`,
              top: `${yMm}mm`,
              transform: "translate(-50%, -50%)",
              width: `${sizeMm}mm`,
              height: `${sizeMm}mm`,
              fontSize: "10px",
              color: "#64748b",
            }}
          >
            QR
          </div>
        );
      }
      return (
        <div
          key={key}
          className="absolute"
          style={{
            left: `${xMm}mm`,
            top: `${yMm}mm`,
            transform: "translate(-50%, -50%)",
            width: `${sizeMm}mm`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.qrDataUrl}
            alt="QR verifikasi"
            draggable={false}
            className="block w-full h-auto"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/logo.png"
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: "26%",
              background: "#fff",
              borderRadius: 8,
              padding: 2,
            }}
          />
        </div>
      );
    }

    const posStyle: React.CSSProperties = {
      position: "absolute",
      left: `${xMm}mm`,
      top: `${yMm}mm`,
      transform: "translate(-50%, -50%)",
      width: `${maxWMm}mm`,
      textAlign: (cfg.align as any) || "center",
      direction: "rtl",
      fontFamily: cfg.fontFamily || undefined,
      color: cfg.color || undefined,
    };
    if (key === "nama") {
      return (
        <AutoFitTextPt
          key={key}
          text={data.texts[key] ?? ""}
          basePt={fontPt}
          maxWidthMm={maxWMm}
          fontFamily={cfg.fontFamily}
          style={{ ...posStyle, fontWeight: 700 }}
        />
      );
    }
    return (
      <div
        key={key}
        style={{ ...posStyle, fontSize: `${fontPt}pt`, lineHeight: 1.4 }}
      >
        {data.texts[key] ?? ""}
      </div>
    );
  };

  const renderStage = (forPng: boolean) => (
    <>
      {bg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bg}
          alt="Template syahadah"
          className={`absolute inset-0 w-full h-full object-fill ${mode === "admin" && !forPng ? "offline-bg-print-hidden" : ""}`}
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400">
          Template belum memiliki background — upload di menu Template Offline
        </div>
      )}
      {/* Offset printer hanya untuk field (bukan background) dan hanya mode admin. */}
      <div
        className="absolute inset-0"
        style={
          !forPng && (offsetX !== 0 || offsetY !== 0)
            ? { transform: `translate(${offsetX}mm, ${offsetY}mm)` }
            : undefined
        }
      >
        {OFFLINE_FIELD_KEYS.map(renderField)}
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-200 print:bg-white">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-stage-wrap { transform: none !important; width: 100% !important; }
          .offline-bg-print-hidden { display: none !important; }
          @page { size: A4 portrait; margin: 0; }
        }
      `}</style>

      <div className="no-print sticky top-0 z-10 bg-white/90 backdrop-blur border-b px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-bold">
            {mode === "admin" ? "Cetak Syahadah Offline" : "Unduh Syahadah"} — {programKey}
          </h1>
          <p className="text-sm text-slate-500">{data.nama}</p>
          {mode === "admin" && (
            <p className="text-xs text-slate-500">
              Cetak di kertas pre-printed (desain tidak ikut tercetak). Pastikan skala print 100%.
            </p>
          )}
          {mode === "santri" && (
            <p className="text-xs text-slate-500">
              Unduhan berisi desain penuh + isi syahadah (A4).
            </p>
          )}
          {pngError && <p className="text-sm text-red-600 mt-1">{pngError}</p>}
        </div>
        <div className="flex gap-2 shrink-0">
          {mode === "santri" && (
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

      <div ref={wrapRef} className="mx-auto max-w-4xl p-4 print:p-0 print:max-w-none">
        <div
          className="print-stage-wrap relative overflow-hidden bg-white shadow-lg print:shadow-none"
          style={{
            width: `${OFFLINE_STAGE_W_MM}mm`,
            height: `${OFFLINE_STAGE_H_MM}mm`,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            marginBottom: `${-OFFLINE_STAGE_H_MM * (1 - scale)}mm`,
          }}
        >
          {renderStage(false)}
        </div>
      </div>

      {/* Salinan panggung ukuran penuh di luar layar, khusus tangkapan PNG. */}
      {mode === "santri" && (
        <div
          ref={pngRef}
          aria-hidden
          className="relative overflow-hidden bg-white"
          style={{
            position: "fixed",
            left: -10000,
            top: 0,
            width: `${OFFLINE_STAGE_W_MM}mm`,
            height: `${OFFLINE_STAGE_H_MM}mm`,
          }}
        >
          {renderStage(true)}
        </div>
      )}
    </div>
  );
}
