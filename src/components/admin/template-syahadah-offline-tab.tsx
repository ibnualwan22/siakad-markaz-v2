"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  OFFLINE_DEFAULT_FONT_FAMILY,
  OFFLINE_FIELD_KEYS,
  OFFLINE_FIELD_LABEL,
  OFFLINE_FIELD_SAMPLE,
  OFFLINE_STAGE_H_MM,
  OFFLINE_STAGE_W_MM,
  OFFLINE_STAGE_W_PX,
  defaultFieldPositionsOffline,
} from "@/lib/syahadah-offline";
import SyahadahOfflineStage from "@/components/cetak/SyahadahOfflineStage";

// Tab "Template Offline" syahadah A4 portrait (kertas pre-printed).
// Preview editor memakai komponen panggung yang SAMA PERSIS dengan
// halaman cetak (SyahadahOfflineStage) — jadi atur layout = print preview:
// panggung 210 x 297 mm, font pt, posisi % -> mm, font default Amiri.
// Field ditampilkan sebagai teks asli (bukan kotak kuning) dan bisa
// di-drag; field terpilih diberi outline. Zoom + offset printer bisa
// ditampilkan langsung di preview.
export default function TemplateSyahadahOfflineTab({
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
  const [locked, setLocked] = useState(false);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locking, setLocking] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [zoom, setZoom] = useState<"fit" | 50 | 75 | 100>("fit");
  const [showOffset, setShowOffset] = useState(true);
  const [fitScale, setFitScale] = useState(1);
  const wrapRef = useRef<HTMLDivElement>(null);

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

  // Skala "Pas": panggung 210mm menyesuaikan lebar wadah, maksimal 100%
  // (ukuran sebenarnya). Zoom 50/75/100% memakai skala tetap.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setFitScale(Math.min(1, el.clientWidth / OFFLINE_STAGE_W_PX));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = zoom === "fit" ? fitScale : zoom / 100;

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

  const setField = (key: string, patch: any) =>
    setPositions((p: any) => ({ ...p, [key]: { ...p[key], ...patch } }));

  const editable = canEdit && !locked;

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
            Atur Posisi Field {editable && <span className="font-normal text-sm text-[var(--color-text-muted)]">(geser teks di atas desain — tampilannya sama persis dengan hasil print)</span>}
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
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold">Zoom:</span>
              {(["fit", 50, 75, 100] as const).map((z) => (
                <button
                  key={String(z)}
                  onClick={() => setZoom(z)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                    zoom === z ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-700 border-slate-300"
                  }`}
                >
                  {z === "fit" ? "Pas" : `${z}%`}
                </button>
              ))}
              <label className="ml-auto flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOffset}
                  onChange={(e) => setShowOffset(e.target.checked)}
                />
                Tampilkan offset printer di preview
              </label>
            </div>

            <div ref={wrapRef} className="overflow-x-auto border rounded-xl bg-slate-100 p-2">
              <div
                className="relative mx-auto"
                style={{
                  width: `${OFFLINE_STAGE_W_MM}mm`,
                  height: `${OFFLINE_STAGE_H_MM}mm`,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                  marginBottom: `${-OFFLINE_STAGE_H_MM * (1 - scale)}mm`,
                }}
              >
                <SyahadahOfflineStage
                  texts={OFFLINE_FIELD_SAMPLE}
                  qrDataUrl={null}
                  template={{ backgroundUrl: bg, fieldPositions: positions, offsetX, offsetY }}
                  showBackground
                  hideBackgroundOnPrint={false}
                  applyOffset={showOffset}
                  showQrPlaceholder
                  editable={editable}
                  selectedKey={selectedKey}
                  onSelectKey={setSelectedKey}
                  onFieldMove={(key, x, y) => setField(key, { x, y })}
                />
              </div>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              Klik teks untuk memilih, geser untuk memindah. Ukuran font di preview ini
              sudah memakai nilai pt yang tersimpan (font default {OFFLINE_DEFAULT_FONT_FAMILY}).
              Zoom 100% = ukuran sebenarnya di kertas A4.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {OFFLINE_FIELD_KEYS.map((key) => {
                const cfg = positions[key] || {};
                const isQr = key === "qr";
                const isSelected = selectedKey === key;
                return (
                  <div
                    key={key}
                    onClick={() => setSelectedKey(key)}
                    className={`border rounded-xl p-3 space-y-2 cursor-pointer ${isSelected ? "ring-2 ring-emerald-500" : ""}`}
                  >
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
                          <label className="col-span-2">Font (nama family, kosong = {OFFLINE_DEFAULT_FONT_FAMILY})
                            <input type="text" value={cfg.fontFamily ?? ""}
                              placeholder={`${OFFLINE_DEFAULT_FONT_FAMILY} (default)`}
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

            <div className="border rounded-xl p-4 space-y-2">
              <h4 className="font-bold text-sm">Tabel Nilai — mengikuti settingan syahadah</h4>
              <p className="text-xs text-[var(--color-text-muted)]">
                Nama mapel sudah tercetak di kertas; web hanya mengisi kolom nilainya.
                Slot 1–12 otomatis terisi dari mapel yang tampil di syahadah
                (pengaturan tampil di syahadah di pengelola mapel program), dengan
                urutan yang sama — tanpa pemetaan manual. Geser posisi tiap slot
                (Nilai Slot 1–12) seperti field lain di atas.
              </p>
            </div>

            <div className="border rounded-xl p-4 space-y-3">
              <h4 className="font-bold text-sm">Offset Printer (kalibrasi)</h4>
              <p className="text-xs text-[var(--color-text-muted)]">
                Geser SELURUH isi cetakan bila hasil print meleset dari garis kertas
                (mis. printer menarik kertas sedikit miring/bergeser). Aktifkan
                &ldquo;Tampilkan offset printer di preview&rdquo; di atas untuk melihat
                geserannya langsung di panggung. Setelah kalibrasi selesai,
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
