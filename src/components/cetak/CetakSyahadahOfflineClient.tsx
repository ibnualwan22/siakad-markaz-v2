"use client";

import { useEffect, useRef, useState } from "react";
import {
  OFFLINE_STAGE_H_MM,
  OFFLINE_STAGE_H_PX,
  OFFLINE_STAGE_W_MM,
  OFFLINE_STAGE_W_PX,
  OfflineFieldCfg,
  defaultFieldPositionsOffline,
} from "@/lib/syahadah-offline";
import SyahadahOfflineStage, {
  OFFLINE_PRINT_CSS,
} from "@/components/cetak/SyahadahOfflineStage";
import SyahadahOfflineWorkspace from "@/components/cetak/SyahadahOfflineWorkspace";

// Halaman cetak/unduh syahadah offline (F4 portrait 215 x 330 mm, kertas pre-printed).
// - mode "admin": memakai SyahadahOfflineWorkspace yang SAMA PERSIS dengan editor
//   di /admin/syahadah-offline (termasuk Mode Editor opsional + keyboard panah +
//   CSS print identik) agar hasil edit dan hasil print presisi 1:1.
// - mode "santri": background ikut tercetak & ikut di PNG; tanpa offset; tombol
//   Unduh PNG + Cetak / PDF.
type OfflineTemplate = {
  backgroundUrl: string | null;
  fieldPositions: Record<string, Partial<OfflineFieldCfg>>;
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
    qrUrl?: string | null;
    signatureUrl?: string | null;
    isMusyarokah?: boolean;
    isHufadz?: boolean;
    template: OfflineTemplate | null;
    slotCount?: number;
  };
  mode: "admin" | "santri";
}) {
  const [positions, setPositions] = useState<
    Record<string, Partial<OfflineFieldCfg>>
  >(() => ({
    ...defaultFieldPositionsOffline(),
    ...(data.template?.fieldPositions || {}),
  }));
  const [offsetX, setOffsetX] = useState<number>(data.template?.offsetX ?? 0);
  const [offsetY, setOffsetY] = useState<number>(data.template?.offsetY ?? 0);

  // Khusus mode santri (zoom + unduh PNG)
  const wrapRef = useRef<HTMLDivElement>(null);
  const pngRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pngDownloading, setPngDownloading] = useState(false);
  const [pngError, setPngError] = useState("");

  useEffect(() => {
    if (mode !== "santri") return;
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const style = window.getComputedStyle(el);
      const padX =
        (parseFloat(style.paddingLeft) || 0) +
        (parseFloat(style.paddingRight) || 0);
      const avail = Math.max(200, el.clientWidth - padX);
      setScale(Math.min(1, avail / OFFLINE_STAGE_W_PX));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]);

  if (mode === "admin") {
    return (
      <SyahadahOfflineWorkspace
        programKey={programKey}
        titleLabel={`Cetak Syahadah ${data.isMusyarokah ? "Musyarokah" : "Lulus"} — ${data.nama}`}
        subtitleLabel={`Program: ${programKey} · F4 Portrait (${OFFLINE_STAGE_W_MM}×${OFFLINE_STAGE_H_MM}mm)`}
        backHref="/admin/syahadah"
        backLabel="← Kembali ke Data Syahadah"
        texts={data.texts}
        qrDataUrl={data.qrDataUrl}
        qrUrl={data.qrUrl}
        signatureUrl={data.signatureUrl}
        isMusyarokah={Boolean(data.isMusyarokah)}
        isHufadz={Boolean(data.isHufadz)}
        defaultCetakDenganDesain={Boolean(data.isMusyarokah)}
        backgroundUrl={data.template?.backgroundUrl ?? null}
        positions={positions}
        onPositionsChange={setPositions}
        offsetX={offsetX}
        offsetY={offsetY}
        onOffsetXChange={setOffsetX}
        onOffsetYChange={setOffsetY}
        locked={data.template?.locked ?? false}
        canEdit
        initialEditorActive={false}
        slotCount={data.slotCount ?? 12}
      />
    );
  }

  // Unduh syahadah penuh (desain + isi) sebagai PNG untuk santri
  const downloadPng = async () => {
    const el = pngRef.current;
    if (!el) return;
    setPngDownloading(true);
    setPngError("");
    try {
      try {
        await (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready;
      } catch {
        /* abaikan */
      }
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        width: OFFLINE_STAGE_W_PX,
        height: OFFLINE_STAGE_H_PX,
      });
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, "image/png"),
      );
      if (!blob) throw new Error("gagal membuat PNG");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `syahadah-${programKey}-${data.nama.replace(/\s+/g, "-")}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      setPngError(
        "Gagal mengunduh PNG (kemungkinan gambar template tidak mengizinkan CORS). Silakan pakai tombol Cetak / PDF.",
      );
    } finally {
      setPngDownloading(false);
    }
  };

  const stageProps = {
    texts: data.texts,
    qrDataUrl: data.qrDataUrl,
    qrUrl: data.qrUrl,
    signatureUrl: data.signatureUrl,
    isMusyarokah: Boolean(data.isMusyarokah),
    isHufadz: Boolean(data.isHufadz),
    template: data.template,
  };

  return (
    <div className="min-h-screen bg-[#111] print:bg-white offline-print-reset">
      <style>{OFFLINE_PRINT_CSS}</style>

      <div className="no-print sticky top-0 z-10 bg-neutral-900/95 backdrop-blur border-b border-neutral-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-bold text-white">
            Unduh Syahadah — {programKey}
          </h1>
          <p className="text-sm text-slate-300">{data.nama}</p>
          <p className="text-xs text-slate-400">
            Unduhan berisi desain penuh + isi syahadah (F4 Portrait{" "}
            {OFFLINE_STAGE_W_MM}×{OFFLINE_STAGE_H_MM}mm).
          </p>
          {pngError && <p className="text-sm text-red-400 mt-1">{pngError}</p>}
        </div>
        <div className="flex gap-2 shrink-0 items-center">
          <button
            type="button"
            onClick={downloadPng}
            disabled={pngDownloading}
            className="px-5 py-2 rounded-full bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50"
          >
            {pngDownloading ? "Menyiapkan PNG..." : "Unduh PNG"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-5 py-2 rounded-full bg-white text-neutral-900 text-sm font-semibold hover:bg-slate-100"
          >
            🖨️ Cetak / PDF
          </button>
        </div>
      </div>

      <div
        ref={wrapRef}
        className="offline-print-reset mx-auto max-w-5xl p-4 print:p-0 print:max-w-none"
      >
        <div
          className="offline-print-reset mx-auto"
          style={{
            width: `${OFFLINE_STAGE_W_MM * scale}mm`,
            height: `${OFFLINE_STAGE_H_MM * scale}mm`,
          }}
        >
          <div
            className="offline-print-stage-wrap relative overflow-hidden bg-white shadow-2xl print:shadow-none"
            style={{
              width: `${OFFLINE_STAGE_W_MM}mm`,
              height: `${OFFLINE_STAGE_H_MM}mm`,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            <SyahadahOfflineStage
              {...stageProps}
              showBackground
              hideBackgroundOnPrint={false}
              applyOffset={false}
              showQrPlaceholder={false}
              slotCount={data.slotCount ?? 12}
            />
          </div>
        </div>
      </div>

      {/* Salinan panggung ukuran penuh di luar layar, khusus tangkapan PNG. */}
      <div
        ref={pngRef}
        aria-hidden
        className="no-print relative overflow-hidden bg-white"
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
          slotCount={data.slotCount ?? 12}
        />
      </div>
    </div>
  );
}
