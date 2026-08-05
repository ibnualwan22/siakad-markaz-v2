"use client";

import React, { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { LayoutData, LayoutElementKey, getDefaultLayout } from "@/lib/syahadah-layout";

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
      tgl_cetak_indo: string;
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
    riwayatSantri: {
      id: string;
    };
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

export function SyahadahCacDocument({ qrUrl, data, layout, editorMode, selectedElement, onSelectElement }: SyahadahDocumentProps) {
  const lo = layout || getDefaultLayout();
  const [serialNumber, setSerialNumber] = useState<string>("Sedang mengambil serial...");
  const namaFontSize = lo.namaSantri.fontSize ?? 40;

  // Fetch the CAC serial number dynamically to get the current serial number 
  useEffect(() => {
    async function fetchSerial() {
      try {
        const res = await fetch(`/api/admin/cac-serial?riwayatId=${data.riwayatSantri.id}`);
        if (res.ok) {
          const result = await res.json();
          setSerialNumber(result.serialNumber);
        } else {
          setSerialNumber("Gagal mengambil Serial");
        }
      } catch (err) {
        setSerialNumber("Gagal mengambil Serial");
      }
    }
    fetchSerial();
  }, [data.riwayatSantri.id]);

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
          fontFamily: "'Inter', 'Segoe UI', sans-serif",
          flexShrink: 0,
          background: "white",
        }}
        onClick={() => editorMode && onSelectElement?.(null as any)}
      >
        {/* Background */}
        <img
          src="/images/syahadah-cac.png"
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

        {/* Garis Bantu Editor */}
        {editorMode && (
          <>
            <div className="editor-crosshair" style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: "1px", borderLeft: "1px dashed rgba(59, 130, 246, 0.5)", zIndex: 1, pointerEvents: "none" }} />
            <div className="editor-crosshair" style={{ position: "absolute", top: "50%", left: 0, right: 0, height: "1px", borderTop: "1px dashed rgba(59, 130, 246, 0.5)", zIndex: 1, pointerEvents: "none" }} />
          </>
        )}

        {/* Main Content Area */}
        <div
          style={{
            position: "absolute",
            top: "60mm",
            left: "50%",
            transform: "translateX(-50%)",
            width: "270mm",
            bottom: "10mm",
            zIndex: 3,
            display: "flex",
            flexDirection: "column",
            overflow: "visible",
            alignItems: "center"
          }}
        >
          {/* Serial Number (Reusing elemen teksPeriode as Serial) */}
          <div
            {...elProps("teksPeriode", editorMode, selectedElement, onSelectElement, "No. Seri CAC")}
            style={{
              fontSize: "14pt",
              fontWeight: 600,
              color: "#333",
              textAlign: "center",
              marginBottom: "3mm",
              marginTop: "1mm",
              transform: `translate(${lo.teksPeriode.offsetX}mm, ${lo.teksPeriode.offsetY}mm)`,
            }}
          >
            {serialNumber}
          </div>

          <div
            {...elProps("paragrafPembuka", editorMode, selectedElement, onSelectElement, "Paragraf Pembuka")}
            style={{
              fontSize: "15pt",
              color: "#333",
              textAlign: "center",
              marginBottom: "5mm",
              transform: `translate(${lo.paragrafPembuka.offsetX}mm, ${lo.paragrafPembuka.offsetY}mm)`,
            }}
          >
            This certificate is proudly presented to
          </div>

          {/* Nama Santri */}
          <div
            {...elProps("namaSantri", editorMode, selectedElement, onSelectElement, "Nama Santri")}
            style={{
              textAlign: "center",
              marginBottom: "2mm",
              transform: `translate(${lo.namaSantri.offsetX}mm, ${lo.namaSantri.offsetY}mm)`,
            }}
          >
            <span
              style={{
                fontSize: `${namaFontSize}pt`,
                fontWeight: "900",
                color: "#b08527",
                display: "inline-block",
                whiteSpace: "nowrap",
                paddingBottom: "1mm",
                paddingLeft: "10mm",
                paddingRight: "10mm",
              }}
            >
              {data.masterSantri.nama.toUpperCase()}
            </span>
          </div>



          {/* Body Text */}
          <p
            {...elProps("teksDufah", editorMode, selectedElement, onSelectElement, "Teks Keterangan")}
            style={{
              fontSize: "12pt",
              lineHeight: 1.5,
              color: "#1a1a1a",
              textAlign: "center",
              margin: 0,
              maxWidth: "250mm",
              transform: `translate(${lo.teksDufah.offsetX}mm, ${lo.teksDufah.offsetY}mm)`,
            }}
          >
            Has successfully completed the prescribed curriculum and is hereby declared competent. The holder of<br />
            this certificate is entitled to bear the professional non-academic designation of <strong>C.AC. (Certified Arabic</strong><br />
            <strong>Competency)</strong> in accordance with applicable international standards and regulations.<br />
            Congratulations on this remarkable achievement.
          </p>
        </div>

        {/* Tanggal Cetak */}
        <div
          {...elProps("tanggalCetak", editorMode, selectedElement, onSelectElement, "Tanggal Cetak")}
          style={{
            position: "absolute",
            bottom: `calc(13mm + ${-lo.tanggalCetak.offsetY}mm)`,
            right: `calc(32mm + ${-lo.tanggalCetak.offsetX}mm)`,
            zIndex: 4,
            ...(editorMode ? { cursor: "pointer" } : {}),
          }}
        >
          <p style={{ fontSize: "11pt", fontWeight: "600", color: "#1a0e00", margin: 0, whiteSpace: "nowrap" }}>
            Issued in Pare, {data.template.tgl_cetak_indo}
          </p>
        </div>

        {/* QR Code */}
        <div
          {...elProps("qrCode", editorMode, selectedElement, onSelectElement, "QR Code")}
          style={{
            position: "absolute",
            bottom: `calc(35mm + ${-lo.qrCode.offsetY}mm)`,
            left: `calc(28mm + ${lo.qrCode.offsetX}mm)`,
            zIndex: 4,
            background: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center"
          }}
        >
          <div style={{ background: "linear-gradient(135deg, #1d4ed8, #60a5fa)", padding: "1.5mm", borderRadius: "3mm", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" as any }}>
            <div style={{ background: "white", padding: "1.5mm", borderRadius: "2mm", display: "flex", justifyContent: "center", alignItems: "center", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" as any }}>
              <QRCodeSVG value={qrUrl} size={90} fgColor="#1d4ed8" />
            </div>
          </div>
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
