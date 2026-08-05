"use client";

import React from "react";
import { QRCodeCanvas } from "qrcode.react";
import { convertToArabicNumerals } from "@/lib/formatters";
import { OnlineLayoutData, OnlineLayoutElementKey, getDefaultOnlineLayout } from "@/lib/syahadah-online-layout";

export type SyahadahOnlineDocumentData = {
  id: string;
  nama: string;
  isMusyarokah: boolean;
  nilai: number | null;
  programOnline: {
    namaIndo: string;
    namaArab: string;
    tglCetakArab: string | null;
    periodeAwal: string | null;
    periodeAkhir: string | null;
  } | null;
};

type Props = {
  data: SyahadahOnlineDocumentData;
  qrUrl: string;
  layout?: OnlineLayoutData;
  editorMode?: boolean;
  selectedElement?: OnlineLayoutElementKey | null;
  onSelectElement?: (key: OnlineLayoutElementKey) => void;
};

function elProps(
  key: OnlineLayoutElementKey,
  editorMode?: boolean,
  selectedElement?: OnlineLayoutElementKey | null,
  onSelectElement?: (key: OnlineLayoutElementKey) => void,
  label?: string
): Record<string, any> {
  if (!editorMode) return {};
  return {
    className: `syahadah-element ${selectedElement === key ? "selected" : ""}`,
    "data-label": label || key,
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelectElement?.(key);
    },
    style: { cursor: "pointer" },
  };
}

// Helper: merge extra style into elProps
function ep(
  key: OnlineLayoutElementKey,
  editorMode: boolean | undefined,
  selectedElement: OnlineLayoutElementKey | null | undefined,
  onSelectElement: ((k: OnlineLayoutElementKey) => void) | undefined,
  label: string,
  baseStyle: React.CSSProperties
): Record<string, any> {
  const base = elProps(key, editorMode, selectedElement, onSelectElement, label);
  return {
    ...base,
    style: { ...baseStyle, ...(editorMode ? { cursor: "pointer" } : {}) },
  };
}

export function SyahadahOnlineDocument({ data, qrUrl, layout, editorMode, selectedElement, onSelectElement }: Props) {
  const lo = layout || getDefaultOnlineLayout();
  const isMusyarokah = data.isMusyarokah;
  const programArab = data.programOnline?.namaArab || "المشاركة";
  const tanggalCetak = data.programOnline?.tglCetakArab || "........";
  const periodeAwal = data.programOnline?.periodeAwal || "........";
  const periodeAkhir = data.programOnline?.periodeAkhir || "........";
  const nilaiValue = !isMusyarokah && data.nilai ? convertToArabicNumerals(Math.round(data.nilai)) : "";
  const namaFontSize = lo.namaSantri.fontSize ?? 32;

  // Turats Detection
  const isTurats = !!data.programOnline?.namaIndo?.toLowerCase().includes("turats");

  // Base positions for signature area (bottom of content box)
  const sigAreaTop = "auto"; // using marginTop:auto in flex

  return (
    <div
      className="container-syahadah print:block print:min-h-0 mx-auto mb-12"
      style={{ pageBreakAfter: "always" }}
    >
      <div
        id="syahadah-online-doc"
        className="doc-syahadah"
        style={{
          width: "330mm",
          height: "215mm",
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
          fontFamily: "'Traditional Arabic', 'Scheherazade New', 'Amiri', serif",
          flexShrink: 0,
          background: "white",
        }}
        onClick={() => editorMode && onSelectElement?.(null as any)}
      >
        {/* Background */}
        <img
          src="/images/syahadah-online.webp"
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "fill",
            zIndex: 0,
            pointerEvents: "none",
            display: "block",
          }}
        />

        {/* Editor crosshairs */}
        {editorMode && (
          <>
            <div className="editor-crosshair" style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: "1px", borderLeft: "1px dashed rgba(59,130,246,0.5)", zIndex: 1, pointerEvents: "none" }} />
            <div className="editor-crosshair" style={{ position: "absolute", top: "50%", left: 0, right: 0, height: "1px", borderTop: "1px dashed rgba(59,130,246,0.5)", zIndex: 1, pointerEvents: "none" }} />
          </>
        )}

        {/* QR Code */}
        <div
          {...ep("qrCode", editorMode, selectedElement, onSelectElement, "QR Code", {
            position: "absolute",
            bottom: `calc(18mm + ${-lo.qrCode.offsetY}mm)`,
            left: `calc(10mm + ${lo.qrCode.offsetX}mm)`,
            zIndex: 3,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          })}
        >
          <p style={{ fontSize: "10pt", color: "#000", textAlign: "center", marginBottom: "3mm", marginTop: 0, direction: "rtl" }}>
            امسح الكود للتحقق من الأصالة
          </p>
          <div style={{ position: "relative", width: "105px", height: "105px" }}>
            {isTurats && (
              <img
                src="/images/bingkai-turats.png"
                alt=""
                style={{
                  position: "absolute",
                  inset: "-12px",
                  width: "129px",
                  height: "129px",
                  objectFit: "contain",
                  zIndex: 0,
                  pointerEvents: "none",
                }}
              />
            )}
            <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "center", alignItems: "center", width: "100%", height: "100%" }}>
              <QRCodeCanvas
                value={qrUrl}
                size={75}
                level="H"
                imageSettings={{ src: isTurats ? "/images/logo-turats.png" : "/images/logo.png", height: 26, width: 26, excavate: true }}
              />
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div
          dir="rtl"
          style={{
            position: "absolute",
            top: "62mm",
            left: "50%",
            transform: "translateX(-50%)",
            width: "200mm",
            bottom: "10mm",
            zIndex: 3,
            display: "flex",
            flexDirection: "column",
            overflow: "visible",
          }}
        >
          {/* Paragraf Pembuka */}
          <div
            {...ep("paragrafPembuka", editorMode, selectedElement, onSelectElement, "Paragraf Pembuka", {
              fontSize: "15pt",
              lineHeight: 1.9,
              color: "#1a0e00",
              textAlign: "center",
              marginBottom: "2mm",
              marginTop: 0,
              transform: `translate(${lo.paragrafPembuka.offsetX}mm, ${lo.paragrafPembuka.offsetY}mm)`,
              position: "relative",
            })}
          >
            <p dir="rtl" style={{ textAlign: "center", margin: 0 }}>
              بعد الوصية بتقوى الله واتباع سنة رسول الله، قرر {isTurats ? "مركز التراث" : "مركز العربية"} بباري كديري إندونيسيا،
              <br />
              منح شهادة الاستكمال للطالب/الطالبة :
            </p>
          </div>

          {/* Nama Peserta */}
          <div
            dir="ltr"
            {...ep("namaSantri", editorMode, selectedElement, onSelectElement, "Nama Peserta", {
              textAlign: "center",
              marginBottom: "1mm",
              transform: `translate(${lo.namaSantri.offsetX}mm, ${lo.namaSantri.offsetY}mm)`,
              position: "relative",
            })}
          >
            <span
              style={{
                fontSize: `${namaFontSize}pt`,
                fontWeight: "900",
                color: "#1a6b1a",
                fontFamily: "Georgia, 'Times New Roman', serif",
                letterSpacing: "0.01em",
                lineHeight: 1.1,
                display: "inline-block",
                whiteSpace: "nowrap",
              }}
            >
              {data.nama}
            </span>
          </div>

          {/* Pengantar Program */}
          <p
            {...ep("pengantarProgram", editorMode, selectedElement, onSelectElement, "Pengantar Program", {
              fontSize: "15pt",
              lineHeight: 1.9,
              color: "#1a0e00",
              textAlign: "center",
              margin: 0,
              transform: `translate(${lo.pengantarProgram.offsetX}mm, ${lo.pengantarProgram.offsetY}mm)`,
              position: "relative",
            })}
          >
            وذلك لإكماله/لإكمالها الدراسات والامتحانات التي أقيمت في
          </p>

          {/* Nama Program */}
          <p
            {...ep("teksProgram", editorMode, selectedElement, onSelectElement, "Nama Program", {
              fontSize: "15pt",
              lineHeight: 1.9,
              color: "#1a0e00",
              textAlign: "center",
              margin: 0,
              transform: `translate(${lo.teksProgram.offsetX}mm, ${lo.teksProgram.offsetY}mm)`,
              position: "relative",
            })}
          >
            برنامج <strong style={{ color: "#8B1A1A" }}>{programArab}</strong>
          </p>

          {/* Teks Periode */}
          <p
            {...ep("teksPeriode", editorMode, selectedElement, onSelectElement, "Teks Periode", {
              fontSize: "15pt",
              lineHeight: 1.9,
              fontWeight: "700",
              textAlign: "center",
              margin: 0,
              transform: `translate(${lo.teksPeriode.offsetX}mm, ${lo.teksPeriode.offsetY}mm)`,
              position: "relative",
            })}
          >
            <span style={{ color: "#1a0e00" }}>التي تقام خلال فترات </span>
            <strong style={{ color: "#8B1A1A" }}>{periodeAwal}</strong>
            <span style={{ color: "#8B1A1A" }}> – </span>
            <strong style={{ color: "#8B1A1A" }}>{periodeAkhir}</strong>
          </p>

          {/* Rata-rata */}
          {!isMusyarokah && nilaiValue && (
            <p
              {...ep("rataRata", editorMode, selectedElement, onSelectElement, "Rata-rata", {
                fontSize: "16pt",
                lineHeight: 1.9,
                color: "#1a0e00",
                textAlign: "center",
                margin: 0,
                transform: `translate(${lo.rataRata.offsetX}mm, ${lo.rataRata.offsetY}mm)`,
                position: "relative",
              })}
            >
              بمعدل تراكمي عام (<strong>{nilaiValue}</strong>)
            </p>
          )}

          {/* Doa Penutup */}
          <p
            {...ep("doaPenutup", editorMode, selectedElement, onSelectElement, "Doa Penutup", {
              fontSize: "15pt",
              lineHeight: 1.9,
              color: "#1a0e00",
              textAlign: "center",
              margin: 0,
              transform: `translate(${lo.doaPenutup.offsetX}mm, ${lo.doaPenutup.offsetY}mm)`,
              position: "relative",
            })}
          >
            نسأل الله أن يوفقه/يوفقها لخدمة الإسلام والعلم
          </p>

          {/* ═══ SIGNATURE AREA — 40mm fixed height, each element absolutely positioned ═══ */}
          <div style={{ marginTop: "auto", position: "relative", height: "42mm", flexShrink: 0 }}>

            {/* ── KIRI: Jabatan ── */}
            <p
              {...ep("jabatanKiri", editorMode, selectedElement, onSelectElement, "Jabatan Kiri", {
                position: "absolute",
                left: `calc(2mm + ${lo.jabatanKiri.offsetX}mm)`,
                top: `calc(0mm + ${lo.jabatanKiri.offsetY}mm)`,
                fontSize: "14pt",
                color: "#1a0e00",
                fontWeight: 500,
                margin: 0,
                whiteSpace: "nowrap",
                direction: "rtl",
                zIndex: 4,
              })}
            >
              {isTurats ? "الرئيس العام لمركز التراث" : "الرئيس العام لمركز العربية"}
            </p>

            {/* ── KIRI: Cap (Stempel) ── */}
            <img
              src="/images/stamp.png"
              alt="Cap Kiri"
              {...ep("stempelKiri", editorMode, selectedElement, onSelectElement, "Cap Kiri", {
                position: "absolute",
                left: `calc(10mm + ${lo.stempelKiri.offsetX}mm)`,
                top: `calc(6mm + ${lo.stempelKiri.offsetY}mm)`,
                height: "36mm",
                objectFit: "contain",
                opacity: 0.88,
                zIndex: 3,
              })}
            />

            {/* ── KIRI: Tanda Tangan ── */}
            <img
              src="/images/signature.png"
              alt="TTD Kiri"
              {...ep("ttdKiri", editorMode, selectedElement, onSelectElement, "TTD Kiri", {
                position: "absolute",
                left: `calc(10mm + ${lo.ttdKiri.offsetX}mm)`,
                top: `calc(6mm + ${lo.ttdKiri.offsetY}mm)`,
                height: "36mm",
                objectFit: "contain",
                zIndex: 2,
              })}
            />

            {/* ── KIRI: Nama ── */}
            <p
              {...ep("namaKiri", editorMode, selectedElement, onSelectElement, "Nama Kiri", {
                position: "absolute",
                left: `calc(2mm + ${lo.namaKiri.offsetX}mm)`,
                bottom: `calc(0mm + ${-lo.namaKiri.offsetY}mm)`,
                fontSize: "14pt",
                fontWeight: "400",
                color: "#1a0e00",
                margin: 0,
                whiteSpace: "nowrap",
                direction: "rtl",
                zIndex: 4,
              })}
            >
              ريكو أندريان البكالوريوس
            </p>

            {/* ── KANAN: Jabatan ── */}
            <p
              {...ep("jabatanKanan", editorMode, selectedElement, onSelectElement, "Jabatan Kanan", {
                position: "absolute",
                right: `calc(2mm + ${-lo.jabatanKanan.offsetX}mm)`,
                top: `calc(0mm + ${lo.jabatanKanan.offsetY}mm)`,
                fontSize: "14pt",
                color: "#1a0e00",
                fontWeight: 500,
                margin: 0,
                whiteSpace: "nowrap",
                direction: "rtl",
                zIndex: 4,
              })}
            >
              أمينة المناهج للتعليم عن بعد
            </p>


            {/* ── KANAN: Tanda Tangan ── */}
            <img
              src="/images/signature.png"
              alt="TTD Kanan"
              {...ep("ttdKanan", editorMode, selectedElement, onSelectElement, "TTD Kanan", {
                position: "absolute",
                right: `calc(10mm + ${-lo.ttdKanan.offsetX}mm)`,
                top: `calc(6mm + ${lo.ttdKanan.offsetY}mm)`,
                height: "36mm",
                objectFit: "contain",
                zIndex: 2,
              })}
            />

            {/* ── KANAN: Nama ── */}
            <p
              {...ep("namaKanan", editorMode, selectedElement, onSelectElement, "Nama Kanan", {
                position: "absolute",
                right: `calc(2mm + ${-lo.namaKanan.offsetX}mm)`,
                bottom: `calc(0mm + ${-lo.namaKanan.offsetY}mm)`,
                fontSize: "14pt",
                fontWeight: "400",
                color: "#1a0e00",
                margin: 0,
                whiteSpace: "nowrap",
                direction: "rtl",
                zIndex: 4,
              })}
            >
              إسما يونيا ساري
            </p>

          </div>{/* end signature area */}
        </div>

        {/* Tanggal Cetak */}
        <div
          {...ep("tanggalCetak", editorMode, selectedElement, onSelectElement, "Tanggal Cetak", {
            position: "absolute",
            bottom: `calc(8mm + ${-lo.tanggalCetak.offsetY}mm)`,
            left: `calc(45% + ${lo.tanggalCetak.offsetX}mm)`,
            transform: "translateX(-50%)",
            zIndex: 4,
            direction: "rtl",
          })}
        >
          <p style={{ fontSize: "15pt", color: "#1a0e00", margin: 0, whiteSpace: "nowrap" }}>
            {tanggalCetak} م
          </p>
        </div>
      </div>
    </div>
  );
}
