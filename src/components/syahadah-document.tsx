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

export function SyahadahDocument({ qrUrl, data, layout, editorMode, selectedElement, onSelectElement }: SyahadahDocumentProps) {
  const lo = layout || getDefaultLayout();
  const isMusyarokah = data.status === "MUSYAROKAH";
  let tanggalMulai = data.template.tgl_mulai_arab || "........";
  const tanggalSampai = data.template.tgl_selesai_arab || "........";

  if (tanggalMulai !== "........" && tanggalSampai !== "........") {
    const partsMulai = tanggalMulai.trim().split(/\s+/);
    const partsSampai = tanggalSampai.trim().split(/\s+/);
    if (partsMulai.length > 1 && partsSampai.length > 1) {
      const yearMulai = partsMulai[partsMulai.length - 1];
      const yearSampai = partsSampai[partsSampai.length - 1];
      if (yearMulai === yearSampai && /^[\d٠-٩]+$/.test(yearMulai)) {
        tanggalMulai = partsMulai.slice(0, -1).join(" ");
      }
    }
  }

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
        <img
          src="/images/syahadah-bg.webp"
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

        {/* QR Code */}
        <div
          {...elProps("qrCode", editorMode, selectedElement, onSelectElement, "QR Code")}
          style={{
            position: "absolute",
            top: `calc(70mm + ${lo.qrCode.offsetY}mm)`,
            right: `calc(8mm + ${-lo.qrCode.offsetX}mm)`,
            width: "88mm",
            zIndex: 3,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            ...(editorMode ? { cursor: "pointer" } : {}),
          }}
        >
          <p
            style={{
              fontSize: "14pt",
              color: "#000",
              textAlign: "center",
              marginBottom: "5mm",
              marginTop: 0,
              direction: "rtl",
            }}
          >
            امسح الكود للتحقق من الأصالة
          </p>
          <QRCodeSVG
            value={qrUrl}
            size={100}
            level="H"
            imageSettings={{ src: "/images/logo.png", height: 35, width: 35, excavate: true }}
          />
        </div>

        {/* Tabel Nilai */}
        {!isMusyarokah && (
          <div
            {...elProps("tabelNilai", editorMode, selectedElement, onSelectElement, "Tabel Nilai")}
            style={{
              position: "absolute",
              top: `calc(130mm + ${lo.tabelNilai.offsetY}mm)`,
              right: `calc(0mm + ${-lo.tabelNilai.offsetX}mm)`,
              width: "90mm", // Default width, can adjust if columns > 1
              zIndex: 3,
              ...(editorMode ? { cursor: "pointer" } : {}),
            }}
          >
            {(() => {
              const numCols = lo.tabelNilai.columns || 1;
              const totalItems = data.nilaiRows.length;
              // Ceiling division
              const rowsPerCol = Math.ceil(totalItems / numCols);
              const tableWidth = lo.tabelNilai.tableWidth ?? (numCols === 1 ? 80 : 100);

              return (
                <table
                  style={{
                    width: `${tableWidth}%`,
                    borderCollapse: "collapse",
                    fontSize: "15pt",
                    direction: "rtl",
                    border: "1px solid #000",
                    marginLeft: numCols > 1 ? "-20mm" : "0", // expand left if multiple cols
                  }}
                >
                  <thead>
                    <tr>
                      <th
                        colSpan={numCols * 2}
                        style={{
                          padding: "1.5mm 3mm",
                          textAlign: "center",
                          fontWeight: "500",
                          color: "#000",
                          border: "1px solid #000",
                          fontSize: "15pt",
                        }}
                      >
                        حصيلة نتائج الطالب/الطالبة
                      </th>
                    </tr>
                    <tr>
                      {Array.from({ length: numCols }).map((_, i) => (
                        <React.Fragment key={i}>
                          <th
                            style={{
                              padding: "1mm 3mm",
                              textAlign: "center",
                              fontWeight: "700",
                              color: "#1a0e00",
                              border: "1.2px solid #000",
                              fontSize: "15pt",
                            }}
                          >
                            المادة
                          </th>
                          <th
                            style={{
                              padding: "1mm 2mm",
                              textAlign: "center",
                              fontWeight: "700",
                              color: "#1a0e00",
                              border: "1.2px solid #000",
                              width: `${lo.tabelNilai.colWidthDarajah ?? 35}mm`,
                              fontSize: "15pt",
                            }}
                          >
                            الدرجة
                          </th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: rowsPerCol }).map((_, rowIndex) => (
                      <tr key={rowIndex}>
                        {Array.from({ length: numCols }).map((_, colIndex) => {
                          const itemIndex = colIndex * rowsPerCol + rowIndex;
                          const row = data.nilaiRows[itemIndex];

                          if (!row) {
                            return (
                              <React.Fragment key={colIndex}>
                                <td style={{ border: "1px solid #000" }}></td>
                                <td style={{ border: "1px solid #000" }}></td>
                              </React.Fragment>
                            );
                          }

                          return (
                            <React.Fragment key={colIndex}>
                              <td
                                style={{
                                  padding: "1mm 3mm",
                                  textAlign: "center",
                                  color: "#1a0e00",
                                  border: "1px solid #000",
                                  fontSize: "16pt",
                                }}
                              >
                                {row.nama_arab}
                              </td>
                              <td
                                style={{
                                  padding: "1mm 2mm",
                                  textAlign: "center",
                                  fontWeight: "700",
                                  color: "#1a0e00",
                                  border: "1px solid #000",
                                  fontSize: "13pt",
                                }}
                              >
                                {isMusyarokah || row.skor === null ? "" : convertToArabicNumerals(Math.round(row.skor))}
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
          </div>
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
              fontSize: "18pt",
              lineHeight: 2,
              color: "#1a0e00",
              textAlign: "justify",
              marginBottom: "4mm",
              marginTop: 0,
              transform: `translate(${lo.paragrafPembuka.offsetX}mm, ${lo.paragrafPembuka.offsetY}mm)`,
            }}
          >
            <p dir="rtl" style={{ textAlign: "center", marginLeft: "100px", marginTop: "27px" }}>
              بعد الوصية بتقوى الله واتباع سنة رسول الله، قرر مركز العربية بباري كديري إندونيسيا،
              <br />
              منح شهادة الاستكمال للطالب/الطالبة :
            </p>
          </div>

          {/* Nama Santri */}
          <div
            {...elProps("namaSantri", editorMode, selectedElement, onSelectElement, "Nama Santri")}
            dir="ltr"
            style={{
              textAlign: "center",
              marginBottom: "2mm",
              marginLeft: "50px",
              transform: `translate(${lo.namaSantri.offsetX}mm, ${lo.namaSantri.offsetY}mm)`,
            }}
          >
            <span
              style={{
                fontSize: `${namaFontSize}pt`,
                fontWeight: "900",
                color: "#1a6b1a",
                fontFamily: "Georgia, 'Times New Roman', serif",
                letterSpacing: "0.01em",
                lineHeight: 1,
                display: "inline-block",
                whiteSpace: "nowrap",
              }}
            >
              {data.masterSantri.nama}
            </span>
          </div>

          {/* Teks Duf'ah */}
          <p
            {...elProps("teksDufah", editorMode, selectedElement, onSelectElement, "Teks Duf'ah")}
            style={{
              fontSize: "18pt",
              lineHeight: 2,
              color: "#1a0e00",
              textAlign: "center",
              margin: 0,
              transform: `translate(${lo.teksDufah.offsetX}mm, ${lo.teksDufah.offsetY}mm)`,
              position: "relative",
            }}
          >
            وذلك لإكماله/لإكمالها الدراسات والامتحانات التي أقيمت
            {data.program?.nama_indo?.toLowerCase().includes("akbarnas") && data.template.teks_dufah_akbarnas_arab ? (
              <>
                <br />
                في <strong style={{ color: "#8B1A1A" }}>{data.template.teks_dufah_akbarnas_arab}</strong>
              </>
            ) : (
              <>
                {" "}في <strong style={{ color: "#8B1A1A" }}>{data.template.teks_dufah_arab ? data.template.teks_dufah_arab : (data.dufahNamaArab ? data.dufahNamaArab : translateDufahToArabic(data.masterSantri.dufahNama).replace("الدفعة ", ""))}</strong>
              </>
            )}
          </p>

          {/* Teks Program */}
          <p
            {...elProps("teksProgram", editorMode, selectedElement, onSelectElement, "Teks Program")}
            style={{
              fontSize: "18pt",
              lineHeight: 2,
              color: "#1a0e00",
              textAlign: "center",
              margin: 0,
              transform: `translate(${lo.teksProgram.offsetX}mm, ${lo.teksProgram.offsetY}mm)`,
              position: "relative",
            }}
          >
            برنامج <strong style={{ color: "#8B1A1A" }}>{convertToArabicNumerals(data.program.nama_arab)}</strong>
          </p>

          {/* Teks Periode */}
          <p
            {...elProps("teksPeriode", editorMode, selectedElement, onSelectElement, "Teks Periode")}
            style={{
              fontSize: "18pt",
              lineHeight: 2,
              fontWeight: "700",
              textAlign: "center",
              margin: 0,
              transform: `translate(${lo.teksPeriode.offsetX}mm, ${lo.teksPeriode.offsetY}mm)`,
              position: "relative",
            }}
          >
            <span style={{ color: "#1a0e00" }}>التي تقام خلال فترات </span>
            <strong style={{ color: "#8B1A1A" }}>{tanggalMulai}</strong>
            <span style={{ color: "#8B1A1A" }}> إلى </span>
            <strong style={{ color: "#8B1A1A" }}>{tanggalSampai}</strong>
          </p>

          {/* Rata-rata */}
          {!isMusyarokah && (
            <p
              {...elProps("rataRata", editorMode, selectedElement, onSelectElement, "Rata-rata")}
              style={{
                fontSize: "20pt",
                lineHeight: 2,
                color: "#1a0e00",
                textAlign: "center",
                margin: 0,
                transform: `translate(${lo.rataRata.offsetX}mm, ${lo.rataRata.offsetY}mm)`,
                position: "relative",
              }}
            >
              بمعدل تراكمي عام (<strong>{averageValue}</strong>)
            </p>
          )}

          {/* Predikat */}
          {!isMusyarokah && (
            <p
              {...elProps("predikat", editorMode, selectedElement, onSelectElement, "Predikat")}
              style={{
                fontSize: "20pt",
                lineHeight: 2,
                color: "#1a0e00",
                textAlign: "center",
                margin: 0,
                transform: `translate(${lo.predikat?.offsetX ?? 0}mm, ${lo.predikat?.offsetY ?? 0}mm)`,
                position: "relative",
              }}
            >
              وبتقدير <strong style={{ color: "#8B1A1A" }}>{averagePredikat}</strong>
            </p>
          )}

          {/* Doa Penutup */}
          <p
            {...elProps("doaPenutup", editorMode, selectedElement, onSelectElement, "Doa Penutup")}
            style={{
              fontSize: "20pt",
              lineHeight: 2,
              color: "#1a0e00",
              textAlign: "center",
              margin: 0,
              transform: `translate(${lo.doaPenutup.offsetX}mm, ${lo.doaPenutup.offsetY}mm)`,
              position: "relative",
            }}
          >
            نسأل الله أن يوفقه/يوفقها لخدمة الإسلام والعلم
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
    </div>
  );
}
