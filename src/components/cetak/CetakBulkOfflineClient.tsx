"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  OFFLINE_STAGE_H_MM,
  OFFLINE_STAGE_W_MM,
} from "@/lib/syahadah-offline";
import SyahadahOfflineStage from "@/components/cetak/SyahadahOfflineStage";
import type { BulkOfflinePrintResult } from "@/lib/syahadah-offline-data";
import { lembagaLabel, type LembagaId } from "@/lib/lembaga";

const BULK_PRINT_CSS = `
  @media print {
    @page {
      size: ${OFFLINE_STAGE_W_MM}mm ${OFFLINE_STAGE_H_MM}mm;
      margin: 0;
    }

    html, body {
      background: white !important;
      margin: 0 !important;
      padding: 0 !important;
      width: ${OFFLINE_STAGE_W_MM}mm !important;
      height: auto !important;
      overflow: visible !important;
    }

    .no-print,
    aside,
    footer,
    header,
    nav {
      display: none !important;
    }

    .offline-bulk-reset {
      margin: 0 !important;
      padding: 0 !important;
      max-width: none !important;
      width: auto !important;
      background: white !important;
      border: none !important;
      box-shadow: none !important;
      display: block !important;
    }

    .offline-bulk-page {
      width: ${OFFLINE_STAGE_W_MM}mm !important;
      height: ${OFFLINE_STAGE_H_MM}mm !important;
      margin: 0 !important;
      padding: 0 !important;
      box-shadow: none !important;
      transform: none !important;
      overflow: hidden !important;
      page-break-after: always;
      break-after: page;
    }

    .offline-bulk-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }

    .offline-bg-print-hidden {
      display: none !important;
    }
  }
`;

export default function CetakBulkOfflineClient({
  data,
  kelasId,
  lembaga,
}: {
  data: BulkOfflinePrintResult;
  kelasId?: string | null;
  lembaga?: LembagaId | null;
}) {
  const isMusyarokah = data.mode === "musyarokah";
  // Lulus = kertas pre-printed (default cetak TANPA background).
  // Musyarokah = kertas polos (default cetak DENGAN background).
  const [cetakDenganDesain, setCetakDenganDesain] = useState<boolean>(isMusyarokah);
  const [applyOffset, setApplyOffset] = useState<boolean>(true);
  const [previewScale, setPreviewScale] = useState<number>(0.55);

  const missingBgPrograms = useMemo(() => {
    const set = new Set<string>();
    for (const item of data.items) {
      if (!item.template?.backgroundUrl) {
        set.add(item.programNamaIndo);
      }
    }
    return [...set];
  }, [data.items]);

  const otherPhase = isMusyarokah ? "lulus" : "musyarokah";
  const otherPhaseHref = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set("mode", otherPhase);
    if (kelasId) qs.set("kelasId", kelasId);
    if (lembaga) qs.set("lembaga", lembaga);
    return `/cetak-offline/bulk?${qs.toString()}`;
  }, [otherPhase, kelasId, lembaga]);

  return (
    <div className="min-h-screen bg-[#111] text-white print:bg-white print:text-black offline-bulk-reset">
      <style>{BULK_PRINT_CSS}</style>

      {/* Sticky Toolbar */}
      <div className="no-print sticky top-0 z-30 border-b border-neutral-800 bg-neutral-900/95 backdrop-blur px-4 py-3">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/syahadah"
              className="rounded-full border border-neutral-600 bg-neutral-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-neutral-700"
            >
              ← Data Syahadah
            </Link>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider ${
                    isMusyarokah
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  }`}
                >
                  {isMusyarokah ? "Fase 2 · Musyarokah" : "Fase 1 · Lulus"}
                </span>
                <h1 className="text-sm font-bold text-white">
                  {data.scopeLabel} — {data.items.length} Lembar
                </h1>
              </div>
              <p className="text-[11px] text-slate-400">
                F4 Portrait ({OFFLINE_STAGE_W_MM}×{OFFLINE_STAGE_H_MM}mm) · Diurutkan per kelas: Banin (tertinggi → terendah) lalu Banat (tertinggi → terendah)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-slate-200 cursor-pointer hover:bg-neutral-700">
              <input
                type="checkbox"
                checked={cetakDenganDesain}
                onChange={(e) => setCetakDenganDesain(e.target.checked)}
              />
              <span>Sertakan desain saat cetak</span>
            </label>

            <label className="flex items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-slate-200 cursor-pointer hover:bg-neutral-700">
              <input
                type="checkbox"
                checked={applyOffset}
                onChange={(e) => setApplyOffset(e.target.checked)}
              />
              <span>Offset printer</span>
            </label>

            <a
              href={otherPhaseHref}
              className={`rounded-full px-3.5 py-2 text-xs font-bold transition ${
                isMusyarokah
                  ? "bg-emerald-700 text-white hover:bg-emerald-600"
                  : "bg-amber-600 text-white hover:bg-amber-500"
              }`}
            >
              {isMusyarokah
                ? "← Fase 1: Lulus"
                : "Fase 2: Musyarokah →"}
            </a>

            <button
              type="button"
              onClick={() => window.print()}
              disabled={data.items.length === 0}
              className="rounded-full bg-white px-5 py-2 text-xs font-bold text-neutral-900 transition hover:bg-slate-100 disabled:opacity-40"
            >
              🖨️ Cetak Semua ({data.items.length})
            </button>
          </div>
        </div>

        {/* Info Mode & Zoom */}
        <div className="mx-auto mt-2.5 flex max-w-6xl flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <span>
            {cetakDenganDesain
              ? "Mode Kertas Polos: background desain AKAN ikut tercetak di setiap lembar. Pastikan skala 100% (Actual Size), ukuran kertas F4 (215×330mm)."
              : "Mode Kertas Pre-Printed: background desain TIDAK ikut tercetak (hanya teks, nilai, TTD, & QR). Pastikan skala 100% (Actual Size), ukuran kertas F4 (215×330mm)."}
          </span>
          <div className="flex items-center gap-1.5">
            <span>Preview:</span>
            {[0.4, 0.55, 0.75, 1].map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => setPreviewScale(z)}
                className={`rounded px-2 py-0.5 font-bold ${
                  previewScale === z
                    ? "bg-emerald-600 text-white"
                    : "bg-neutral-800 text-slate-400 hover:text-white"
                }`}
              >
                {Math.round(z * 100)}%
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Warning jika Musyarokah belum upload background */}
      {isMusyarokah && missingBgPrograms.length > 0 && (
        <div className="no-print mx-auto mt-4 max-w-6xl px-4">
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-200 flex flex-wrap items-center justify-between gap-2">
            <span>
              ⚠️ Background <strong>Desain Musyarokah</strong> belum diupload untuk program:{" "}
              <strong>{missingBgPrograms.join(", ")}</strong>. Karena kertas Musyarokah polos,
              harap upload background di menu Layout Syahadah terlebih dahulu.
            </span>
            <Link
              href="/admin/syahadah-offline"
              className="rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-neutral-950 hover:bg-amber-400"
            >
              Buka Layout Syahadah
            </Link>
          </div>
        </div>
      )}

      {/* Ringkasan Kelas */}
      {data.classSummary.length > 0 && (
        <div className="no-print mx-auto mt-4 max-w-6xl px-4">
          <div className="flex flex-wrap gap-2">
            {data.classSummary.map((cs) => (
              <div
                key={cs.kelasKey}
                className="inline-flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-800/80 px-3 py-1 text-xs text-slate-200"
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    cs.lembaga === "ARABIYAH"
                      ? "bg-sky-400"
                      : cs.lembaga === "TURATS"
                        ? "bg-amber-400"
                        : "bg-emerald-400"
                  }`}
                />
                <span className="font-bold">{cs.kelasNama}</span>
                <span className="text-slate-400">({cs.count})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {data.items.length === 0 ? (
        <div className="no-print mx-auto my-20 max-w-md rounded-3xl border border-neutral-800 bg-neutral-900 p-8 text-center">
          <p className="text-lg font-bold text-white">
            Tidak ada santri untuk dicetak pada fase ini
          </p>
          <p className="mt-2 text-xs text-slate-400">
            {isMusyarokah
              ? "Belum ada santri berstatus MUSYAROKAH yang siap cetak di cakupan ini."
              : "Belum ada santri berstatus LULUS yang siap cetak di cakupan ini."}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <a
              href={otherPhaseHref}
              className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500"
            >
              Lihat {isMusyarokah ? "Fase 1: Lulus" : "Fase 2: Musyarokah"}
            </a>
            <Link
              href="/admin/syahadah"
              className="rounded-full border border-neutral-700 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-neutral-800"
            >
              Kembali
            </Link>
          </div>
        </div>
      ) : (
        /* Daftar Halaman F4 */
        <div className="offline-bulk-reset mx-auto py-6 px-4 print:p-0 space-y-6 print:space-y-0">
          {data.items.map((item, idx) => {
            const prev = idx > 0 ? data.items[idx - 1] : null;
            const isNewClass =
              !prev ||
              prev.kelasNama !== item.kelasNama ||
              prev.programNamaIndo !== item.programNamaIndo;

            return (
              <div
                key={`${item.riwayatId}-${idx}`}
                className="offline-bulk-reset"
              >
                {/* Pembatas Kelas (hanya di layar, tidak ikut tercetak) */}
                {isNewClass && (
                  <div className="no-print mx-auto mb-3 mt-4 max-w-4xl flex items-center justify-between rounded-xl border border-neutral-700 bg-neutral-800/90 px-4 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          item.lembaga === "ARABIYAH"
                            ? "bg-sky-400"
                            : item.lembaga === "TURATS"
                              ? "bg-amber-400"
                              : "bg-emerald-400"
                        }`}
                      />
                      <span className="font-bold text-white">
                        {item.kelasNama}
                      </span>
                      <span className="text-slate-400">
                        · {item.programNamaIndo} · {lembagaLabel(item.lembaga)}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Lembar mulai #{idx + 1}
                    </span>
                  </div>
                )}

                {/* Caption per santri (hanya di layar) */}
                <div className="no-print mx-auto mb-1.5 flex max-w-4xl items-center justify-between px-1 text-[11px] text-slate-400">
                  <span>
                    <strong className="text-slate-200">#{idx + 1}</strong> ·{" "}
                    <strong className="text-white">{item.nama}</strong> ·{" "}
                    {item.gender} · Nilai: {item.nilaiAkumulatif.toFixed(2)}
                  </span>
                  <Link
                    href={`/cetak-offline/${item.riwayatId}`}
                    target="_blank"
                    className="text-sky-400 hover:underline"
                  >
                    Buka satuan ↗
                  </Link>
                </div>

                {/* Wrapper ukuran preview di layar; saat print menjadi tepat 215x330mm */}
                <div
                  className="offline-bulk-reset mx-auto print:mx-0"
                  style={{
                    width: `${OFFLINE_STAGE_W_MM * previewScale}mm`,
                    height: `${OFFLINE_STAGE_H_MM * previewScale}mm`,
                  }}
                >
                  <div
                    className="offline-bulk-page relative overflow-hidden bg-white shadow-2xl shadow-black/60"
                    style={{
                      width: `${OFFLINE_STAGE_W_MM}mm`,
                      height: `${OFFLINE_STAGE_H_MM}mm`,
                      transform: `scale(${previewScale})`,
                      transformOrigin: "top left",
                    }}
                  >
                    <SyahadahOfflineStage
                      texts={item.texts}
                      qrDataUrl={item.qrDataUrl}
                      qrUrl={item.qrUrl}
                      signatureUrl={item.signatureUrl}
                      isMusyarokah={item.isMusyarokah}
                      isHufadz={item.isHufadz}
                      template={item.template}
                      showBackground
                      hideBackgroundOnPrint={!cetakDenganDesain}
                      applyOffset={applyOffset}
                      showQrPlaceholder={false}
                      slotCount={item.slotCount}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
