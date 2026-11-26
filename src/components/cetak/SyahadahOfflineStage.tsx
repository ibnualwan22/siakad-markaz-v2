"use client";

import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import "./xb-tabriz.css";
import {
  OFFLINE_DEFAULT_FONT_FAMILY,
  OFFLINE_FIELD_KEYS,
  OFFLINE_STAGE_H_MM,
  OFFLINE_STAGE_W_MM,
  OfflineFieldCfg,
  getOfflineFieldDisplayLabel,
  isOfflineFieldVisible,
} from "@/lib/syahadah-offline";

// Panggung syahadah offline F4 portrait (215 x 330 mm) — SATU jalur render untuk:
// - halaman editor admin (/admin/syahadah-offline),
// - halaman cetak admin (/cetak-offline/[id] & /cetak-offline/tes/[programKey]),
// - halaman unduh santri (/santri/syahadah-offline/[riwayatId]).
// Editor & halaman cetak memakai komponen dan CSS print yang SAMA PERSIS
// (seperti /layout-editor), sehingga posisi di editor = hasil print 1:1.

export const OFFLINE_PRINT_CSS = `
  .offline-stage-field.is-editable {
    transition: outline 0.12s ease, outline-offset 0.12s ease;
    cursor: move;
  }
  .offline-stage-field.is-editable:hover {
    outline: 2px dashed rgba(59, 130, 246, 0.55);
    outline-offset: 2px;
  }
  .offline-stage-field.is-selected {
    outline: 2.5px solid #2563eb !important;
    outline-offset: 3px !important;
    z-index: 20 !important;
  }
  .offline-field-badge {
    position: absolute;
    top: -22px;
    left: 50%;
    transform: translateX(-50%);
    background: #2563eb;
    color: #ffffff;
    font-size: 10px;
    font-weight: 700;
    font-family: system-ui, -apple-system, sans-serif;
    line-height: 1.2;
    padding: 2px 8px;
    border-radius: 4px;
    white-space: nowrap;
    z-index: 30;
    pointer-events: none;
    direction: ltr;
  }

  @media print {
    @page {
      size: ${OFFLINE_STAGE_W_MM}mm ${OFFLINE_STAGE_H_MM}mm;
      margin: 0;
    }

    html, body {
      background: white !important;
      margin: 0 !important;
      padding: 0 !important;
      width: ${OFFLINE_STAGE_W_MM}mm !important;
      height: ${OFFLINE_STAGE_H_MM}mm !important;
      overflow: hidden !important;
    }

    .no-print,
    .editor-toolbar,
    .editor-panel,
    .editor-crosshair,
    .offline-field-badge,
    .lg\\:hidden,
    aside,
    footer,
    .app-footer,
    header,
    nav {
      display: none !important;
    }

    main,
    main > div,
    main > div > div,
    .min-h-screen,
    .offline-print-reset {
      margin: 0 !important;
      padding: 0 !important;
      max-width: none !important;
      width: auto !important;
      height: auto !important;
      min-height: 0 !important;
      overflow: visible !important;
      background: white !important;
      border: none !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      display: block !important;
    }

    .offline-print-stage-wrap {
      transform: none !important;
      margin: 0 !important;
      padding: 0 !important;
      width: ${OFFLINE_STAGE_W_MM}mm !important;
      height: ${OFFLINE_STAGE_H_MM}mm !important;
      box-shadow: none !important;
      overflow: hidden !important;
    }

    .offline-bg-print-hidden {
      display: none !important;
    }

    .offline-stage-field,
    .offline-stage-field:hover,
    .offline-stage-field.is-selected {
      outline: none !important;
      outline-offset: 0 !important;
      cursor: default !important;
    }
  }
`;

export type OfflineStageTemplate = {
  backgroundUrl: string | null;
  fieldPositions: Record<string, Partial<OfflineFieldCfg>>;
  offsetX: number;
  offsetY: number;
};

function hasArabicChars(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

export default function SyahadahOfflineStage({
  texts,
  qrDataUrl,
  qrUrl,
  template,
  showBackground = true,
  hideBackgroundOnPrint = false,
  applyOffset = false,
  showQrPlaceholder = false,
  slotCount = 12,
  editable = false,
  selectedKey = null,
  onSelectKey,
  onFieldMove,
  onFieldDragEnd,
}: {
  texts: Record<string, string>;
  qrDataUrl: string | null;
  qrUrl?: string | null;
  template: OfflineStageTemplate | null;
  showBackground?: boolean;
  hideBackgroundOnPrint?: boolean;
  applyOffset?: boolean;
  showQrPlaceholder?: boolean;
  slotCount?: number;
  editable?: boolean;
  selectedKey?: string | null;
  onSelectKey?: (key: string | null) => void;
  onFieldMove?: (key: string, x: number, y: number) => void;
  onFieldDragEnd?: () => void;
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
    moved: boolean;
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
      moved: false,
    };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* abaikan bila pointerCapture tidak tersedia */
    }
  };

  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) d.moved = true;
    const nx = Math.min(100, Math.max(0, d.origX + (dx / d.w) * 100));
    const ny = Math.min(100, Math.max(0, d.origY + (dy / d.h) * 100));
    onFieldMove?.(
      d.key,
      Math.round(nx * 100) / 100,
      Math.round(ny * 100) / 100,
    );
  };

  const onUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d?.moved) {
      onFieldDragEnd?.();
    }
  };

  const renderField = (key: string) => {
    if (!isOfflineFieldVisible(key, slotCount)) return null;
    const cfg = fields[key];
    if (!cfg) return null;

    const xMm = ((cfg.x ?? 50) / 100) * OFFLINE_STAGE_W_MM;
    const yMm = ((cfg.y ?? 50) / 100) * OFFLINE_STAGE_H_MM;
    const maxWMm = ((cfg.maxWidth ?? 80) / 100) * OFFLINE_STAGE_W_MM;
    const fontPt = cfg.fontSize ?? 13;
    const family = cfg.fontFamily || OFFLINE_DEFAULT_FONT_FAMILY;
    const isSelected = editable && selectedKey === key;
    const badge = isSelected ? getOfflineFieldDisplayLabel(key, texts) : null;
    const fieldClass = `offline-stage-field ${editable ? "is-editable" : ""} ${isSelected ? "is-selected" : ""
      }`;

    if (key === "qr") {
      const sizeMm = maxWMm;
      const effectiveQrUrl =
        qrUrl || (showQrPlaceholder ? "https://markazarabiyah.site/preview" : null);

      if (!qrDataUrl && !effectiveQrUrl) return null;

      return (
        <div
          key={key}
          onPointerDown={(e) => onFieldDown(e, key)}
          className={`absolute ${fieldClass}`}
          style={{
            left: `${xMm}mm`,
            top: `${yMm}mm`,
            transform: "translate(-50%, -50%)",
            width: `${sizeMm}mm`,
            height: `${sizeMm}mm`,
          }}
        >
          {badge && <span className="offline-field-badge no-print">{badge}</span>}
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="QR verifikasi"
              draggable={false}
              className="block w-full h-full object-contain"
            />
          ) : (
            <QRCodeSVG
              value={effectiveQrUrl!}
              size={256}
              level="M"
              style={{ width: "100%", height: "100%", display: "block" }}
            />
          )}
        </div>
      );
    }

    if (key === "tandaTangan") {
      // Gambar tanda tangan mudir (26 Nov 2026): file statis yang sama
      // dengan syahadah online (/images/signature.png). Lebar diatur
      // maxWidth (mm); tinggi mengikuti rasio gambar. Bisa di-drag seperti
      // field lain; ikut tercetak (bukan background).
      const widthMm = maxWMm;
      return (
        <div
          key={key}
          onPointerDown={(e) => onFieldDown(e, key)}
          className={`absolute ${fieldClass}`}
          style={{
            left: `${xMm}mm`,
            top: `${yMm}mm`,
            transform: "translate(-50%, -50%)",
            width: `${widthMm}mm`,
          }}
        >
          {badge && <span className="offline-field-badge no-print">{badge}</span>}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/signature.png"
            alt="Tanda tangan mudir"
            draggable={false}
            className="block w-full h-auto"
          />
        </div>
      );
    }

    const text = texts[key] ?? "";
    // tempatLahir format Indonesia (Wonosobo, 05 - 11 - 2000) wajib LTR agar
    // tanda koma & strip tanggal tidak terbalik oleh algoritma BiDi RTL.
    // Nama santri otomatis LTR bila Latin, RTL bila aksara Arab.
    const direction: "ltr" | "rtl" =
      key === "tempatLahir"
        ? "ltr"
        : key === "nama"
          ? hasArabicChars(text)
            ? "rtl"
            : "ltr"
          : "rtl";

    const align = (cfg.align as "left" | "center" | "right") || "center";
    const justifyContent =
      align === "left"
        ? "flex-start"
        : align === "right"
          ? "flex-end"
          : "center";

    // Semua field teks dirender lurus mendatar (1 baris, tanpa wrap) dengan
    // ukuran font pt persis sesuai pengaturan user — tanpa auto-shrink/lock.
    // Lebar mengikuti minWidth = maxWMm dan otomatis meluas (max-content)
    // bila teks lebih lebar agar tidak pernah patah ke baris kedua atau terpotong.
    const posStyle: React.CSSProperties = {
      position: "absolute",
      left: `${xMm}mm`,
      top: `${yMm}mm`,
      transform: "translate(-50%, -50%)",
      minWidth: `${maxWMm}mm`,
      width: "max-content",
      display: "flex",
      justifyContent,
      alignItems: "center",
      direction: "ltr",
      whiteSpace: "nowrap",
      overflow: "visible",
    };

    const onDown = editable
      ? (e: React.PointerEvent) => onFieldDown(e, key)
      : undefined;

    return (
      <div
        key={key}
        onPointerDown={onDown}
        className={fieldClass}
        style={posStyle}
      >
        {badge && <span className="offline-field-badge no-print">{badge}</span>}
        <span
          style={{
            direction,
            fontFamily: family,
            fontSize: `${fontPt}pt`,
            lineHeight: 1.25,
            color: cfg.color || "#000000",
            fontWeight:
              key === "nama" || key === "namaMudir" ? 700 : undefined,
            whiteSpace: "nowrap",
          }}
        >
          {text}
        </span>
      </div>
    );
  };

  return (
    <div
      ref={stageRef}
      className={`relative overflow-hidden bg-white ${editable ? "select-none touch-none" : ""
        }`}
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
          className={`absolute inset-0 w-full h-full object-fill pointer-events-none ${hideBackgroundOnPrint ? "offline-bg-print-hidden" : ""
            }`}
          draggable={false}
        />
      ) : (
        <div className="no-print absolute inset-0 flex items-center justify-center text-slate-400 text-sm px-8 text-center">
          Template belum memiliki background — upload desain F4 portrait di menu
          Syahadah Offline
        </div>
      )}

      {/* Garis bantu tengah (crosshairs) saat mode editor — persis seperti layout-editor */}
      {editable && (
        <>
          <div
            className="editor-crosshair"
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: "50%",
              width: "1px",
              borderLeft: "1px dashed rgba(59, 130, 246, 0.5)",
              zIndex: 1,
              pointerEvents: "none",
            }}
          />
          <div
            className="editor-crosshair"
            style={{
              position: "absolute",
              top: "50%",
              left: 0,
              right: 0,
              height: "1px",
              borderTop: "1px dashed rgba(59, 130, 246, 0.5)",
              zIndex: 1,
              pointerEvents: "none",
            }}
          />
        </>
      )}

      {/* Offset printer hanya untuk field (bukan background). */}
      <div
        className="absolute inset-0"
        style={{
          zIndex: 2,
          ...(offsetX !== 0 || offsetY !== 0
            ? { transform: `translate(${offsetX}mm, ${offsetY}mm)` }
            : {}),
        }}
      >
        {OFFLINE_FIELD_KEYS.map(renderField)}
      </div>
    </div>
  );
}
