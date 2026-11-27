"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  NON_KELAS_H_MM,
  NON_KELAS_H_PX,
  NON_KELAS_W_MM,
  NON_KELAS_W_PX,
  defaultNonKelasPositions,
  getNonKelasFieldSchema,
  type NonKelasFieldCfg,
} from "@/lib/syahadah-non-kelas";
import SyahadahNonKelasStage, {
  NON_KELAS_PRINT_CSS,
} from "@/components/cetak/SyahadahNonKelasStage";

const STEP_OPTIONS = [0.5, 1, 2, 5] as const;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function isEditableInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

type PositionsMap = Record<string, Partial<NonKelasFieldCfg>>;

type HistoryState = {
  stack: PositionsMap[];
  index: number;
};

export type SyahadahNonKelasWorkspaceProps = {
  programKey: string;
  apiBase?: string;
  titleLabel: string;
  subtitleLabel?: string;
  backHref?: string;
  backLabel?: string;
  texts: Record<string, string>;
  qrUrl?: string | null;
  signatureUrl?: string | null;
  stampUrl?: string | null;
  backgroundUrl: string | null;
  positions: PositionsMap;
  onPositionsChange?: (next: PositionsMap) => void;
  offsetX?: number;
  offsetY?: number;
  onOffsetXChange?: (v: number) => void;
  onOffsetYChange?: (v: number) => void;
  locked?: boolean;
  onToggleLock?: () => void;
  locking?: boolean;
  canEdit?: boolean;
  initialEditorActive?: boolean;
  onSave?: (
    positionsToSave: PositionsMap,
    offsetXToSave: number,
    offsetYToSave: number,
  ) => Promise<void>;
  saving?: boolean;
  embedded?: boolean;
  showPngButton?: boolean;
  fileBaseName?: string;
  historyResetKey?: string | number;
};

export default function SyahadahNonKelasWorkspace({
  programKey,
  apiBase = "/api/admin/syahadah-non-kelas/template",
  titleLabel,
  subtitleLabel,
  backHref,
  backLabel,
  texts,
  qrUrl,
  signatureUrl,
  stampUrl,
  backgroundUrl,
  positions: externalPositions,
  onPositionsChange: externalOnPositionsChange,
  offsetX: externalOffsetX = 0,
  offsetY: externalOffsetY = 0,
  onOffsetXChange: externalOnOffsetXChange,
  onOffsetYChange: externalOnOffsetYChange,
  locked = false,
  onToggleLock,
  locking = false,
  canEdit = true,
  initialEditorActive = true,
  onSave,
  saving: externalSaving,
  embedded = false,
  showPngButton = false,
  fileBaseName,
  historyResetKey,
}: SyahadahNonKelasWorkspaceProps) {
  const [localPositions, setLocalPositions] = useState<PositionsMap>(externalPositions);
  const [localOffsetX, setLocalOffsetX] = useState<number>(externalOffsetX);
  const [localOffsetY, setLocalOffsetY] = useState<number>(externalOffsetY);

  const positions = externalOnPositionsChange ? externalPositions : localPositions;
  const setPositions = useCallback(
    (next: PositionsMap) => {
      if (externalOnPositionsChange) externalOnPositionsChange(next);
      else setLocalPositions(next);
    },
    [externalOnPositionsChange],
  );
  const offsetX = externalOnOffsetXChange ? externalOffsetX : localOffsetX;
  const setOffsetX = externalOnOffsetXChange ?? setLocalOffsetX;
  const offsetY = externalOnOffsetYChange ? externalOffsetY : localOffsetY;
  const setOffsetY = externalOnOffsetYChange ?? setLocalOffsetY;

  const [editorActive, setEditorActive] = useState(
    canEdit && initialEditorActive,
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [stepSize, setStepSize] = useState<number>(1);
  const [zoom, setZoom] = useState<"fit" | 50 | 75 | 100>("fit");
  const [showOffset, setShowOffset] = useState(true);
  // Default true untuk non-kelas karena umumnya dicetak di kertas polos
  const [cetakDenganDesain, setCetakDenganDesain] = useState(true);
  const [fitScale, setFitScale] = useState(1);
  const [internalSaving, setInternalSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [pngDownloading, setPngDownloading] = useState(false);
  const pngRef = useRef<HTMLDivElement>(null);

  const [history, setHistory] = useState<HistoryState>(() => ({
    stack: [positions],
    index: 0,
  }));

  const positionsRef = useRef(positions);
  positionsRef.current = positions;

  const prevResetKeyRef = useRef(`${programKey}:${historyResetKey ?? ""}`);
  useEffect(() => {
    const curKey = `${programKey}:${historyResetKey ?? ""}`;
    if (prevResetKeyRef.current !== curKey) {
      prevResetKeyRef.current = curKey;
      setSelectedKey(null);
      setHistory({ stack: [positionsRef.current], index: 0 });
    }
  }, [programKey, historyResetKey]);

  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const style = window.getComputedStyle(el);
      const padX =
        (parseFloat(style.paddingLeft) || 0) +
        (parseFloat(style.paddingRight) || 0);
      const avail = Math.max(240, el.clientWidth - padX);
      setFitScale(Math.min(1, avail / NON_KELAS_W_PX));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const schema = useMemo(() => getNonKelasFieldSchema(programKey), [programKey]);
  const visibleKeys = useMemo(() => schema.map((s) => s.key), [schema]);

  const scale = zoom === "fit" ? fitScale : zoom / 100;
  const editable = canEdit && !locked && editorActive;
  const saving = externalSaving ?? internalSaving;

  const pushHistory = useCallback((snapshot: PositionsMap) => {
    setHistory((h) => {
      const trimmed = h.stack.slice(0, h.index + 1);
      const nextStack = [...trimmed, snapshot].slice(-80);
      return { stack: nextStack, index: nextStack.length - 1 };
    });
  }, []);

  const commitPositions = useCallback(
    (next: PositionsMap) => {
      setPositions(next);
      pushHistory(next);
    },
    [setPositions, pushHistory],
  );

  const updateFieldLive = useCallback(
    (key: string, patch: Partial<NonKelasFieldCfg>) => {
      const prev = positionsRef.current;
      setPositions({
        ...prev,
        [key]: { ...(prev[key] || {}), ...patch },
      });
    },
    [setPositions],
  );

  const updateFieldCommit = useCallback(
    (key: string, patch: Partial<NonKelasFieldCfg>) => {
      const prev = positionsRef.current;
      commitPositions({
        ...prev,
        [key]: { ...(prev[key] || {}), ...patch },
      });
    },
    [commitPositions],
  );

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.index <= 0) return h;
      const nextIndex = h.index - 1;
      setPositions(h.stack[nextIndex]);
      return { ...h, index: nextIndex };
    });
  }, [setPositions]);

  const handleReset = useCallback(() => {
    const seed = defaultNonKelasPositions(programKey);
    commitPositions(seed);
    setSelectedKey(null);
    toast.success("Posisi direset ke default (klik Simpan Layout)");
  }, [commitPositions, programKey]);

  const handleSave = useCallback(async () => {
    if (!canEdit || locked) return;
    if (onSave) {
      await onSave(positionsRef.current, offsetX, offsetY);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
      return;
    }
    setInternalSaving(true);
    try {
      const res = await fetch(apiBase, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programKey,
          fieldPositions: { ...positionsRef.current, units: "pct" },
          offsetX,
          offsetY,
        }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan layout");
      setSavedFlash(true);
      toast.success("Layout tersimpan");
      setTimeout(() => setSavedFlash(false), 2500);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan layout");
    } finally {
      setInternalSaving(false);
    }
  }, [apiBase, canEdit, locked, offsetX, offsetY, onSave, programKey]);

  const downloadPng = async () => {
    const el = pngRef.current;
    if (!el) return;
    setPngDownloading(true);
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
        width: Math.round(NON_KELAS_W_PX),
        height: NON_KELAS_H_PX,
      });
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, "image/png"),
      );
      if (!blob) throw new Error("gagal membuat PNG");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `syahadah-${programKey}-${(fileBaseName || "cetak").replace(/\s+/g, "-")}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      toast.error(
        "Gagal mengunduh PNG (kemungkinan CORS gambar background). Gunakan Cetak / PDF.",
      );
    } finally {
      setPngDownloading(false);
    }
  };

  useEffect(() => {
    if (!editable) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
        return;
      }
      if (e.key === "Escape") {
        if (isEditableInputTarget(e.target)) {
          (e.target as HTMLElement).blur();
        } else {
          setSelectedKey(null);
        }
        return;
      }
      if (isEditableInputTarget(e.target)) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        setSelectedKey((prev) => {
          if (visibleKeys.length === 0) return null;
          if (!prev) return visibleKeys[0];
          const idx = visibleKeys.findIndex((k) => k === prev);
          if (idx < 0) return visibleKeys[0];
          const nextIdx = e.shiftKey
            ? (idx - 1 + visibleKeys.length) % visibleKeys.length
            : (idx + 1) % visibleKeys.length;
          return visibleKeys[nextIdx];
        });
        return;
      }
      if (!selectedKey) return;
      if (
        !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        return;
      }

      e.preventDefault();
      const multiplier = e.shiftKey ? 5 : 1;
      const deltaMm = stepSize * multiplier;
      const dxPct = (deltaMm / NON_KELAS_W_MM) * 100;
      const dyPct = (deltaMm / NON_KELAS_H_MM) * 100;

      const prev = positionsRef.current;
      const cur = prev[selectedKey] || { x: 50, y: 50, fontSize: 16 };
      let nx = Number(cur.x ?? 50);
      let ny = Number(cur.y ?? 50);

      switch (e.key) {
        case "ArrowLeft":
          nx = round2(clamp(nx - dxPct, 0, 100));
          break;
        case "ArrowRight":
          nx = round2(clamp(nx + dxPct, 0, 100));
          break;
        case "ArrowUp":
          ny = round2(clamp(ny - dyPct, 0, 100));
          break;
        case "ArrowDown":
          ny = round2(clamp(ny + dyPct, 0, 100));
          break;
      }

      commitPositions({
        ...prev,
        [selectedKey]: { ...cur, x: nx, y: ny },
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    editable,
    selectedKey,
    stepSize,
    visibleKeys,
    commitPositions,
    undo,
    handleSave,
  ]);

  const selectedMeta = selectedKey
    ? schema.find((s) => s.key === selectedKey) || null
    : null;
  const selectedCfg = selectedKey ? positions[selectedKey] || {} : null;
  const selectedIsImage =
    selectedMeta?.kind === "qr" ||
    selectedMeta?.kind === "signature" ||
    selectedMeta?.kind === "stamp";
  const selectedXMm = selectedCfg
    ? round2(((selectedCfg.x ?? 50) / 100) * NON_KELAS_W_MM)
    : 0;
  const selectedYMm = selectedCfg
    ? round2(((selectedCfg.y ?? 50) / 100) * NON_KELAS_H_MM)
    : 0;
  const selectedImgMm = selectedCfg
    ? round2(((selectedCfg.maxWidth ?? 12) / 100) * NON_KELAS_W_MM)
    : 35;

  return (
    <>
      <style>{NON_KELAS_PRINT_CSS}</style>

      <div
        className={`offline-print-reset ${
          embedded
            ? "rounded-2xl px-4 py-5 bg-[#111] print:bg-white print:p-0 print:rounded-none"
            : "min-h-screen px-4 py-6 bg-[#111] print:bg-white print:p-0"
        }`}
      >
        {/* Top Toolbar */}
        <div
          className="editor-toolbar no-print mx-auto mb-4 flex flex-wrap items-center justify-between gap-3"
          style={{ maxWidth: "1180px" }}
        >
          <div className="flex items-center gap-3">
            {backHref && (
              <a
                href={backHref}
                className="rounded-full border border-neutral-600 bg-neutral-800 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:border-neutral-400 hover:bg-neutral-700 hover:text-white"
              >
                {backLabel || "← Kembali"}
              </a>
            )}
            <div>
              <h2 className="text-sm font-bold text-white">{titleLabel}</h2>
              <p className="text-[11px] text-slate-400">
                {subtitleLabel ||
                  `Kertas F4 Landscape (${NON_KELAS_W_MM}×${NON_KELAS_H_MM}mm) · Klik elemen → Geser mouse atau Arrow keys (Shift = 5×)`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs font-semibold text-slate-300 cursor-pointer hover:bg-neutral-700">
              <input
                type="checkbox"
                checked={cetakDenganDesain}
                onChange={(e) => setCetakDenganDesain(e.target.checked)}
              />
              <span>Sertakan desain saat cetak</span>
            </label>

            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  if (locked) {
                    toast.error("Layout terkunci — buka kunci dulu untuk mengedit");
                    return;
                  }
                  setEditorActive((v) => !v);
                }}
                className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                  editable
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25 hover:bg-blue-500"
                    : "bg-neutral-700 text-slate-300 hover:bg-neutral-600"
                }`}
              >
                {editable ? "🎨 Editor Aktif" : "🎨 Mode Editor"}
              </button>
            )}

            {showPngButton && (
              <button
                type="button"
                onClick={downloadPng}
                disabled={pngDownloading}
                className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
              >
                {pngDownloading ? "Menyiapkan..." : "⬇ Unduh PNG"}
              </button>
            )}

            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-full bg-white px-5 py-2 text-xs font-bold text-neutral-900 transition hover:bg-slate-100"
            >
              🖨️ Cetak / PDF
            </button>
          </div>
        </div>

        {/* Info mode print + zoom */}
        <div
          className="no-print mx-auto mb-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400"
          style={{ maxWidth: "1180px" }}
        >
          <span>
            {cetakDenganDesain
              ? `Mode Kertas Polos: background desain AKAN ikut tercetak. Pastikan skala 100%, kertas F4 Landscape (${NON_KELAS_W_MM}×${NON_KELAS_H_MM}mm).`
              : `Mode Kertas Pre-Printed: background desain TIDAK ikut tercetak (hanya teks/QR/TTD).`}
          </span>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">Zoom:</span>
            {(["fit", 50, 75, 100] as const).map((z) => (
              <button
                key={String(z)}
                type="button"
                onClick={() => setZoom(z)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition ${
                  zoom === z
                    ? "bg-emerald-600 text-white"
                    : "bg-neutral-800 text-slate-400 hover:bg-neutral-700 hover:text-white"
                }`}
              >
                {z === "fit" ? "Pas" : `${z}%`}
              </button>
            ))}
            <label className="ml-2 flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={showOffset}
                onChange={(e) => setShowOffset(e.target.checked)}
              />
              Offset printer
            </label>
          </div>
        </div>

        {/* Editor Control Panel */}
        {editable && (
          <div
            className="editor-panel no-print mx-auto mb-5"
            style={{ maxWidth: "1180px" }}
          >
            <div className="overflow-hidden rounded-2xl border border-neutral-700/80 bg-neutral-800/95 shadow-2xl shadow-black/30 backdrop-blur-md">
              {/* Row 1 */}
              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Step
                  </span>
                  <div className="flex rounded-lg bg-neutral-900/70 p-0.5">
                    {STEP_OPTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStepSize(s)}
                        className={`rounded-md px-2.5 py-1 text-xs font-bold transition ${
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

                {selectedKey && selectedMeta && selectedCfg ? (
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="inline-flex rounded-md border border-blue-500/30 bg-blue-600/15 px-2.5 py-1 text-[11px] font-bold text-blue-400">
                      {selectedMeta.label}
                    </span>
                    <label className="flex items-center gap-1 text-[11px] text-slate-400">
                      X(mm)
                      <input
                        type="number"
                        step="0.5"
                        value={selectedXMm}
                        onChange={(e) => {
                          const mm = Number(e.target.value);
                          if (!Number.isNaN(mm)) {
                            updateFieldCommit(selectedKey, {
                              x: round2(clamp((mm / NON_KELAS_W_MM) * 100, 0, 100)),
                            });
                          }
                        }}
                        className="w-16 rounded bg-neutral-900 border border-neutral-700 px-1.5 py-0.5 text-xs font-bold text-white"
                      />
                    </label>
                    <label className="flex items-center gap-1 text-[11px] text-slate-400">
                      Y(mm)
                      <input
                        type="number"
                        step="0.5"
                        value={selectedYMm}
                        onChange={(e) => {
                          const mm = Number(e.target.value);
                          if (!Number.isNaN(mm)) {
                            updateFieldCommit(selectedKey, {
                              y: round2(clamp((mm / NON_KELAS_H_MM) * 100, 0, 100)),
                            });
                          }
                        }}
                        className="w-16 rounded bg-neutral-900 border border-neutral-700 px-1.5 py-0.5 text-xs font-bold text-white"
                      />
                    </label>
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-400">
                    Klik elemen di kertas atau pilih chip di bawah
                  </span>
                )}

                <div className="ml-auto flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={undo}
                    disabled={history.index <= 0}
                    className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-slate-300 transition hover:bg-neutral-700 hover:text-white disabled:opacity-25"
                  >
                    ↩ Undo
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-amber-400/90 transition hover:bg-neutral-700 hover:text-amber-300"
                  >
                    ⟲ Reset
                  </button>
                  {onToggleLock && (
                    <button
                      type="button"
                      onClick={onToggleLock}
                      disabled={locking}
                      className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-slate-300 transition hover:bg-neutral-700 hover:text-white disabled:opacity-40"
                    >
                      {locking ? "..." : locked ? "🔓 Buka Kunci" : "🔒 Kunci"}
                    </button>
                  )}
                  <div className="mx-1 h-5 w-px bg-neutral-700/60" />
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className={`rounded-lg px-4 py-1.5 text-[11px] font-bold transition ${
                      savedFlash
                        ? "bg-emerald-600 text-white"
                        : "bg-blue-600 text-white hover:bg-blue-500"
                    }`}
                  >
                    {saving
                      ? "Menyimpan..."
                      : savedFlash
                        ? "✓ Tersimpan!"
                        : "💾 Simpan Layout"}
                  </button>
                </div>
              </div>

              {/* Row 1b: Properti detail elemen terpilih */}
              {selectedKey && selectedMeta && selectedCfg && (
                <div className="flex flex-wrap items-center gap-3 border-t border-neutral-700/50 bg-neutral-900/40 px-4 py-2.5 text-[11px] text-slate-300">
                  {selectedIsImage ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">Ukuran (mm):</span>
                      <button
                        type="button"
                        onClick={() =>
                          updateFieldCommit(selectedKey, {
                            maxWidth: round2(
                              (Math.max(10, selectedImgMm - 1) / NON_KELAS_W_MM) * 100,
                            ),
                          })
                        }
                        className="rounded bg-neutral-700 px-2 py-0.5 font-bold text-white hover:bg-neutral-600"
                      >
                        -1
                      </button>
                      <input
                        type="number"
                        step="1"
                        min="10"
                        max="150"
                        value={Math.round(selectedImgMm)}
                        onChange={(e) => {
                          const mm = Math.max(10, Number(e.target.value) || 10);
                          updateFieldCommit(selectedKey, {
                            maxWidth: round2((mm / NON_KELAS_W_MM) * 100),
                          });
                        }}
                        className="w-14 rounded bg-neutral-900 border border-neutral-700 px-1.5 py-0.5 text-center font-bold text-white"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateFieldCommit(selectedKey, {
                            maxWidth: round2(
                              (Math.min(150, selectedImgMm + 1) / NON_KELAS_W_MM) * 100,
                            ),
                          })
                        }
                        className="rounded bg-neutral-700 px-2 py-0.5 font-bold text-white hover:bg-neutral-600"
                      >
                        +1
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">Font (pt):</span>
                        <button
                          type="button"
                          onClick={() =>
                            updateFieldCommit(selectedKey, {
                              fontSize: Math.max(6, (selectedCfg.fontSize ?? 16) - 1),
                            })
                          }
                          className="rounded bg-neutral-700 px-2 py-0.5 font-bold text-white hover:bg-neutral-600"
                        >
                          -1
                        </button>
                        <input
                          type="number"
                          min="6"
                          step="0.5"
                          value={selectedCfg.fontSize ?? 16}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (!Number.isNaN(val) && val > 0) {
                              updateFieldCommit(selectedKey, { fontSize: val });
                            }
                          }}
                          className="w-16 rounded bg-neutral-900 border border-neutral-700 px-1.5 py-0.5 text-center font-bold text-white"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateFieldCommit(selectedKey, {
                              fontSize: (selectedCfg.fontSize ?? 16) + 1,
                            })
                          }
                          className="rounded bg-neutral-700 px-2 py-0.5 font-bold text-white hover:bg-neutral-600"
                        >
                          +1
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">Lebar (%):</span>
                        <input
                          type="number"
                          step="2"
                          min="8"
                          max="100"
                          value={selectedCfg.maxWidth ?? 60}
                          onChange={(e) =>
                            updateFieldCommit(selectedKey, {
                              maxWidth: clamp(Number(e.target.value) || 8, 8, 100),
                            })
                          }
                          className="w-14 rounded bg-neutral-900 border border-neutral-700 px-1.5 py-0.5 text-center font-bold text-white"
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-slate-400">Rata:</span>
                        {(["right", "center", "left"] as const).map((al) => (
                          <button
                            key={al}
                            type="button"
                            onClick={() => updateFieldCommit(selectedKey, { align: al })}
                            className={`rounded px-2 py-0.5 font-bold uppercase ${
                              (selectedCfg.align || "center") === al
                                ? "bg-blue-600 text-white"
                                : "bg-neutral-700 text-slate-300 hover:bg-neutral-600"
                            }`}
                          >
                            {al === "right" ? "Kanan" : al === "center" ? "Tengah" : "Kiri"}
                          </button>
                        ))}
                      </div>

                      <label className="flex items-center gap-1.5">
                        <span className="text-slate-400">Warna:</span>
                        <input
                          type="color"
                          value={
                            /^#[0-9a-fA-F]{6}$/.test(selectedCfg.color || "")
                              ? selectedCfg.color
                              : "#000000"
                          }
                          onChange={(e) =>
                            updateFieldCommit(selectedKey, { color: e.target.value })
                          }
                          className="h-6 w-7 cursor-pointer rounded border border-neutral-700 bg-neutral-900 p-0.5"
                        />
                      </label>

                      <label className="flex items-center gap-1.5">
                        <span className="text-slate-400">Font:</span>
                        <input
                          type="text"
                          value={selectedCfg.fontFamily ?? ""}
                          placeholder={selectedMeta.defaultFontFamily || "Amiri"}
                          onChange={(e) =>
                            updateFieldCommit(selectedKey, { fontFamily: e.target.value })
                          }
                          className="w-28 rounded bg-neutral-900 border border-neutral-700 px-2 py-0.5 text-xs text-white placeholder:text-slate-500"
                        />
                      </label>
                    </>
                  )}
                </div>
              )}

              {/* Row 2: Element Selector Chips */}
              <div className="flex flex-wrap items-center gap-1.5 border-t border-neutral-700/50 bg-neutral-900/30 px-4 py-2.5">
                <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Elemen:
                </span>
                {schema.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSelectedKey(item.key)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                      selectedKey === item.key
                        ? "bg-blue-600 text-white shadow"
                        : "bg-neutral-800/80 text-slate-300 hover:bg-neutral-700 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Row 3: Keyboard hints + Offset printer */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-700/30 bg-neutral-900/20 px-4 py-2">
                <p className="text-[10px] text-slate-400">
                  <kbd className="rounded border border-neutral-700 bg-neutral-800 px-1 py-0.5 text-slate-300">
                    ←→↑↓
                  </kbd>{" "}
                  geser ({stepSize}mm) · Shift+Arrow = {stepSize * 5}mm · Tab pindah · Ctrl+S simpan · Ctrl+Z undo
                </p>

                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <span className="font-bold text-slate-300">
                    Offset Printer (mm):
                  </span>
                  <label className="flex items-center gap-1">
                    X
                    <input
                      type="number"
                      step="0.5"
                      value={offsetX}
                      onChange={(e) => setOffsetX(Number(e.target.value) || 0)}
                      className="w-14 rounded bg-neutral-900 border border-neutral-700 px-1.5 py-0.5 text-[11px] font-bold text-white"
                    />
                  </label>
                  <label className="flex items-center gap-1">
                    Y
                    <input
                      type="number"
                      step="0.5"
                      value={offsetY}
                      onChange={(e) => setOffsetY(Number(e.target.value) || 0)}
                      className="w-14 rounded bg-neutral-900 border border-neutral-700 px-1.5 py-0.5 text-[11px] font-bold text-white"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stage Canvas — 100% WYSIWYG 330 x 215 mm (F4 Landscape) */}
        <div
          ref={wrapRef}
          className="offline-print-reset overflow-x-auto px-1 py-2 print:overflow-visible print:p-0"
        >
          <div
            className="offline-print-reset mx-auto"
            style={{
              width: `${NON_KELAS_W_MM * scale}mm`,
              height: `${NON_KELAS_H_MM * scale}mm`,
            }}
          >
            <div
              className="nonkelas-print-stage-wrap relative overflow-hidden bg-white shadow-2xl shadow-black/60 print:shadow-none"
              style={{
                width: `${NON_KELAS_W_MM}mm`,
                height: `${NON_KELAS_H_MM}mm`,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
            >
              <SyahadahNonKelasStage
                programKey={programKey}
                texts={texts}
                qrUrl={qrUrl}
                signatureUrl={signatureUrl}
                stampUrl={stampUrl}
                template={{
                  backgroundUrl,
                  fieldPositions: positions,
                  offsetX,
                  offsetY,
                }}
                showBackground
                hideBackgroundOnPrint={!cetakDenganDesain}
                applyOffset={showOffset}
                editable={editable}
                selectedKey={selectedKey}
                onSelectKey={setSelectedKey}
                onFieldMove={(key, x, y) => updateFieldLive(key, { x, y })}
                onFieldDragEnd={() => pushHistory(positionsRef.current)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Off-screen copy for PNG download */}
      {showPngButton && (
        <div
          ref={pngRef}
          aria-hidden
          className="no-print relative overflow-hidden bg-white"
          style={{
            position: "fixed",
            left: -10000,
            top: 0,
            width: `${NON_KELAS_W_MM}mm`,
            height: `${NON_KELAS_H_MM}mm`,
          }}
        >
          <SyahadahNonKelasStage
            programKey={programKey}
            texts={texts}
            qrUrl={qrUrl}
            signatureUrl={signatureUrl}
            stampUrl={stampUrl}
            template={{
              backgroundUrl,
              fieldPositions: positions,
              offsetX: 0,
              offsetY: 0,
            }}
            showBackground
            hideBackgroundOnPrint={false}
            applyOffset={false}
          />
        </div>
      )}
    </>
  );
}
