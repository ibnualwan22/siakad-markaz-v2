"use client";

import React from "react";
import { QRCodeSVG } from "qrcode.react";
import { LayoutData, LayoutElementKey, getDefaultLayout } from "@/lib/syahadah-layout";

// Reuses same prop shape as SyahadahDocument for compatibility
type SyahadahTuratsDocumentProps = {
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
      tgl_cetak_indo: string;
      tgl_mulai_indo: string | null;
      tgl_selesai_indo: string | null;
      jabatan_mudir_indo: string;
      nama_mudir_indo: string;
      // Turats-specific (optional, falls back to Indo fields)
      nama_mudir_turats?: string | null;
      jabatan_mudir_turats?: string | null;
      tgl_cetak_turats?: string | null;
      tgl_mulai_turats?: string | null;
      tgl_selesai_turats?: string | null;
    };
    nilaiRows: Array<{
      mapelId: string;
      nama_indo: string;
      skor: number | null;
    }>;
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

export function SyahadahMartabahTuratsDocument({
  qrUrl,
  data,
  layout,
  editorMode,
  selectedElement,
  onSelectElement,
}: SyahadahTuratsDocumentProps) {
  const lo = layout || getDefaultLayout();
  const isMusyarokah = data.status === "MUSYAROKAH";

  // Use Turats-specific template fields with fallbacks
  const tglCetak = data.template.tgl_cetak_turats || data.template.tgl_cetak_indo;
  const tglMulai = data.template.tgl_mulai_turats || data.template.tgl_mulai_indo || "........";
  const tglSelesai = data.template.tgl_selesai_turats || data.template.tgl_selesai_indo || "........";
  // Hardcoded for Turats
  const namaMudir = "Ustadz Abdul Wahhab, M.Pd.";
  const jabatanMudir = "Direktur Markaz Turats";

  const averageValue = isMusyarokah ? "" : Math.round(data.average).toString();
  const averagePredikat = isMusyarokah ? "" : data.averagePredikat.indo;

  const namaFontSize = lo.namaSantri.fontSize ?? 40;

  // Extract marhalah from program name (e.g., "Marhalah 1", "Marhalah 2")
  const programNama = data.program.nama_indo;

  return (
    <div
      className="container-syahadah print:block print:min-h-0 mx-auto mb-12"
      style={{ pageBreakAfter: "always" }}
    >
      <div
        className="doc-syahadah"
        style={{
          width: "330mm",
          height: "215mm",
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
          fontFamily: "'Crimson Text', Georgia, 'Times New Roman', serif",
          flexShrink: 0,
          background: "white",
          color: "#1a1a1a",
        }}
        onClick={() => editorMode && onSelectElement?.(null as any)}
      >
        {/* Turats Background */}
        <img
          src="/images/syahadah-martabah-turats.png"
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

        {/* QR Code and Grade Table Hidden for Reward Certificate */}

        {/* Main Content Area — LTR, left of center */}
        <div
          dir="ltr"
          style={{
            position: "absolute",
            top: "48mm",
            left: "48mm",
            right: "20mm",
            bottom: "20mm",
            zIndex: 3,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Paragraf Pembuka */}
          <div
            {...elProps("paragrafPembuka", editorMode, selectedElement, onSelectElement, "Paragraf Pembuka")}
            style={{
              fontSize: "14pt",
              lineHeight: 1.8,
              color: "#1a1a1a",
              textAlign: "center",
              marginBottom: "8mm",
              marginTop: "16mm",
              transform: `translate(${lo.paragrafPembuka.offsetX}mm, ${lo.paragrafPembuka.offsetY}mm)`,
            }}
          >
            <p style={{ margin: 0 }}>
              Markaz Turats memberikan penghargaan kepada mahasiswa berprestasi:
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
                color: "#1a4a1a",
                fontFamily: "Georgia, 'Times New Roman', serif",
                letterSpacing: "0.01em",
                lineHeight: 1.2,
                display: "inline-block",
                whiteSpace: "nowrap",
              }}
            >
              {data.masterSantri.nama}
            </span>
          </div>

          {/* Teks Keterangan */}
          <p
            {...elProps("teksDufah", editorMode, selectedElement, onSelectElement, "Teks Keterangan")}
            style={{
              fontSize: "14pt",
              lineHeight: 1.8,
              color: "#1a1a1a",
              textAlign: "center",
              margin: 0,
              marginBottom: "1mm",
              transform: `translate(${lo.teksDufah.offsetX}mm, ${lo.teksDufah.offsetY}mm)`,
            }}
          >
            sebagai <i>Peringkat Satu dengan Predikat Istimewa</i> pada program <strong style={{ color: "#6b1a1a" }}>{programNama}</strong>
          </p>

          {/* Teks Beasiswa */}
          <p
            {...elProps("teksProgram", editorMode, selectedElement, onSelectElement, "Teks Beasiswa")}
            style={{
              fontSize: "14pt",
              lineHeight: 1.8,
              color: "#1a1a1a",
              textAlign: "center",
              margin: 0,
              marginBottom: "20mm",
              transform: `translate(${lo.teksProgram.offsetX}mm, ${lo.teksProgram.offsetY}mm)`,
            }}
          >
            sehingga berhak menerima beasiswa untuk program selanjutnya senilai Rp.425.000<br />
            (masa berlaku 6 bulan sejak sertifikat ini diterbitkan).
          </p>



          {/* Signature Area */}
          <div style={{ marginTop: "auto", display: "flex", justifyContent: "center" }}>
            <div style={{ textAlign: "center", minWidth: "60mm", position: "relative" }}>
              {/* Tanggal Cetak */}
              <p
                {...elProps("tanggalCetak", editorMode, selectedElement, onSelectElement, "Tanggal Cetak")}
                style={{
                  fontSize: "12pt",
                  color: "#1a1a1a",
                  marginBottom: "2mm",
                  marginTop: 0,
                  transform: `translate(${lo.tanggalCetak.offsetX}mm, ${lo.tanggalCetak.offsetY}mm)`,
                  position: "relative",
                }}
              >
                Diterbitkan di Pare, {tglCetak}
              </p>

              {/* Jabatan Mudir */}
              <p
                {...elProps("jabatanMudir", editorMode, selectedElement, onSelectElement, "Jabatan Mudir")}
                style={{
                  fontSize: "12pt",
                  color: "#1a1a1a",
                  marginBottom: "1mm",
                  marginTop: 0,
                  transform: `translate(${lo.jabatanMudir.offsetX}mm, ${lo.jabatanMudir.offsetY}mm)`,
                  position: "relative",
                }}
              >
                {jabatanMudir}
              </p>

              <div style={{ position: "relative", height: "24mm", marginBottom: "1mm" }}>
                {/* Stempel */}
                <img
                  {...elProps("stempel", editorMode, selectedElement, onSelectElement, "Stempel")}
                  src="/images/stempel-turats.png"
                  alt="Stempel"
                  style={{
                    position: "absolute",
                    left: `calc(50% - 25mm + ${lo.stempel.offsetX}mm)`,
                    bottom: `calc(-8mm + ${-lo.stempel.offsetY}mm)`,
                    height: "45mm",
                    objectFit: "contain",
                    opacity: 0.88,
                    zIndex: 1,
                    transform: "rotate(-15deg)",
                    ...(editorMode ? { cursor: "pointer" } : {}),
                  }}
                />
                {/* Tanda Tangan Turats */}
                <img
                  {...elProps("tandaTangan", editorMode, selectedElement, onSelectElement, "Tanda Tangan")}
                  src="/images/signature-turats.png"
                  alt="Tanda Tangan"
                  style={{
                    position: "absolute",
                    left: `calc(50% - 22mm + ${lo.tandaTangan.offsetX}mm)`,
                    bottom: `calc(-2mm + ${-lo.tandaTangan.offsetY}mm)`,
                    height: "45mm",
                    objectFit: "contain",
                    zIndex: 2,
                    filter: "brightness(0)",
                    ...(editorMode ? { cursor: "pointer" } : {}),
                  }}
                />
              </div>

              {/* Nama Mudir */}
              <p
                {...elProps("namaMudir", editorMode, selectedElement, onSelectElement, "Nama Mudir")}
                style={{
                  fontSize: "12pt",
                  fontWeight: "700",
                  color: "#1a1a1a",
                  paddingTop: "1mm",
                  margin: 0,
                  transform: `translate(${lo.namaMudir.offsetX}mm, ${lo.namaMudir.offsetY}mm)`,
                  position: "relative",
                  textDecoration: "underline"
                }}
              >
                {namaMudir}
              </p>
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
