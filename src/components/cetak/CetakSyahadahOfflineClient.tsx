"use client";

import { useEffect, useRef, useState } from "react";
import {
  OFFLINE_STAGE_H_MM,
  OFFLINE_STAGE_H_PX,
  OFFLINE_STAGE_W_MM,
  OFFLINE_STAGE_W_PX,
} from "@/lib/syahadah-offline";
import SyahadahOfflineStage from "@/components/cetak/SyahadahOfflineStage";

// Halaman cetak/unduh syahadah offline (A4 portrait, kertas pre-printed).
// Panggung dirender komponen bersama SyahadahOfflineStage — SAMA PERSIS
// dengan preview editor, supaya atur layout = print preview (WYSIWYG).
// Beda mode:
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

  const stageProps = {
    texts: data.texts,
    qrDataUrl: data.qrDataUrl,
    template: data.template,
  };

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
          <SyahadahOfflineStage
            {...stageProps}
            showBackground
            hideBackgroundOnPrint={mode === "admin"}
            applyOffset={mode === "admin"}
            showQrPlaceholder={mode === "admin"}
          />
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
          <SyahadahOfflineStage
            {...stageProps}
            showBackground
            hideBackgroundOnPrint={false}
            applyOffset={false}
            showQrPlaceholder={false}
          />
        </div>
      )}
    </div>
  );
}
