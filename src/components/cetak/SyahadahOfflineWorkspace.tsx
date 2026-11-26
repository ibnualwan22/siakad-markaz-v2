"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  OFFLINE_DEFAULT_FONT_FAMILY,
  OFFLINE_FIELD_KEYS,
  OFFLINE_STAGE_H_MM,
  OFFLINE_STAGE_W_MM,
  OFFLINE_STAGE_W_PX,
  OfflineFieldCfg,
  defaultFieldPositionsOffline,
  getOfflineFieldDisplayLabel,
  isOfflineFieldVisible,
} from "@/lib/syahadah-offline";
import SyahadahOfflineStage, {
  OFFLINE_PRINT_CSS,
} from "@/components/cetak/SyahadahOfflineStage";

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

type OfflinePositionsMap = Record<string, Partial<OfflineFieldCfg>>;

type HistoryState = {
  stack: OfflinePositionsMap[];
  index: number;
};

export type SyahadahOfflineWorkspaceProps = {
  programKey: string;
  apiBase?: string;
  titleLabel: string;
  subtitleLabel?: string;
  backHref?: string;
  backLabel?: string;
  texts: Record<string, string>;
  qrDataUrl: string | null;
  qrUrl?: string | null;
  backgroundUrl: string | null;
  positions: OfflinePositionsMap;
  onPositionsChange: (next: OfflinePositionsMap) => void;
  offsetX: number;
  offsetY: number;
  onOffsetXChange?: (v: number) => void;
  onOffsetYChange?: (v: number) => void;
  locked: boolean;
  onToggleLock?: () => void;
  locking?: boolean;
  canEdit: boolean;
  initialEditorActive?: boolean;
  slotCount?: number;
  onSave?: (
    positionsToSave: OfflinePositionsMap,
    offsetXToSave: number,
    offsetYToSave: number,
  ) => Promise<void>;
  saving?: boolean;
  /** Sembunyikan tombol kembali/header full-screen bila ditanam di dalam tab admin. */
  embedded?: boolean;
  /** Kunci untuk mereset stack undo (mis. setelah fetch template selesai). */
  historyResetKey?: string | number;
};

/**
 * Workspace editor & preview syahadah offline (F4 portrait 215 x 330 mm).
 * Dipakai BERSAMA oleh halaman editor (/admin/syahadah-offline) dan halaman
 * cetak (/cetak-offline/[id], /cetak-offline/tes/[programKey]) — meniru
 * /layout-editor (SyahadahEditor) sehingga posisi saat edit dan saat print
 * 100% identik, lengkap dengan kontrol keyboard panah + Shift (5x cepat).
 */
export default function SyahadahOfflineWorkspace({
  programKey,
  apiBase = "/api/admin/syahadah-offline/template",
  titleLabel,
  subtitleLabel,
  backHref,
  backLabel,
  texts,
  qrDataUrl,
  qrUrl,
  backgroundUrl,
  positions,
  onPositionsChange,
  offsetX,
  offsetY,
  onOffsetXChange,
  onOffsetYChange,
  locked,
  onToggleLock,
  locking = false,
  canEdit,
  initialEditorActive = true,
  slotCount = 12,
  onSave,
  saving: externalSaving,
  embedded = false,
  historyResetKey,
}: SyahadahOfflineWorkspaceProps) {
  const [editorActive, setEditorActive] = useState(
    canEdit && initialEditorActive,
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [stepSize, setStepSize] = useState<number>(1);
  const [zoom, setZoom] = useState<"fit" | 50 | 75 | 100>("fit");
  const [showOffset, setShowOffset] = useState(true);
  const [cetakDenganDesain, setCetakDenganDesain] = useState(false);
  const [fitScale, setFitScale] = useState(1);
  const [internalSaving, setInternalSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const [history, setHistory] = useState<HistoryState>(() => ({
    stack: [positions],
    index: 0,
  }));

  const positionsRef = useRef(positions);
  positionsRef.current = positions;

  // Reset riwayat undo bila programKey atau historyResetKey berubah
  // (mis. pindah program atau selesai memuat template dari server).
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
      const avail = Math.max(200, el.clientWidth - padX);
      setFitScale(Math.min(1, avail / OFFLINE_STAGE_W_PX));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = zoom === "fit" ? fitScale : zoom / 100;
  const editable = canEdit && !locked && editorActive;
  const saving = externalSaving ?? internalSaving;

  const visibleKeys = useMemo(
    () => OFFLINE_FIELD_KEYS.filter((k) => isOfflineFieldVisible(k, slotCount)),
    [slotCount],
  );

  const infoKeys = useMemo(
    () =>
      visibleKeys.filter(
        (k) => !k.startsWith("mapelSlot") && !k.startsWith("nilaiSlot"),
      ),
    [visibleKeys],
  );
  const mapelKeys = useMemo(
    () => visibleKeys.filter((k) => k.startsWith("mapelSlot")),
    [visibleKeys],
  );
  const nilaiKeys = useMemo(
    () => visibleKeys.filter((k) => k.startsWith("nilaiSlot")),
    [visibleKeys],
  );

  const pushHistory = useCallback((snapshot: OfflinePositionsMap) => {
    setHistory((h) => {
      const trimmed = h.stack.slice(0, h.index + 1);
      const nextStack = [...trimmed, snapshot].slice(-80);
      return { stack: nextStack, index: nextStack.length - 1 };
    });
  }, []);

  const commitPositions = useCallback(
    (next: OfflinePositionsMap) => {
      onPositionsChange(next);
      pushHistory(next);
    },
    [onPositionsChange, pushHistory],
  );

  const updateFieldLive = useCallback(
    (key: string, patch: Partial<OfflineFieldCfg>) => {
      const prev = positionsRef.current;
      const next: OfflinePositionsMap = {
        ...prev,
        [key]: { ...(prev[key] || {}), ...patch },
      };
      onPositionsChange(next);
    },
    [onPositionsChange],
  );

  const updateFieldCommit = useCallback(
    (key: string, patch: Partial<OfflineFieldCfg>) => {
      const prev = positionsRef.current;
      const next: OfflinePositionsMap = {
        ...prev,
        [key]: { ...(prev[key] || {}), ...patch },
      };
      commitPositions(next);
    },
    [commitPositions],
  );

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.index <= 0) return h;
      const nextIndex = h.index - 1;
      onPositionsChange(h.stack[nextIndex]);
      return { ...h, index: nextIndex };
    });
  }, [onPositionsChange]);

  const handleReset = useCallback(() => {
    const seed = defaultFieldPositionsOffline();
    commitPositions(seed);
    setSelectedKey(null);
    toast.success("Posisi direset ke default (klik Simpan untuk menyimpan)");
  }, [commitPositions]);

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
          fieldPositions: positionsRef.current,
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

  // Keyboard shortcuts — persis seperti /layout-editor (SyahadahEditor):
  // Arrow = geser stepSize mm, Shift+Arrow = 5x lebih cepat, Tab = pindah field,
  // Esc = deselect, Ctrl+S = simpan, Ctrl+Z = undo.
  useEffect(() => {
    if (!editable) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S / Cmd+S selalu simpan walau fokus di input
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
        return;
      }

      // Escape: lepas fokus input atau deselect
      if (e.key === "Escape") {
        if (isEditableInputTarget(e.target)) {
          (e.target as HTMLElement).blur();
        } else {
          setSelectedKey(null);
        }
        return;
      }

      // Jangan bajak tombol panah / Tab / Ctrl+Z saat user mengetik di input
      if (isEditableInputTarget(e.target)) return;

      // Undo: Ctrl+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
        return;
      }

      // Tab: pindah antar field tampil
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

      // Arrow keys: geser elemen terpilih dalam mm (Shift = 5x cepat)
      if (!selectedKey) return;
      if (
        !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        return;
      }

      e.preventDefault();
      const multiplier = e.shiftKey ? 5 : 1;
      const deltaMm = stepSize * multiplier;
      const dxPct = (deltaMm / OFFLINE_STAGE_W_MM) * 100;
      const dyPct = (deltaMm / OFFLINE_STAGE_H_MM) * 100;

      const prev = positionsRef.current;
      const cur = prev[selectedKey] || { x: 50, y: 50, fontSize: 13 };
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

      const next = {
        ...prev,
        [selectedKey]: { ...cur, x: nx, y: ny },
      };
      commitPositions(next);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editable, selectedKey, stepSize, visibleKeys, commitPositions, undo, handleSave]);

  const selectedCfg = selectedKey ? positions[selectedKey] || {} : null;
  // Field gambar (QR + tanda tangan mudir): ukuran diatur lewat lebar
  // (mm), tanpa kontrol font/warna.
  const selectedIsImage =
    selectedKey === "qr" || selectedKey === "tandaTangan";
  const selectedXMm = selectedCfg
    ? round2(((selectedCfg.x ?? 50) / 100) * OFFLINE_STAGE_W_MM)
    : 0;
  const selectedYMm = selectedCfg
    ? round2(((selectedCfg.y ?? 50) / 100) * OFFLINE_STAGE_H_MM)
    : 0;
  const selectedImgMm = selectedCfg
    ? round2(((selectedCfg.maxWidth ?? 11.16) / 100) * OFFLINE_STAGE_W_MM)
    : 24;

  return (
    <>
      <style>{OFFLINE_PRINT_CSS}</style>

      <div
        className={`offline-print-reset ${
          embedded
            ? "rounded-2xl px-4 py-5 bg-[#111] print:bg-white print:p-0 print:rounded-none"
            : "min-h-screen px-4 py-6 bg-[#111] print:bg-white print:p-0"
        }`}
      >
        {/* Top Toolbar — gaya layout-editor */}
        <div
          className="editor-toolbar no-print mx-auto mb-4 flex flex-wrap items-center justify-between gap-3"
          style={{ maxWidth: "1100px" }}
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
                  `Kertas F4 Portrait (${OFFLINE_STAGE_W_MM}×${OFFLINE_STAGE_H_MM}mm) · Klik elemen → Geser mouse atau Arrow keys (Shift = 5×)`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Toggle sertakan desain saat print (tes kertas polos) */}
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
                    toast.error("Template terkunci — buka kunci dulu untuk mengedit");
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

            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-full bg-white px-5 py-2 text-xs font-bold text-neutral-900 transition hover:bg-slate-100"
            >
              🖨️ Cetak / PDF
            </button>
          </div>
        </div>

        {/* Info mode print */}
        <div
          className="no-print mx-auto mb-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400"
          style={{ maxWidth: "1100px" }}
        >
          <span>
            {cetakDenganDesain
              ? "Mode Tes Kertas Polos: desain background AKAN ikut tercetak."
              : "Mode Kertas Pre-Printed: desain background TIDAK ikut tercetak (hanya teks & QR). Pastikan skala print 100% / Actual Size, ukuran kertas F4 (215×330mm)."}
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

        {/* Editor Control Panel — persis gaya /layout-editor */}
        {editable && (
          <div
            className="editor-panel no-print mx-auto mb-5"
            style={{ maxWidth: "1100px" }}
          >
            <div className="overflow-hidden rounded-2xl border border-neutral-700/80 bg-neutral-800/95 shadow-2xl shadow-black/30 backdrop-blur-md">
              {/* Row 1: Step Size + Selected Info + Actions */}
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

                {selectedKey && selectedCfg ? (
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="inline-flex rounded-md border border-blue-500/30 bg-blue-600/15 px-2.5 py-1 text-[11px] font-bold text-blue-400">
                      {getOfflineFieldDisplayLabel(selectedKey, texts)}
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
                              x: round2(clamp((mm / OFFLINE_STAGE_W_MM) * 100, 0, 100)),
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
                              y: round2(clamp((mm / OFFLINE_STAGE_H_MM) * 100, 0, 100)),
                            });
                          }
                        }}
                        className="w-16 rounded bg-neutral-900 border border-neutral-700 px-1.5 py-0.5 text-xs font-bold text-white"
                      />
                    </label>
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-400">
                    Klik elemen di kertas atau pilih tombol di bawah untuk mengatur posisi
                  </span>
                )}

                {/* Actions */}
                <div className="ml-auto flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={undo}
                    disabled={history.index <= 0}
                    className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-slate-300 transition hover:bg-neutral-700 hover:text-white disabled:opacity-25 disabled:hover:bg-transparent"
                    title="Undo (Ctrl+Z)"
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

              {/* Row 1b: Properti detail elemen terpilih (Font / QR size, Lebar, Align, Warna, Font Family) */}
              {selectedKey && selectedCfg && (
                <div className="flex flex-wrap items-center gap-3 border-t border-neutral-700/50 bg-neutral-900/40 px-4 py-2.5 text-[11px] text-slate-300">
                  {selectedIsImage ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">
                        {selectedKey === "qr" ? "Ukuran QR (mm):" : "Ukuran TTD (mm):"}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateFieldCommit(selectedKey, {
                            maxWidth: round2(
                              (Math.max(8, selectedImgMm - 1) / OFFLINE_STAGE_W_MM) * 100,
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
                        min="8"
                        max="120"
                        value={Math.round(selectedImgMm)}
                        onChange={(e) => {
                          const mm = Math.max(8, Number(e.target.value) || 8);
                          updateFieldCommit(selectedKey, {
                            maxWidth: round2((mm / OFFLINE_STAGE_W_MM) * 100),
                          });
                        }}
                        className="w-14 rounded bg-neutral-900 border border-neutral-700 px-1.5 py-0.5 text-center font-bold text-white"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateFieldCommit(selectedKey, {
                            maxWidth: round2(
                              (Math.min(120, selectedImgMm + 1) / OFFLINE_STAGE_W_MM) * 100,
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
                              fontSize: Math.max(1, (selectedCfg.fontSize ?? 13) - 1),
                            })
                          }
                          className="rounded bg-neutral-700 px-2 py-0.5 font-bold text-white hover:bg-neutral-600"
                        >
                          -1
                        </button>
                        <input
                          type="number"
                          min="1"
                          step="0.5"
                          value={selectedCfg.fontSize ?? 13}
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
                              fontSize: (selectedCfg.fontSize ?? 13) + 1,
                            })
                          }
                          className="rounded bg-neutral-700 px-2 py-0.5 font-bold text-white hover:bg-neutral-600"
                        >
                          +1
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">Lebar (%):</span>
                        <button
                          type="button"
                          onClick={() =>
                            updateFieldCommit(selectedKey, {
                              maxWidth: round2(Math.max(4, (selectedCfg.maxWidth ?? 20) - 2)),
                            })
                          }
                          className="rounded bg-neutral-700 px-2 py-0.5 font-bold text-white hover:bg-neutral-600"
                        >
                          -2
                        </button>
                        <input
                          type="number"
                          step="1"
                          min="4"
                          max="100"
                          value={selectedCfg.maxWidth ?? 20}
                          onChange={(e) =>
                            updateFieldCommit(selectedKey, {
                              maxWidth: clamp(Number(e.target.value) || 4, 4, 100),
                            })
                          }
                          className="w-14 rounded bg-neutral-900 border border-neutral-700 px-1.5 py-0.5 text-center font-bold text-white"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateFieldCommit(selectedKey, {
                              maxWidth: round2(Math.min(100, (selectedCfg.maxWidth ?? 20) + 2)),
                            })
                          }
                          className="rounded bg-neutral-700 px-2 py-0.5 font-bold text-white hover:bg-neutral-600"
                        >
                          +2
                        </button>
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
                          placeholder={OFFLINE_DEFAULT_FONT_FAMILY}
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
              <div className="space-y-2 border-t border-neutral-700/50 bg-neutral-900/30 px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Umum:
                  </span>
                  {infoKeys.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedKey(key)}
                      className={`rounded-md px-2 py-1 text-[10px] font-semibold transition ${
                        selectedKey === key
                          ? "bg-blue-600 text-white shadow"
                          : "bg-neutral-800/80 text-slate-400 hover:bg-neutral-700 hover:text-slate-200"
                      }`}
                    >
                      {getOfflineFieldDisplayLabel(key, texts)}
                    </button>
                  ))}
                </div>

                {mapelKeys.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400/80">
                      Mapel:
                    </span>
                    {mapelKeys.map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedKey(key)}
                        className={`rounded-md px-2 py-1 text-[10px] font-semibold transition ${
                          selectedKey === key
                            ? "bg-emerald-600 text-white shadow"
                            : "bg-neutral-800/80 text-slate-400 hover:bg-neutral-700 hover:text-slate-200"
                        }`}
                      >
                        {getOfflineFieldDisplayLabel(key, texts)}
                      </button>
                    ))}
                  </div>
                )}

                {nilaiKeys.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-amber-400/80">
                      Nilai:
                    </span>
                    {nilaiKeys.map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedKey(key)}
                        className={`rounded-md px-2 py-1 text-[10px] font-semibold transition ${
                          selectedKey === key
                            ? "bg-amber-600 text-white shadow"
                            : "bg-neutral-800/80 text-slate-400 hover:bg-neutral-700 hover:text-slate-200"
                        }`}
                      >
                        {getOfflineFieldDisplayLabel(key, texts)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Row 3: Offset Printer + Keyboard Hints */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-700/30 bg-neutral-900/20 px-4 py-2">
                <p className="text-[10px] text-slate-400">
                  <kbd className="rounded border border-neutral-700 bg-neutral-800 px-1 py-0.5 text-slate-300">
                    ←→↑↓
                  </kbd>{" "}
                  geser ({stepSize}mm)
                  {" · "}
                  <kbd className="rounded border border-neutral-700 bg-neutral-800 px-1 py-0.5 text-slate-300">
                    Shift
                  </kbd>
                  +Arrow = 5× cepat ({stepSize * 5}mm)
                  {" · "}
                  <kbd className="rounded border border-neutral-700 bg-neutral-800 px-1 py-0.5 text-slate-300">
                    Tab
                  </kbd>{" "}
                  pindah elemen
                  {" · "}
                  <kbd className="rounded border border-neutral-700 bg-neutral-800 px-1 py-0.5 text-slate-300">
                    Esc
                  </kbd>{" "}
                  deselect
                  {" · "}
                  <kbd className="rounded border border-neutral-700 bg-neutral-800 px-1 py-0.5 text-slate-300">
                    Ctrl+S
                  </kbd>{" "}
                  simpan
                  {" · "}
                  <kbd className="rounded border border-neutral-700 bg-neutral-800 px-1 py-0.5 text-slate-300">
                    Ctrl+Z
                  </kbd>{" "}
                  undo
                </p>

                {onOffsetXChange && onOffsetYChange && (
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span className="font-bold text-slate-300">Offset Printer (mm):</span>
                    <label className="flex items-center gap-1">
                      X
                      <input
                        type="number"
                        step="0.5"
                        value={offsetX}
                        onChange={(e) => onOffsetXChange(Number(e.target.value) || 0)}
                        className="w-14 rounded bg-neutral-900 border border-neutral-700 px-1.5 py-0.5 text-[11px] font-bold text-white"
                      />
                    </label>
                    <label className="flex items-center gap-1">
                      Y
                      <input
                        type="number"
                        step="0.5"
                        value={offsetY}
                        onChange={(e) => onOffsetYChange(Number(e.target.value) || 0)}
                        className="w-14 rounded bg-neutral-900 border border-neutral-700 px-1.5 py-0.5 text-[11px] font-bold text-white"
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Stage Canvas — 100% WYSIWYG 215 x 330 mm (F4 Portrait) */}
        <div
          ref={wrapRef}
          className="offline-print-reset overflow-x-auto px-1 py-2 print:overflow-visible print:p-0"
        >
          <div
            className="offline-print-reset mx-auto"
            style={{
              width: `${OFFLINE_STAGE_W_MM * scale}mm`,
              height: `${OFFLINE_STAGE_H_MM * scale}mm`,
            }}
          >
            <div
              className="offline-print-stage-wrap relative overflow-hidden bg-white shadow-2xl shadow-black/60 print:shadow-none"
              style={{
                width: `${OFFLINE_STAGE_W_MM}mm`,
                height: `${OFFLINE_STAGE_H_MM}mm`,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
            >
              <SyahadahOfflineStage
                texts={texts}
                qrDataUrl={qrDataUrl}
                qrUrl={qrUrl}
                template={{
                  backgroundUrl,
                  fieldPositions: positions,
                  offsetX,
                  offsetY,
                }}
                showBackground
                hideBackgroundOnPrint={!cetakDenganDesain}
                applyOffset={showOffset}
                showQrPlaceholder
                slotCount={slotCount}
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
    </>
  );
}
