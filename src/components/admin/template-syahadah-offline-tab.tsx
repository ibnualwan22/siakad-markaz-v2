"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  OFFLINE_FIELD_SAMPLE,
  OFFLINE_STAGE_H_MM,
  OFFLINE_STAGE_W_MM,
  OfflineFieldCfg,
  defaultFieldPositionsOffline,
} from "@/lib/syahadah-offline";
import SyahadahOfflineWorkspace from "@/components/cetak/SyahadahOfflineWorkspace";

// Tab editor template syahadah F4 portrait (215 x 330 mm) — mendukung
// mode Global Lembaga (menerapkan ke seluruh program di lembaga tsb) maupun
// mode Per Program (override khusus 1 program).
export default function TemplateSyahadahOfflineTab({
  programKey,
  baseProgramKey,
  apiBase,
  canEdit,
  slotCount = 12,
  programLabel,
  isMusyarokah = false,
  isHufadz = false,
  isGlobalLembaga = false,
  lembagaName,
  sharedBackgroundUrl,
  hideUploadCard = false,
}: {
  programKey: string;
  baseProgramKey?: string;
  apiBase: string;
  canEdit: boolean;
  slotCount?: number;
  programLabel?: string;
  isMusyarokah?: boolean;
  isHufadz?: boolean;
  isGlobalLembaga?: boolean;
  lembagaName?: string;
  sharedBackgroundUrl?: string | null;
  hideUploadCard?: boolean;
}) {
  const [bg, setBg] = useState<string | null>(sharedBackgroundUrl ?? null);
  const [positions, setPositions] = useState<
    Record<string, Partial<OfflineFieldCfg>>
  >(() => defaultFieldPositionsOffline());
  const [locked, setLocked] = useState(false);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [copyingFromLulus, setCopyingFromLulus] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locking, setLocking] = useState(false);
  const [dummyTexts, setDummyTexts] = useState<Record<string, string> | null>(
    null,
  );
  const [dummyQrDataUrl, setDummyQrDataUrl] = useState<string | null>(null);
  const [dummyQrUrl, setDummyQrUrl] = useState<string | null>(null);
  const [dummySignatureUrl, setDummySignatureUrl] = useState<string | null>(
    null,
  );
  const [resolvedSlotCount, setResolvedSlotCount] = useState(slotCount);
  const [loadSeq, setLoadSeq] = useState(0);

  const load = async () => {
    const res = await fetch(`${apiBase}?programKey=${programKey}`);
    if (!res.ok) return;
    const tpl = await res.json();
    setBg(sharedBackgroundUrl ?? tpl.backgroundUrl ?? null);
    const seed = defaultFieldPositionsOffline();
    setPositions({ ...seed, ...(tpl.fieldPositions || {}) });
    setLocked(tpl.locked === true);
    setOffsetX(Number(tpl.offsetX) || 0);
    setOffsetY(Number(tpl.offsetY) || 0);
    setDummyTexts(tpl.dummyTexts ?? null);
    setDummyQrDataUrl(tpl.dummyQrDataUrl ?? null);
    setDummyQrUrl(tpl.dummyQrUrl ?? null);
    setDummySignatureUrl(tpl.dummySignatureUrl ?? null);
    if (typeof tpl.slotCount === "number") setResolvedSlotCount(tpl.slotCount);
    setLoadSeq((n) => n + 1);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programKey, sharedBackgroundUrl]);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("programKey", programKey);
      const res = await fetch(`${apiBase}/upload`, { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.json()).error || "Gagal upload");
      const { url, publicId } = await res.json();
      const put = await fetch(apiBase, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programKey,
          backgroundUrl: url,
          backgroundId: publicId,
        }),
      });
      if (!put.ok) throw new Error("Gagal menyimpan template");
      setBg(url);
      toast.success("Background terupload");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal upload");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const copyFromLulus = async () => {
    if (!baseProgramKey) return;
    setCopyingFromLulus(true);
    try {
      const res = await fetch(`${apiBase}?programKey=${baseProgramKey}`);
      if (!res.ok) throw new Error("Gagal memuat Desain Lulus");
      const baseTpl = await res.json();
      const seed = defaultFieldPositionsOffline();
      setPositions({ ...seed, ...(baseTpl.fieldPositions || {}) });
      setOffsetX(Number(baseTpl.offsetX) || 0);
      setOffsetY(Number(baseTpl.offsetY) || 0);
      setLoadSeq((n) => n + 1);
      toast.success(
        "Posisi field & offset disalin dari Desain Lulus (klik Simpan Layout untuk menyimpan)",
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menyalin posisi");
    } finally {
      setCopyingFromLulus(false);
    }
  };

  const savePositions = async (
    positionsToSave: Record<string, Partial<OfflineFieldCfg>>,
    ox: number,
    oy: number,
  ) => {
    setSaving(true);
    try {
      const res = await fetch(apiBase, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programKey,
          fieldPositions: positionsToSave,
          offsetX: ox,
          offsetY: oy,
          applyToAllPrograms: isGlobalLembaga,
        }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan");
      const result = await res.json();
      if (isGlobalLembaga && result.propagatedCount > 0) {
        toast.success(
          `Layout global tersimpan & langsung diterapkan ke ${result.propagatedCount} program ${lembagaName || ""}`,
        );
      } else {
        toast.success("Layout tersimpan");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const toggleLock = async () => {
    setLocking(true);
    try {
      const res = await fetch(apiBase, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programKey, locked: !locked }),
      });
      if (!res.ok) throw new Error("Gagal mengubah kunci");
      setLocked(!locked);
      toast.success(
        locked ? "Template dibuka — bisa diubah lagi" : "Template dikunci",
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal mengubah kunci");
    } finally {
      setLocking(false);
    }
  };

  return (
    <div className="space-y-4 offline-print-reset">
      {/* Bar info / aksi cepat untuk mode Global & Musyarokah */}
      {hideUploadCard ? (
        <div className="no-print flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-slate-50 px-4 py-3 text-xs">
          <div className="text-slate-700">
            {isGlobalLembaga ? (
              <span>
                🌐 <strong>Mode Layout Global:</strong> Klik{" "}
                <strong>💾 Simpan Layout</strong> di bawah untuk langsung menerapkan posisi &amp; offset ini ke <strong>semua program {lembagaName}</strong> ({isMusyarokah ? "Musyarokah" : "Lulus"}).
              </span>
            ) : (
              <span>
                🎯 <strong>Mode Per Program:</strong> Perubahan posisi di sini hanya berlaku untuk <strong>{programLabel}</strong>.
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && !locked && isMusyarokah && baseProgramKey && (
              <button
                type="button"
                onClick={copyFromLulus}
                disabled={copyingFromLulus}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 disabled:opacity-50"
              >
                {copyingFromLulus
                  ? "Menyalin..."
                  : "📋 Salin Posisi dari Desain Lulus"}
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={toggleLock}
                disabled={locking}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold disabled:opacity-50 ${
                  locked
                    ? "bg-amber-600 text-white"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                }`}
              >
                {locking
                  ? "..."
                  : locked
                    ? "🔓 Buka Kunci"
                    : "🔒 Kunci Layout"}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          className={`no-print rounded-2xl border p-5 space-y-3 ${
            isMusyarokah ? "bg-amber-50/40 border-amber-200" : "bg-white"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-bold">
              Background Desain (F4 Portrait — {OFFLINE_STAGE_W_MM} ×{" "}
              {OFFLINE_STAGE_H_MM} mm)
            </h3>
            {canEdit && (
              <button
                type="button"
                onClick={toggleLock}
                disabled={locking}
                className={`px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-50 ${
                  locked
                    ? "bg-amber-600 text-white"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                }`}
              >
                {locking
                  ? "Menyimpan..."
                  : locked
                    ? "🔓 Buka Kunci Template"
                    : "🔒 Kunci Template"}
              </button>
            )}
          </div>
          {canEdit && !locked && (
            <label className="inline-block px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-bold cursor-pointer hover:opacity-90">
              {uploading ? "Mengupload..." : "Upload Desain F4 Baru"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={upload}
                disabled={uploading}
              />
            </label>
          )}
        </div>
      )}

      {locked && (
        <p className="no-print text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
          Layout terkunci setelah kalibrasi. Klik &ldquo;Buka Kunci&rdquo; untuk mengedit kembali.
        </p>
      )}

      {/* Unified Layout Editor & Print Workspace */}
      <SyahadahOfflineWorkspace
        programKey={programKey}
        apiBase={apiBase}
        titleLabel={`Layout Syahadah — ${programLabel || programKey}`}
        texts={dummyTexts ?? OFFLINE_FIELD_SAMPLE}
        qrDataUrl={dummyQrDataUrl}
        qrUrl={dummyQrUrl}
        signatureUrl={dummySignatureUrl}
        isMusyarokah={isMusyarokah}
        isHufadz={isHufadz}
        defaultCetakDenganDesain={isMusyarokah}
        backgroundUrl={bg}
        positions={positions}
        onPositionsChange={setPositions}
        offsetX={offsetX}
        offsetY={offsetY}
        onOffsetXChange={setOffsetX}
        onOffsetYChange={setOffsetY}
        locked={locked}
        onToggleLock={canEdit ? toggleLock : undefined}
        locking={locking}
        canEdit={canEdit}
        initialEditorActive
        slotCount={resolvedSlotCount}
        onSave={savePositions}
        saving={saving}
        embedded
        historyResetKey={loadSeq}
      />
    </div>
  );
}
