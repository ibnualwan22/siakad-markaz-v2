"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import AutoFitText from "./AutoFitText";
import MunaqosahNilaiTable from "./MunaqosahNilaiTable";
import { NADI_HUFADZ_WARNA_NAMA } from "@/lib/nadi-hufadz";
import { toArabDigits } from "@/lib/munaqosah-hufadz";
import {
  STAGE_H_MM,
  STAGE_W_MM,
  STAGE_W_PX,
  mmToPxRef,
  normalizeFieldPositions,
  pxRefToMm,
} from "@/lib/template-layout";

// Komponen dokumen template bersama — SATU jalur render untuk editor
// layout keempat program dan halaman cetak, dengan geometri yang sama
// persis seperti syahadah offline: panggung 330 x 215 mm, posisi field
// dalam mm, font dirender dalam mm. Nilai fontSize yang tersimpan TIDAK
// diubah (tetap angka referensi lama) dan baru dikonversi ke mm saat
// render, sehingga input font editor dan data lama tetap sama.

export const FIELD_LABEL: Record<string, string> = {
  nama: "Nama",
  juz: "Juz",
  predikat: "Predikat",
  periode: "Periode",
  tglCetak: "Tanggal Cetak",
  // Syahadah MC Akbarnas bulan 1 (field lain programKey tidak punya
  // cfg-nya sehingga renderField mengembalikan null untuk mereka).
  pembuka: "Teks Pembuka",
  penghargaan: "Teks Penghargaan",
  tahunAjaran: "Tahun Ajaran",
  tanggalPemberian: "Tanggal Pemberian",
  tauqi: "Label Tanda Tangan",
  tandaTangan: "Gambar Tanda Tangan",
  namaMudir: "Nama Mudir",
  // Syahadah Munaqosah Hufadz (field lain programKey tidak punya
  // cfg-nya sehingga renderField mengembalikan null untuk mereka).
  kalimatJuz: "Kalimat Juz",
  periodeLine: "Baris Periode",
  tanggalPeriodeLine: "Baris Tanggal Periode",
  doa: "Doa Penutup",
  tabelNilai: "Tabel Nilai",
  rataRata: "Rata-rata & Predikat",
  tanggalCetak: "Tanggal Cetak",
  qrLabel: "Label QR",
  qr: "Gambar QR",
};

export type TemplateFieldCfg = {
  x?: number; // mm (setelah normalisasi)
  y?: number; // mm (setelah normalisasi)
  maxWidth?: number; // mm (setelah normalisasi)
  fontSize?: number; // angka referensi lama (TIDAK diubah)
  align?: string;
  fontFamily?: string;
  color?: string;
};

export type TemplateTabelNilai = {
  rows: { arab: string; nilai: number }[];
  rataRata: number;
  predikat: string;
} | null;

export function TemplateStage({
  programKey,
  backgroundUrl,
  fieldPositions,
  fieldKeys,
  texts,
  signatureUrl,
  qrUrl,
  tabelNilai,
  editorMode,
  defaultFontSize = 28,
  onFieldPointerDown,
  className,
}: {
  programKey: string;
  backgroundUrl: string | null;
  fieldPositions: Record<string, any>; // mentah (lama %/px atau baru mm) — dinormalisasi di sini
  fieldKeys?: string[]; // default: semua FIELD_LABEL (dipakai halaman cetak)
  texts: Record<string, string>;
  signatureUrl?: string | null;
  qrUrl?: string | null;
  tabelNilai?: TemplateTabelNilai;
  editorMode?: boolean;
  defaultFontSize?: number;
  onFieldPointerDown?: (e: React.PointerEvent, key: string) => void;
  className?: string;
}) {
  // Pembacaan tahan data lama: posisi %/px dikonversi ke mm di sini,
  // sehingga editor maupun cetak selalu menerima geometri mm.
  const positions = useMemo(
    () => normalizeFieldPositions(fieldPositions),
    [fieldPositions]
  );
  const keys = fieldKeys || Object.keys(FIELD_LABEL);

  // Nadi, MC Akbarnas, Munaqosah, & Tadrib Funun memakai teks Arab (rtl);
  // syahadah organisasi memakai teks Latin (ltr).
  const fieldDirection =
    programKey === "nadi-hufadz" || programKey === "akbarnas-mc" || programKey === "munaqosah-hufadz" || programKey.startsWith("tadrib-funun-")
      ? "rtl"
      : "ltr";

  const renderField = (key: string) => {
    const cfg = (positions as any)[key] as TemplateFieldCfg | undefined;
    const editorCls = editorMode
      ? `absolute border border-dashed border-transparent hover:border-amber-500 ${
          onFieldPointerDown ? "cursor-move" : ""
        }`
      : "absolute";
    const editorProps = editorMode && onFieldPointerDown
      ? { onPointerDown: (e: React.PointerEvent) => onFieldPointerDown(e, key) }
      : {};

    // Baris rata-rata & predikat Munaqosah sebagai FIELD SENDIRI (bukan
    // jeda margin di dalam tabel) — posisinya diatur independen (drag /
    // X-Y / font / warna) di editor. Musyarokah: tabelNilai null -> blok
    // disembunyikan total (sama seperti tabelnya).
    // Bila belum ada posisi tersimpan, jatuh ke posisi lama (di bawah
    // tabel, dihitung dari tinggi tabel) supaya cetakan yang sudah ada
    // tidak berubah sebelum admin mengaturnya. Cabang ini harus jalan
    // walau cfg kosong, jadi ditempatkan SEBELUM early-return di bawah.
    if (key === "rataRata") {
      if (!tabelNilai) return null;
      const tableCfg = (positions as any)["tabelNilai"] as TemplateFieldCfg | undefined;
      const fs = cfg?.fontSize ?? tableCfg?.fontSize ?? (editorMode ? 22 : defaultFontSize);
      const fontMm = pxRefToMm(fs);
      // Tinggi tabel (judul + baris) dalam mm, untuk posisi fallback.
      const padV = pxRefToMm(2);
      const borderMm = 0.53; // border sel 2px CSS pada panggung 330mm
      const titleH = fontMm * 1.5 + padV * 2 + borderMm + pxRefToMm(4);
      const rowH = fontMm * 1.5 + padV * 2 + borderMm;
      const tableH = titleH + tabelNilai.rows.length * rowH;
      const x = cfg?.x ?? tableCfg?.x ?? STAGE_W_MM / 2;
      const y = cfg?.y ?? (tableCfg?.y !== undefined
        ? tableCfg.y + (tableH + pxRefToMm(16)) / 2
        : STAGE_H_MM / 2);
      const maxWmm = cfg?.maxWidth ?? tableCfg?.maxWidth ?? 264;
      return (
        <div
          key={key}
          {...editorProps}
          className={editorCls}
          style={{
            left: `${x}mm`,
            top: `${y}mm`,
            transform: "translate(-50%, -50%)",
            width: `${maxWmm}mm`,
            direction: "rtl",
            textAlign: "center",
            fontSize: `${fontMm}mm`,
            lineHeight: 1.5,
            color: cfg?.color || "#111",
            fontFamily: cfg?.fontFamily || undefined,
          }}
        >
          بمعدل تراكمي عام ({toArabDigits(tabelNilai.rataRata)}) وبتقدير {tabelNilai.predikat}
        </div>
      );
    }

    if (!cfg) {
      // Halaman cetak hanya merender field yang punya posisi tersimpan.
      // Editor merender semua field kuncinya (default tengah panggung)
      // supaya bisa diatur walau belum pernah disimpan.
      if (!editorMode) return null;
    }
    const x = cfg?.x ?? STAGE_W_MM / 2;
    const y = cfg?.y ?? STAGE_H_MM / 2;
    const maxWmm = cfg?.maxWidth ?? 264;
    const fontSize =
      cfg?.fontSize ?? (key === "tabelNilai" && editorMode ? 22 : defaultFontSize);

    // Tabel nilai Munaqosah: blok tabel (bukan satu baris teks).
    // Musyarokah: tabelNilai null -> blok disembunyikan total.
    if (key === "tabelNilai") {
      if (!tabelNilai) return null;
      return (
        <div
          key={key}
          {...editorProps}
          className={editorCls}
          style={{
            left: `${x}mm`,
            top: `${y}mm`,
            transform: "translate(-50%, -50%)",
            width: `${maxWmm}mm`,
            direction: "rtl",
          }}
        >
          <MunaqosahNilaiTable
            rows={tabelNilai.rows}
            fontSize={fontSize}
          />
        </div>
      );
    }
    // QR verifikasi Munaqosah: gambar dari data URL (dibuat server),
    // dengan logo Markaz di tengahnya — pola yang sama dengan QR
    // syahadah offline (logo.png, latar putih).
    if (key === "qr") {
      if (!qrUrl) {
        // Editor: placeholder kotak putih + logo (QR asli per santri,
        // baru ada saat mencetak) — sama seperti preview editor lama.
        if (!editorMode) return null;
        return (
          <div
            key={key}
            {...editorProps}
            className={`${editorCls} bg-white border flex items-center justify-center`}
            style={{
              left: `${x}mm`,
              top: `${y}mm`,
              transform: "translate(-50%, -50%)",
              width: `${maxWmm}mm`,
              height: `${maxWmm}mm`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo.png" alt="Logo di tengah QR" draggable={false} style={{ width: "50%" }} />
          </div>
        );
      }
      return (
        <div
          key={key}
          {...editorProps}
          className={editorCls}
          style={{
            left: `${x}mm`,
            top: `${y}mm`,
            transform: "translate(-50%, -50%)",
            width: `${maxWmm}mm`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrUrl}
            alt="QR verifikasi"
            draggable={false}
            className="block w-full h-auto"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/logo.png"
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: "26%",
              background: "#fff",
              borderRadius: 8,
              padding: 2,
            }}
          />
        </div>
      );
    }
    // Tanda tangan dirender sebagai gambar (bukan teks); lebarnya dari
    // maxWidth field tersebut (mm panggung).
    if (key === "tandaTangan") {
      if (!signatureUrl) return null;
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={key}
          {...editorProps}
          src={signatureUrl}
          alt="Tanda tangan"
          draggable={false}
          className={editorCls}
          style={{
            left: `${x}mm`,
            top: `${y}mm`,
            transform: "translate(-50%, -50%)",
            width: `${maxWmm}mm`,
          }}
        />
      );
    }
    const posStyle: React.CSSProperties = {
      position: "absolute",
      left: `${x}mm`,
      top: `${y}mm`,
      transform: "translate(-50%, -50%)",
      width: `${maxWmm}mm`,
      textAlign: (cfg?.align as any) || "center",
      direction: fieldDirection,
      fontFamily: cfg?.fontFamily || undefined,
      // Syahadah Nadi: nama jatuh ke emas bila posisi tersimpan belum
      // punya warna (layout lama tersimpan tanpa warna).
      color:
        cfg?.color ||
        (programKey === "nadi-hufadz" && key === "nama"
          ? NADI_HUFADZ_WARNA_NAMA
          : undefined),
    };
    if (key === "nama") {
      // Cetak: persis struktur lama (AutoFitText sendiri yang diposisikan).
      // Editor: dibungkus div posisi supaya bisa di-drag seperti field lain.
      if (!editorMode) {
        return (
          <AutoFitText
            key={key}
            text={texts[key] ?? ""}
            baseFontSize={fontSize}
            maxWidth={mmToPxRef(maxWmm)}
            style={{ ...posStyle, fontWeight: 700 }}
          />
        );
      }
      return (
        <div key={key} {...editorProps} className={editorCls} style={{ ...posStyle, fontWeight: 700 }}>
          <AutoFitText
            text={texts[key] ?? ""}
            baseFontSize={fontSize}
            maxWidth={mmToPxRef(maxWmm)}
            style={{ fontWeight: 700 }}
          />
        </div>
      );
    }
    return (
      <div
        key={key}
        {...editorProps}
        className={editorCls}
        style={{
          ...posStyle,
          fontSize: `${pxRefToMm(fontSize)}mm`,
          lineHeight: 1.4,
          // Pembuka MC terdiri dari 2 baris (dipisah \n).
          whiteSpace: "pre-line",
        }}
      >
        {texts[key] ?? ""}
      </div>
    );
  };

  return (
    <div
      className={`template-stage relative overflow-hidden bg-white ${className || ""}`}
      style={{ width: "330mm", height: "215mm" }}
    >
      {backgroundUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={backgroundUrl}
          alt="Template syahadah"
          className="absolute inset-0 w-full h-full object-fill"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400">
          Template belum memiliki background — upload di menu Template
        </div>
      )}
      {keys.map(renderField)}
    </div>
  );
}

// Pembungkus zoom layar: panggung 330mm diskalakan agar muat di kontainer
// (HP/laptop), tanpa mengubah geometri di dalamnya. Saat print, transform
// di-reset lewat CSS (.template-stage-zoom-inner) sehingga panggung
// tercetak 330mm apa adanya.
export function TemplateStageZoom({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setScale(el.clientWidth / STAGE_W_PX);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className={className}>
      <div
        className="template-stage-zoom-inner"
        style={{
          width: "330mm",
          height: "215mm",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          marginBottom: `${-215 * (1 - scale)}mm`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
