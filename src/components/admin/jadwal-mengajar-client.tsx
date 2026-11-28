"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { toast } from "react-hot-toast";
import {
  Save,
  RotateCcw,
  Trash2,
  AlertTriangle,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Users,
  User,
  Crown,
  BookOpen,
  FileSpreadsheet,
  Plus,
  Check,
  Sparkles,
  Layers,
  Filter,
  Loader2,
  Maximize2,
  Minimize2,
} from "lucide-react";

type MapelItem = {
  id: string;
  nama_indo: string;
  nama_arab: string;
};

type KelasItem = {
  id: string;
  nama: string;
  waliKelasId: string | null;
  waliKelasNama: string | null;
};

type ProgramItem = {
  id: string;
  nama_indo: string;
  kategori: string;
  kelasList: KelasItem[];
  mapelList: MapelItem[];
};

type TeacherItem = {
  id: string;
  nama: string;
  role: string;
  kelasId: string | null;
};

type PengajarSesiItem = {
  kelasId: string;
  sesi: string;
  userId: string;
};

type PengajarSesiProgramItem = {
  programId: string;
  sesi: string;
  userId: string;
};

type SlotMetaItem = {
  targetKey: string;
  sesi: string;
  mapelId: string | null;
  keterangan: string | null;
};

type JadwalSesiRow = {
  sesi: string;
  label: string;
  jamBuka: string;
  jamTutup: string;
  isActive: boolean;
};

type SesiTambahanRow = {
  programId: string;
  sesi: string;
  jamBuka: string;
  jamTutup: string;
};

type MatrixColumn = {
  targetKey: string; // "KELAS:<id>" atau "PROGRAM:<id>"
  kind: "KELAS" | "PROGRAM";
  id: string;
  nama: string;
  programId: string;
  programNama: string;
  kategori: string;
  lembagaGroup: "ARABIYAH" | "TURATS" | "HUFADZ" | "KHUSUS";
  mapelList: MapelItem[];
};

type ConflictEntry = {
  userId: string;
  userName: string;
  sesi: string;
  targets: { targetKey: string; label: string }[];
  isSesi6: boolean;
};

type EditingCell = {
  col: MatrixColumn;
  sesi: string;
};

function getSesiNumber(sesi: string): number {
  return parseInt(sesi.replace("SESI_", ""), 10) || 0;
}

function getLembagaGroup(kategori: string, programNama: string): "ARABIYAH" | "TURATS" | "HUFADZ" | "KHUSUS" {
  const kat = (kategori || "").toUpperCase();
  const nama = (programNama || "").toLowerCase();
  if (kat === "TURATS") return "TURATS";
  if (kat === "HUFADZ" || nama.includes("hufadz") || nama.includes("huffadz")) return "HUFADZ";
  if (nama.includes("fln") || nama.includes("raudhotul")) return "KHUSUS";
  return "ARABIYAH";
}

function getDefaultGroupRank(group: "ARABIYAH" | "TURATS" | "HUFADZ" | "KHUSUS"): number {
  // Urutan visual kiri -> kanan agar biru (Markaz Arabiyah) berada paling KANAN tepat di sebelah kolom Sesi,
  // lalu bergerak ke KIRI: Arabiyah (kanan) <- Turats <- Khusus/FLN <- Hufadz (kiri)
  if (group === "HUFADZ") return 1;
  if (group === "KHUSUS") return 2;
  if (group === "TURATS") return 3;
  return 4;
}

function getColumnTheme(group: "ARABIYAH" | "TURATS" | "HUFADZ" | "KHUSUS") {
  switch (group) {
    case "ARABIYAH":
      return {
        headerBg: "bg-sky-600 text-white",
        headerBorder: "border-sky-700",
        cellBg: "bg-sky-50/25",
        badgeBg: "bg-sky-100 text-sky-800",
        excelHeaderHex: "#3b82f6",
        excelHeaderText: "#ffffff",
        excelCellHex: "#f0f9ff",
      };
    case "TURATS":
      return {
        headerBg: "bg-amber-400 text-amber-950",
        headerBorder: "border-amber-500",
        cellBg: "bg-amber-50/30",
        badgeBg: "bg-amber-100 text-amber-900",
        excelHeaderHex: "#f59e0b",
        excelHeaderText: "#1f2937",
        excelCellHex: "#fffbeb",
      };
    case "KHUSUS":
      return {
        headerBg: "bg-rose-400 text-white",
        headerBorder: "border-rose-500",
        cellBg: "bg-rose-50/30",
        badgeBg: "bg-rose-100 text-rose-800",
        excelHeaderHex: "#fb7185",
        excelHeaderText: "#ffffff",
        excelCellHex: "#fff1f2",
      };
    case "HUFADZ":
      return {
        headerBg: "bg-yellow-700 text-white",
        headerBorder: "border-yellow-800",
        cellBg: "bg-yellow-50/35",
        badgeBg: "bg-yellow-100 text-yellow-900",
        excelHeaderHex: "#a16207",
        excelHeaderText: "#ffffff",
        excelCellHex: "#fefce8",
      };
  }
}

export function JadwalMengajarClient({
  canEdit,
  isSuperAdmin = false,
  programs,
  initialPengajarSesi,
  initialPengajarSesiProgram,
  initialSlotMetas,
  initialColumnOrder,
  jadwalSesiList,
  sesiTambahan,
  teachers,
}: {
  canEdit: boolean;
  isSuperAdmin?: boolean;
  programs: ProgramItem[];
  initialPengajarSesi: PengajarSesiItem[];
  initialPengajarSesiProgram: PengajarSesiProgramItem[];
  initialSlotMetas: SlotMetaItem[];
  initialColumnOrder: string[];
  jadwalSesiList: JadwalSesiRow[];
  sesiTambahan: SesiTambahanRow[];
  teachers: TeacherItem[];
}) {
  // Bangun daftar semua kolom default:
  // Hanya tampilkan kelas yang aktif ("KELAS:<id>"). Program tanpa kelas aktif tidak ditampilkan.
  const allColumnsMap = useMemo(() => {
    const cols: MatrixColumn[] = [];
    for (const p of programs) {
      const lembagaGroup = getLembagaGroup(p.kategori, p.nama_indo);
      for (const k of p.kelasList) {
        cols.push({
          targetKey: `KELAS:${k.id}`,
          kind: "KELAS",
          id: k.id,
          nama: k.nama,
          programId: p.id,
          programNama: p.nama_indo,
          kategori: p.kategori,
          lembagaGroup,
          mapelList: p.mapelList,
        });
      }
    }

    // Urutkan visual kiri -> kanan: Hufadz (kiri) -> Khusus -> Turats -> Markaz Arabiyah (kanan dekat Sesi),
    // dan nama kelas/program descending agar kelas 1 (mis. Ula 1 / Atiqoh A) berada lebih ke kanan mendekati Sesi
    cols.sort((a, b) => {
      const rankDiff = getDefaultGroupRank(a.lembagaGroup) - getDefaultGroupRank(b.lembagaGroup);
      if (rankDiff !== 0) return rankDiff;
      const progDiff = b.programNama.localeCompare(a.programNama, "id");
      if (progDiff !== 0) return progDiff;
      return b.nama.localeCompare(a.nama, "id");
    });

    const map = new Map<string, MatrixColumn>();
    cols.forEach((c) => map.set(c.targetKey, c));
    return { list: cols, map };
  }, [programs]);

  const computeInitialOrder = (savedOrder: string[]): string[] => {
    const validSaved = savedOrder.filter((key) => allColumnsMap.map.has(key));
    const savedSet = new Set(validSaved);
    const missing = allColumnsMap.list
      .map((c) => c.targetKey)
      .filter((k) => !savedSet.has(k));
    return [...validSaved, ...missing];
  };

  // Draft States (Mode Excel — ubah bebas lalu klik Simpan Jadwal)
  const [draftSesi, setDraftSesi] = useState<PengajarSesiItem[]>(initialPengajarSesi);
  const [draftSesiProgram, setDraftSesiProgram] = useState<PengajarSesiProgramItem[]>(
    initialPengajarSesiProgram
  );
  const [draftMetas, setDraftMetas] = useState<SlotMetaItem[]>(initialSlotMetas);
  const [columnOrder, setColumnOrder] = useState<string[]>(() =>
    computeInitialOrder(initialColumnOrder)
  );

  // Baseline tersimpan untuk deteksi perubahan & tombol Batal
  const [savedSnapshot, setSavedSnapshot] = useState(() => ({
    sesi: initialPengajarSesi,
    sesiProgram: initialPengajarSesiProgram,
    metas: initialSlotMetas,
    columnOrder: computeInitialOrder(initialColumnOrder),
  }));

  const [isSaving, setIsSaving] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSummaryInFullscreen, setShowSummaryInFullscreen] = useState(false);

  // Filter & Interaksi UI
  const [filterLembaga, setFilterLembaga] = useState<
    "ALL" | "ARABIYAH" | "TURATS" | "HUFADZ" | "KHUSUS"
  >("ALL");
  const [highlightedTeacherId, setHighlightedTeacherId] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [draggedKey, setDraggedKey] = useState<string | null>(null);

  // State di dalam popover editor sel
  const [editorMode, setEditorMode] = useState<"KELAS" | "PROGRAM">("KELAS");
  const [editorSearch, setEditorSearch] = useState("");
  const [onlyFreeTeachers, setOnlyFreeTeachers] = useState(false);

  // State untuk tabel ringkasan pengajar di bawah
  const [summarySearch, setSummarySearch] = useState("");
  const [summaryFilter, setSummaryFilter] = useState<
    "all" | "assigned" | "unassigned" | "conflict" | "wali"
  >("all");
  const [summarySort, setSummarySort] = useState<"name" | "most" | "least">("name");

  const tableContainerRef = useRef<HTMLDivElement>(null);

  const defaultOrderKeys = useMemo(
    () => allColumnsMap.list.map((c) => c.targetKey),
    [allColumnsMap]
  );

  // Bila belum ada urutan custom tersimpan di DB, pastikan selalu sinkron dengan urutan default (kanan -> kiri)
  useEffect(() => {
    if (initialColumnOrder.length === 0) {
      setColumnOrder(defaultOrderKeys);
      setSavedSnapshot((prev) => ({ ...prev, columnOrder: defaultOrderKeys }));
    }
  }, [initialColumnOrder.length, defaultOrderKeys]);

  // Scroll otomatis ke kanan (dekat kolom Sesi & Markaz Arabiyah) saat awal dibuka atau ganti mode layar penuh
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const el = tableContainerRef.current;
      if (el) {
        el.scrollLeft = el.scrollWidth;
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [isFullscreen, filterLembaga, columnOrder.length]);

  // Tekan Escape untuk keluar dari mode layar penuh (bila tidak ada modal terbuka)
  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !editingCell && !showClearModal) {
        if (showSummaryInFullscreen) {
          setShowSummaryInFullscreen(false);
        } else {
          setIsFullscreen(false);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFullscreen, editingCell, showClearModal, showSummaryInFullscreen]);

  // Lookup cepat
  const teacherMap = useMemo(() => {
    const m = new Map<string, TeacherItem>();
    teachers.forEach((t) => m.set(t.id, t));
    return m;
  }, [teachers]);

  const mapelMap = useMemo(() => {
    const m = new Map<string, MapelItem>();
    programs.forEach((p) => p.mapelList.forEach((mp) => m.set(mp.id, mp)));
    return m;
  }, [programs]);

  const programMap = useMemo(() => {
    const m = new Map<string, ProgramItem>();
    programs.forEach((p) => m.set(p.id, p));
    return m;
  }, [programs]);

  // Daftar sesi (baris tabel)
  const sesiRows = useMemo(() => {
    const bySesi = new Map<string, { sesi: string; label: string; jam: string }>();

    // Minimal tampilkan Sesi 1 sampai Sesi 8 (sesuai kebutuhan pondok)
    const defaultJams: Record<string, string> = {
      SESI_1: "05:30 - 06:30",
      SESI_2: "07:00 - 08:00",
      SESI_3: "08:00 - 09:00",
      SESI_4: "09:30 - 10:30",
      SESI_5: "10:30 - 11:30",
      SESI_6: "15:30 - 16:30",
      SESI_7: "Ba'da Maghrib",
      SESI_8: "20:10 - Selesai",
    };

    for (let i = 1; i <= 8; i++) {
      const key = `SESI_${i}`;
      bySesi.set(key, {
        sesi: key,
        label: `Sesi ${i}`,
        jam: defaultJams[key] || "",
      });
    }

    // Timpa dengan jam resmi dari JadwalSesi DB
    for (const js of jadwalSesiList) {
      const n = getSesiNumber(js.sesi);
      bySesi.set(js.sesi, {
        sesi: js.sesi,
        label: js.label || `Sesi ${n}`,
        jam: js.jamBuka && js.jamTutup ? `${js.jamBuka} - ${js.jamTutup}` : defaultJams[js.sesi] || "",
      });
    }

    // Pastikan sesi tambahan program & sesi yang sudah terisi juga selalu muncul
    for (const st of sesiTambahan) {
      if (!bySesi.has(st.sesi)) {
        const n = getSesiNumber(st.sesi);
        bySesi.set(st.sesi, {
          sesi: st.sesi,
          label: `Sesi ${n}`,
          jam: st.jamBuka && st.jamTutup ? `${st.jamBuka} - ${st.jamTutup}` : "",
        });
      }
    }
    for (const ps of draftSesi) {
      if (!bySesi.has(ps.sesi)) {
        const n = getSesiNumber(ps.sesi);
        bySesi.set(ps.sesi, { sesi: ps.sesi, label: `Sesi ${n}`, jam: "" });
      }
    }
    for (const psp of draftSesiProgram) {
      if (!bySesi.has(psp.sesi)) {
        const n = getSesiNumber(psp.sesi);
        bySesi.set(psp.sesi, { sesi: psp.sesi, label: `Sesi ${n}`, jam: "" });
      }
    }

    return Array.from(bySesi.values()).sort(
      (a, b) => getSesiNumber(a.sesi) - getSesiNumber(b.sesi)
    );
  }, [jadwalSesiList, sesiTambahan, draftSesi, draftSesiProgram]);

  // Urutan kolom terfilter
  const orderedColumns = useMemo(() => {
    return columnOrder
      .map((k) => allColumnsMap.map.get(k))
      .filter((c): c is MatrixColumn => Boolean(c));
  }, [columnOrder, allColumnsMap]);

  const visibleColumns = useMemo(() => {
    if (filterLembaga === "ALL") return orderedColumns;
    return orderedColumns.filter((c) => c.lembagaGroup === filterLembaga);
  }, [orderedColumns, filterLembaga]);

  // Indeks cepat slot meta
  const slotMetaMap = useMemo(() => {
    const m = new Map<string, SlotMetaItem>();
    for (const item of draftMetas) {
      m.set(`${item.targetKey}|${item.sesi}`, item);
    }
    return m;
  }, [draftMetas]);

  // Deteksi bentrok real-time (lintas kelas reguler & level program!)
  const { conflicts, conflictCellKeys, busyBySesiUser } = useMemo(() => {
    // Map: `${sesi}|${userId}` -> list of distinct targets
    const occMap = new Map<string, { targetKey: string; label: string }[]>();

    const addOcc = (sesi: string, userId: string, targetKey: string, label: string) => {
      const k = `${sesi}|${userId}`;
      if (!occMap.has(k)) occMap.set(k, []);
      const arr = occMap.get(k)!;
      if (!arr.some((x) => x.targetKey === targetKey)) {
        arr.push({ targetKey, label });
      }
    };

    for (const ps of draftSesi) {
      const col = allColumnsMap.map.get(`KELAS:${ps.kelasId}`);
      addOcc(ps.sesi, ps.userId, `KELAS:${ps.kelasId}`, col?.nama || "Kelas");
    }

    for (const psp of draftSesiProgram) {
      const prog = programMap.get(psp.programId);
      addOcc(
        psp.sesi,
        psp.userId,
        `PROGRAM:${psp.programId}`,
        `1 Program: ${prog?.nama_indo || "Program"}`
      );
    }

    const conflictList: ConflictEntry[] = [];
    const cellKeys = new Set<string>();

    for (const [k, targets] of occMap.entries()) {
      if (targets.length > 1) {
        const [sesi, userId] = k.split("|");
        const teacher = teacherMap.get(userId);
        conflictList.push({
          userId,
          userName: teacher?.nama || "Pengajar",
          sesi,
          targets,
          isSesi6: sesi === "SESI_6",
        });

        for (const t of targets) {
          if (t.targetKey.startsWith("PROGRAM:")) {
            const progId = t.targetKey.replace("PROGRAM:", "");
            cellKeys.add(`${t.targetKey}|${sesi}`);
            // Tandai juga semua kolom kelas dalam program itu pada sesi yang sama
            const prog = programMap.get(progId);
            prog?.kelasList.forEach((kl) => cellKeys.add(`KELAS:${kl.id}|${sesi}`));
          } else {
            cellKeys.add(`${t.targetKey}|${sesi}`);
          }
        }
      }
    }

    conflictList.sort(
      (a, b) =>
        getSesiNumber(a.sesi) - getSesiNumber(b.sesi) ||
        a.userName.localeCompare(b.userName, "id")
    );

    return { conflicts: conflictList, conflictCellKeys: cellKeys, busyBySesiUser: occMap };
  }, [draftSesi, draftSesiProgram, allColumnsMap, programMap, teacherMap]);

  // Cek apakah ada perubahan draft yang belum disimpan
  const isDirty = useMemo(() => {
    const normPS = (arr: PengajarSesiItem[]) =>
      [...arr]
        .map((x) => `${x.kelasId}|${x.sesi}|${x.userId}`)
        .sort()
        .join(";");
    const normPSP = (arr: PengajarSesiProgramItem[]) =>
      [...arr]
        .map((x) => `${x.programId}|${x.sesi}|${x.userId}`)
        .sort()
        .join(";");
    const normMeta = (arr: SlotMetaItem[]) =>
      [...arr]
        .filter((x) => x.mapelId || x.keterangan)
        .map((x) => `${x.targetKey}|${x.sesi}|${x.mapelId || ""}|${x.keterangan || ""}`)
        .sort()
        .join(";");

    return (
      normPS(draftSesi) !== normPS(savedSnapshot.sesi) ||
      normPSP(draftSesiProgram) !== normPSP(savedSnapshot.sesiProgram) ||
      normMeta(draftMetas) !== normMeta(savedSnapshot.metas) ||
      columnOrder.join(",") !== savedSnapshot.columnOrder.join(",")
    );
  }, [draftSesi, draftSesiProgram, draftMetas, columnOrder, savedSnapshot]);

  // Ringkasan Beban Mengajar per Pengajar (real-time di bawah tabel)
  const teacherSummaries = useMemo(() => {
    type SlotDetail = {
      sesi: string;
      sesiNum: number;
      targetKey: string;
      targetLabel: string;
      mapelLabel: string | null;
      isProgramLevel: boolean;
      isWaliSlot: boolean;
      isConflict: boolean;
    };

    const byTeacher = new Map<
      string,
      {
        teacher: TeacherItem;
        slots: SlotDetail[];
        waliKelasNama: string | null;
        hasConflict: boolean;
      }
    >();

    for (const t of teachers) {
      byTeacher.set(t.id, {
        teacher: t,
        slots: [],
        waliKelasNama: null,
        hasConflict: false,
      });
    }

    const conflictUserSesiSet = new Set(conflicts.map((c) => `${c.sesi}|${c.userId}`));

    for (const ps of draftSesi) {
      const entry = byTeacher.get(ps.userId);
      if (!entry) continue;
      const col = allColumnsMap.map.get(`KELAS:${ps.kelasId}`);
      const meta = slotMetaMap.get(`KELAS:${ps.kelasId}|${ps.sesi}`);
      const mapelLabel =
        (meta?.mapelId ? mapelMap.get(meta.mapelId)?.nama_indo : null) ||
        meta?.keterangan ||
        null;
      const isConflict = conflictUserSesiSet.has(`${ps.sesi}|${ps.userId}`);
      if (isConflict) entry.hasConflict = true;
      if (ps.sesi === "SESI_6") {
        entry.waliKelasNama = col?.nama || "Kelas";
      }
      entry.slots.push({
        sesi: ps.sesi,
        sesiNum: getSesiNumber(ps.sesi),
        targetKey: `KELAS:${ps.kelasId}`,
        targetLabel: col?.nama || "Kelas",
        mapelLabel,
        isProgramLevel: false,
        isWaliSlot: ps.sesi === "SESI_6",
        isConflict,
      });
    }

    for (const psp of draftSesiProgram) {
      const entry = byTeacher.get(psp.userId);
      if (!entry) continue;
      const prog = programMap.get(psp.programId);
      const meta = slotMetaMap.get(`PROGRAM:${psp.programId}|${psp.sesi}`);
      const mapelLabel =
        (meta?.mapelId ? mapelMap.get(meta.mapelId)?.nama_indo : null) ||
        meta?.keterangan ||
        null;
      const isConflict = conflictUserSesiSet.has(`${psp.sesi}|${psp.userId}`);
      if (isConflict) entry.hasConflict = true;
      entry.slots.push({
        sesi: psp.sesi,
        sesiNum: getSesiNumber(psp.sesi),
        targetKey: `PROGRAM:${psp.programId}`,
        targetLabel: `Program ${prog?.nama_indo || ""}`,
        mapelLabel,
        isProgramLevel: true,
        isWaliSlot: false,
        isConflict,
      });
    }

    const result = Array.from(byTeacher.values());
    result.forEach((r) => {
      r.slots.sort(
        (a, b) => a.sesiNum - b.sesiNum || a.targetLabel.localeCompare(b.targetLabel, "id")
      );
    });
    return result;
  }, [teachers, draftSesi, draftSesiProgram, allColumnsMap, slotMetaMap, mapelMap, programMap, conflicts]);

  const filteredSummaries = useMemo(() => {
    const q = summarySearch.trim().toLowerCase();
    const list = teacherSummaries.filter((row) => {
      if (q) {
        const matchName = row.teacher.nama.toLowerCase().includes(q);
        const matchSlot = row.slots.some(
          (s) =>
            s.targetLabel.toLowerCase().includes(q) ||
            (s.mapelLabel || "").toLowerCase().includes(q)
        );
        if (!matchName && !matchSlot) return false;
      }
      if (summaryFilter === "assigned") return row.slots.length > 0;
      if (summaryFilter === "unassigned") return row.slots.length === 0;
      if (summaryFilter === "conflict") return row.hasConflict;
      if (summaryFilter === "wali") return Boolean(row.waliKelasNama);
      return true;
    });

    list.sort((a, b) => {
      if (summarySort === "most") {
        if (b.slots.length !== a.slots.length) return b.slots.length - a.slots.length;
      } else if (summarySort === "least") {
        if (a.slots.length !== b.slots.length) return a.slots.length - b.slots.length;
      }
      return a.teacher.nama.localeCompare(b.teacher.nama, "id");
    });

    return list;
  }, [teacherSummaries, summarySearch, summaryFilter, summarySort]);

  // Helper baca isi satu sel
  const getCellDisplay = (col: MatrixColumn, sesi: string) => {
    const classTeachers =
      col.kind === "KELAS"
        ? draftSesi
            .filter((ps) => ps.kelasId === col.id && ps.sesi === sesi)
            .map((ps) => ({
              userId: ps.userId,
              nama: teacherMap.get(ps.userId)?.nama || "Unknown",
            }))
        : [];

    const programTeachers = draftSesiProgram
      .filter((psp) => psp.programId === col.programId && psp.sesi === sesi)
      .map((psp) => ({
        userId: psp.userId,
        nama: teacherMap.get(psp.userId)?.nama || "Unknown",
      }));

    // Meta sel: prioritas meta target kolom, fallback meta program jika sesi > 6 & pakai pengajar program
    const ownMeta = slotMetaMap.get(`${col.targetKey}|${sesi}`);
    const progMeta =
      col.kind === "KELAS" && programTeachers.length > 0
        ? slotMetaMap.get(`PROGRAM:${col.programId}|${sesi}`)
        : undefined;
    const activeMeta = ownMeta || progMeta;

    const mapelLabel =
      (activeMeta?.mapelId ? mapelMap.get(activeMeta.mapelId)?.nama_indo : null) ||
      activeMeta?.keterangan ||
      null;

    return { classTeachers, programTeachers, ownMeta, progMeta, mapelLabel };
  };

  // Geser kolom header (kiri / kanan / drag-drop)
  const moveColumn = (targetKey: string, direction: -1 | 1) => {
    if (!canEdit) return;
    setColumnOrder((prev) => {
      const idx = prev.indexOf(targetKey);
      if (idx === -1) return prev;
      const targetIdx = idx + direction;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
      return next;
    });
  };

  const handleDropColumn = (targetKey: string) => {
    if (!canEdit || !draggedKey || draggedKey === targetKey) {
      setDraggedKey(null);
      return;
    }
    setColumnOrder((prev) => {
      const fromIdx = prev.indexOf(draggedKey);
      const toIdx = prev.indexOf(targetKey);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
    setDraggedKey(null);
  };

  const handleResetColumnOrder = () => {
    setColumnOrder(allColumnsMap.list.map((c) => c.targetKey));
    toast("Urutan kolom dikembalikan ke default (Kanan→Kiri: Arabiyah → Turats → Hufadz)");
  };

  // Buka editor sel
  const openCellEditor = (col: MatrixColumn, sesi: string) => {
    if (!canEdit) return;
    const sesiNum = getSesiNumber(sesi);
    const hasProgTeachers = draftSesiProgram.some(
      (psp) => psp.programId === col.programId && psp.sesi === sesi
    );
    const hasClassTeachers =
      col.kind === "KELAS" &&
      draftSesi.some((ps) => ps.kelasId === col.id && ps.sesi === sesi);

    if (col.kind === "PROGRAM") {
      setEditorMode("PROGRAM");
    } else if (sesiNum > 6 && hasProgTeachers && !hasClassTeachers) {
      setEditorMode("PROGRAM");
    } else {
      setEditorMode("KELAS");
    }

    setEditorSearch("");
    setOnlyFreeTeachers(false);
    setEditingCell({ col, sesi });
  };

  // Update meta (Mapel dropdown / Keterangan kegiatan) di draft
  const updateCellMeta = (
    targetKey: string,
    sesi: string,
    patch: { mapelId?: string | null; keterangan?: string | null }
  ) => {
    setDraftMetas((prev) => {
      const existing = prev.find((m) => m.targetKey === targetKey && m.sesi === sesi);
      const nextMapelId = patch.mapelId !== undefined ? patch.mapelId : existing?.mapelId ?? null;
      const nextKet =
        patch.keterangan !== undefined ? patch.keterangan : existing?.keterangan ?? null;

      const filtered = prev.filter((m) => !(m.targetKey === targetKey && m.sesi === sesi));
      if (!nextMapelId && !(nextKet && nextKet.trim())) {
        return filtered;
      }
      return [
        ...filtered,
        { targetKey, sesi, mapelId: nextMapelId, keterangan: nextKet },
      ];
    });
  };

  // Pilih / toggle pengajar pada sel di draft
  const handleSelectTeacherInEditor = (userId: string) => {
    if (!editingCell) return;
    const { col, sesi } = editingCell;
    const sesiNum = getSesiNumber(sesi);

    if (editorMode === "PROGRAM" || col.kind === "PROGRAM") {
      // Multi-pengajar level 1 program
      setDraftSesiProgram((prev) => {
        const exists = prev.some(
          (p) => p.programId === col.programId && p.sesi === sesi && p.userId === userId
        );
        if (exists) {
          return prev.filter(
            (p) => !(p.programId === col.programId && p.sesi === sesi && p.userId === userId)
          );
        }
        return [...prev, { programId: col.programId, sesi, userId }];
      });
      return;
    }

    // Mode Per Kelas
    if (sesiNum <= 6) {
      // Sesi 1..6: 1 pengajar utama per sel (klik ulang untuk kosongkan)
      setDraftSesi((prev) => {
        const isAlreadySelected = prev.some(
          (p) => p.kelasId === col.id && p.sesi === sesi && p.userId === userId
        );
        const withoutSlot = prev.filter((p) => !(p.kelasId === col.id && p.sesi === sesi));
        if (isAlreadySelected) return withoutSlot;
        return [...withoutSlot, { kelasId: col.id, sesi, userId }];
      });
    } else {
      // Sesi > 6: Multi-pengajar per kelas!
      setDraftSesi((prev) => {
        const exists = prev.some(
          (p) => p.kelasId === col.id && p.sesi === sesi && p.userId === userId
        );
        if (exists) {
          return prev.filter(
            (p) => !(p.kelasId === col.id && p.sesi === sesi && p.userId === userId)
          );
        }
        return [...prev, { kelasId: col.id, sesi, userId }];
      });
    }
  };

  const clearCurrentCell = () => {
    if (!editingCell) return;
    const { col, sesi } = editingCell;
    if (editorMode === "PROGRAM" || col.kind === "PROGRAM") {
      setDraftSesiProgram((prev) =>
        prev.filter((p) => !(p.programId === col.programId && p.sesi === sesi))
      );
      updateCellMeta(`PROGRAM:${col.programId}`, sesi, { mapelId: null, keterangan: null });
    } else {
      setDraftSesi((prev) => prev.filter((p) => !(p.kelasId === col.id && p.sesi === sesi)));
      updateCellMeta(col.targetKey, sesi, { mapelId: null, keterangan: null });
    }
  };

  // Kosongkan SEMUA jadwal (di draft — baru permanen setelah klik Simpan Jadwal)
  const handleConfirmClearAll = () => {
    setDraftSesi([]);
    setDraftSesiProgram([]);
    setDraftMetas([]);
    setHighlightedTeacherId(null);
    setShowClearModal(false);
    toast(
      "Seluruh draft jadwal dikosongkan. Klik 'Simpan Jadwal' untuk menerapkan ke database (atau 'Batal' untuk mengembalikan)."
    );
  };

  const handleCancelDraft = () => {
    setDraftSesi(savedSnapshot.sesi);
    setDraftSesiProgram(savedSnapshot.sesiProgram);
    setDraftMetas(savedSnapshot.metas);
    setColumnOrder(savedSnapshot.columnOrder);
    toast("Perubahan draft dibatalkan");
  };

  // Simpan semua draft ke database + sinkronkan Wali Kelas dari Sesi 6
  const handleSaveAll = async () => {
    const sesi6Conflicts = conflicts.filter((c) => c.isSesi6);
    if (sesi6Conflicts.length > 0) {
      toast.error(
        `Tidak dapat menyimpan: ada bentrok di Sesi 6 (Wali Kelas) pada ${sesi6Conflicts
          .map((c) => c.userName)
          .join(", ")}. Selesaikan dulu bentrok Sesi 6.`
      );
      return;
    }

    if (conflicts.length > 0) {
      const ok = confirm(
        `Masih terdapat ${conflicts.length} bentrok jadwal di sesi lain. Tetap simpan jadwal sekarang?`
      );
      if (!ok) return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/jadwal-mengajar/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pengajarSesi: draftSesi,
          pengajarSesiProgram: draftSesiProgram,
          slotMetas: draftMetas,
          columnOrder,
          syncWaliKelas: true,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal menyimpan jadwal");
      }

      setSavedSnapshot({
        sesi: [...draftSesi],
        sesiProgram: [...draftSesiProgram],
        metas: [...draftMetas],
        columnOrder: [...columnOrder],
      });

      toast.success(
        `Jadwal berhasil disimpan (${json.savedCount} plot) & ${json.syncedWaliCount} wali kelas (Sesi 6) disinkronkan.`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan");
    } finally {
      setIsSaving(false);
    }
  };

  // Export ke Excel (.xls) lengkap dengan warna lembaga & ringkasan pengajar
  const handleExportExcel = () => {
    const cols = visibleColumns;
    let html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><style>
      table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 11px; margin-bottom: 24px; }
      th, td { border: 1px solid #334155; padding: 6px 8px; text-align: center; vertical-align: middle; }
      .sesi-col { background-color: #fde68a; font-weight: bold; }
      .conflict { background-color: #fee2e2 !important; color: #991b1b; }
      .left { text-align: left; }
    </style></head><body>`;

    html += `<h3>Jadwal Mengajar</h3><table><thead><tr>`;
    for (const col of cols) {
      const theme = getColumnTheme(col.lembagaGroup);
      html += `<th style="background:${theme.excelHeaderHex};color:${theme.excelHeaderText};font-weight:bold;">${col.nama}</th>`;
    }
    html += `<th class="sesi-col">Sesi / Hissoh</th></tr></thead><tbody>`;

    for (const row of sesiRows) {
      html += `<tr>`;
      for (const col of cols) {
        const theme = getColumnTheme(col.lembagaGroup);
        const { classTeachers, programTeachers, mapelLabel } = getCellDisplay(col, row.sesi);
        const isConf = conflictCellKeys.has(`${col.targetKey}|${row.sesi}`);
        const lines: string[] = [];
        if (mapelLabel) lines.push(`<b>${mapelLabel}</b>`);
        if (classTeachers.length > 0) {
          lines.push(classTeachers.map((t) => `(${t.nama})`).join(" "));
        }
        if (programTeachers.length > 0) {
          lines.push(
            programTeachers
              .map((t) =>
                col.kind === "KELAS" ? `(1 Program: ${t.nama})` : `(${t.nama})`
              )
              .join(" ")
          );
        }
        html += `<td class="${isConf ? "conflict" : ""}" style="background:${theme.excelCellHex};">${lines.join("<br/>")}</td>`;
      }
      html += `<td class="sesi-col">${row.label}${row.jam ? `<br/><span style="font-weight:normal;font-size:10px;">(${row.jam})</span>` : ""}${row.sesi === "SESI_6" ? "<br/><span style='font-size:9px;'>[Wali Kelas]</span>" : ""}</td>`;
      html += `</tr>`;
    }
    html += `</tbody></table>`;

    // Ringkasan Per Pengajar di bawah
    html += `<h3>Ringkasan Beban Mengajar Per Pengajar</h3><table><thead><tr style="background:#e2e8f0;font-weight:bold;">
      <th>No</th><th>Nama Pengajar</th><th>Wali Kelas (Sesi 6)</th><th>Total Sesi</th><th class="left">Rincian Mengajar (Hissoh &amp; Kelas)</th>
    </tr></thead><tbody>`;

    teacherSummaries.forEach((ts, i) => {
      const detailText = ts.slots
        .map(
          (s) =>
            `Sesi ${s.sesiNum}: ${s.targetLabel}${s.mapelLabel ? ` (${s.mapelLabel})` : ""}`
        )
        .join(" | ");
      html += `<tr>
        <td>${i + 1}</td>
        <td class="left"><b>${ts.teacher.nama}</b></td>
        <td>${ts.waliKelasNama || "-"}</td>
        <td><b>${ts.slots.length}</b></td>
        <td class="left">${detailText || "-"}</td>
      </tr>`;
    });

    html += `</tbody></table></body></html>`;

    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Jadwal_Mengajar.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Helper untuk modal editor sel
  const activeEditorInfo = useMemo(() => {
    if (!editingCell) return null;
    const { col, sesi } = editingCell;
    const sesiNum = getSesiNumber(sesi);
    const isProgramMode = editorMode === "PROGRAM" || col.kind === "PROGRAM";
    const metaTargetKey = isProgramMode ? `PROGRAM:${col.programId}` : col.targetKey;
    const currentMeta = slotMetaMap.get(`${metaTargetKey}|${sesi}`);
    const selectedUserIds = isProgramMode
      ? draftSesiProgram
          .filter((p) => p.programId === col.programId && p.sesi === sesi)
          .map((p) => p.userId)
      : draftSesi
          .filter((p) => p.kelasId === col.id && p.sesi === sesi)
          .map((p) => p.userId);
    const selectedSet = new Set(selectedUserIds);

    const q = editorSearch.trim().toLowerCase();
    const list = teachers
      .map((t) => {
        const occs = busyBySesiUser.get(`${sesi}|${t.id}`) || [];
        const otherOccs = occs.filter((o) => o.targetKey !== metaTargetKey);
        return {
          teacher: t,
          selected: selectedSet.has(t.id),
          busyElsewhere: otherOccs,
        };
      })
      .filter((item) => {
        if (q && !item.teacher.nama.toLowerCase().includes(q)) return false;
        if (onlyFreeTeachers && !item.selected && item.busyElsewhere.length > 0) return false;
        return true;
      });

    // Tampilkan yang terpilih dulu, lalu yang kosong, baru yang sibuk
    list.sort((a, b) => {
      if (a.selected !== b.selected) return a.selected ? -1 : 1;
      const aBusy = a.busyElsewhere.length > 0 ? 1 : 0;
      const bBusy = b.busyElsewhere.length > 0 ? 1 : 0;
      if (aBusy !== bBusy) return aBusy - bBusy;
      return a.teacher.nama.localeCompare(b.teacher.nama, "id");
    });

    return {
      col,
      sesi,
      sesiNum,
      isProgramMode,
      metaTargetKey,
      currentMeta,
      selectedUserIds,
      teacherList: list,
    };
  }, [
    editingCell,
    editorMode,
    slotMetaMap,
    draftSesi,
    draftSesiProgram,
    teachers,
    busyBySesiUser,
    editorSearch,
    onlyFreeTeachers,
  ]);

  const totalAssignedSlots = draftSesi.length + draftSesiProgram.length;
  const waliCount = draftSesi.filter((p) => p.sesi === "SESI_6").length;

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-[60] bg-slate-50 flex flex-col overflow-hidden p-3 sm:p-4 gap-3"
          : "space-y-6 pb-12"
      }
    >
      {/* Toolbar Sticky Atas */}
      <div
        className={`${
          isFullscreen ? "shrink-0" : "sticky top-0 z-30"
        } bg-white/95 backdrop-blur-md border border-[var(--color-surface-dark)] rounded-2xl p-3.5 sm:p-4 shadow-sm space-y-2.5`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Legenda Warna Lembaga (tanpa judul lembaga di atas tabel) + Filter Cepat */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ["ALL", "Semua", "bg-slate-800 text-white", "bg-slate-400"],
                ["ARABIYAH", "Arabiyah", "bg-sky-600 text-white", "bg-sky-500"],
                ["TURATS", "Turats", "bg-amber-400 text-amber-950", "bg-amber-400"],
                ["KHUSUS", "Khusus", "bg-rose-400 text-white", "bg-rose-400"],
                ["HUFADZ", "Hufadz", "bg-yellow-700 text-white", "bg-yellow-700"],
              ] as const
            ).map(([val, lbl, activeCls, dotCls]) => {
              const count =
                val === "ALL"
                  ? orderedColumns.length
                  : orderedColumns.filter((c) => c.lembagaGroup === val).length;
              if (val !== "ALL" && count === 0) return null;
              const active = filterLembaga === val;
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => setFilterLembaga(val)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    active
                      ? `${activeCls} shadow-xs`
                      : "bg-slate-100 text-[var(--color-text-muted)] hover:bg-slate-200/70"
                  }`}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${active ? "bg-white/80" : dotCls}`}
                  />
                  <span>{lbl}</span>
                  <span className="opacity-75 text-[10px]">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Tombol Aksi Utama */}
          <div className="flex flex-wrap items-center gap-2">
            {isFullscreen && (
              <button
                type="button"
                onClick={() => setShowSummaryInFullscreen((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  showSummaryInFullscreen
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                }`}
              >
                <Users size={15} />
                Ringkasan Pengajar
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setIsFullscreen((v) => !v);
                setShowSummaryInFullscreen(false);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                isFullscreen
                  ? "bg-slate-800 text-white border-slate-800 hover:bg-slate-900"
                  : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
              }`}
              title={isFullscreen ? "Keluar dari mode layar penuh (Esc)" : "Perbesar tabel penuh se-layar laptop"}
            >
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              {isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              <FileSpreadsheet size={15} />
              Export Excel
            </button>

            {canEdit && (
              <>
                <button
                  type="button"
                  onClick={handleResetColumnOrder}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Kembalikan urutan kolom ke default (Kanan→Kiri: Arabiyah → Turats → Hufadz)"
                >
                  <Layers size={14} />
                  Urutan Default
                </button>

                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => setShowClearModal(true)}
                    disabled={totalAssignedSlots === 0 && draftMetas.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <Trash2 size={14} />
                    Kosongkan Semua
                  </button>
                )}

                {isDirty && (
                  <button
                    type="button"
                    onClick={handleCancelDraft}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white text-slate-600 border border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <RotateCcw size={14} />
                    Batal
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSaveAll}
                  disabled={isSaving || !isDirty}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    isDirty
                      ? "bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white shadow-md shadow-teal-200"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {isSaving ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Save size={15} />
                  )}
                  Simpan Jadwal
                </button>
              </>
            )}
          </div>
        </div>

        {/* Status Info Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-3 text-[var(--color-text-muted)]">
            <span>
              Total terplot: <strong className="text-[var(--color-text)]">{totalAssignedSlots}</strong> slot
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              <Crown size={13} className="text-amber-500" />
              Wali Kelas (Sesi 6): <strong className="text-[var(--color-text)]">{waliCount}</strong> kelas
            </span>
            {isDirty && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                Draft belum disimpan
              </span>
            )}
          </div>

          {highlightedTeacherId && (
            <div className="flex items-center gap-2 bg-indigo-50 text-indigo-800 px-3 py-1 rounded-full border border-indigo-200 font-bold">
              <Sparkles size={13} />
              <span>
                Menyorot: {teacherMap.get(highlightedTeacherId)?.nama}
              </span>
              <button
                type="button"
                onClick={() => setHighlightedTeacherId(null)}
                className="text-indigo-500 hover:text-indigo-800 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Banner Peringatan Bentrok Real-Time */}
      {conflicts.length > 0 && (
        <div className={`${isFullscreen ? "shrink-0" : ""} bg-rose-50 border-2 border-rose-300 rounded-2xl p-3.5 space-y-2 shadow-sm`}>
          <div className="flex items-center gap-2 text-rose-800 font-black text-sm">
            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
            <span>
              Terdeteksi {conflicts.length} Bentrok Jadwal Pengajar!
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {conflicts.map((c) => (
              <button
                key={`${c.sesi}|${c.userId}`}
                type="button"
                onClick={() => setHighlightedTeacherId(c.userId)}
                className="text-left text-xs bg-white border border-rose-200 hover:border-rose-400 rounded-xl px-3 py-1.5 text-rose-800 transition-colors cursor-pointer shadow-2xs"
              >
                <strong className="text-rose-900">{c.userName}</strong> bentrok di{" "}
                <span className="font-bold underline">
                  Sesi {getSesiNumber(c.sesi)}
                  {c.isSesi6 ? " (Wali Kelas)" : ""}
                </span>
                :{" "}
                <span className="font-semibold">
                  {c.targets.map((t) => t.label).join(" & ")}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* TABEL MATRIKS ALA EXCEL (Header = Nama Kelas, Kolom Paling Kanan Sticky = Sesi/Hissoh) */}
      <div
        className={`bg-white rounded-2xl shadow-sm border border-[var(--color-surface-dark)] overflow-hidden ${
          isFullscreen ? "flex-1 min-h-0 flex flex-col" : ""
        }`}
      >
        <div
          ref={tableContainerRef}
          className={`overflow-x-auto overflow-y-auto custom-scrollbar ${
            isFullscreen ? "flex-1 min-h-0" : "max-h-[72vh]"
          }`}
        >
          <table className="w-max min-w-full border-collapse text-xs">
            <thead className="sticky top-0 z-20">
              <tr>
                {visibleColumns.map((col) => {
                  const theme = getColumnTheme(col.lembagaGroup);
                  const globalIdx = columnOrder.indexOf(col.targetKey);
                  return (
                    <th
                      key={col.targetKey}
                      draggable={canEdit}
                      onDragStart={() => setDraggedKey(col.targetKey)}
                      onDragOver={(e) => {
                        if (canEdit) e.preventDefault();
                      }}
                      onDrop={() => handleDropColumn(col.targetKey)}
                      onDragEnd={() => setDraggedKey(null)}
                      className={`${theme.headerBg} border ${theme.headerBorder} px-2 py-2.5 min-w-[140px] max-w-[180px] align-middle select-none transition-opacity ${
                        draggedKey === col.targetKey ? "opacity-50" : ""
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center gap-1">
                        <div className="flex items-center justify-between w-full gap-1">
                          {canEdit ? (
                            <button
                              type="button"
                              onClick={() => moveColumn(col.targetKey, -1)}
                              disabled={globalIdx <= 0}
                              title="Geser kolom ke kiri"
                              className="p-0.5 rounded bg-black/10 hover:bg-black/20 disabled:opacity-25 shrink-0 cursor-pointer"
                            >
                              <ChevronLeft size={13} />
                            </button>
                          ) : (
                            <span className="w-4 shrink-0" />
                          )}

                          <span
                            className={`flex-1 min-w-0 font-black text-xs leading-snug text-center whitespace-normal break-words ${
                              canEdit ? "cursor-grab active:cursor-grabbing" : ""
                            }`}
                            title={
                              canEdit
                                ? `${col.nama} (${col.programNama}) — seret atau klik panah untuk menggeser urutan`
                                : `${col.nama} (${col.programNama})`
                            }
                          >
                            {col.nama}
                          </span>

                          {canEdit ? (
                            <button
                              type="button"
                              onClick={() => moveColumn(col.targetKey, 1)}
                              disabled={globalIdx === columnOrder.length - 1}
                              title="Geser kolom ke kanan"
                              className="p-0.5 rounded bg-black/10 hover:bg-black/20 disabled:opacity-25 shrink-0 cursor-pointer"
                            >
                              <ChevronRight size={13} />
                            </button>
                          ) : (
                            <span className="w-4 shrink-0" />
                          )}
                        </div>
                        {col.kind === "PROGRAM" && (
                          <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.2 rounded bg-black/15">
                            1 Program
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}

                {/* KOLOM PALING KANAN STICKY: SESI / HISSOH */}
                <th className="sticky right-0 z-30 bg-amber-100 text-amber-950 border border-amber-300 px-3 py-3 min-w-[138px] text-center shadow-[-4px_0_10px_-4px_rgba(15,23,42,0.15)]">
                  <div className="font-black text-xs sm:text-sm uppercase tracking-wider">
                    Sesi / Hissoh
                  </div>
                  <div className="text-[10px] font-semibold text-amber-800 mt-0.5">
                    Jam Pelajaran
                  </div>
                </th>
              </tr>
            </thead>

            <tbody>
              {sesiRows.map((row) => {
                const sesiNum = getSesiNumber(row.sesi);
                const isSesi6 = row.sesi === "SESI_6";
                const isMultiSesi = sesiNum > 6;

                return (
                  <tr key={row.sesi} className="group">
                    {visibleColumns.map((col) => {
                      const theme = getColumnTheme(col.lembagaGroup);
                      const { classTeachers, programTeachers, mapelLabel } = getCellDisplay(
                        col,
                        row.sesi
                      );
                      const cellConflict = conflictCellKeys.has(`${col.targetKey}|${row.sesi}`);
                      const isHighlighted =
                        highlightedTeacherId !== null &&
                        (classTeachers.some((t) => t.userId === highlightedTeacherId) ||
                          programTeachers.some((t) => t.userId === highlightedTeacherId));
                      const isEmpty =
                        !mapelLabel && classTeachers.length === 0 && programTeachers.length === 0;

                      return (
                        <td
                          key={`${col.targetKey}|${row.sesi}`}
                          onClick={() => openCellEditor(col, row.sesi)}
                          className={`border border-slate-200 p-2 align-middle text-center transition-all min-h-[64px] h-[68px] ${
                            canEdit ? "cursor-pointer hover:brightness-95" : ""
                          } ${
                            cellConflict
                              ? "bg-rose-100/90 ring-2 ring-inset ring-rose-500"
                              : isHighlighted
                                ? "bg-indigo-100 ring-2 ring-inset ring-indigo-500"
                                : theme.cellBg
                          }`}
                        >
                          {isEmpty ? (
                            <div className="h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                              {canEdit && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 bg-white/80 border border-dashed border-slate-300 px-2 py-1 rounded-lg">
                                  <Plus size={12} /> Isi
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-1">
                              {/* Baris 1: Nama Mapel / Keterangan */}
                              {mapelLabel && (
                                <div className="font-bold text-[11px] sm:text-xs text-slate-800 leading-tight line-clamp-2">
                                  {mapelLabel}
                                </div>
                              )}

                              {/* Baris 2: Pengajar Per Kelas */}
                              {classTeachers.length > 0 && (
                                <div className="flex flex-wrap items-center justify-center gap-1">
                                  {classTeachers.map((t) => {
                                    const teacherClashing = conflicts.some(
                                      (c) => c.sesi === row.sesi && c.userId === t.userId
                                    );
                                    return (
                                      <span
                                        key={t.userId}
                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold leading-tight ${
                                          teacherClashing
                                            ? "bg-rose-600 text-white"
                                            : isSesi6
                                              ? "bg-amber-100 text-amber-950 border border-amber-300"
                                              : "bg-white/90 text-slate-700 border border-slate-200/80"
                                        }`}
                                      >
                                        {isSesi6 && (
                                          <Crown size={10} className="text-amber-600 shrink-0" />
                                        )}
                                        <span>{t.nama}</span>
                                      </span>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Baris 3: Pengajar Level 1 Program */}
                              {programTeachers.length > 0 && (
                                <div className="flex flex-wrap items-center justify-center gap-1">
                                  {programTeachers.map((t) => {
                                    const teacherClashing = conflicts.some(
                                      (c) => c.sesi === row.sesi && c.userId === t.userId
                                    );
                                    return (
                                      <span
                                        key={t.userId}
                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold leading-tight ${
                                          teacherClashing
                                            ? "bg-rose-600 text-white"
                                            : "bg-violet-100 text-violet-900 border border-violet-300"
                                        }`}
                                        title={`Mengampu seluruh program ${col.programNama} pada ${row.label}`}
                                      >
                                        {col.kind === "KELAS" && (
                                          <span className="text-[9px] uppercase px-1 rounded bg-violet-600 text-white">
                                            1 Prog
                                          </span>
                                        )}
                                        <span>{t.nama}</span>
                                      </span>
                                    );
                                  })}
                                </div>
                              )}

                              {cellConflict && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-rose-700">
                                  <AlertTriangle size={10} /> Bentrok
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}

                    {/* KOLOM PALING KANAN STICKY: INFO SESI + JAM */}
                    <td
                      className={`sticky right-0 z-10 border border-amber-200 px-3 py-2 text-center shadow-[-4px_0_10px_-4px_rgba(15,23,42,0.12)] ${
                        isSesi6
                          ? "bg-amber-100"
                          : isMultiSesi
                            ? "bg-violet-50"
                            : "bg-amber-50/95"
                      }`}
                    >
                      <div className="font-black text-xs sm:text-sm text-amber-950">
                        {row.label}
                      </div>
                      {row.jam && (
                        <div className="text-[10px] font-semibold text-amber-800 mt-0.5 whitespace-nowrap">
                          {row.jam}
                        </div>
                      )}
                      {isSesi6 && (
                        <span className="inline-flex items-center gap-0.5 mt-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500 text-white">
                          <Crown size={9} /> Wali Kelas
                        </span>
                      )}
                      {isMultiSesi && (
                        <span className="inline-block mt-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-violet-200 text-violet-900">
                          Multi / 1 Prog
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* PANEL RINGKASAN BEBAN MENGAJAR PER PENGAJAR (DI BAWAH TABEL — atau panel bawah saat Fullscreen jika dibuka) */}
      {(!isFullscreen || showSummaryInFullscreen) && (
      <div
        className={`bg-white rounded-2xl shadow-sm border border-[var(--color-surface-dark)] overflow-hidden ${
          isFullscreen ? "shrink-0 max-h-[38vh] flex flex-col" : ""
        }`}
      >
        <div className="p-4 sm:p-5 border-b border-[var(--color-surface)] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[var(--color-text)] flex items-center gap-2">
                <Users className="h-5 w-5 text-[var(--color-primary)]" />
                Ringkasan Beban Mengajar Per Pengajar
              </h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Klik baris pengajar untuk menyorot seluruh jadwalnya di tabel atas secara otomatis.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-bold">
                Total Pengajar: {teacherSummaries.length}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                Terjadwal: {teacherSummaries.filter((t) => t.slots.length > 0).length}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold">
                0 Sesi: {teacherSummaries.filter((t) => t.slots.length === 0).length}
              </span>
            </div>
          </div>

          {/* Search + Filter + Sort Ringkasan */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-subtle)]" />
              <input
                type="text"
                value={summarySearch}
                onChange={(e) => setSummarySearch(e.target.value)}
                placeholder="Cari nama pengajar, kelas, atau mapel..."
                className="w-full pl-9 pr-8 py-2 text-sm bg-[var(--color-secondary)] border border-[var(--color-surface-dark)] rounded-xl outline-none focus:bg-white focus:border-[var(--color-primary)]"
              />
              {summarySearch && (
                <button
                  type="button"
                  onClick={() => setSummarySearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1 bg-[var(--color-secondary)] p-1 rounded-xl border border-[var(--color-surface-dark)]">
              {(
                [
                  ["all", "Semua"],
                  ["assigned", "Terjadwal"],
                  ["unassigned", "0 Sesi"],
                  ["wali", "Wali Kelas"],
                  ["conflict", `Bentrok (${teacherSummaries.filter((t) => t.hasConflict).length})`],
                ] as const
              ).map(([val, lbl]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setSummaryFilter(val)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    summaryFilter === val
                      ? "bg-white text-[var(--color-primary)] shadow-xs"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>

            <select
              value={summarySort}
              onChange={(e) => setSummarySort(e.target.value as "name" | "most" | "least")}
              className="rounded-xl border border-[var(--color-surface-dark)] bg-white px-3 py-2 text-xs font-bold text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
            >
              <option value="name">Urut: Nama A–Z</option>
              <option value="most">Urut: Sesi Terbanyak</option>
              <option value="least">Urut: Sesi Tersedikit</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[420px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 sticky top-0 z-10 border-b border-[var(--color-surface-dark)]">
              <tr>
                <th className="px-4 py-2.5 font-bold text-[var(--color-text-muted)] text-[11px] uppercase w-12 text-center">
                  No
                </th>
                <th className="px-4 py-2.5 font-bold text-[var(--color-text-muted)] text-[11px] uppercase min-w-[200px]">
                  Nama Pengajar
                </th>
                <th className="px-4 py-2.5 font-bold text-[var(--color-text-muted)] text-[11px] uppercase w-28 text-center">
                  Total Sesi
                </th>
                <th className="px-4 py-2.5 font-bold text-[var(--color-text-muted)] text-[11px] uppercase">
                  Mengajar di Kelas &amp; Hissoh Ke-berapa
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSummaries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-slate-400 text-sm">
                    Tidak ada pengajar yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                filteredSummaries.map((item, idx) => {
                  const isHighlighted = highlightedTeacherId === item.teacher.id;
                  return (
                    <tr
                      key={item.teacher.id}
                      onClick={() =>
                        setHighlightedTeacherId(isHighlighted ? null : item.teacher.id)
                      }
                      className={`transition-colors cursor-pointer ${
                        isHighlighted
                          ? "bg-indigo-50"
                          : item.hasConflict
                            ? "bg-rose-50/50 hover:bg-rose-50"
                            : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="px-4 py-3 text-center text-xs font-bold text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-[var(--color-text)]">
                            {item.teacher.nama}
                          </span>
                          {item.waliKelasNama && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                              <Crown size={10} className="text-amber-600" />
                              Wali: {item.waliKelasNama}
                            </span>
                          )}
                          {item.hasConflict && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-600 text-white">
                              <AlertTriangle size={10} /> Bentrok
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center min-w-[34px] px-2.5 py-1 rounded-full text-xs font-black ${
                            item.hasConflict
                              ? "bg-rose-100 text-rose-800"
                              : item.slots.length === 0
                                ? "bg-slate-100 text-slate-400"
                                : "bg-[var(--color-primary-50)] text-[var(--color-primary)]"
                          }`}
                        >
                          {item.slots.length}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {item.slots.length === 0 ? (
                          <span className="text-xs italic text-slate-400">
                            Belum mendapat jadwal mengajar
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {item.slots.map((s, sIdx) => (
                              <span
                                key={`${s.sesi}|${s.targetKey}|${sIdx}`}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold border ${
                                  s.isConflict
                                    ? "bg-rose-100 text-rose-800 border-rose-300"
                                    : s.isWaliSlot
                                      ? "bg-amber-50 text-amber-950 border-amber-300"
                                      : s.isProgramLevel
                                        ? "bg-violet-50 text-violet-900 border-violet-200"
                                        : "bg-slate-50 text-slate-700 border-slate-200"
                                }`}
                              >
                                <strong className="text-[10px] uppercase">S{s.sesiNum}</strong>
                                <span>• {s.targetLabel}</span>
                                {s.mapelLabel && (
                                  <span className="text-[10px] opacity-75">
                                    ({s.mapelLabel})
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* MODAL EDITOR SEL (Mapel dari Pengaturan Syahadah + Pengajar Single/Multi/1-Program) */}
      {editingCell && activeEditorInfo && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/45 backdrop-blur-xs p-4"
          onClick={() => setEditingCell(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-black text-[var(--color-text)] flex items-center gap-2">
                  <span>{activeEditorInfo.col.nama}</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                    Sesi {activeEditorInfo.sesiNum}
                  </span>
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  Program {activeEditorInfo.col.programNama}
                  {activeEditorInfo.sesi === "SESI_6" && (
                    <span className="ml-1.5 text-amber-700 font-bold">
                      • Pengisi Sesi 6 otomatis menjadi Wali Kelas
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingCell(null)}
                className="p-2 rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Saklar Mode khusus Sesi > 6 pada kolom Kelas: Per Kelas (Multi) vs 1 Program */}
              {activeEditorInfo.sesiNum > 6 && activeEditorInfo.col.kind === "KELAS" && (
                <div className="bg-violet-50 border border-violet-200 rounded-2xl p-3 space-y-2">
                  <p className="text-[11px] font-bold text-violet-900">
                    Mode Pengampu (Sesi di atas 6):
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 bg-white p-1 rounded-xl border border-violet-200">
                    <button
                      type="button"
                      onClick={() => setEditorMode("KELAS")}
                      className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        editorMode === "KELAS"
                          ? "bg-[var(--color-primary)] text-white"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      Per Kelas (Multi Pengajar)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorMode("PROGRAM")}
                      className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        editorMode === "PROGRAM"
                          ? "bg-violet-600 text-white"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      1 Pengajar = 1 Program
                    </button>
                  </div>
                  <p className="text-[11px] text-violet-700 leading-snug">
                    {editorMode === "KELAS"
                      ? `Bisa memilih lebih dari 1 pengajar khusus untuk kelas ${activeEditorInfo.col.nama}.`
                      : `Pengajar yang dipilih langsung mengampu seluruh kelas dalam program ${activeEditorInfo.col.programNama} pada Sesi ${activeEditorInfo.sesiNum}.`}
                  </p>
                </div>
              )}

              {/* 1. Dropdown Mapel dari Pengaturan Syahadah Program + Keterangan Opsional */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-1.5">
                  <BookOpen size={13} />
                  Mata Pelajaran (dari Pengaturan Syahadah {activeEditorInfo.col.programNama})
                </label>
                <select
                  value={activeEditorInfo.currentMeta?.mapelId || ""}
                  onChange={(e) =>
                    updateCellMeta(activeEditorInfo.metaTargetKey, activeEditorInfo.sesi, {
                      mapelId: e.target.value || null,
                    })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                >
                  <option value="">— Tanpa Mapel / Pilih dari daftar —</option>
                  {activeEditorInfo.col.mapelList.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nama_indo}
                      {m.nama_arab ? ` (${m.nama_arab})` : ""}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={activeEditorInfo.currentMeta?.keterangan || ""}
                  onChange={(e) =>
                    updateCellMeta(activeEditorInfo.metaTargetKey, activeEditorInfo.sesi, {
                      keterangan: e.target.value,
                    })
                  }
                  placeholder="Atau tulis kegiatan non-mapel (opsional, mis. Sorogan, Setoran & Lalaran)..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-[var(--color-text)] outline-none focus:bg-white focus:border-[var(--color-primary)]"
                />
              </div>

              {/* 2. Pemilih Pengajar */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                    {activeEditorInfo.sesiNum > 6 || activeEditorInfo.isProgramMode
                      ? `Pilih Pengajar (Bisa Multi • Terpilih: ${activeEditorInfo.selectedUserIds.length})`
                      : "Pilih Pengajar (1 Pengajar Utama)"}
                  </label>
                  <button
                    type="button"
                    onClick={() => setOnlyFreeTeachers((v) => !v)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${
                      onlyFreeTeachers
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <Filter size={11} />
                    Hanya yang kosong
                  </button>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={editorSearch}
                    onChange={(e) => setEditorSearch(e.target.value)}
                    placeholder="Cari nama pengajar..."
                    className="w-full pl-9 pr-8 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-[var(--color-primary)]"
                  />
                  {editorSearch && (
                    <button
                      type="button"
                      onClick={() => setEditorSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="max-h-[34vh] overflow-y-auto pr-1 space-y-1.5 custom-scrollbar">
                  {activeEditorInfo.teacherList.map(({ teacher, selected, busyElsewhere }) => (
                    <button
                      key={teacher.id}
                      type="button"
                      onClick={() => handleSelectTeacherInEditor(teacher.id)}
                      className={`w-full text-left flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border transition-all cursor-pointer ${
                        selected
                          ? busyElsewhere.length > 0
                            ? "bg-rose-50 border-rose-400 text-rose-900"
                            : "bg-[var(--color-primary-50)] border-[var(--color-primary)] text-[var(--color-primary-dark)]"
                          : busyElsewhere.length > 0
                            ? "bg-amber-50/40 border-amber-200/80 hover:bg-amber-50"
                            : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                          <User size={14} className="text-slate-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate">{teacher.nama}</p>
                          {busyElsewhere.length > 0 ? (
                            <p className="text-[11px] font-semibold text-amber-700 flex items-center gap-1 truncate">
                              <AlertTriangle size={11} className="shrink-0" />
                              Sudah di: {busyElsewhere.map((b) => b.label).join(", ")}
                            </p>
                          ) : (
                            <p className="text-[10px] font-semibold text-emerald-600">
                              Tersedia di Sesi {activeEditorInfo.sesiNum}
                            </p>
                          )}
                        </div>
                      </div>

                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center border shrink-0 ${
                          selected
                            ? busyElsewhere.length > 0
                              ? "bg-rose-600 border-rose-600 text-white"
                              : "bg-[var(--color-primary)] border-[var(--color-primary)] text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {selected && <Check size={12} strokeWidth={3} />}
                      </span>
                    </button>
                  ))}

                  {activeEditorInfo.teacherList.length === 0 && (
                    <p className="text-center text-xs text-slate-400 py-6">
                      Tidak ada pengajar yang cocok.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={clearCurrentCell}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 px-3 py-2 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer"
              >
                Kosongkan Sel Ini
              </button>
              <button
                type="button"
                onClick={() => setEditingCell(null)}
                className="px-5 py-2 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-bold transition-colors cursor-pointer"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI KOSONGKAN SEMUA JADWAL */}
      {isSuperAdmin && showClearModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          onClick={() => setShowClearModal(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-rose-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <Trash2 size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800">
                Kosongkan Semua Jadwal?
              </h3>
              <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                Tindakan ini akan mengosongkan seluruh pengajar kelas, pengajar program, dan mapel pada draft tabel. Saat Anda klik <strong>Simpan Jadwal</strong>, relasi Wali Kelas (Sesi 6) lama juga akan dilepas sampai diisi kembali.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmClearAll}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
              >
                Ya, Kosongkan Draft
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
