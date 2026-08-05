"use client";

import React from "react";
import { QRCodeSVG } from "qrcode.react";
import { convertToArabicNumerals } from "@/lib/formatters";
import { translateDufahToArabic } from "@/lib/formatters";
import { LayoutData, LayoutElementKey, getDefaultLayout } from "@/lib/syahadah-layout";

// Define a minimal required type derived from getCertificateData
type SyahadahDocumentProps = {
  qrUrl: string;
  data: {
    status: string;
    average: number;
    averagePredikat: { indo: string; arab: string };
    masterSantri: {
      nama: string;
      dufahNama: string;
    };
    program: {
      nama_indo: string;
      nama_arab: string;
    };
    template: {
      tgl_cetak_arab: string;
      tgl_mulai_arab: string | null;
      tgl_selesai_arab: string | null;
      jabatan_mudir_arab: string;
      nama_mudir_arab: string;
      teks_dufah_akbarnas_arab?: string | null;
      teks_dufah_arab?: string | null;
    };
    nilaiRows: Array<{
      mapelId: string;
      nama_arab: string;
      skor: number | null;
    }>;
    dufahNamaArab?: string | null;
  };
  layout?: LayoutData;
  editorMode?: boolean;
  selectedElement?: LayoutElementKey | null;
  onSelectElement?: (key: LayoutElementKey) => void;
};

function elProps(
  key: LayoutElementKey,
  editorMode?: boolean,
  selectedElement?: LayoutElementKey | null,
  onSelectElement?: (key: LayoutElementKey) => void,
  label?: string
) {
  if (!editorMode) return {};
  return {
    className: `syahadah-element ${selectedElement === key ? "selected" : ""}`,
    "data-label": label || key,
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelectElement?.(key);
    },
    style: { position: "relative" as const },
  };
}

export function SyahadahMartabahDocument({ qrUrl, data, layout, editorMode, selectedElement, onSelectElement }: SyahadahDocumentProps) {
  const lo = layout || getDefaultLayout();
  const isMusyarokah = data.status === "MUSYAROKAH";
  const tanggalMulai = data.template.tgl_mulai_arab || "........";
  const tanggalSampai = data.template.tgl_selesai_arab || "........";
  const averageValue = isMusyarokah ? "" : convertToArabicNumerals(Math.round(data.average));
  const averagePredikat = isMusyarokah ? "" : data.averagePredikat.arab;

  const namaFontSize = lo.namaSantri.fontSize ?? 40;

  return (
    <div className="container-syahadah print:block print:min-h-0 mx-auto mb-12" style={{ pageBreakAfter: "always" }}>
      <div
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
          src="/images/syahadah-martabah.png"
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

        {/* Garis Bantu Editor (Crosshairs) */}
        {editorMode && (
          <>
            {/* Vertical Center Line */}
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
            {/* Horizontal Center Line */}
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

        {/* Main Content Area */}
        <div
          dir="rtl"
          style={{
            position: "absolute",
            top: "72mm",
            left: "55%",
            transform: "translateX(-62%)",
            width: "175mm",
            bottom: "10mm",
            zIndex: 3,
            display: "flex",
            flexDirection: "column",
            overflow: "visible",
          }}
        >
          {/* Paragraf Pembuka */}
          <div
            {...elProps("paragrafPembuka", editorMode, selectedElement, onSelectElement, "Paragraf Pembuka")}
            style={{
              fontSize: "22pt",
              lineHeight: 2.2,
              color: "#1a1a1a",
              textAlign: "center",
              marginBottom: "8mm",
              marginTop: "5mm",
              transform: `translate(${lo.paragrafPembuka.offsetX}mm, ${lo.paragrafPembuka.offsetY}mm)`,
            }}
          >
            <p style={{ margin: 0 }}>
              يقدم مركز العربية الجائزة إلى الطالب/ة المتفوق/ة:
            </p>
          </div>

          {/* Nama Santri */}
          <div
            {...elProps("namaSantri", editorMode, selectedElement, onSelectElement, "Nama Santri")}
            style={{
              textAlign: "center",
              marginBottom: "6mm",
              transform: `translate(${lo.namaSantri.offsetX}mm, ${lo.namaSantri.offsetY}mm)`,
            }}
          >
            <span
              style={{
                fontSize: `${namaFontSize}pt`,
                fontWeight: "900",
                color: "#b08527",
                fontFamily: "Georgia, 'Times New Roman', serif",
                letterSpacing: "0.01em",
                lineHeight: 1.2,
                display: "inline-block",
                whiteSpace: "nowrap",
                borderBottom: "2px solid #b08527",
                paddingBottom: "2mm",
                paddingLeft: "10mm",
                paddingRight: "10mm",
              }}
              dir="ltr"
            >
              {data.masterSantri.nama}
            </span>
          </div>

          {/* Teks Keterangan & Beasiswa (Combined) */}
          <p
            {...elProps("teksDufah", editorMode, selectedElement, onSelectElement, "Teks Beasiswa")}
            style={{
              fontSize: "22pt",
              lineHeight: 2.4,
              color: "#1a1a1a",
              textAlign: "center",
              margin: 0,
              marginBottom: "1mm",
              transform: `translate(${lo.teksDufah.offsetX}mm, ${lo.teksDufah.offsetY}mm)`,
            }}
          >
            لحصوله/ها على الامتياز مع مرتبة الشرف الأولى في برنامج {data.program.nama_arab}<br />
            يحصل على المنحة الدراسية للبرنامج التالي بقيمة ٤٢٥.٠٠٠ روبية<br />
            (تجري لمدة ٦ أشهر من صدرها)
          </p>

          {/* Signature Area - Each element separate */}
          <div style={{ marginTop: "auto", display: "flex", justifyContent: "flex-end" }}>
            <div style={{ textAlign: "center", minWidth: "55mm", position: "relative" }}>
              {/* Jabatan Mudir */}
              <p
                {...elProps("jabatanMudir", editorMode, selectedElement, onSelectElement, "Jabatan Mudir")}
                style={{
                  fontSize: "18pt",
                  color: "#1a0e00",
                  marginBottom: "2mm",
                  marginTop: -50,
                  marginLeft: "-39mm",
                  transform: `translate(${lo.jabatanMudir.offsetX}mm, ${lo.jabatanMudir.offsetY}mm)`,
                  position: "relative",
                }}
              >
                {data.template.jabatan_mudir_arab}
              </p>

              <div style={{ position: "relative", height: "19mm", marginBottom: "1mm" }}>
                {/* Stempel */}
                <img
                  {...elProps("stempel", editorMode, selectedElement, onSelectElement, "Stempel")}
                  src="/images/stamp.png"
                  alt="Stempel"
                  style={{
                    position: "absolute",
                    left: `calc(-29mm + ${lo.stempel.offsetX}mm)`,
                    bottom: `calc(-13mm + ${-lo.stempel.offsetY}mm)`,
                    height: "40mm",
                    objectFit: "contain",
                    opacity: 0.88,
                    zIndex: 3,
                    ...(editorMode ? { cursor: "pointer" } : {}),
                  }}
                />
                {/* Tanda Tangan */}
                <img
                  {...elProps("tandaTangan", editorMode, selectedElement, onSelectElement, "Tanda Tangan")}
                  src="/images/signature.png"
                  alt="Tanda Tangan"
                  style={{
                    position: "absolute",
                    left: `calc(-29mm + ${lo.tandaTangan.offsetX}mm)`,
                    bottom: `calc(-2mm + ${-lo.tandaTangan.offsetY}mm)`,
                    height: "40mm",
                    objectFit: "contain",
                    zIndex: 1,
                    ...(editorMode ? { cursor: "pointer" } : {}),
                  }}
                />
              </div>

              {/* Nama Mudir */}
              <p
                {...elProps("namaMudir", editorMode, selectedElement, onSelectElement, "Nama Mudir")}
                style={{
                  fontSize: "18pt",
                  fontWeight: "400",
                  color: "#1a0e00",
                  paddingTop: "1mm",
                  margin: 0,
                  marginLeft: "-50mm",
                  transform: `translate(${lo.namaMudir.offsetX}mm, ${lo.namaMudir.offsetY}mm)`,
                  position: "relative",
                }}
              >
                {data.template.nama_mudir_arab}
              </p>
            </div>
          </div>
        </div>

        {/* Tanggal Cetak */}
        <div
          {...elProps("tanggalCetak", editorMode, selectedElement, onSelectElement, "Tanggal Cetak")}
          style={{
            position: "absolute",
            bottom: `calc(8mm + ${-lo.tanggalCetak.offsetY}mm)`,
            left: `calc(45% + ${lo.tanggalCetak.offsetX}mm)`,
            transform: "translateX(-50%)",
            zIndex: 4,
            direction: "rtl",
            ...(editorMode ? { cursor: "pointer" } : {}),
          }}
        >
          <p style={{ fontSize: "18pt", color: "#1a0e00", margin: 0, whiteSpace: "nowrap" }}>
            {data.template.tgl_cetak_arab} م
          </p>
        </div>
      </div>
      <style>{`
        @media print {
          body { background-color: white !important; margin: 0 !important; padding: 0 !important; }
          @page { size: 330mm 215mm landscape; margin: 0; }
        }
      `}</style>
    </div>
  );
}
