"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  OFFLINE_FIELD_KEYS,
  OFFLINE_FIELD_LABEL,
  OFFLINE_FIELD_SAMPLE,
  OFFLINE_QR_MM,
  OFFLINE_STAGE_W_MM,
  defaultFieldPositionsOffline,
} from "@/lib/syahadah-offline";

// Tab "Template Offline" syahadah A4 portrait (kertas pre-printed).
// Cermin tab Template Nadi/Lajnah, dengan perbedaan:
// - panggung portrait 210 x 297 mm (bukan landscape 330 x 215);
// - font tersimpan dalam PT (bukan px-di-1600);
// - 15 item drag: 11 teks + QR + 3 baris nilai;
// - pemetaan baris tabel -> mapel, kunci template, offset global X/Y (mm)
//   untuk kalibrasi printer.
export default function TemplateSyahadahOfflineTab({
  programKey,
  apiBase,
  canEdit,
  mapels,
}: {
  programKey: string;
  apiBase: string;
  canEdit: boolean;
  mapels: Array<{ id: string; nama_indo: string; nama_arab: string }>;
}) {
  const [bg, setBg] = useState<string | null>(null);
  const [positions, setPositions] = useState<Record<string, any>>({});
  const [locked, setLocked] = useState(false);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locking, setLocking] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<any>(null);

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
  };
  useEffect(() => { load(); }, [programKey]);

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
        body: JSON.stringify({ programKey, fieldPositions: positions, offsetX, offsetY }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan");
      toast.success("Layout tersimpan");
    } catch (e: any) {
      toast.error(e.message);
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
      toast.success(locked ? "Template dibuka — bisa diubah lagi" : "Template dikunci");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLocking(false);
    }
  };

  const onChipDown = (e: React.PointerEvent, key: string) => {
    if (!canEdit || locked || !wrapRef.current) return;
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

  const setTabelMapel = (baris: string, mapelId: string) =>
    setPositions((p: any) => ({
      ...p,
      tabelMapel: { ...(p.tabelMapel || {}), [baris]: mapelId || null },
    }));

  const editable = canEdit && !locked;
  const tabelMapel = positions.tabelMapel || {};

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border p-5 space-y-3">
        <h3 className="font-bold">Background Desain (A4 Portrait)</h3>
        {locked && (
          <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Template terkunci setelah kalibrasi. Buka kunci untuk mengubah desain atau posisi.
          </p>
        )}
        {canEdit && !locked && (
          <label className="inline-block px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white font-bold cursor-pointer hover:opacity-90">
            {uploading ? "Mengupload..." : "Upload Desain Baru"}
            <input type="file" accept="image/*" className="hidden" onChange={upload} disabled={uploading} />
          </label>
        )}
        <p className="text-xs text-[var(--color-text-muted)]">
          Ekspor Canva ukuran A4 portrait (JPG/PNG), maksimal 10MB. Tersimpan di Cloudinary.
          Background ini HANYA preview di editor &amp; unduhan santri — saat admin mencetak
          di kertas pre-printed, background TIDAK ikut tercetak.
        </p>
      </div>

      <div className="bg-white rounded-2xl border p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold">
            Atur Posisi Field {editable && <span className="font-normal text-sm text-[var(--color-text-muted)]">(geser label di atas desain)</span>}
          </h3>
          {canEdit && (
            <button onClick={toggleLock} disabled={locking}
              className={`px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50 ${locked ? "bg-amber-600 text-white" : "bg-slate-200 text-slate-700"}`}>
              {locking ? "Menyimpan..." : locked ? "Buka Kunci Template" : "Kunci Template"}
            </button>
          )}
        </div>
        {!bg ? (
          <p className="text-sm text-[var(--color-text-muted)]">Upload background terlebih dahulu.</p>
        ) : (
          <>
            <div
              ref={wrapRef}
              className="relative w-full max-w-xl mx-auto border rounded-xl overflow-hidden select-none touch-none"
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={bg} alt="Template" className="w-full block" draggable={false} />
              {OFFLINE_FIELD_KEYS.map((key) => {
                const cfg = positions[key] || { x: 50, y: 50 };
                return (
                  <div
                    key={key}
                    onPointerDown={(e) => onChipDown(e, key)}
                    className={`absolute px-2 py-1 rounded text-xs font-bold border-2 whitespace-nowrap ${
                      editable ? "cursor-move bg-yellow-300/90 border-yellow-600" : "bg-white/80 border-slate-400"
                    }`}
                    style={{
                      left: `${cfg.x}%`, top: `${cfg.y}%`, transform: "translate(-50%, -50%)",
                      fontFamily: cfg.fontFamily || undefined, color: cfg.color || undefined,
                    }}
                  >
                    {OFFLINE_FIELD_SAMPLE[key]}
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {OFFLINE_FIELD_KEYS.map((key) => {
                const cfg = positions[key] || {};
                const isQr = key === "qr";
                return (
                  <div key={key} className="border rounded-xl p-3 space-y-2">
                    <p className="font-bold text-sm">{OFFLINE_FIELD_LABEL[key]}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <label>X (%)
                        <input type="number" step="0.5" value={cfg.x ?? 50}
                          onChange={(e) => setField(key, { x: Number(e.target.value) })}
                          disabled={!editable} className="w-full px-2 py-1 border rounded" />
                      </label>
                      <label>Y (%)
                        <input type="number" step="0.5" value={cfg.y ?? 50}
                          onChange={(e) => setField(key, { y: Number(e.target.value) })}
                          disabled={!editable} className="w-full px-2 py-1 border rounded" />
                      </label>
                      {isQr ? (
                        <label>Ukuran (mm)
                          <input type="number" step="1"
                            value={Math.round(((cfg.maxWidth ?? 10.5) / 100) * OFFLINE_STAGE_W_MM)}
                            onChange={(e) => setField(key, { maxWidth: (Number(e.target.value) / OFFLINE_STAGE_W_MM) * 100 })}
                            disabled={!editable} className="w-full px-2 py-1 border rounded" />
                        </label>
                      ) : (
                        <label>Font (pt)
                          <input type="number" value={cfg.fontSize ?? 13}
                            onChange={(e) => setField(key, { fontSize: Number(e.target.value) })}
                            disabled={!editable} className="w-full px-2 py-1 border rounded" />
                        </label>
                      )}
                      <label>Lebar maks (%)
                        <input type="number" value={cfg.maxWidth ?? 80}
                          onChange={(e) => setField(key, { maxWidth: Number(e.target.value) })}
                          disabled={!editable} className="w-full px-2 py-1 border rounded" />
                      </label>
                      {!isQr && (
                        <>
                          <label className="col-span-2">Font (nama family, diatur lewat web)
                            <input type="text" value={cfg.fontFamily ?? ""}
                              placeholder="cth: The Season / Poppins"
                              onChange={(e) => setField(key, { fontFamily: e.target.value })}
                              disabled={!editable} className="w-full px-2 py-1 border rounded" />
                          </label>
                          <label className="col-span-2">Warna
                            <span className="flex gap-2">
                              <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(cfg.color || "") ? cfg.color : "#000000"}
                                onChange={(e) => setField(key, { color: e.target.value })}
                                disabled={!editable} className="w-10 h-8 px-1 border rounded cursor-pointer" />
                              <input type="text" value={cfg.color ?? ""}
                                placeholder="#865b34"
                                onChange={(e) => setField(key, { color: e.target.value })}
                                disabled={!editable} className="flex-1 px-2 py-1 border rounded" />
                            </span>
                          </label>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border rounded-xl p-4 space-y-3">
              <h4 className="font-bold text-sm">Tabel Nilai — mapel tiap baris</h4>
              <p className="text-xs text-[var(--color-text-muted)]">
                Nama mapel sudah tercetak di kertas; web hanya mengisi kolom nilainya.
                Pilih mapel untuk tiap baris (kosongkan bila baris tidak dipakai).
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {(["baris1", "baris2", "baris3"] as const).map((baris, i) => (
                  <label key={baris}>Baris {i + 1}
                    <select
                      value={tabelMapel[baris] || ""}
                      onChange={(e) => setTabelMapel(baris, e.target.value)}
                      disabled={!editable}
                      className="w-full px-2 py-1 border rounded"
                    >
                      <option value="">— tidak dipakai —</option>
                      {mapels.map((m) => (
                        <option key={m.id} value={m.id}>{m.nama_indo}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>

            <div className="border rounded-xl p-4 space-y-3">
              <h4 className="font-bold text-sm">Offset Printer (kalibrasi)</h4>
              <p className="text-xs text-[var(--color-text-muted)]">
                Geser SELURUH isi cetakan bila hasil print meleset dari garis kertas
                (mis. printer menarik kertas sedikit miring/bergeser). Diterapkan saat
                mencetak admin, bukan di preview ini. Setelah kalibrasi selesai,
                kunci template.
              </p>
              <div className="grid grid-cols-2 gap-3 text-xs max-w-sm">
                <label>Offset X (mm)
                  <input type="number" step="0.5" value={offsetX}
                    onChange={(e) => setOffsetX(Number(e.target.value))}
                    disabled={!editable} className="w-full px-2 py-1 border rounded" />
                </label>
                <label>Offset Y (mm)
                  <input type="number" step="0.5" value={offsetY}
                    onChange={(e) => setOffsetY(Number(e.target.value))}
                    disabled={!editable} className="w-full px-2 py-1 border rounded" />
                </label>
              </div>
            </div>

            {canEdit && (
              <button onClick={savePositions} disabled={saving || locked}
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
