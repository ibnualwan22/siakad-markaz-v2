"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  NON_KELAS_H_MM,
  NON_KELAS_W_MM,
  defaultNonKelasPositions,
  type NonKelasFieldCfg,
} from "@/lib/syahadah-non-kelas";
import type { NonKelasCatalogItem } from "@/lib/syahadah-non-kelas-data";
import SyahadahNonKelasWorkspace from "@/components/cetak/SyahadahNonKelasWorkspace";

export default function SyahadahNonKelasPanel({
  catalog,
}: {
  catalog: NonKelasCatalogItem[];
}) {
  const [selectedKey, setSelectedKey] = useState<string>(
    catalog[0]?.programKey || "nadi-hufadz",
  );

  const selectedItem = useMemo(
    () => catalog.find((c) => c.programKey === selectedKey) || catalog[0],
    [catalog, selectedKey],
  );

  const totalAllNonKelas = useMemo(
    () => catalog.reduce((sum, item) => sum + item.count, 0),
    [catalog],
  );

  const [bg, setBg] = useState<string | null>(null);
  const [hasCustomBg, setHasCustomBg] = useState(false);
  const [positions, setPositions] = useState<
    Record<string, Partial<NonKelasFieldCfg>>
  >(() => defaultNonKelasPositions(selectedKey));
  const [locked, setLocked] = useState(false);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locking, setLocking] = useState(false);
  const [dummyTexts, setDummyTexts] = useState<Record<string, string>>({});
  const [dummyQrUrl, setDummyQrUrl] = useState<string | null>(null);
  const [dummySignatureUrl, setDummySignatureUrl] = useState<string | null>(null);
  const [dummyStampUrl, setDummyStampUrl] = useState<string | null>(null);
  const [loadSeq, setLoadSeq] = useState(0);

  useEffect(() => {
    let ignore = false;
    fetch(`/api/admin/syahadah-non-kelas/template?programKey=${encodeURIComponent(selectedKey)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((tpl) => {
        if (ignore || !tpl) return;
        setBg(tpl.backgroundUrl ?? null);
        setHasCustomBg(Boolean(tpl.hasCustomBackground));
        setPositions(tpl.fieldPositions || defaultNonKelasPositions(selectedKey));
        setLocked(tpl.locked === true);
        setOffsetX(Number(tpl.offsetX) || 0);
        setOffsetY(Number(tpl.offsetY) || 0);
        setDummyTexts(tpl.dummyTexts || {});
        setDummyQrUrl(tpl.dummyQrUrl ?? null);
        setDummySignatureUrl(tpl.dummySignatureUrl ?? null);
        setDummyStampUrl(tpl.dummyStampUrl ?? null);
        setLoadSeq((n) => n + 1);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [selectedKey]);

  const handleUploadBg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("programKey", selectedKey);
      const res = await fetch("/api/admin/syahadah-non-kelas/template/upload", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error((await res.json()).error || "Gagal upload");
      const { url, publicId } = await res.json();
      const put = await fetch("/api/admin/syahadah-non-kelas/template", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programKey: selectedKey,
          backgroundUrl: url,
          backgroundId: publicId,
        }),
      });
      if (!put.ok) throw new Error("Gagal menyimpan background");
      setBg(url);
      setHasCustomBg(true);
      toast.success(`Background ${selectedItem?.label || selectedKey} terupload`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal upload");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSaveLayout = async (
    positionsToSave: Record<string, Partial<NonKelasFieldCfg>>,
    ox: number,
    oy: number,
  ) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/syahadah-non-kelas/template", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programKey: selectedKey,
          fieldPositions: positionsToSave,
          offsetX: ox,
          offsetY: oy,
        }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan layout");
      toast.success(`Layout ${selectedItem?.label || selectedKey} tersimpan`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan layout");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleLock = async () => {
    setLocking(true);
    try {
      const res = await fetch("/api/admin/syahadah-non-kelas/template", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programKey: selectedKey, locked: !locked }),
      });
      if (!res.ok) throw new Error("Gagal mengubah kunci");
      setLocked(!locked);
      toast.success(locked ? "Layout dibuka" : "Layout dikunci");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah kunci");
    } finally {
      setLocking(false);
    }
  };

  return (
    <div className="space-y-6 offline-print-reset">
      {/* Card 1: Cetak Bulk Global Non-Kelas */}
      <div className="no-print rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-700">
            Cetak Bulk Global — Syahadah Non-Kelas (F4 Landscape)
          </p>
          <p className="text-xs text-slate-600">
            Cetak seluruh syahadah non-kelas periode aktif sekaligus dalam satu kali print
            (Nadi Hufadz, Lajnah, OSIM, Tadrib Funun, CAC, &amp; Martabah Ula), atau pilih cetak bulk per jenis di bawah.
          </p>
        </div>

        <a
          href="/cetak-non-kelas/bulk?jenis=ALL"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700"
        >
          🖨️ Cetak Bulk Global Non-Kelas ({totalAllNonKelas})
        </a>
      </div>

      {/* Card 2: Pilih Jenis Syahadah Non-Kelas */}
      <div className="no-print bg-white rounded-2xl border p-5 space-y-4">
        <div>
          <h3 className="font-bold text-base">
            1. Pilih Jenis Syahadah Non-Kelas ({catalog.length} Template)
          </h3>
          <p className="text-xs text-[var(--color-text-muted)]">
            Semua syahadah non-kelas memakai ukuran F4 Landscape ({NON_KELAS_W_MM} ×{" "}
            {NON_KELAS_H_MM} mm) dengan editor WYSIWYG presisi 1:1.
          </p>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.map((item) => {
            const active = item.programKey === selectedKey;
            return (
              <div
                key={item.programKey}
                onClick={() => setSelectedKey(item.programKey)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedKey(item.programKey);
                  }
                }}
                className={`rounded-2xl border p-3.5 text-left transition cursor-pointer flex flex-col justify-between gap-2 ${
                  active
                    ? "bg-slate-900 text-white border-slate-900 shadow-md"
                    : "bg-slate-50 text-slate-800 border-slate-200 hover:bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        active ? "text-emerald-300" : "text-slate-400"
                      }`}
                    >
                      {item.group}
                    </span>
                    <p className="font-bold text-sm leading-snug">{item.label}</p>
                    <p
                      className={`text-[11px] mt-0.5 ${
                        active ? "text-slate-300" : "text-slate-500"
                      }`}
                    >
                      {item.sublabel}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      active
                        ? "bg-white/20 text-white"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {item.count}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-current/10">
                  <span
                    className={`text-[10px] font-semibold ${
                      active ? "text-slate-300" : "text-slate-400"
                    }`}
                  >
                    {active ? "✓ Sedang diedit" : "Klik untuk atur layout"}
                  </span>
                  <a
                    href={`/cetak-non-kelas/bulk?jenis=${encodeURIComponent(item.bulkFilter)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
                      active
                        ? "bg-emerald-500 text-white hover:bg-emerald-400"
                        : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                    }`}
                  >
                    🖨️ Bulk ({item.count})
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Card 3: Upload Background Desain F4 Landscape untuk jenis terpilih */}
      {selectedItem && (
        <div className="no-print bg-white rounded-2xl border p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-bold text-base">
              2. Background Desain — {selectedItem.label} (F4 Landscape{" "}
              {NON_KELAS_W_MM} × {NON_KELAS_H_MM} mm)
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              Upload gambar desain Canva F4 Landscape (JPG/PNG, maks 10MB).{" "}
              {hasCustomBg
                ? "Menggunakan background custom upload."
                : bg
                  ? "Menggunakan background bawaan (bisa diganti kapan saja)."
                  : "Belum ada background diupload."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!locked && (
              <label
                className={`inline-block px-4 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-xs font-bold cursor-pointer hover:opacity-90 ${
                  uploading ? "opacity-60 pointer-events-none" : ""
                }`}
              >
                {uploading ? "Mengupload..." : "Upload Background F4 Landscape"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUploadBg}
                  disabled={uploading}
                />
              </label>
            )}

            <a
              href={`/cetak-non-kelas/tes/${encodeURIComponent(selectedItem.programKey)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-700"
            >
              🖨️ Cetak Tes
            </a>

            <a
              href={`/cetak-non-kelas/bulk?jenis=${encodeURIComponent(selectedItem.bulkFilter)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700"
            >
              🖨️ Cetak Bulk {selectedItem.label} ({selectedItem.count})
            </a>
          </div>
        </div>
      )}

      {/* Unified WYSIWYG F4 Landscape Workspace */}
      {selectedItem && (
        <SyahadahNonKelasWorkspace
          key={selectedKey}
          programKey={selectedKey}
          titleLabel={`Layout Non-Kelas — ${selectedItem.label}`}
          texts={dummyTexts}
          qrUrl={dummyQrUrl}
          signatureUrl={dummySignatureUrl}
          stampUrl={dummyStampUrl}
          backgroundUrl={bg}
          positions={positions}
          onPositionsChange={setPositions}
          offsetX={offsetX}
          offsetY={offsetY}
          onOffsetXChange={setOffsetX}
          onOffsetYChange={setOffsetY}
          locked={locked}
          onToggleLock={handleToggleLock}
          locking={locking}
          canEdit
          initialEditorActive
          onSave={handleSaveLayout}
          saving={saving}
          embedded
          historyResetKey={loadSeq}
        />
      )}
    </div>
  );
}
