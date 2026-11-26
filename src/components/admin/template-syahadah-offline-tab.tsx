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

// Tab "Template Offline" syahadah F4 portrait (215 x 330 mm, kertas pre-printed).
// Menggunakan SyahadahOfflineWorkspace yang SAMA PERSIS dengan halaman cetak
// (/cetak-offline/[id] & /cetak-offline/tes/[programKey]), sehingga layout yang
// diatur di sini 100% identik dengan hasil print (WYSIWYG), lengkap dengan
// kontrol keyboard panah + Shift (5x cepat) seperti /layout-editor.
export default function TemplateSyahadahOfflineTab({
  programKey,
  apiBase,
  canEdit,
  slotCount = 12,
  programLabel,
}: {
  programKey: string;
  apiBase: string;
  canEdit: boolean;
  slotCount?: number;
  programLabel?: string;
}) {
  const [bg, setBg] = useState<string | null>(null);
  const [positions, setPositions] = useState<
    Record<string, Partial<OfflineFieldCfg>>
  >(() => defaultFieldPositionsOffline());
  const [locked, setLocked] = useState(false);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locking, setLocking] = useState(false);
  const [dummyTexts, setDummyTexts] = useState<Record<string, string> | null>(
    null,
  );
  const [dummyQrDataUrl, setDummyQrDataUrl] = useState<string | null>(null);
  const [dummyQrUrl, setDummyQrUrl] = useState<string | null>(null);
  const [loadSeq, setLoadSeq] = useState(0);

  const load = async () => {
    const res = await fetch(`${apiBase}?programKey=${programKey}`);
    if (!res.ok) return;
    const tpl = await res.json();
    setBg(tpl.backgroundUrl);
    const seed = defaultFieldPositionsOffline();
    setPositions({ ...seed, ...(tpl.fieldPositions || {}) });
    setLocked(tpl.locked === true);
    setOffsetX(Number(tpl.offsetX) || 0);
    setOffsetY(Number(tpl.offsetY) || 0);
    setDummyTexts(tpl.dummyTexts ?? null);
    setDummyQrDataUrl(tpl.dummyQrDataUrl ?? null);
    setDummyQrUrl(tpl.dummyQrUrl ?? null);
    setLoadSeq((n) => n + 1);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programKey]);

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
        }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan");
      toast.success("Layout tersimpan");
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
    <div className="space-y-6 offline-print-reset">
      {/* Upload Background Card — tidak tercetak */}
      <div className="no-print bg-white rounded-2xl border p-5 space-y-3">
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
              className={`px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-50 ${locked
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
        {locked && (
          <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Template terkunci setelah kalibrasi. Buka kunci untuk mengubah
            desain atau posisi.
          </p>
        )}
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
        <p className="text-xs text-[var(--color-text-muted)]">
          Ekspor desain ukuran F4 portrait ({OFFLINE_STAGE_W_MM} ×{" "}
          {OFFLINE_STAGE_H_MM} mm, JPG/PNG), maksimal 10MB. Background ini
          HANYA untuk acuan di editor &amp; unduhan santri — saat mencetak di
          kertas pre-printed, background otomatis disembunyikan (kecuali centang
          &ldquo;Sertakan desain saat cetak&rdquo;).
        </p>
      </div>

      {/* Unified Layout Editor & Print Workspace (sama persis dengan halaman cetak) */}
      <SyahadahOfflineWorkspace
        programKey={programKey}
        apiBase={apiBase}
        titleLabel={`Layout Editor Offline — ${programLabel || programKey}`}
        texts={dummyTexts ?? OFFLINE_FIELD_SAMPLE}
        qrDataUrl={dummyQrDataUrl}
        qrUrl={dummyQrUrl}
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
        slotCount={slotCount}
        onSave={savePositions}
        saving={saving}
        embedded
        historyResetKey={loadSeq}
      />
    </div>
  );
}
