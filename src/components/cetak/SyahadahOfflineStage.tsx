"use client";

import { useEffect, useRef, useState } from "react";
import {
  OFFLINE_DEFAULT_FONT_FAMILY,
  OFFLINE_FIELD_KEYS,
  OFFLINE_STAGE_H_MM,
  OFFLINE_STAGE_W_MM,
} from "@/lib/syahadah-offline";

// Panggung syahadah offline A4 portrait — SATU jalur render untuk:
// - halaman cetak admin (/cetak-offline/[id]),
// - halaman unduh santri (/santri/syahadah-offline/[riwayatId]),
// - preview editor admin (/admin/syahadah-offline).
// Editor memakai komponen yang SAMA PERSIS dengan halaman cetak, jadi
// "atur layout" = print preview secara harfiah: panggung 210 x 297 mm,
// posisi % -> mm, font pt, anchor tengah, lebar maks, auto-fit nama.
// Yang membedakan hanya mode editor: field bisa di-drag (pointer),
// field terpilih diberi outline, background selalu tampil, dan offset
// printer bisa ditampilkan di preview.
export type OfflineStageTemplate = {
  backgroundUrl: string | null;
  fieldPositions: Record<string, any>;
  offsetX: number;
  offsetY: number;
};

/** Nama satu baris yang font-nya mengecil otomatis bila kepanjangan
 *  (diukur canvas dalam pt, dirender dalam pt — sebangun dengan panggung). */
function AutoFitTextPt({
  text,
  basePt,
  maxWidthMm,
  fontFamily,
  style,
  dragProps,
}: {
  text: string;
  basePt: number;
  maxWidthMm: number;
  fontFamily?: string;
  style?: React.CSSProperties;
  dragProps?: {
    onPointerDown?: (e: React.PointerEvent) => void;
    className?: string;
  };
}) {
  const [pt, setPt] = useState(basePt);
  useEffect(() => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const family = fontFamily ? `"${fontFamily}"` : `"${OFFLINE_DEFAULT_FONT_FAMILY}"`;
    ctx.font = `${(basePt * 96) / 72}px ${family}`;
    const w = ctx.measureText(text).width;
    const maxW = (maxWidthMm * 96) / 25.4;
    if (w > maxW && w > 0) {
      setPt(Math.max(8, Math.floor((maxW / w) * basePt)));
    } else {
      setPt(basePt);
    }
  }, [text, basePt, maxWidthMm, fontFamily]);

  return (
    <div
      onPointerDown={dragProps?.onPointerDown}
      className={dragProps?.className}
      style={{
        ...style,
        fontSize: `${pt}pt`,
        lineHeight: 1.2,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "clip",
      }}
    >
      {text}
    </div>
  );
}

export default function SyahadahOfflineStage({
  texts,
  qrDataUrl,
  template,
  showBackground = true,
  hideBackgroundOnPrint = false,
  applyOffset = false,
  showQrPlaceholder = false,
  editable = false,
  selectedKey = null,
  onSelectKey,
  onFieldMove,
}: {
  texts: Record<string, string>;
  qrDataUrl: string | null;
  template: OfflineStageTemplate | null;
  showBackground?: boolean;
  hideBackgroundOnPrint?: boolean;
  applyOffset?: boolean;
  showQrPlaceholder?: boolean;
  editable?: boolean;
  selectedKey?: string | null;
  onSelectKey?: (key: string | null) => void;
  onFieldMove?: (key: string, x: number, y: number) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    key: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    w: number;
    h: number;
  } | null>(null);

  const fields = template?.fieldPositions || {};
  const offsetX = applyOffset ? template?.offsetX || 0 : 0;
  const offsetY = applyOffset ? template?.offsetY || 0 : 0;
  const bg = template?.backgroundUrl || null;

  const onFieldDown = (e: React.PointerEvent, key: string) => {
    if (!editable || !stageRef.current) return;
    e.stopPropagation();
    onSelectKey?.(key);
    const rect = stageRef.current.getBoundingClientRect();
    dragRef.current = {
      key,
      startX: e.clientX,
      startY: e.clientY,
      origX: fields[key]?.x ?? 50,
      origY: fields[key]?.y ?? 50,
      w: rect.width,
      h: rect.height,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const nx = Math.min(100, Math.max(0, d.origX + ((e.clientX - d.startX) / d.w) * 100));
    const ny = Math.min(100, Math.max(0, d.origY + ((e.clientY - d.startY) / d.h) * 100));
    onFieldMove?.(d.key, Math.round(nx * 10) / 10, Math.round(ny * 10) / 10);
  };
  const onUp = () => {
    dragRef.current = null;
  };

  const renderField = (key: string) => {
    const cfg = fields[key];
    if (!cfg) return null;
    const xMm = ((cfg.x ?? 50) / 100) * OFFLINE_STAGE_W_MM;
    const yMm = ((cfg.y ?? 50) / 100) * OFFLINE_STAGE_H_MM;
    const maxWMm = ((cfg.maxWidth ?? 80) / 100) * OFFLINE_STAGE_W_MM;
    const fontPt = cfg.fontSize ?? 13;
    const family = cfg.fontFamily || OFFLINE_DEFAULT_FONT_FAMILY;
    const isSelected = editable && selectedKey === key;

    if (key === "qr") {
      const sizeMm = maxWMm;
      if (!qrDataUrl) {
        // Kotak penanda QR: di editor selalu tampil; di print admin tampil
        // di preview saja (tidak ikut tercetak); di santri disembunyikan.
        if (!showQrPlaceholder) return null;
        return (
          <div
            key={key}
            onPointerDown={(e) => onFieldDown(e, key)}
            className={`no-print absolute border-2 border-dashed border-slate-400 bg-white/70 flex items-center justify-center ${
              editable ? "cursor-move" : ""
            }`}
            style={{
              left: `${xMm}mm`,
              top: `${yMm}mm`,
              transform: "translate(-50%, -50%)",
              width: `${sizeMm}mm`,
              height: `${sizeMm}mm`,
              fontSize: "10px",
              color: "#64748b",
              outline: isSelected ? "2px solid #059669" : undefined,
              outlineOffset: 2,
            }}
          >
            QR
          </div>
        );
      }
      return (
        <div
          key={key}
          onPointerDown={(e) => onFieldDown(e, key)}
          className={`absolute ${editable ? "cursor-move" : ""}`}
          style={{
            left: `${xMm}mm`,
            top: `${yMm}mm`,
            transform: "translate(-50%, -50%)",
            width: `${sizeMm}mm`,
            outline: isSelected ? "2px solid #059669" : undefined,
            outlineOffset: 2,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
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

    const posStyle: React.CSSProperties = {
      position: "absolute",
      left: `${xMm}mm`,
      top: `${yMm}mm`,
      transform: "translate(-50%, -50%)",
      width: `${maxWMm}mm`,
      textAlign: (cfg.align as any) || "center",
      direction: "rtl",
      fontFamily: family,
      color: cfg.color || undefined,
      outline: isSelected ? "2px dashed #059669" : undefined,
      outlineOffset: 2,
    };
    const dragProps = editable
      ? {
          onPointerDown: (e: React.PointerEvent) => onFieldDown(e, key),
          className: "cursor-move",
        }
      : {};
    if (key === "nama") {
      return (
        <AutoFitTextPt
          key={key}
          text={texts[key] ?? ""}
          basePt={fontPt}
          maxWidthMm={maxWMm}
          fontFamily={family}
          style={{ ...posStyle, fontWeight: 700 }}
          dragProps={dragProps}
        />
      );
    }
    return (
      <div
        key={key}
        {...dragProps}
        style={{ ...posStyle, fontSize: `${fontPt}pt`, lineHeight: 1.4 }}
      >
        {texts[key] ?? ""}
      </div>
    );
  };

  return (
    <div
      ref={stageRef}
      className={`relative overflow-hidden bg-white ${editable ? "select-none touch-none" : ""}`}
      style={{
        width: `${OFFLINE_STAGE_W_MM}mm`,
        height: `${OFFLINE_STAGE_H_MM}mm`,
      }}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerDown={() => onSelectKey?.(null)}
    >
      {bg && showBackground ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bg}
          alt="Template syahadah"
          className={`absolute inset-0 w-full h-full object-fill ${hideBackgroundOnPrint ? "offline-bg-print-hidden" : ""}`}
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400">
          Template belum memiliki background — upload di menu Template Offline
        </div>
      )}
      {/* Offset printer hanya untuk field (bukan background). */}
      <div
        className="absolute inset-0"
        style={
          offsetX !== 0 || offsetY !== 0
            ? { transform: `translate(${offsetX}mm, ${offsetY}mm)` }
            : undefined
        }
      >
        {OFFLINE_FIELD_KEYS.map(renderField)}
      </div>
    </div>
  );
}
