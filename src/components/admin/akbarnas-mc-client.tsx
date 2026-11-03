"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  AKBARNAS_MC_FIELD_KEYS,
  AKBARNAS_MC_FIELD_LABEL,
  AKBARNAS_MC_JUDUL,
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
  const [positions, setPositions] = useState<Record<string, any>>(initialPositions);
  const [saving, setSaving] = useState(false);
  const [imgRatio, setImgRatio] = useState(1869 / 2870);
  const [scale, setScale] = useState(1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<any>(null);

  useEffect(() => {
    if (!bg) return;
    const img = new Image();
    img.onload = () => setImgRatio(img.naturalHeight / img.naturalWidth);
    img.src = bg;
  }, [bg]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / 1600));
    ro.observe(el);
    return () => ro.disconnect();
  }, [bg]);

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
    if (!wrapRef.current) return;
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

  // Data contoh preview — SAMA seperti yang dirender halaman cetak,
  // hanya namanya contoh (bukan santri baru).
  const sample: Record<string, string> = {
    judul: AKBARNAS_MC_JUDUL,
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
            Background memakai desain syahadah offline persis. Preview memakai data contoh dengan gaya field asli —
            tanggal pemberian di preview dihitung dari hari ini, sama seperti saat mencetak nanti.
          </p>
          {!bg ? (
            <p className="text-sm text-[var(--color-text-muted)]">Template belum memiliki background.</p>
          ) : (
            <>
              <div
                ref={wrapRef}
                className="relative w-full max-w-3xl mx-auto border rounded-xl overflow-hidden select-none touch-none"
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
              >
                <div
                  className="relative overflow-hidden bg-white"
                  style={{
                    width: 1600,
                    height: Math.round(1600 * imgRatio),
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                    marginBottom: -Math.round(1600 * imgRatio) * (1 - scale),
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={bg} alt="Template" className="absolute inset-0 w-full h-full object-fill" draggable={false} />
                  {AKBARNAS_MC_FIELD_KEYS.map((key) => {
                    const cfg = positions[key] || { x: 50, y: 50 };
                    const maxW = ((cfg.maxWidth ?? 80) / 100) * 1600;
                    if (key === "tandaTangan") {
                      return (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={key}
                          src="/images/signature.png"
                          alt="Tanda tangan"
                          draggable={false}
                          onPointerDown={(e) => onFieldDown(e, key)}
                          className="absolute cursor-move border border-dashed border-transparent hover:border-amber-500"
                          style={{
                            left: `${cfg.x}%`, top: `${cfg.y}%`,
                            transform: "translate(-50%, -50%)", width: maxW,
                          }}
                        />
                      );
                    }
                    return (
                      <div
                        key={key}
                        onPointerDown={(e) => onFieldDown(e, key)}
                        className="absolute cursor-move border border-dashed border-transparent hover:border-amber-500"
                        style={{
                          left: `${cfg.x}%`, top: `${cfg.y}%`, transform: "translate(-50%, -50%)",
                          width: maxW, textAlign: cfg.align || "center", direction: "rtl",
                          fontFamily: cfg.fontFamily || undefined, color: cfg.color || undefined,
                          fontSize: cfg.fontSize ?? 28,
                          fontWeight: key === "nama" || key === "judul" ? 700 : undefined,
                          lineHeight: 1.4, whiteSpace: "pre-line",
                        }}
                      >
                        {sample[key]}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {AKBARNAS_MC_FIELD_KEYS.map((key) => {
                  const cfg = positions[key] || {};
                  const isSig = key === "tandaTangan";
                  return (
                    <div key={key} className="border rounded-xl p-3 space-y-2">
                      <p className="font-bold text-sm">{AKBARNAS_MC_FIELD_LABEL[key]}</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <label>X (%)
                          <input type="number" step="0.5" value={cfg.x ?? 50}
                            onChange={(e) => setField(key, { x: Number(e.target.value) })}
                            className="w-full px-2 py-1 border rounded" />
                        </label>
                        <label>Y (%)
                          <input type="number" step="0.5" value={cfg.y ?? 50}
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
                        <label>{isSig ? "Lebar (%, panggung)" : "Lebar maks (%)"}
                          <input type="number" value={cfg.maxWidth ?? 80}
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
