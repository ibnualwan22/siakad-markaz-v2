"use client";

import { useState } from "react";
import Link from "next/link";
import { NON_KELAS_H_MM, NON_KELAS_W_MM } from "@/lib/syahadah-non-kelas";
import SyahadahNonKelasStage from "@/components/cetak/SyahadahNonKelasStage";
import type { BulkNonKelasPrintResult } from "@/lib/syahadah-non-kelas-data";

const BULK_NON_KELAS_PRINT_CSS = `
  @media print {
    @page {
      size: ${NON_KELAS_W_MM}mm ${NON_KELAS_H_MM}mm;
      margin: 0;
    }

    html, body {
      background: white !important;
      margin: 0 !important;
      padding: 0 !important;
      width: ${NON_KELAS_W_MM}mm !important;
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

    .nonkelas-bulk-reset {
      margin: 0 !important;
      padding: 0 !important;
      max-width: none !important;
      width: auto !important;
      background: white !important;
      border: none !important;
      box-shadow: none !important;
      display: block !important;
    }

    .nonkelas-bulk-page {
      width: ${NON_KELAS_W_MM}mm !important;
      height: ${NON_KELAS_H_MM}mm !important;
      margin: 0 !important;
      padding: 0 !important;
      box-shadow: none !important;
      transform: none !important;
      overflow: hidden !important;
      page-break-after: always;
      break-after: page;
    }

    .nonkelas-bulk-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }

    .nonkelas-bg-print-hidden {
      display: none !important;
    }
  }
`;

export default function CetakBulkNonKelasClient({
  data,
  backHref = "/admin/syahadah-offline?tab=non-kelas",
  backLabel = "← Layout Syahadah Non-Kelas",
}: {
  data: BulkNonKelasPrintResult;
  backHref?: string;
  backLabel?: string;
}) {
  const [cetakDenganDesain, setCetakDenganDesain] = useState(true);
  const [applyOffset, setApplyOffset] = useState(true);
  const [previewScale, setPreviewScale] = useState(0.55);

  return (
    <div className="min-h-screen bg-[#111] text-white print:bg-white print:text-black nonkelas-bulk-reset">
      <style>{BULK_NON_KELAS_PRINT_CSS}</style>

      {/* Sticky Toolbar */}
      <div className="no-print sticky top-0 z-30 border-b border-neutral-800 bg-neutral-900/95 backdrop-blur px-4 py-3">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href={backHref}
              className="rounded-full border border-neutral-600 bg-neutral-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-neutral-700"
            >
              {backLabel}
            </Link>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider">
                  F4 Landscape
                </span>
                <h1 className="text-sm font-bold text-white">
                  {data.scopeLabel} — {data.items.length} Lembar
                </h1>
              </div>
              <p className="text-[11px] text-slate-400">
                Ukuran {NON_KELAS_W_MM}×{NON_KELAS_H_MM}mm · Pastikan skala print 100% (Actual Size), orientasi Landscape
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

        {/* Zoom & Ringkasan */}
        <div className="mx-auto mt-2.5 flex max-w-6xl flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <div className="flex flex-wrap gap-1.5">
            {data.summary.map((s) => (
              <span
                key={s.programKey}
                className="inline-flex items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-800 px-2.5 py-0.5 text-slate-200"
              >
                <strong className="text-white">{s.label}</strong>
                <span className="text-emerald-400 font-bold">{s.count}</span>
              </span>
            ))}
          </div>
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

      {data.items.length === 0 ? (
        <div className="no-print mx-auto my-20 max-w-md rounded-3xl border border-neutral-800 bg-neutral-900 p-8 text-center">
          <p className="text-lg font-bold text-white">
            Belum ada data syahadah non-kelas siap cetak
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Pastikan peserta/pengurus/juara untuk periode aktif sudah tercatat di menu masing-masing.
          </p>
          <Link
            href={backHref}
            className="mt-5 inline-block rounded-full border border-neutral-700 px-5 py-2 text-xs font-bold text-slate-300 hover:bg-neutral-800"
          >
            {backLabel}
          </Link>
        </div>
      ) : (
        <div className="nonkelas-bulk-reset mx-auto py-6 px-4 print:p-0 space-y-6 print:space-y-0">
          {data.items.map((item, idx) => {
            const prev = idx > 0 ? data.items[idx - 1] : null;
            const isNewSection = !prev || prev.programKey !== item.programKey;

            return (
              <div key={item.id} className="nonkelas-bulk-reset">
                {isNewSection && (
                  <div className="no-print mx-auto mb-3 mt-4 max-w-5xl flex items-center justify-between rounded-xl border border-neutral-700 bg-neutral-800/90 px-4 py-2 text-xs">
                    <span className="font-bold text-white">
                      📄 {item.jenisLabel}
                    </span>
                    <span className="text-slate-400">
                      Mulai lembar #{idx + 1}
                    </span>
                  </div>
                )}

                <div className="no-print mx-auto mb-1.5 flex max-w-5xl items-center justify-between px-1 text-[11px] text-slate-400">
                  <span>
                    <strong className="text-slate-200">#{idx + 1}</strong> ·{" "}
                    <strong className="text-white">{item.nama}</strong>
                    {item.subtitle ? ` · ${item.subtitle}` : ""}
                  </span>
                  <span className="text-slate-500">{item.jenisLabel}</span>
                </div>

                <div
                  className="nonkelas-bulk-reset mx-auto print:mx-0"
                  style={{
                    width: `${NON_KELAS_W_MM * previewScale}mm`,
                    height: `${NON_KELAS_H_MM * previewScale}mm`,
                  }}
                >
                  <div
                    className="nonkelas-bulk-page relative overflow-hidden bg-white shadow-2xl shadow-black/60"
                    style={{
                      width: `${NON_KELAS_W_MM}mm`,
                      height: `${NON_KELAS_H_MM}mm`,
                      transform: `scale(${previewScale})`,
                      transformOrigin: "top left",
                    }}
                  >
                    <SyahadahNonKelasStage
                      programKey={item.programKey}
                      texts={item.texts}
                      qrUrl={item.qrUrl}
                      signatureUrl={item.signatureUrl}
                      stampUrl={item.stampUrl}
                      template={item.template}
                      showBackground
                      hideBackgroundOnPrint={!cetakDenganDesain}
                      applyOffset={applyOffset}
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
