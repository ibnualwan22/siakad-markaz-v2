"use client";

import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import "./xb-tabriz.css";
import {
  NON_KELAS_H_MM,
  NON_KELAS_W_MM,
  getNonKelasFieldSchema,
  type NonKelasFieldCfg,
  type NonKelasFieldMeta,
} from "@/lib/syahadah-non-kelas";

// Panggung Syahadah Non-Kelas Terpadu — F4 Landscape (330 x 215 mm).
// SATU jalur render untuk:
// - Editor di /admin/syahadah-offline (Tab Syahadah Non-Kelas),
// - Cetak satuan (Nadi Hufadz, Lajnah, OSIM, Tadrib Funun, CAC, Martabah Ula),
// - Cetak tes (/cetak-non-kelas/tes/[programKey]),
// - Cetak bulk global & per jenis (/cetak-non-kelas/bulk).
// Geometri WYSIWYG 1:1 (mm + pt), identik dengan SyahadahOfflineStage.

export const NON_KELAS_PRINT_CSS = `
  .nonkelas-stage-field.is-editable {
    transition: outline 0.12s ease, outline-offset 0.12s ease;
    cursor: move;
  }
  .nonkelas-stage-field.is-editable:hover {
    outline: 2px dashed rgba(59, 130, 246, 0.55);
    outline-offset: 2px;
  }
  .nonkelas-stage-field.is-selected {
    outline: 2.5px solid #2563eb !important;
    outline-offset: 3px !important;
    z-index: 20 !important;
  }
  .nonkelas-field-badge {
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
      size: ${NON_KELAS_W_MM}mm ${NON_KELAS_H_MM}mm;
      margin: 0;
    }

    html, body {
      background: white !important;
      margin: 0 !important;
      padding: 0 !important;
      width: ${NON_KELAS_W_MM}mm !important;
      height: ${NON_KELAS_H_MM}mm !important;
      overflow: hidden !important;
    }

    .no-print,
    .editor-toolbar,
    .editor-panel,
    .editor-crosshair,
    .nonkelas-field-badge,
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

    .nonkelas-print-stage-wrap {
      transform: none !important;
      margin: 0 !important;
      padding: 0 !important;
      width: ${NON_KELAS_W_MM}mm !important;
      height: ${NON_KELAS_H_MM}mm !important;
      box-shadow: none !important;
      overflow: hidden !important;
    }

    .nonkelas-bg-print-hidden {
      display: none !important;
    }

    .nonkelas-stage-field,
    .nonkelas-stage-field:hover,
    .nonkelas-stage-field.is-selected {
      outline: none !important;
      outline-offset: 0 !important;
      cursor: default !important;
    }
  }
`;

export type NonKelasStageTemplate = {
  backgroundUrl: string | null;
  fieldPositions: Record<string, Partial<NonKelasFieldCfg>>;
  offsetX: number;
  offsetY: number;
};

function hasArabicChars(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

export default function SyahadahNonKelasStage({
  programKey,
  texts,
  qrUrl,
  signatureUrl,
  stampUrl,
  template,
  showBackground = true,
  hideBackgroundOnPrint = false,
  applyOffset = false,
  editable = false,
  selectedKey = null,
  onSelectKey,
  onFieldMove,
  onFieldDragEnd,
}: {
  programKey: string;
  texts: Record<string, string>;
  qrUrl?: string | null;
  signatureUrl?: string | null;
  stampUrl?: string | null;
  template: NonKelasStageTemplate | null;
  showBackground?: boolean;
  hideBackgroundOnPrint?: boolean;
  applyOffset?: boolean;
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

  const schema = getNonKelasFieldSchema(programKey);
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
      /* abaikan */
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

  const renderField = (meta: NonKelasFieldMeta) => {
    const cfg = fields[meta.key];
    if (!cfg) return null;

    const xMm = ((cfg.x ?? 50) / 100) * NON_KELAS_W_MM;
    const yMm = ((cfg.y ?? 50) / 100) * NON_KELAS_H_MM;
    const maxWMm = ((cfg.maxWidth ?? 60) / 100) * NON_KELAS_W_MM;
    const fontPt = cfg.fontSize ?? 16;
    const family = cfg.fontFamily || meta.defaultFontFamily || "Amiri";
    const isSelected = editable && selectedKey === meta.key;
    const badge = isSelected ? meta.label : null;
    const fieldClass = `nonkelas-stage-field ${editable ? "is-editable" : ""} ${
      isSelected ? "is-selected" : ""
    }`;

    if (meta.kind === "qr") {
      const effectiveUrl = qrUrl || "https://markazarabiyah.site/preview";
      return (
        <div
          key={meta.key}
          onPointerDown={(e) => onFieldDown(e, meta.key)}
          className={`absolute ${fieldClass}`}
          style={{
            left: `${xMm}mm`,
            top: `${yMm}mm`,
            transform: "translate(-50%, -50%)",
            width: `${maxWMm}mm`,
            height: `${maxWMm}mm`,
          }}
        >
          {badge && (
            <span className="nonkelas-field-badge no-print">{badge}</span>
          )}
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "linear-gradient(135deg, #b3823c, #d8c568)",
              padding: "1.4mm",
              borderRadius: "2.5mm",
              WebkitPrintColorAdjust: "exact",
              printColorAdjust: "exact",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                background: "#ffffff",
                padding: "1.2mm",
                borderRadius: "1.5mm",
                boxSizing: "border-box",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <QRCodeSVG
                value={effectiveUrl}
                size={256}
                fgColor="#b3823c"
                level="M"
                style={{ width: "100%", height: "100%", display: "block" }}
              />
            </div>
          </div>
        </div>
      );
    }

    if (meta.kind === "signature") {
      const src = signatureUrl || "/images/signature.png";
      return (
        <div
          key={meta.key}
          onPointerDown={(e) => onFieldDown(e, meta.key)}
          className={`absolute ${fieldClass}`}
          style={{
            left: `${xMm}mm`,
            top: `${yMm}mm`,
            transform: "translate(-50%, -50%)",
            width: `${maxWMm}mm`,
            zIndex: 4,
          }}
        >
          {badge && (
            <span className="nonkelas-field-badge no-print">{badge}</span>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt="Tanda tangan mudir"
            draggable={false}
            className="block w-full h-auto"
          />
        </div>
      );
    }

    if (meta.kind === "stamp") {
      const src = stampUrl || "/images/stamp.png";
      return (
        <div
          key={meta.key}
          onPointerDown={(e) => onFieldDown(e, meta.key)}
          className={`absolute ${fieldClass}`}
          style={{
            left: `${xMm}mm`,
            top: `${yMm}mm`,
            transform: "translate(-50%, -50%)",
            width: `${maxWMm}mm`,
            zIndex: 3,
          }}
        >
          {badge && (
            <span className="nonkelas-field-badge no-print">{badge}</span>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt="Stempel"
            draggable={false}
            className="block w-full h-auto opacity-90"
          />
        </div>
      );
    }

    const text = texts[meta.key] ?? "";
    const direction: "ltr" | "rtl" =
      meta.direction === "rtl"
        ? "rtl"
        : meta.direction === "ltr"
          ? "ltr"
          : hasArabicChars(text)
            ? "rtl"
            : "ltr";

    const align = (cfg.align as "left" | "center" | "right") || "center";
    const textAlign = align;
    const isCustomColor = Boolean(cfg.color && cfg.color !== "#b3823c");
    const useGoldGradient = Boolean(meta.goldGradient && !isCustomColor);

    const spanStyle: React.CSSProperties = {
      display: "inline-block",
      width: meta.multiline ? "100%" : "auto",
      direction,
      fontFamily: family,
      fontSize: `${fontPt}pt`,
      lineHeight: meta.multiline ? 1.45 : 1.25,
      fontWeight: meta.bold ? 700 : undefined,
      whiteSpace: meta.multiline ? "pre-line" : "nowrap",
      textAlign,
      ...(meta.underline
        ? {
            borderBottom: `2px solid ${cfg.color || "#b08527"}`,
            paddingBottom: "1.5mm",
            paddingLeft: "6mm",
            paddingRight: "6mm",
          }
        : {}),
      ...(useGoldGradient
        ? {
            background: "linear-gradient(to right, #b3823c, #d8c568)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            WebkitPrintColorAdjust: "exact",
            printColorAdjust: "exact",
          }
        : {
            color: cfg.color || "#000000",
          }),
    };

    return (
      <div
        key={meta.key}
        onPointerDown={editable ? (e) => onFieldDown(e, meta.key) : undefined}
        className={`absolute ${fieldClass}`}
        style={{
          left: `${xMm}mm`,
          top: `${yMm}mm`,
          transform: "translate(-50%, -50%)",
          width: meta.multiline ? `${maxWMm}mm` : "max-content",
          minWidth: `${maxWMm}mm`,
          display: "flex",
          justifyContent:
            align === "left"
              ? "flex-start"
              : align === "right"
                ? "flex-end"
                : "center",
          alignItems: "center",
          overflow: "visible",
          zIndex: 5,
        }}
      >
        {badge && (
          <span className="nonkelas-field-badge no-print">{badge}</span>
        )}
        <span style={spanStyle}>{text}</span>
      </div>
    );
  };

  return (
    <div
      ref={stageRef}
      className={`relative overflow-hidden bg-white ${
        editable ? "select-none touch-none" : ""
      }`}
      style={{
        width: `${NON_KELAS_W_MM}mm`,
        height: `${NON_KELAS_H_MM}mm`,
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
          alt="Background Syahadah Non-Kelas"
          className={`absolute inset-0 w-full h-full object-fill pointer-events-none ${
            hideBackgroundOnPrint ? "nonkelas-bg-print-hidden" : ""
          }`}
          draggable={false}
        />
      ) : (
        <div className="no-print absolute inset-0 flex items-center justify-center text-slate-400 text-sm px-8 text-center">
          Template belum memiliki background — upload desain F4 Landscape (330 ×
          215 mm) di tab Syahadah Non-Kelas
        </div>
      )}

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

      <div
        className="absolute inset-0"
        style={{
          zIndex: 2,
          ...(offsetX !== 0 || offsetY !== 0
            ? { transform: `translate(${offsetX}mm, ${offsetY}mm)` }
            : {}),
        }}
      >
        {schema.map(renderField)}
      </div>
    </div>
  );
}
