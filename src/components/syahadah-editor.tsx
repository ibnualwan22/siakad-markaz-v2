"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { SyahadahDocument } from "@/components/syahadah-document";
import { SyahadahTuratsDocument } from "@/components/syahadah-turats-document";
import { SyahadahMartabahDocument } from "@/components/syahadah-martabah-document";
import { SyahadahMartabahTuratsDocument } from "@/components/syahadah-martabah-turats-document";
import { SyahadahCacDocument } from "@/components/syahadah-cac-document";
import { LayoutData, LayoutElementKey, LAYOUT_ELEMENT_KEYS, ELEMENT_LABELS, getDefaultLayout } from "@/lib/syahadah-layout";

type SyahadahEditorProps = {
  qrUrl: string;
  data: any;
  initialLayout: LayoutData;
  riwayatId?: string | null;
  programId?: string | null;
  mode: "global" | "per-program" | "per-santri";
  musyarokah?: boolean;
  backHref: string;
  backLabel: string;
  titleLabel?: string;
  isTurats?: boolean;
  isMartabah?: boolean;
  isCac?: boolean;
};

const STEP_OPTIONS = [0.5, 1, 2, 5];

export function SyahadahEditor({
  qrUrl,
  data,
  initialLayout,
  riwayatId,
  programId,
  mode,
  musyarokah,
  backHref,
  backLabel,
  titleLabel,
  isTurats = false,
  isMartabah = false,
  isCac = false,
}: SyahadahEditorProps) {
  const router = useRouter();
  const [layout, setLayout] = useState<LayoutData>(initialLayout);
  const [selectedElement, setSelectedElement] = useState<LayoutElementKey | null>(null);
  const [stepSize, setStepSize] = useState(1);
  // Global/program editor starts active, per-santri starts inactive
  const [editorActive, setEditorActive] = useState(mode !== "per-santri");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState<LayoutData[]>([initialLayout]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Push to history
  const pushHistory = useCallback((newLayout: LayoutData) => {
    setHistory(prev => {
      const trimmed = prev.slice(0, historyIndex + 1);
      return [...trimmed, newLayout];
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  // Undo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setLayout(history[newIndex]);
    }
  }, [historyIndex, history]);

  // Save to API
  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/syahadah-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          riwayatId: mode === "per-santri" ? riwayatId : null,
          programId: mode === "per-program" ? programId : null,
          layoutData: layout,
          mode: isCac ? "MARTABAH_CAC" : (isMartabah ? (isTurats ? "MARTABAH_TURATS" : "MARTABAH_REGULER") : musyarokah ? "MUSYAROKAH" : "REGULER"),
        }),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 2500);
      }
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }, [layout, mode, riwayatId, programId, musyarokah]);

  // Keyboard handler
  useEffect(() => {
    if (!editorActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo: Ctrl+Z
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        undo();
        return;
      }

      // Save: Ctrl+S
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
        return;
      }

      // Escape: deselect
      if (e.key === "Escape") {
        setSelectedElement(null);
        return;
      }

      // Tab: cycle through elements
      if (e.key === "Tab") {
        e.preventDefault();
        setSelectedElement(prev => {
          if (!prev) return LAYOUT_ELEMENT_KEYS[0];
          const idx = LAYOUT_ELEMENT_KEYS.indexOf(prev);
          const nextIdx = e.shiftKey
            ? (idx - 1 + LAYOUT_ELEMENT_KEYS.length) % LAYOUT_ELEMENT_KEYS.length
            : (idx + 1) % LAYOUT_ELEMENT_KEYS.length;
          return LAYOUT_ELEMENT_KEYS[nextIdx];
        });
        return;
      }

      // Arrow keys: move selected element
      if (!selectedElement) return;
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) return;

      e.preventDefault();
      const multiplier = e.shiftKey ? 5 : 1;
      const delta = stepSize * multiplier;

      setLayout(prev => {
        const el = { ...prev[selectedElement] };
        switch (e.key) {
          case "ArrowLeft":
            el.offsetX -= delta;
            break;
          case "ArrowRight":
            el.offsetX += delta;
            break;
          case "ArrowUp":
            el.offsetY -= delta;
            break;
          case "ArrowDown":
            el.offsetY += delta;
            break;
        }
        const newLayout = { ...prev, [selectedElement]: el };
        pushHistory(newLayout);
        return newLayout;
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editorActive, selectedElement, stepSize, pushHistory, undo, handleSave]);

  // Font size control for nama santri
  const handleFontSizeChange = (delta: number) => {
    if (selectedElement !== "namaSantri") return;
    setLayout(prev => {
      const el = { ...prev.namaSantri };
      el.fontSize = Math.max(10, Math.min(60, (el.fontSize ?? 32) + delta));
      const newLayout = { ...prev, namaSantri: el };
      pushHistory(newLayout);
      return newLayout;
    });
  };

  // Columns control for tabelNilai
  const handleColumnsChange = (delta: number) => {
    if (selectedElement !== "tabelNilai") return;
    setLayout(prev => {
      const el = { ...prev.tabelNilai };
      el.columns = Math.max(1, Math.min(4, (el.columns ?? 1) + delta));
      const newLayout = { ...prev, tabelNilai: el };
      pushHistory(newLayout);
      return newLayout;
    });
  };

  // Table Width control
  const handleTableWidthChange = (delta: number) => {
    if (selectedElement !== "tabelNilai") return;
    setLayout(prev => {
      const el = { ...prev.tabelNilai };
      el.tableWidth = Math.max(30, Math.min(100, (el.tableWidth ?? 80) + delta));
      const newLayout = { ...prev, tabelNilai: el };
      pushHistory(newLayout);
      return newLayout;
    });
  };

  // Column Darajah (Score) Width control
  const handleColWidthDarajahChange = (delta: number) => {
    if (selectedElement !== "tabelNilai") return;
    setLayout(prev => {
      const el = { ...prev.tabelNilai };
      el.colWidthDarajah = Math.max(15, Math.min(60, (el.colWidthDarajah ?? 35) + delta));
      const newLayout = { ...prev, tabelNilai: el };
      pushHistory(newLayout);
      return newLayout;
    });
  };

  // Reset layout
  const handleReset = () => {
    const defaultLayout = getDefaultLayout();
    setLayout(defaultLayout);
    pushHistory(defaultLayout);
    setSelectedElement(null);
  };

  // Delete per-santri or per-program override
  const handleDeleteOverride = async () => {
    if (mode === "global") return;
    try {
      const query = mode === "per-santri" ? `riwayatId=${riwayatId}` : `programId=${programId}`;
      await fetch(`/api/admin/syahadah-layout?${query}`, { method: "DELETE" });
      window.location.reload();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const selectedOffset = selectedElement ? layout[selectedElement] : null;

  return (
    <>
      <style>{`
        html, body { margin: 0; padding: 0; background: #111 !important; }
        @media print {
          html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
          @page { size: 330mm 215mm landscape; margin: 0; }
          
          /* Hide EVERYTHING structurally inside body */
          .lg\\:hidden, aside, footer, .app-footer, header, nav { 
            display: none !important; 
          }
          
          /* Strip all layout constraints that shrink the canvas */
          html, body, main, main > div, .min-h-screen {
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            background: white !important;
            display: block !important;
          }
          
          .container-syahadah {
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
          }

          .editor-toolbar, .editor-panel, .editor-crosshair { display: none !important; }
          .editor-workspace { transform: none !important; margin: 0 !important; padding: 0 !important; }
        }
      `}</style>

      <div className="min-h-screen px-4 py-6 print:bg-white print:p-0" style={{ background: "#111" }} ref={containerRef}>
        {/* Top Toolbar */}
        <div className="editor-toolbar mx-auto mb-5 flex w-full items-center justify-between gap-3 print:hidden" style={{ maxWidth: "330mm" }}>
          <div className="flex items-center gap-3">
            <a
              href={backHref}
              className="rounded-full border border-neutral-600 bg-neutral-800 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-neutral-400 hover:bg-neutral-700 hover:text-white"
            >
              {backLabel}
            </a>
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold text-white">
                {titleLabel || (mode === "global" ? "Layout Editor — Template Global" : mode === "per-program" ? "Layout Editor — Per Program" : "Layout Editor — Per Santri")}
              </h1>
              <p className="text-[11px] text-slate-500">Klik elemen → Arrow keys untuk geser posisi</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditorActive(!editorActive)}
              className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                editorActive
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25 hover:bg-blue-500"
                  : "bg-neutral-700 text-slate-300 hover:bg-neutral-600"
              }`}
            >
              {editorActive ? "🎨 Editor Aktif" : "🎨 Mode Editor"}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-slate-100"
            >
              🖨️ Cetak
            </button>
          </div>
        </div>

        {/* Editor Control Panel */}
        {editorActive && (
          <div className="editor-panel mx-auto mb-5 print:hidden" style={{ maxWidth: "330mm" }}>
            <div className="overflow-hidden rounded-2xl border border-neutral-700/80 bg-neutral-800/95 shadow-2xl shadow-black/30 backdrop-blur-md">
              {/* Row 1: Step Size + Actions */}
              <div className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Step</span>
                  <div className="flex rounded-lg bg-neutral-900/60 p-0.5">
                    {STEP_OPTIONS.map(s => (
                      <button
                        key={s}
                        onClick={() => setStepSize(s)}
                        className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
                          stepSize === s
                            ? "bg-blue-600 text-white shadow"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {s}mm
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-6 w-px bg-neutral-700/60" />

                {/* Selected info inline */}
                {selectedElement ? (
                  <div className="flex flex-col gap-2 p-2">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex rounded-md bg-blue-600/15 border border-blue-500/30 px-2.5 py-1 text-[11px] font-bold text-blue-400">
                        {ELEMENT_LABELS[selectedElement]}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        X <strong className="text-slate-300">{selectedOffset?.offsetX?.toFixed(1) ?? 0}</strong>mm
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Y <strong className="text-slate-300">{selectedOffset?.offsetY?.toFixed(1) ?? 0}</strong>mm
                      </span>
                    </div>

                    {selectedElement === "namaSantri" && (
                      <div className="mt-4 border-t border-neutral-700 pt-4">
                        <p className="mb-2 text-xs font-semibold text-slate-400">Ukuran Font (pt): {layout.namaSantri.fontSize}</p>
                        <div className="flex gap-2">
                          <button onClick={() => handleFontSizeChange(-1)} className="flex-1 rounded-md bg-neutral-700 py-1.5 text-sm text-white hover:bg-neutral-600">-1</button>
                          <button onClick={() => handleFontSizeChange(1)} className="flex-1 rounded-md bg-neutral-700 py-1.5 text-sm text-white hover:bg-neutral-600">+1</button>
                          <button onClick={() => handleFontSizeChange(-5)} className="flex-1 rounded-md bg-neutral-700 py-1.5 text-sm text-white hover:bg-neutral-600">-5</button>
                          <button onClick={() => handleFontSizeChange(5)} className="flex-1 rounded-md bg-neutral-700 py-1.5 text-sm text-white hover:bg-neutral-600">+5</button>
                        </div>
                      </div>
                    )}
                    {selectedElement === "tabelNilai" && (
                      <div className="mt-4 border-t border-neutral-700 pt-4">
                        <div className="flex gap-4">
                          <div className="flex-1">
                            <p className="mb-2 text-xs font-semibold text-slate-400">Kolom Tabel: {layout.tabelNilai.columns || 1}</p>
                            <div className="flex gap-2">
                              <button onClick={() => handleColumnsChange(-1)} className="flex-1 rounded-md bg-neutral-700 py-1 text-sm text-white hover:bg-neutral-600">-</button>
                              <button onClick={() => handleColumnsChange(1)} className="flex-1 rounded-md bg-neutral-700 py-1 text-sm text-white hover:bg-neutral-600">+</button>
                            </div>
                          </div>
                          <div className="flex-1">
                            <p className="mb-2 text-xs font-semibold text-slate-400">Lebar Tabel (%): {layout.tabelNilai.tableWidth ?? 80}</p>
                            <div className="flex gap-2">
                              <button onClick={() => handleTableWidthChange(-5)} className="flex-1 rounded-md bg-neutral-700 py-1 text-sm text-white hover:bg-neutral-600">-5</button>
                              <button onClick={() => handleTableWidthChange(5)} className="flex-1 rounded-md bg-neutral-700 py-1 text-sm text-white hover:bg-neutral-600">+5</button>
                            </div>
                          </div>
                          <div className="flex-1">
                            <p className="mb-2 text-xs font-semibold text-slate-400">Lebar Kolom Nilai (mm): {layout.tabelNilai.colWidthDarajah ?? 35}</p>
                            <div className="flex gap-2">
                              <button onClick={() => handleColWidthDarajahChange(-2)} className="flex-1 rounded-md bg-neutral-700 py-1 text-sm text-white hover:bg-neutral-600">-2</button>
                              <button onClick={() => handleColWidthDarajahChange(2)} className="flex-1 rounded-md bg-neutral-700 py-1 text-sm text-white hover:bg-neutral-600">+2</button>
                            </div>
                          </div>
                        </div>
                        <p className="mt-2 text-[10px] text-slate-500 leading-tight">Sesuaikan jika nama mapel terpotong atau tabel terlalu sempit.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-500">Pilih elemen untuk mulai mengatur posisi</span>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1.5 ml-auto">
                  <button
                    onClick={undo}
                    disabled={historyIndex <= 0}
                    className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-slate-400 transition hover:bg-neutral-700 hover:text-white disabled:opacity-25 disabled:hover:bg-transparent"
                    title="Undo (Ctrl+Z)"
                  >
                    ↩ Undo
                  </button>
                  <button
                    onClick={handleReset}
                    className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-amber-400/80 transition hover:bg-neutral-700 hover:text-amber-300"
                  >
                    ⟲ Reset
                  </button>
                  {mode === "per-santri" && riwayatId && (
                    <button
                      onClick={handleDeleteOverride}
                      className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-rose-400/80 transition hover:bg-neutral-700 hover:text-rose-300"
                    >
                      ✕ Hapus Override Santri
                    </button>
                  )}
                  {mode === "per-program" && programId && (
                    <button
                      onClick={handleDeleteOverride}
                      className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-rose-400/80 transition hover:bg-neutral-700 hover:text-rose-300"
                    >
                      ✕ Hapus Override Program
                    </button>
                  )}
                  <div className="h-5 w-px bg-neutral-700/60 mx-1" />
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`rounded-lg px-4 py-1.5 text-[11px] font-bold transition ${
                      saved
                        ? "bg-emerald-600 text-white"
                        : "bg-blue-600 text-white hover:bg-blue-500"
                    }`}
                  >
                    {saving ? "Menyimpan..." : saved ? "✓ Tersimpan!" : mode === "per-santri" ? "💾 Simpan Per-Santri" : mode === "per-program" ? "💾 Simpan Per-Program" : "💾 Simpan Global"}
                  </button>
                </div>
              </div>

              {/* Row 2: Element Selector */}
              <div className="flex flex-wrap items-center gap-1.5 border-t border-neutral-700/50 bg-neutral-900/30 px-5 py-2.5">
                {LAYOUT_ELEMENT_KEYS.map(key => (
                  <button
                    key={key}
                    onClick={() => setSelectedElement(key)}
                    className={`rounded-md px-2.5 py-1 text-[10px] font-semibold transition ${
                      selectedElement === key
                        ? "bg-blue-600 text-white shadow"
                        : "text-slate-500 hover:bg-neutral-700 hover:text-slate-300"
                    }`}
                  >
                    {ELEMENT_LABELS[key]}
                  </button>
                ))}
              </div>

              {/* Row 3: Keyboard hints */}
              <div className="border-t border-neutral-700/30 bg-neutral-900/20 px-5 py-2">
                <p className="text-[10px] text-slate-600">
                  <kbd className="rounded border border-neutral-700 bg-neutral-800 px-1 py-0.5 text-slate-400">←→↑↓</kbd> geser
                  {" · "}
                  <kbd className="rounded border border-neutral-700 bg-neutral-800 px-1 py-0.5 text-slate-400">Shift</kbd>+Arrow = 5x cepat
                  {" · "}
                  <kbd className="rounded border border-neutral-700 bg-neutral-800 px-1 py-0.5 text-slate-400">Tab</kbd> pindah elemen
                  {" · "}
                  <kbd className="rounded border border-neutral-700 bg-neutral-800 px-1 py-0.5 text-slate-400">Esc</kbd> deselect
                  {" · "}
                  <kbd className="rounded border border-neutral-700 bg-neutral-800 px-1 py-0.5 text-slate-400">Ctrl+S</kbd> simpan
                  {" · "}
                  <kbd className="rounded border border-neutral-700 bg-neutral-800 px-1 py-0.5 text-slate-400">Ctrl+Z</kbd> undo
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Syahadah Preview */}
        <div className="flex flex-col items-center gap-10 print:gap-0">
          {(() => {
            let DocumentComponent: any = isTurats ? SyahadahTuratsDocument : SyahadahDocument;
            if (isCac) {
              DocumentComponent = SyahadahCacDocument;
            } else if (isMartabah) {
              DocumentComponent = isTurats ? SyahadahMartabahTuratsDocument : SyahadahMartabahDocument;
            }

            return (
              <DocumentComponent
                qrUrl={qrUrl}
                data={data}
                layout={layout}
                editorMode={editorActive}
                selectedElement={selectedElement}
                onSelectElement={setSelectedElement}
              />
            );
          })()}
        </div>
      </div>
    </>
  );
}
