"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

// Tab "Template & Layout" syahadah organisasi (Lajnah & OSIM) — cermin tab
// Template Nadi Hufadz, ditambah input font & warna per field.
// Field syahadah organisasi: nama, periode, tglCetak.
const FIELD_KEYS = ["nama", "periode", "tglCetak"] as const;
const FIELD_SAMPLE: Record<string, string> = {
  nama: "Nama Santri",
  periode: "11 September 2026 – 05 Oktober 2026",
  tglCetak: "05 Oktober 2026",
};

export default function TemplateSyahadahTab({
  programKey,
  apiBase,
  canEdit,
}: {
  programKey: string;
  apiBase: string;
  canEdit: boolean;
}) {
  const [bg, setBg] = useState<string | null>(null);
  const [positions, setPositions] = useState<Record<string, any>>({});
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<any>(null);

  const load = async () => {
    const res = await fetch(`${apiBase}?programKey=${programKey}`);
    if (!res.ok) return;
    const tpl = await res.json();
    setBg(tpl.backgroundUrl);
    setPositions(tpl.fieldPositions || {});
  };
  useEffect(() => { load(); }, []);

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
        body: JSON.stringify({ programKey, backgroundUrl: url, backgroundId: publicId }),
      });
      if (!put.ok) throw new Error("Gagal menyimpan template");
      setBg(url);
      toast.success("Background terupload");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const savePositions = async () => {
    setSaving(true);
    try {
      const res = await fetch(apiBase, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programKey, fieldPositions: positions }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan");
      toast.success("Layout tersimpan");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const onChipDown = (e: React.PointerEvent, key: string) => {
    if (!canEdit || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    dragRef.current = {
      key, startX: e.clientX, startY: e.clientY,
      origX: positions[key]?.x ?? 50, origY: positions[key]?.y ?? 50,
      w: rect.width, h: rect.height,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const nx = Math.min(100, Math.max(0, d.origX + ((e.clientX - d.startX) / d.w) * 100));
    const ny = Math.min(100, Math.max(0, d.origY + ((e.clientY - d.startY) / d.h) * 100));
    setPositions((p: any) => ({ ...p, [d.key]: { ...p[d.key], x: Math.round(nx * 10) / 10, y: Math.round(ny * 10) / 10 } }));
  };
  const onUp = () => { dragRef.current = null; };

  const setField = (key: string, patch: any) =>
    setPositions((p: any) => ({ ...p, [key]: { ...p[key], ...patch } }));

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border p-5 space-y-3">
        <h3 className="font-bold">Background Desain</h3>
        {canEdit && (
          <label className="inline-block px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white font-bold cursor-pointer hover:opacity-90">
            {uploading ? "Mengupload..." : "Upload Desain Baru"}
            <input type="file" accept="image/*" className="hidden" onChange={upload} disabled={uploading} />
          </label>
        )}
        <p className="text-xs text-[var(--color-text-muted)]">Format gambar (JPG/PNG), maksimal 10MB. Tersimpan di Cloudinary.</p>
      </div>

      <div className="bg-white rounded-2xl border p-5 space-y-4">
        <h3 className="font-bold">Atur Posisi Field {canEdit && <span className="font-normal text-sm text-[var(--color-text-muted)]">(geser label di atas desain)</span>}</h3>
        {!bg ? (
          <p className="text-sm text-[var(--color-text-muted)]">Upload background terlebih dahulu.</p>
        ) : (
          <>
            <div
              ref={wrapRef}
              className="relative w-full max-w-3xl mx-auto border rounded-xl overflow-hidden select-none touch-none"
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={bg} alt="Template" className="w-full block" draggable={false} />
              {FIELD_KEYS.map((key) => {
                const cfg = positions[key] || { x: 50, y: 50 };
                return (
                  <div
                    key={key}
                    onPointerDown={(e) => onChipDown(e, key)}
                    className={`absolute px-2 py-1 rounded text-xs font-bold border-2 whitespace-nowrap ${
                      canEdit ? "cursor-move bg-yellow-300/90 border-yellow-600" : "bg-white/80 border-slate-400"
                    }`}
                    style={{
                      left: `${cfg.x}%`, top: `${cfg.y}%`, transform: "translate(-50%, -50%)",
                      fontFamily: cfg.fontFamily || undefined, color: cfg.color || undefined,
                    }}
                  >
                    {FIELD_SAMPLE[key]}
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {FIELD_KEYS.map((key) => {
                const cfg = positions[key] || {};
                return (
                  <div key={key} className="border rounded-xl p-3 space-y-2">
                    <p className="font-bold text-sm capitalize">{key === "tglCetak" ? "Tanggal Cetak" : key}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <label>X (%)
                        <input type="number" step="0.5" value={cfg.x ?? 50}
                          onChange={(e) => setField(key, { x: Number(e.target.value) })}
                          disabled={!canEdit} className="w-full px-2 py-1 border rounded" />
                      </label>
                      <label>Y (%)
                        <input type="number" step="0.5" value={cfg.y ?? 50}
                          onChange={(e) => setField(key, { y: Number(e.target.value) })}
                          disabled={!canEdit} className="w-full px-2 py-1 border rounded" />
                      </label>
                      <label>Font (px)
                        <input type="number" value={cfg.fontSize ?? 28}
                          onChange={(e) => setField(key, { fontSize: Number(e.target.value) })}
                          disabled={!canEdit} className="w-full px-2 py-1 border rounded" />
                      </label>
                      <label>Lebar maks (%)
                        <input type="number" value={cfg.maxWidth ?? 80}
                          onChange={(e) => setField(key, { maxWidth: Number(e.target.value) })}
                          disabled={!canEdit} className="w-full px-2 py-1 border rounded" />
                      </label>
                      <label className="col-span-2">Font (nama family, diatur lewat web)
                        <input type="text" value={cfg.fontFamily ?? ""}
                          placeholder="cth: The Season / Poppins"
                          onChange={(e) => setField(key, { fontFamily: e.target.value })}
                          disabled={!canEdit} className="w-full px-2 py-1 border rounded" />
                      </label>
                      <label className="col-span-2">Warna
                        <span className="flex gap-2">
                          <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(cfg.color || "") ? cfg.color : "#000000"}
                            onChange={(e) => setField(key, { color: e.target.value })}
                            disabled={!canEdit} className="w-10 h-8 px-1 border rounded cursor-pointer" />
                          <input type="text" value={cfg.color ?? ""}
                            placeholder="#865b34"
                            onChange={(e) => setField(key, { color: e.target.value })}
                            disabled={!canEdit} className="flex-1 px-2 py-1 border rounded" />
                        </span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>

            {canEdit && (
              <button onClick={savePositions} disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold disabled:opacity-50">
                {saving ? "Menyimpan..." : "Simpan Layout"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
