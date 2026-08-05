"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Armchair, ListOrdered, Printer, Loader2 } from "lucide-react";

type SantriRow = {
  id: string;
  nama: string;
  gender: string;
  programNama: string;
  programId: string | null;
  kelasNama: string;
  kelasId: string | null;
  statusKelulusan: string;
  average: number;
  averagePredikat: { indo: string; arab: string };
  isAktif: boolean;
  canViewIjazah: boolean;
  isMartabahUla?: boolean;
  programKategori?: string;
};

type KelasItem = {
  id: string;
  nama: string;
  programId: string;
  urutan_haflah?: number;
  waliKelas?: {
    nama: string;
  } | null;
};

const PROGRAM_ORDER = [
  "Shifr", "I'dad Awal", "I'dad Tsani",
  "Syarqi Awwal", "Syarqi Tsany", "Atiqah",
  "Takhasus Awal", "Takhasus Tsani", "Akbarnas"
];

function getProgramOrder(programNama: string) {
  const idx = PROGRAM_ORDER.findIndex(p => programNama.toLowerCase().includes(p.toLowerCase()));
  return idx === -1 ? 99 : idx;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

function padAndDirection(chunk: any[], size: number, start: "right" | "left") {
  const padded = [...chunk];
  while (padded.length < size) {
    padded.push(null);
  }
  return start === "right" ? padded.reverse() : padded;
}

export function HaflahWadaClient({
  santriRows,
  kelasList,
  dufahLabel
}: {
  santriRows: SantriRow[];
  kelasList: KelasItem[];
  dufahLabel: string;
}) {
  const [activeTab, setActiveTab] = useState<"denah" | "pemanggilan">("denah");
  const [colCount, setColCount] = useState<number>(10);
  const [doorOption, setDoorOption] = useState<"masuk-kanan-keluar-kiri" | "masuk-kiri-keluar-kanan" | "kanan-kiri" | "kanan" | "kiri">("masuk-kanan-keluar-kiri");
  const [mounted, setMounted] = useState(false);
  const [exporting, setExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Manage manual sorting modal
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [classOrder, setClassOrder] = useState<KelasItem[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const openOrderModal = () => {
    // Sort taking 0 as the bottom to match processedSantri behavior
    const sorted = [...kelasList].sort((a, b) => {
      const uA = a.urutan_haflah || 0;
      const uB = b.urutan_haflah || 0;
      if (uA !== uB) {
        if (uA === 0) return 1;
        if (uB === 0) return -1;
        return uA - uB;
      }
      return a.nama.localeCompare(b.nama, "id");
    });
    setClassOrder(sorted);
    setShowOrderModal(true);
  };

  const handleDragStart = (idx: number) => {
    setDraggedIdx(idx);
  };

  const handleDragEnter = (targetIdx: number) => {
    if (draggedIdx === null || draggedIdx === targetIdx) return;
    const newOrder = [...classOrder];
    const draggedItem = newOrder[draggedIdx];
    newOrder.splice(draggedIdx, 1);
    newOrder.splice(targetIdx, 0, draggedItem);
    setClassOrder(newOrder);
    setDraggedIdx(targetIdx);
  };

  const saveOrder = async () => {
    setSavingOrder(true);
    try {
      const payload = classOrder.map((cls, index) => ({
        id: cls.id,
        urutan_haflah: index + 1
      }));
      await fetch("/api/admin/kelas/sort-haflah", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      window.location.reload();
    } catch (e) {
      console.error("Gagal simpan urutan", e);
    } finally {
      setSavingOrder(false);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  const kelasMap = useMemo(() => {
    const map = new Map<string, KelasItem>();
    kelasList.forEach(k => map.set(k.id, k));
    return map;
  }, [kelasList]);

  const processedSantri = useMemo(() => {
    const topByProgram = new Map<string, string>();
    const programGroups = new Map<string, SantriRow[]>();

    santriRows.forEach(s => {
      const pId = s.programId || "unknown_program";
      if (!programGroups.has(pId)) programGroups.set(pId, []);
      programGroups.get(pId)!.push(s);
    });

    programGroups.forEach((students) => {
      students.sort((a, b) => b.average - a.average);
      if (students.length > 0) {
        topByProgram.set(students[0].programId || "unknown_program", students[0].id);
      }
    });

    let mapped = santriRows.map(s => ({
      ...s,
      isMartabahUla: topByProgram.get(s.programId || "unknown_program") === s.id
    }));

    let allSantriList = [...mapped];

    allSantriList.sort((a, b) => {
      // 1. Structural sort by strictly defined Class urutan_haflah priority
      const classA = a.kelasId ? kelasMap.get(a.kelasId) : undefined;
      const classB = b.kelasId ? kelasMap.get(b.kelasId) : undefined;

      const urutanA = classA?.urutan_haflah || 0;
      const urutanB = classB?.urutan_haflah || 0;

      if (urutanA !== urutanB) {
        if (urutanA === 0) return 1;
        if (urutanB === 0) return -1;
        return urutanA - urutanB;
      }

      // 2. Primary sort by program structurally first to keep logic intact when unconfigured
      const pA = getProgramOrder(a.programNama);
      const pB = getProgramOrder(b.programNama);
      if (pA !== pB) return pA - pB;

      // 3. Fallback sort structurally straight down by Class Alphabetically
      const kA = a.kelasNama.localeCompare(b.kelasNama, "id");
      if (kA !== 0) return kA;

      // 4. Group graduates above non-graduates inside the class if preferred, or just by score.
      const statA = (a.statusKelulusan === "TIDAK_LULUS") ? 2 : (a.statusKelulusan === "MUSYAROKAH" ? 1 : 0);
      const statB = (b.statusKelulusan === "TIDAK_LULUS") ? 2 : (b.statusKelulusan === "MUSYAROKAH" ? 1 : 0);
      if (statA !== statB) return statA - statB;

      // 5. Finally by average score
      return b.average - a.average;
    });

    let graduates = allSantriList.filter(s => s.statusKelulusan !== "TIDAK_LULUS");
    let nonGraduates = allSantriList.filter(s => s.statusKelulusan === "TIDAK_LULUS");

    return { allSantriList, graduates, nonGraduates };
  }, [santriRows, kelasMap]);

  const denahBanin = useMemo(() => [
    ...processedSantri.graduates.filter((s: SantriRow) => s.gender === "BANIN"),
    ...processedSantri.nonGraduates.filter((s: SantriRow) => s.gender === "BANIN")
  ], [processedSantri]);

  const denahBanat = useMemo(() => [
    ...processedSantri.graduates.filter((s: SantriRow) => s.gender === "BANAT"),
    ...processedSantri.nonGraduates.filter((s: SantriRow) => s.gender === "BANAT")
  ], [processedSantri]);



  const pemanggilanGroups = useMemo(() => {
    const groups = new Map<string, SantriRow[]>();
    // Pemanggilan EXCLUDES non-graduates
    processedSantri.graduates.forEach(s => {
      const kId = s.kelasId || "unknown_kelas";
      if (!groups.has(kId)) groups.set(kId, []);
      groups.get(kId)!.push(s);
    });

    const sortedClassIds = Array.from(groups.keys()).sort((a, b) => {
      const classA = kelasMap.get(a);
      const classB = kelasMap.get(b);

      const urutanA = classA?.urutan_haflah || 0;
      const urutanB = classB?.urutan_haflah || 0;

      if (urutanA !== urutanB) {
        if (urutanA === 0) return 1;
        if (urutanB === 0) return -1;
        return urutanA - urutanB;
      }

      const programA = processedSantri.graduates.find((s: SantriRow) => s.kelasId === a)?.programNama || "";
      const programB = processedSantri.graduates.find((s: SantriRow) => s.kelasId === b)?.programNama || "";

      const pA = getProgramOrder(programA);
      const pB = getProgramOrder(programB);
      if (pA !== pB) return pA - pB;

      return (classA?.nama || "").localeCompare(classB?.nama || "", "id");
    });

    return sortedClassIds.map(classId => {
      const students = groups.get(classId)!;
      return {
        kelas: kelasMap.get(classId),
        banin: students.filter(s => s.gender === "BANIN"),
        banat: students.filter(s => s.gender === "BANAT")
      };
    });
  }, [processedSantri, kelasMap]);

  const handleExportPDF = useCallback(async () => {
    if (!printRef.current || exporting) return;
    setExporting(true);

    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const isLandscape = activeTab === "denah";
      const f4Width = isLandscape ? 330.2 : 215.9;
      const f4Height = isLandscape ? 215.9 : 330.2;
      const orientation = isLandscape ? "landscape" : "portrait";
      const winWidth = isLandscape ? 1200 : 800; // Keep fixed horizontal bounds and allow text wrapping vertically
      const margin = 10;
      const usableWidth = f4Width - margin * 2;
      const usableHeight = f4Height - margin * 2;

      const pdf = new jsPDF({ orientation: orientation as "landscape" | "portrait", unit: "mm", format: [215.9, 330.2] });

      const oncloneHandler = (clonedDoc: Document) => {
        clonedDoc.querySelectorAll('link[rel="stylesheet"], style').forEach(el => el.remove());
        const resetStyle = clonedDoc.createElement("style");
        resetStyle.textContent = `* { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; box-sizing: border-box; }`;
        clonedDoc.head.appendChild(resetStyle);

        const cloneContainer = clonedDoc.querySelector('.neu-card-white');
        if (cloneContainer) {
          (cloneContainer as HTMLElement).style.overflow = 'visible';
          (cloneContainer as HTMLElement).style.width = `${winWidth}px`;
          (cloneContainer as HTMLElement).style.maxWidth = 'none';
        }
      };

      // Find all sections
      const sections = printRef.current.querySelectorAll("[data-pdf-section]");

      if (sections.length === 0) {
        // Fallback: render the whole thing
        const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff", windowWidth: winWidth, onclone: oncloneHandler });
        const ratio = usableWidth / canvas.width;
        const scaledH = canvas.height * ratio;
        if (scaledH <= usableHeight) {
          pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", margin, margin, usableWidth, scaledH);
        } else {
          let srcY = 0; let remaining = canvas.height; let page = 0;
          while (remaining > 0) {
            if (page > 0) pdf.addPage([215.9, 330.2], orientation as "landscape" | "portrait");
            const slice = Math.min(remaining, usableHeight / ratio);
            const sc = document.createElement("canvas"); sc.width = canvas.width; sc.height = slice;
            sc.getContext("2d")!.drawImage(canvas, 0, srcY, canvas.width, slice, 0, 0, canvas.width, slice);
            pdf.addImage(sc.toDataURL("image/jpeg", 0.95), "JPEG", margin, margin, usableWidth, slice * ratio);
            srcY += slice; remaining -= slice; page++;
          }
        }
      } else {
        // Render each section, placing on pages with smart breaks
        let currentY = margin;
        let pageNum = 0;

        for (let i = 0; i < sections.length; i++) {
          const section = sections[i] as HTMLElement;
          const canvas = await html2canvas(section, {
            scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff", windowWidth: winWidth, onclone: oncloneHandler
          });

          const ratio = usableWidth / canvas.width;
          const scaledH = canvas.height * ratio;

          // Calculate max height we can draw on the CURRENT page
          let availableHeight = (f4Height - margin) - currentY;

          if (scaledH <= availableHeight) {
            // Fits entirely on current page
            pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", margin, currentY, usableWidth, scaledH);
            currentY += scaledH + 4; // 4mm gap between sections
          } else {
            // It doesn't fit on the current page entirely.
            // If the available height is too small (e.g. less than 30mm), just start on a new page.
            if (availableHeight < 30) {
              pdf.addPage([215.9, 330.2], orientation as "landscape" | "portrait");
              pageNum++;
              currentY = margin;
              availableHeight = usableHeight;
            }

            // Find row boundaries for clean cuts
            const sectionRect = section.getBoundingClientRect();
            const rowBottoms: number[] = [];

            // Add all valid horizontal cut lines (bottom of rows and headers)
            section.querySelectorAll("tr, :scope > div, :scope > table").forEach((el) => {
              const elRect = el.getBoundingClientRect();
              const fracBottom = (elRect.bottom - sectionRect.top) / sectionRect.height;
              rowBottoms.push(Math.round(fracBottom * canvas.height));
            });
            rowBottoms.sort((a, b) => a - b);

            let srcY = 0;
            while (srcY < canvas.height - 2) {
              // How many canvas pixels fit in the available height?
              const maxSlicePixels = availableHeight / ratio;
              let cutY = Math.min(srcY + maxSlicePixels, canvas.height);

              // Snap to the nearest row boundary to avoid cutting text in half
              if (rowBottoms.length > 0 && cutY < canvas.height) {
                let bestCut = -1;
                for (const rb of rowBottoms) {
                  if (rb > srcY + 2 && rb <= srcY + maxSlicePixels) {
                    bestCut = rb;
                  }
                }
                if (bestCut > srcY + 2) {
                  cutY = bestCut;
                }
              }

              const sliceH = Math.ceil(Math.min(cutY - srcY, canvas.height - srcY));
              if (sliceH <= 0) break;

              // Draw slice
              const sc = document.createElement("canvas");
              sc.width = canvas.width;
              sc.height = sliceH;
              sc.getContext("2d")!.drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

              pdf.addImage(sc.toDataURL("image/jpeg", 0.95), "JPEG", margin, currentY, usableWidth, sliceH * ratio);

              srcY += sliceH;

              if (srcY < canvas.height - 2) {
                // Still more to draw, add a new page
                pdf.addPage([215.9, 330.2], orientation as "landscape" | "portrait");
                pageNum++;
                currentY = margin;
                availableHeight = usableHeight;
              } else {
                // Done with this section, update currentY for the next section
                currentY += sliceH * ratio + 4;
              }
            }
          }
        }
      }

      const filename = activeTab === "denah"
        ? `Denah_Haflah_Wada_${dufahLabel.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`
        : `Pemanggilan_Haflah_Wada_${dufahLabel.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;

      pdf.save(filename);
    } catch (err) {
      console.error("Export PDF failed:", err);
      alert("Gagal export PDF. Silakan coba lagi.");
    } finally {
      setExporting(false);
    }
  }, [activeTab, exporting, dufahLabel]);

  if (!mounted) return null;

  // Render a cell for denah grid — with seat number
  const renderDenahCell = (student: any, colIdx: number, seatNo?: number) => {
    const cellFontSize = colCount > 12 ? 10 : 14;
    const kelasFontSize = colCount > 12 ? 9 : 11;
    const cellPadding = colCount > 12 ? "4px 2px" : "6px 4px";

    return (
      <td key={colIdx} style={{
        border: "1.5px solid #000",
        padding: cellPadding,
        verticalAlign: "top",
        height: 120,
        width: `${100 / colCount}%`,
        backgroundColor: !student ? "#fafafa" : "#ffffff",
        position: "relative",
        overflow: "hidden"
      }}>
        {student && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", paddingTop: 16, width: "100%", height: "100%", textAlign: "center", lineHeight: 1.2, wordBreak: "break-word" }}>
            {seatNo !== undefined && (
              <div style={{ position: "absolute", top: 2, left: 3, fontSize: 9, color: "#94a3b8", fontWeight: 700 }}>{seatNo}</div>
            )}
            <div style={{ fontSize: cellFontSize, fontWeight: 700 }}>
              {student.nama}
            </div>
            <div style={{ fontSize: kelasFontSize, color: "#475569", marginTop: 4, fontWeight: 600 }}>({student.kelasNama})</div>
          </div>
        )}
      </td>
    )
  };

  // Render pemanggilan row — with column borders
  const renderPemanggilanRow = (s: any, idx: number) => (
    <tr key={s.id} style={{ borderBottom: "1px solid #cbd5e1", backgroundColor: s.isMartabahUla ? "#dcfce7" : "white" }}>
      <td style={{ width: 40, textAlign: "center", borderRight: "1px solid #94a3b8", padding: "10px 4px", fontWeight: 700, color: "#94a3b8", fontSize: 13 }}>{idx + 1}</td>
      <td style={{ padding: "10px 14px", borderRight: "1px solid #e2e8f0", fontSize: 14 }}>
        <span style={{ fontWeight: s.isMartabahUla ? 800 : 500, color: "#1e293b" }}>
          {s.isMartabahUla && "★ "}
          {s.nama}
        </span>
      </td>
      <td style={{ padding: "10px 14px", textAlign: "right", direction: "rtl", fontSize: 14 }}>
        {s.isMartabahUla ? (
          <span style={{ backgroundColor: "#bbf7d0", border: "1px solid #86efac", color: "#166534", padding: "4px 14px", borderRadius: 4, fontWeight: 700, fontSize: 14, display: "inline-block" }}>الامتياز مع مرتبة الشرف الأولى</span>
        ) : (
          <span>
            <span style={{ fontWeight: 600, fontSize: 15 }}>{s.averagePredikat.arab}</span>
            {s.statusKelulusan === "MUSYAROKAH" && <span style={{ fontSize: 11, color: "#94a3b8", marginRight: 8, background: "#f1f5f9", padding: "2px 8px", borderRadius: 4, border: "1px solid #e2e8f0" }}>Musyarokah</span>}
          </span>
        )}
      </td>
    </tr>
  );

  return (
    <div className="w-full">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex bg-[var(--color-surface)] p-1 rounded-xl w-full md:w-auto">
          <button
            onClick={() => setActiveTab("denah")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${activeTab === "denah" ? "bg-white text-[var(--color-text)] shadow-sm" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"}`}
          >
            <Armchair className="w-4 h-4" />
            Denah Tempat Duduk
          </button>
          <button
            onClick={() => setActiveTab("pemanggilan")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${activeTab === "pemanggilan" ? "bg-white text-[var(--color-text)] shadow-sm" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"}`}
          >
            <ListOrdered className="w-4 h-4" />
            Urutan Pemanggilan
          </button>
        </div>

        {/* Settings Bar */}
        {activeTab === "denah" && (
          <div className="flex flex-wrap items-center gap-4 bg-[var(--color-surface)] p-2 px-4 rounded-xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[var(--color-text-muted)]">Grid Area:</span>
              <input
                type="number"
                min={5} max={25}
                value={colCount}
                onChange={e => setColCount(Math.max(5, parseInt(e.target.value) || 10))}
                className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm font-bold text-center outline-none focus:border-blue-500"
              />
              <span className="text-xs font-semibold text-[var(--color-text-muted)]">Kolom</span>
            </div>

            <div className="w-px h-6 bg-slate-200 hidden md:block"></div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[var(--color-text-muted)]">Pintu:</span>
              <select
                value={doorOption}
                onChange={e => setDoorOption(e.target.value as any)}
                className="rounded-md border border-slate-300 px-2 py-1 text-sm font-bold outline-none focus:border-blue-500 max-w-[200px]"
              >
                <option value="masuk-kanan-keluar-kiri">Masuk Kanan, Keluar Kiri</option>
                <option value="masuk-kiri-keluar-kanan">Masuk Kiri, Keluar Kanan</option>
                <option value="kanan-kiri">Kanan & Kiri</option>
                <option value="kanan">Kanan Saja</option>
                <option value="kiri">Kiri Saja</option>
              </select>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between w-full md:w-auto gap-4">
          <div className="hidden lg:block text-sm font-semibold text-[var(--color-text-muted)]">
            Total Lulus: <span className="font-bold text-[var(--color-primary)]">{processedSantri.graduates.length}</span> |
            Total Denah: <span className="font-bold text-[var(--color-text)]">{denahBanin.length + denahBanat.length}</span>
          </div>

          <button
            onClick={openOrderModal}
            className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl font-bold shadow-sm transition border border-slate-300"
            title="Klik untuk drag and drop kelas"
          >
            <ListOrdered className="w-4 h-4" />
            <span className="hidden md:inline">Urutan Kelas</span>
          </button>

          <button
            onClick={handleExportPDF}
            disabled={exporting}
            className="flex items-center justify-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] disabled:opacity-50 text-white px-4 py-2 rounded-xl font-bold shadow-sm transition"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            {exporting ? "Mengekspor..." : "Export PDF"}
          </button>
        </div>
      </div>

      {/* Content that gets captured for PDF */}
      <div ref={printRef} className="neu-card-white overflow-hidden bg-white">

        {/* Tab: DENAH */}
        {activeTab === "denah" && (
          <div className="p-3 md:p-6">
            {/* Header Panggung */}
            <div data-pdf-section>
              <div style={{ width: "100%", backgroundColor: "#f8981d", color: "black", fontWeight: 900, textAlign: "center", padding: "10px 0", border: "2px solid black", borderBottom: "none", textTransform: "uppercase", letterSpacing: 4, fontSize: 14 }}>
                PANGGUNG ACARA
              </div>
              <div style={{ width: "100%", display: "flex", border: "2px solid black", borderBottom: "none", height: 48 }}>
                {(doorOption === 'masuk-kanan-keluar-kiri' || doorOption === 'masuk-kiri-keluar-kanan' || doorOption === 'kanan-kiri' || doorOption === 'kiri') && (
                  <div style={{ width: 85, backgroundColor: "#00ff00", borderRight: "2px solid black", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, textAlign: "center", textTransform: "uppercase", lineHeight: 1.2, padding: 4 }}>
                    {doorOption === 'masuk-kanan-keluar-kiri' ? <>P. KIRI<br />KELUAR</> : null}
                    {doorOption === 'masuk-kiri-keluar-kanan' ? <>P. KIRI<br />MASUK</> : null}
                    {doorOption === 'kanan-kiri' || doorOption === 'kiri' ? <>KIRI<br />MASUK & KELUAR</> : null}
                  </div>
                )}

                <div style={{ flex: 1 }}></div>

                {(doorOption === 'masuk-kanan-keluar-kiri' || doorOption === 'masuk-kiri-keluar-kanan' || doorOption === 'kanan-kiri' || doorOption === 'kanan') && (
                  <div style={{ width: 85, backgroundColor: "#00ff00", borderLeft: "2px solid black", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, textAlign: "center", textTransform: "uppercase", lineHeight: 1.2, padding: 4 }}>
                    {doorOption === 'masuk-kanan-keluar-kiri' ? <>P. KANAN<br />MASUK</> : null}
                    {doorOption === 'masuk-kiri-keluar-kanan' ? <>P. KANAN<br />KELUAR</> : null}
                    {doorOption === 'kanan-kiri' || doorOption === 'kanan' ? <>KANAN<br />MASUK & KELUAR</> : null}
                  </div>
                )}
              </div>
            </div>

            {/* BANIN */}
            <div data-pdf-section style={{ marginTop: 16 }}>
              <div style={{ width: "100%", backgroundColor: "#a3c2e6", color: "#1e293b", fontWeight: 900, textAlign: "center", padding: "10px 0", border: "2px solid black", borderBottom: "none", textTransform: "uppercase", letterSpacing: 4, fontSize: 14 }}>
                ★★★ BANIN ★★★
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 800, borderCollapse: "collapse", border: "2px solid black", tableLayout: "fixed" }}>
                  <tbody>
                    {chunkArray(denahBanin, colCount).map((chunk, rowIdx) => {
                      const startFrom = (doorOption === 'masuk-kiri-keluar-kanan' || doorOption === 'kiri') ? 'left' : 'right';
                      const paddedChunk = padAndDirection(chunk, colCount, startFrom);
                      return (
                        <tr key={rowIdx}>
                          {paddedChunk.map((student, colIdx) => {
                            const actualIdx = student ? denahBanin.indexOf(student) : -1;
                            return renderDenahCell(student, colIdx, actualIdx >= 0 ? actualIdx + 1 : undefined);
                          })}
                        </tr>
                      );
                    })}
                    {denahBanin.length === 0 && (
                      <tr><td colSpan={colCount} style={{ textAlign: "center", padding: 24, color: "#94a3b8", border: "1px solid black" }}>Belum ada data Banin</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* BANAT */}
            <div data-pdf-section style={{ marginTop: 32 }}>
              <div style={{ width: "100%", backgroundColor: "#f4b084", color: "#1e293b", fontWeight: 900, textAlign: "center", padding: "10px 0", border: "2px solid black", borderBottom: "none", textTransform: "uppercase", letterSpacing: 4, fontSize: 14 }}>
                ★★★ BANAT ★★★
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 800, borderCollapse: "collapse", border: "2px solid black", tableLayout: "fixed" }}>
                  <tbody>
                    {chunkArray(denahBanat, colCount).map((chunk, rowIdx) => {
                      const startFrom = (doorOption === 'masuk-kiri-keluar-kanan' || doorOption === 'kiri') ? 'left' : 'right';
                      const paddedChunk = padAndDirection(chunk, colCount, startFrom);
                      return (
                        <tr key={rowIdx}>
                          {paddedChunk.map((student, colIdx) => {
                            const actualIdx = student ? denahBanat.indexOf(student) : -1;
                            return renderDenahCell(student, colIdx, actualIdx >= 0 ? actualIdx + 1 : undefined);
                          })}
                        </tr>
                      );
                    })}
                    {denahBanat.length === 0 && (
                      <tr><td colSpan={colCount} style={{ textAlign: "center", padding: 24, color: "#94a3b8", border: "1px solid black" }}>Belum ada data Banat</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PENGUMUMAN */}
            <div data-pdf-section style={{ marginTop: 48, border: "2px solid black", maxWidth: 800, marginLeft: "auto", marginRight: "auto" }}>
              <div style={{ backgroundColor: "#e45b5c", color: "white", fontWeight: 700, textAlign: "center", padding: "10px 0", borderBottom: "2px solid black", textTransform: "uppercase", fontSize: 13, letterSpacing: 2 }}>
                PENGUMUMAN UNTUK PESERTA HAFLAH {dufahLabel.toUpperCase()}
              </div>
              <div style={{ padding: "16px 24px", fontSize: 12, lineHeight: 1.8, backgroundColor: "white" }}>
                <p style={{ marginBottom: 8, color: "#334155" }}>Diharapkan seluruh peserta memperhatikan hal-hal berikut agar prosesi berjalan dengan tertib dan lancar:</p>
                <div style={{ color: "#334155" }}>
                  <p>1. Ketentuan Jalur Pintu:</p>
                  <ul style={{ listStyle: "none", paddingLeft: 24, margin: "4px 0", fontSize: 11 }}>
                    {doorOption === 'masuk-kanan-keluar-kiri' && (
                      <>
                        <li>• Jalur masuk berada di sebelah kanan</li>
                        <li>• Jalur keluar berada di sebelah kiri</li>
                      </>
                    )}
                    {doorOption === 'masuk-kiri-keluar-kanan' && (
                      <>
                        <li>• Jalur masuk berada di sebelah kiri</li>
                        <li>• Jalur keluar berada di sebelah kanan</li>
                      </>
                    )}
                    {doorOption === 'kanan-kiri' && (
                      <li>• Terdapat pintu di sebelah kanan dan kiri yang dapat digunakan untuk masuk dan keluar</li>
                    )}
                    {doorOption === 'kanan' && (
                      <li>• Hanya terdapat satu pintu masuk dan keluar, yaitu di sebelah kanan</li>
                    )}
                    {doorOption === 'kiri' && (
                      <li>• Hanya terdapat satu pintu masuk dan keluar, yaitu di sebelah kiri</li>
                    )}
                  </ul>
                  {doorOption === 'masuk-kanan-keluar-kiri' && <p style={{ fontWeight: 700, margin: "4px 0" }}>Maka dari itu, tepi kiri wajib dikosongkan.</p>}
                  {doorOption === 'masuk-kiri-keluar-kanan' && <p style={{ fontWeight: 700, margin: "4px 0" }}>Maka dari itu, tepi kanan wajib dikosongkan.</p>}
                  <p>2. Urutan keluar barisan dimulai dari banat (putri) terlebih dahulu, kemudian disusul oleh banin (putra).</p>
                  <p>3. Saat turun, transisi berjalan dipercepat agar prosesi selanjutnya tidak terhambat.</p>
                  <p>4. Saat sesi foto, mohon menyimak dan mengikuti arahan dari pengatur barisan foto di depan.</p>
                  <p>5. Ketika berfoto, syahadah dipegang di depan dada dengan posisi yang rapi.</p>
                  <p>6. Jika nama belum tercatat, segera konfirmasi kepada petugas KSU.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: PEMANGGILAN */}
        {activeTab === "pemanggilan" && (
          <div style={{ padding: "24px 32px" }}>
            <div data-pdf-section style={{ textAlign: "center", marginBottom: 32 }}>
              <p style={{ fontSize: 14, textTransform: "uppercase", fontWeight: 700, color: "#64748b", letterSpacing: 2 }}>Urutan Pemanggilan Peserta</p>
              <h1 style={{ fontSize: 32, fontWeight: 900, textTransform: "uppercase", letterSpacing: 4, color: "#0f172a", marginTop: 8 }}>
                HAFLAH WADA&apos; {dufahLabel.toUpperCase()}
              </h1>
              <h2 style={{ fontSize: 20, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, color: "#475569", marginTop: 4 }}>
                Markaz Arabiyah
              </h2>
            </div>

            <div>
              {pemanggilanGroups.map((group) => (
                <div data-pdf-section key={group.kelas?.id} style={{ border: "2px solid black", marginBottom: 24, backgroundColor: "white", overflow: "hidden" }}>
                  {/* Header kelas + wali kelas */}
                  <div style={{ display: "flex", borderBottom: "2px solid black" }}>
                    <div style={{ flex: 1, backgroundColor: "#f1f5f9", fontWeight: 800, padding: 10, textAlign: "center", textTransform: "uppercase", fontSize: 16, letterSpacing: 4, color: "#0f172a" }}>
                      {group.kelas?.nama}
                    </div>
                  </div>
                  <div style={{ padding: "6px 12px", borderBottom: "2px solid black", fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#475569", letterSpacing: 1 }}>
                    WALI KELAS: {group.kelas?.waliKelas?.nama || "-"}
                  </div>

                  {/* Side-by-side Banin | Banat */}
                  <div style={{ display: "flex" }}>
                    {/* BANIN column */}
                    <div style={{ flex: 1, borderRight: "2px solid black" }}>
                      <div style={{ backgroundColor: "#a3c2e6", fontWeight: 700, padding: "6px 10px", borderBottom: "1px solid #000", fontSize: 12, textTransform: "uppercase", letterSpacing: 3, color: "#1e293b", textAlign: "center" }}>
                        BANIN
                      </div>
                      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                        <tbody>
                          {group.banin.length > 0 ? group.banin.map((s, idx) => (
                            <tr key={s.id} style={{ borderBottom: "1px solid #e2e8f0", backgroundColor: s.isMartabahUla ? "#dcfce7" : "white" }}>
                              <td style={{ width: 28, textAlign: "center", borderRight: "1px solid #cbd5e1", padding: "6px 2px", fontWeight: 700, color: "#94a3b8", fontSize: 11 }}>{idx + 1}</td>
                              <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0", fontSize: 13 }}>
                                <span style={{ fontWeight: s.isMartabahUla ? 800 : 500, color: "#1e293b" }}>
                                  {s.isMartabahUla && "★ "}
                                  {s.nama}
                                </span>
                              </td>
                              <td style={{ padding: "6px 8px", textAlign: "right", direction: s.programKategori === 'TURATS' ? "ltr" : "rtl", fontSize: 13 }}>
                                {s.isMartabahUla ? (
                                  <span style={{ backgroundColor: "#bbf7d0", border: "1px solid #86efac", color: "#166534", padding: "4px 14px", borderRadius: 4, fontWeight: 700, fontSize: 14, display: "inline-block" }}>
                                    {s.programKategori === 'TURATS' ? "Peringkat Satu dengan Predikat Istimewa" : "الامتياز مع مرتبة الشرف الأولى"}
                                  </span>
                                ) : (
                                  <span>
                                    <span style={{ fontWeight: 600, fontSize: 13 }}>
                                      {s.programKategori === 'TURATS' ? s.averagePredikat.indo : s.averagePredikat.arab}
                                    </span>
                                    {s.statusKelulusan === "MUSYAROKAH" && <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: s.programKategori === 'TURATS' ? 8 : 0, marginRight: s.programKategori === 'TURATS' ? 0 : 8, background: "#f1f5f9", padding: "2px 8px", borderRadius: 4, border: "1px solid #e2e8f0" }}>Musyarokah</span>}
                                  </span>
                                )}
                              </td>
                            </tr>
                          )) : (
                            <tr><td style={{ padding: 16, textAlign: "center", color: "#cbd5e1", fontSize: 11 }}>-</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* BANAT column */}
                    <div style={{ flex: 1 }}>
                      <div style={{ backgroundColor: "#f4b084", fontWeight: 700, padding: "6px 10px", borderBottom: "1px solid #000", fontSize: 12, textTransform: "uppercase", letterSpacing: 3, color: "#1e293b", textAlign: "center" }}>
                        BANAT
                      </div>
                      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                        <tbody>
                          {group.banat.length > 0 ? group.banat.map((s, idx) => (
                            <tr key={s.id} style={{ borderBottom: "1px solid #e2e8f0", backgroundColor: s.isMartabahUla ? "#dcfce7" : "white" }}>
                              <td style={{ width: 28, textAlign: "center", borderRight: "1px solid #cbd5e1", padding: "6px 2px", fontWeight: 700, color: "#94a3b8", fontSize: 11 }}>{idx + 1}</td>
                              <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0", fontSize: 13 }}>
                                <span style={{ fontWeight: s.isMartabahUla ? 800 : 500, color: "#1e293b" }}>
                                  {s.isMartabahUla && "★ "}
                                  {s.nama}
                                </span>
                              </td>
                              <td style={{ padding: "6px 8px", textAlign: "right", direction: s.programKategori === 'TURATS' ? "ltr" : "rtl", fontSize: 13 }}>
                                {s.isMartabahUla ? (
                                  <span style={{ backgroundColor: "#bbf7d0", border: "1px solid #86efac", color: "#166534", padding: "4px 14px", borderRadius: 4, fontWeight: 700, fontSize: 14, display: "inline-block" }}>
                                    {s.programKategori === 'TURATS' ? "Peringkat Satu dengan Predikat Istimewa" : "الامتياز مع مرتبة الشرف الأولى"}
                                  </span>
                                ) : (
                                  <span>
                                    <span style={{ fontWeight: 600, fontSize: 13 }}>
                                      {s.programKategori === 'TURATS' ? s.averagePredikat.indo : s.averagePredikat.arab}
                                    </span>
                                    {s.statusKelulusan === "MUSYAROKAH" && <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: s.programKategori === 'TURATS' ? 8 : 0, marginRight: s.programKategori === 'TURATS' ? 0 : 8, background: "#f1f5f9", padding: "2px 8px", borderRadius: 4, border: "1px solid #e2e8f0" }}>Musyarokah</span>}
                                  </span>
                                )}
                              </td>
                            </tr>
                          )) : (
                            <tr><td style={{ padding: 16, textAlign: "center", color: "#cbd5e1", fontSize: 11 }}>-</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ))}

              {pemanggilanGroups.length === 0 && (
                <div style={{ textAlign: "center", padding: 48, border: "2px dashed #cbd5e1", color: "#94a3b8", borderRadius: 16 }}>
                  Belum ada data santri yang dapat dipanggil.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showOrderModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[var(--color-surface)] w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 font-black text-lg text-[var(--color-text)]">
              Atur Urutan Pemanggilan Kelas
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-2">
              <p className="text-sm text-[var(--color-text-muted)] mb-4 leading-relaxed">
                Tarik lalu geser <i>(drag-and-drop)</i> kelas di bawah ini untuk mengatur posisi mereka saat dipanggil pada Haflah Wada'.
              </p>

              {classOrder.map((cls, idx) => (
                <div
                  key={cls.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragEnter={() => handleDragEnter(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  className={`p-3 bg-white border border-slate-200 shadow-sm rounded-lg flex items-center gap-3 cursor-grab active:cursor-grabbing transition-transform ${draggedIdx === idx ? "opacity-50 scale-95 border-blue-400" : "hover:border-slate-300"}`}
                >
                  <div className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded text-slate-500 font-bold text-xs shrink-0">
                    {idx + 1}
                  </div>
                  <div className="font-semibold text-sm select-none">
                    {cls.nama}
                  </div>
                  <div className="ml-auto text-slate-400">
                    <ListOrdered className="w-4 h-4 opacity-50" />
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-100 flex items-center gap-3 bg-slate-50">
              <button
                onClick={() => setShowOrderModal(false)}
                className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                onClick={saveOrder}
                disabled={savingOrder}
                className="flex-1 px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingOrder && <Loader2 className="w-4 h-4 animate-spin" />}
                {savingOrder ? "Menyimpan..." : "Simpan Urutan & Refresh"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
