"use client";

import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { TemplateStage, TemplateStageZoom } from "@/components/cetak/TemplateStage";
import { normalizeFieldPositions } from "@/lib/template-layout";
import {
  AKBARNAS_MC_FIELD_KEYS,
  AKBARNAS_MC_FIELD_LABEL,
  AKBARNAS_MC_PEMBUKA,
  AKBARNAS_MC_PENGHARGAAN,
  AKBARNAS_MC_TAHUN_AJARAN,
  AKBARNAS_MC_TAUQI,
  formatTanggalPemberianMC,
} from "@/lib/akbarnas-mc";

// Editor layout syahadah MC saja. Daftar & pencetakan TIDAK di sini
// lagi — sudah pindah ke Data Syahadah (/admin/syahadah), tempat admin
// biasa mencetak (per santri maupun bulk); halaman ini hanya mengatur
// template yang dipakai cetakan itu.
export default function AkbarnasMcClient({
  namaMudir,
  initialBg,
  initialPositions,
}: {
  namaMudir: string;
  initialBg: string | null;
  initialPositions: Record<string, any>;
}) {
  const [bg, setBg] = useState<string | null>(initialBg);
  // Posisi dinormalisasi ke mm saat load (data lama %/px dikonversi);
  // saat save, units:"mm" ikut tersimpan di fieldPositions.
  const [positions, setPositions] = useState<Record<string, any>>(() => normalizeFieldPositions(initialPositions));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Panggung preview memakai TemplateStage (330 x 215 mm, posisi mm) —
  // komponen yang sama dengan halaman cetak, supaya preview sebangun
  // dengan hasil print seperti syahadah offline.
  const dragRef = useRef<any>(null);

  // Upload background khusus template MC (Cloudinary) lalu simpan
  // sebagai backgroundUrl template ini saja.
  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("programKey", "akbarnas-mc");
      const res = await fetch("/api/admin/akbarnas-mc/template/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.json()).error || "Gagal upload");
      const { url, publicId } = await res.json();
      const put = await fetch("/api/admin/akbarnas-mc/template", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programKey: "akbarnas-mc", backgroundUrl: url, backgroundId: publicId }),
      });
      if (!put.ok) throw new Error("Gagal menyimpan template");
      setBg(url);
      toast.success("Background terupload");
    } catch (err: any) {
      toast.error(err.message || "Gagal upload");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const savePositions = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/akbarnas-mc/template", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programKey: "akbarnas-mc", fieldPositions: positions }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan");
      toast.success("Layout tersimpan");
    } catch {
      toast.error("Gagal menyimpan layout");
    } finally {
      setSaving(false);
    }
  };

  const onFieldDown = (e: React.PointerEvent, key: string) => {
    // Rect diukur dari elemen .template-stage terdekat (sudah termasuk
    // zoom layar), lalu geseran diubah ke mm panggung 330 x 215.
    const stage = (e.target as HTMLElement).closest(".template-stage");
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    dragRef.current = {
      key, startX: e.clientX, startY: e.clientY,
      origX: positions[key]?.x ?? 165, origY: positions[key]?.y ?? 107.5,
      w: rect.width, h: rect.height,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const nx = Math.min(330, Math.max(0, d.origX + ((e.clientX - d.startX) / d.w) * 330));
    const ny = Math.min(215, Math.max(0, d.origY + ((e.clientY - d.startY) / d.h) * 215));
    setPositions((p: any) => ({ ...p, [d.key]: { ...p[d.key], x: Math.round(nx * 10) / 10, y: Math.round(ny * 10) / 10 } }));
  };
  const onUp = () => { dragRef.current = null; };

  const setField = (key: string, patch: any) =>
    setPositions((p: any) => ({ ...p, [key]: { ...p[key], ...patch } }));

  // Data contoh preview — SAMA seperti yang dirender halaman cetak,
  // hanya namanya contoh (bukan santri baru).
  const sample: Record<string, string> = {
    pembuka: AKBARNAS_MC_PEMBUKA,
    nama: "Ahmad Ibnu Alwan",
    penghargaan: AKBARNAS_MC_PENGHARGAAN,
    tahunAjaran: AKBARNAS_MC_TAHUN_AJARAN,
    tanggalPemberian: formatTanggalPemberianMC(new Date()),
    tauqi: AKBARNAS_MC_TAUQI,
    namaMudir,
  };

  return (
    <div className="space-y-6">
        <div className="bg-white rounded-2xl border p-5 space-y-4">
          <h3 className="font-bold">Atur Posisi & Ukuran Field <span className="font-normal text-sm text-[var(--color-text-muted)]">(geser teks di atas desain)</span></h3>
          <p className="text-xs text-[var(--color-text-muted)]">
            Background default memakai desain syahadah offline persis dan hanya berlaku untuk template MC ini.
            Preview memakai data contoh dengan gaya field asli —
            tanggal pemberian di preview dihitung dari hari ini, sama seperti saat mencetak nanti.
          </p>
          <label className="inline-block px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white font-bold cursor-pointer hover:opacity-90">
            {uploading ? "Mengupload..." : "Upload Desain Baru"}
            <input type="file" accept="image/*" className="hidden" onChange={upload} disabled={uploading} />
          </label>
          <p className="text-xs text-[var(--color-text-muted)]">Format gambar (JPG/PNG), maksimal 10MB. Tersimpan di Cloudinary, hanya untuk template MC.</p>
          {!bg ? (
            <p className="text-sm text-[var(--color-text-muted)]">Template belum memiliki background.</p>
          ) : (
            <>
              <div
                className="relative w-full max-w-3xl mx-auto border rounded-xl overflow-hidden select-none touch-none"
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
              >
                <TemplateStageZoom>
                  <TemplateStage
                    programKey="akbarnas-mc"
                    backgroundUrl={bg}
                    fieldPositions={positions}
                    fieldKeys={[...AKBARNAS_MC_FIELD_KEYS]}
                    texts={sample}
                    signatureUrl="/images/signature.png"
                    editorMode
                    onFieldPointerDown={onFieldDown}
                  />
                </TemplateStageZoom>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {AKBARNAS_MC_FIELD_KEYS.map((key) => {
                  const cfg = positions[key] || {};
                  const isSig = key === "tandaTangan";
                  return (
                    <div key={key} className="border rounded-xl p-3 space-y-2">
                      <p className="font-bold text-sm">{AKBARNAS_MC_FIELD_LABEL[key]}</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <label>X (mm)
                          <input type="number" step="0.5" value={cfg.x ?? 165}
                            onChange={(e) => setField(key, { x: Number(e.target.value) })}
                            className="w-full px-2 py-1 border rounded" />
                        </label>
                        <label>Y (mm)
                          <input type="number" step="0.5" value={cfg.y ?? 107.5}
                            onChange={(e) => setField(key, { y: Number(e.target.value) })}
                            className="w-full px-2 py-1 border rounded" />
                        </label>
                        {!isSig && (
                          <label>Font (px)
                            <input type="number" value={cfg.fontSize ?? 28}
                              onChange={(e) => setField(key, { fontSize: Number(e.target.value) })}
                              className="w-full px-2 py-1 border rounded" />
                          </label>
                        )}
                        <label>{isSig ? "Lebar (mm, panggung)" : "Lebar maks (mm)"}
                          <input type="number" value={cfg.maxWidth ?? 264}
                            onChange={(e) => setField(key, { maxWidth: Number(e.target.value) })}
                            className="w-full px-2 py-1 border rounded" />
                        </label>
                        {!isSig && (
                          <>
                            <label className="col-span-2">Font (nama family)
                              <input type="text" value={cfg.fontFamily ?? ""}
                                placeholder="cth: Poppins"
                                onChange={(e) => setField(key, { fontFamily: e.target.value })}
                                className="w-full px-2 py-1 border rounded" />
                            </label>
                            <label className="col-span-2">Warna
                              <span className="flex gap-2">
                                <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(cfg.color || "") ? cfg.color : "#000000"}
                                  onChange={(e) => setField(key, { color: e.target.value })}
                                  className="w-10 h-8 px-1 border rounded cursor-pointer" />
                                <input type="text" value={cfg.color ?? ""}
                                  placeholder="#000000"
                                  onChange={(e) => setField(key, { color: e.target.value })}
                                  className="flex-1 px-2 py-1 border rounded" />
                              </span>
                            </label>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button onClick={savePositions} disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold disabled:opacity-50">
                {saving ? "Menyimpan..." : "Simpan Layout"}
              </button>
            </>
          )}
        </div>
    </div>
  );
}
