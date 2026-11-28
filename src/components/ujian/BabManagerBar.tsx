"use client";

import { useState, useEffect, useMemo } from "react";
import {
  FolderOpen,
  FolderPlus,
  Edit2,
  Trash2,
  CheckSquare,
  ArrowUp,
  ArrowDown,
  Lock,
  Eye,
  EyeOff,
  Search,
  Check,
  X,
  AlertTriangle,
  Loader2,
  Layers,
} from "lucide-react";
import toast from "react-hot-toast";
import { TIPE_SOAL_LABELS } from "@/lib/regulasi-soal-usbu";

export type BabMateriItem = {
  id: string;
  programId: string;
  mapelId: string;
  nama: string;
  deskripsi: string | null;
  urutan: number;
  _count?: { soalList: number };
};

type PickerSoalItem = {
  id: string;
  tipeSoal: string;
  pertanyaan: string;
  bobot: number;
  babId: string | null;
  bab?: { id: string; nama: string; urutan: number } | null;
  usbuAssignments?: { usbuKe: number }[];
};

interface BabManagerBarProps {
  programId: string;
  mapelId: string;
  babList: BabMateriItem[];
  tanpaBabCount: number;
  selectedBabId: string; // "ALL" | "NONE" | bab.id
  onSelectBab: (babId: string) => void;
  onRefresh: () => Promise<void> | void;
}

function stripHtml(html: string): string {
  return (html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export default function BabManagerBar({
  programId,
  mapelId,
  babList,
  tanpaBabCount,
  selectedBabId,
  onSelectBab,
  onRefresh,
}: BabManagerBarProps) {
  const activeBab = useMemo(
    () => babList.find((b) => b.id === selectedBabId) || null,
    [babList, selectedBabId],
  );
  const activeBabIndex = useMemo(
    () => babList.findIndex((b) => b.id === selectedBabId),
    [babList, selectedBabId],
  );

  // Add / Edit Bab modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBab, setEditingBab] = useState<BabMateriItem | null>(null);
  const [namaBab, setNamaBab] = useState("");
  const [deskripsiBab, setDeskripsiBab] = useState("");
  const [savingBab, setSavingBab] = useState(false);

  // Delete Bab modal (Super Admin password required)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeletePw, setShowDeletePw] = useState(false);
  const [deleteSoals, setDeleteSoals] = useState(false);
  const [deletingBab, setDeletingBab] = useState(false);

  // Click-to-toggle Soal Picker modal
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSoals, setPickerSoals] = useState<PickerSoalItem[]>([]);
  const [pickerFilter, setPickerFilter] = useState<"ALL" | "IN_BAB" | "NONE" | "OTHER">("ALL");
  const [pickerTipe, setPickerTipe] = useState("ALL");
  const [pickerSearch, setPickerSearch] = useState("");
  const [togglingIds, setTogglingIds] = useState<Record<string, boolean>>({});
  const [pickerDirty, setPickerDirty] = useState(false);

  const openAddModal = () => {
    setEditingBab(null);
    setNamaBab("");
    setDeskripsiBab("");
    setIsFormOpen(true);
  };

  const openEditModal = (bab: BabMateriItem) => {
    setEditingBab(bab);
    setNamaBab(bab.nama);
    setDeskripsiBab(bab.deskripsi || "");
    setIsFormOpen(true);
  };

  const handleSaveBab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaBab.trim()) return toast.error("Nama Bab wajib diisi");
    setSavingBab(true);
    try {
      const res = await fetch("/api/admin/ujian-usbu/bab", {
        method: editingBab ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingBab
            ? { id: editingBab.id, nama: namaBab.trim(), deskripsi: deskripsiBab.trim() }
            : { programId, mapelId, nama: namaBab.trim(), deskripsi: deskripsiBab.trim() },
        ),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan Bab");
      toast.success(editingBab ? "Bab berhasil diperbarui" : "Bab berhasil dibuat");
      setIsFormOpen(false);
      await onRefresh();
      if (!editingBab && json.data?.id) {
        onSelectBab(json.data.id);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan Bab");
    } finally {
      setSavingBab(false);
    }
  };

  const handleMoveBab = async (direction: -1 | 1) => {
    if (activeBabIndex < 0) return;
    const targetIdx = activeBabIndex + direction;
    if (targetIdx < 0 || targetIdx >= babList.length) return;
    const reordered = [...babList];
    const [moved] = reordered.splice(activeBabIndex, 1);
    reordered.splice(targetIdx, 0, moved);
    const payload = reordered.map((b, idx) => ({ id: b.id, urutan: idx + 1 }));
    try {
      const res = await fetch("/api/admin/ujian-usbu/bab", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reorder: payload }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Gagal mengubah urutan Bab");
      await onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah urutan Bab");
    }
  };

  const openDeleteModal = () => {
    setDeletePassword("");
    setShowDeletePw(false);
    setDeleteSoals(false);
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBab) return;
    if (!deletePassword.trim()) {
      return toast.error("Masukkan sandi Super Admin terlebih dahulu");
    }
    setDeletingBab(true);
    try {
      const res = await fetch("/api/admin/ujian-usbu/bab", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: activeBab.id,
          password: deletePassword,
          deleteSoals,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menghapus Bab");
      toast.success(json.message || "Bab berhasil dihapus");
      setIsDeleteOpen(false);
      onSelectBab("ALL");
      await onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus Bab");
    } finally {
      setDeletingBab(false);
    }
  };

  const openPickerModal = async () => {
    if (!activeBab) return;
    setIsPickerOpen(true);
    setPickerDirty(false);
    setPickerFilter("ALL");
    setPickerTipe("ALL");
    setPickerSearch("");
    setPickerLoading(true);
    try {
      const res = await fetch(
        `/api/admin/ujian-usbu/bank-soal?programId=${programId}&mapelId=${mapelId}`,
      );
      if (!res.ok) throw new Error("Gagal memuat daftar soal");
      const data = await res.json();
      setPickerSoals(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat soal");
      setPickerSoals([]);
    } finally {
      setPickerLoading(false);
    }
  };

  const handleToggleSoalInBab = async (soal: PickerSoalItem) => {
    if (!activeBab) return;
    if (togglingIds[soal.id]) return;

    const currentlyInThisBab = soal.babId === activeBab.id;
    const nextAssign = !currentlyInThisBab;

    setTogglingIds((prev) => ({ ...prev, [soal.id]: true }));
    // Optimistic update
    setPickerSoals((prev) =>
      prev.map((item) =>
        item.id === soal.id
          ? {
              ...item,
              babId: nextAssign ? activeBab.id : null,
              bab: nextAssign
                ? { id: activeBab.id, nama: activeBab.nama, urutan: activeBab.urutan }
                : null,
            }
          : item,
      ),
    );

    try {
      const res = await fetch("/api/admin/ujian-usbu/bab", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle-soal",
          babId: activeBab.id,
          soalId: soal.id,
          assign: nextAssign,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memindahkan soal");
      setPickerDirty(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal memindahkan soal");
      // Revert
      setPickerSoals((prev) =>
        prev.map((item) => (item.id === soal.id ? soal : item)),
      );
    } finally {
      setTogglingIds((prev) => {
        const next = { ...prev };
        delete next[soal.id];
        return next;
      });
    }
  };

  const closePickerModal = async () => {
    setIsPickerOpen(false);
    if (pickerDirty) {
      await onRefresh();
    }
  };

  // Escape key closes modals cleanly
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isDeleteOpen && !deletingBab) setIsDeleteOpen(false);
        else if (isFormOpen && !savingBab) setIsFormOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isDeleteOpen, deletingBab, isFormOpen, savingBab]);

  const pickerTipeOptions = useMemo(() => {
    const set = new Set<string>();
    pickerSoals.forEach((s) => set.add(s.tipeSoal));
    return Array.from(set);
  }, [pickerSoals]);

  const pickerCounts = useMemo(() => {
    if (!activeBab) return { all: 0, inBab: 0, none: 0, other: 0 };
    let inBab = 0;
    let none = 0;
    let other = 0;
    for (const s of pickerSoals) {
      if (s.babId === activeBab.id) inBab++;
      else if (!s.babId) none++;
      else other++;
    }
    return { all: pickerSoals.length, inBab, none, other };
  }, [pickerSoals, activeBab]);

  const filteredPickerSoals = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    return pickerSoals.filter((s) => {
      if (activeBab) {
        if (pickerFilter === "IN_BAB" && s.babId !== activeBab.id) return false;
        if (pickerFilter === "NONE" && s.babId !== null) return false;
        if (pickerFilter === "OTHER" && (!s.babId || s.babId === activeBab.id)) return false;
      }
      if (pickerTipe !== "ALL" && s.tipeSoal !== pickerTipe) return false;
      if (q) {
        const plain = stripHtml(s.pertanyaan).toLowerCase();
        if (!plain.includes(q)) return false;
      }
      return true;
    });
  }, [pickerSoals, activeBab, pickerFilter, pickerTipe, pickerSearch]);

  const totalAllCount = useMemo(
    () =>
      babList.reduce((acc, b) => acc + (b._count?.soalList ?? 0), 0) +
      tanpaBabCount,
    [babList, tanpaBabCount],
  );

  if (!programId || !mapelId) return null;

  return (
    <div className="mb-5 bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <FolderOpen size={15} className="text-[var(--color-primary)]" />
          <h3 className="font-bold text-gray-700 uppercase tracking-wider text-xs">
            Kelompok Bab Materi
          </h3>
          <span className="text-[11px] font-semibold text-gray-400">
            ({babList.length} Bab)
          </span>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="text-xs font-bold text-[var(--color-primary)] bg-[var(--color-primary-50)] hover:brightness-95 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition"
        >
          <FolderPlus size={14} /> Tambah Bab
        </button>
      </div>

      {/* Pills Filter Bab */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSelectBab("ALL")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
            selectedBabId === "ALL"
              ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-sm"
              : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
          }`}
        >
          <Layers size={13} />
          Semua Bab
          <span
            className={`px-1.5 py-0.5 rounded-md text-[10px] ${
              selectedBabId === "ALL" ? "bg-white/20 text-white" : "bg-gray-200 text-gray-700"
            }`}
          >
            {totalAllCount}
          </span>
        </button>

        {babList.map((bab) => {
          const isSelected = selectedBabId === bab.id;
          return (
            <button
              key={bab.id}
              type="button"
              onClick={() => onSelectBab(bab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                isSelected
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-indigo-50/40 text-indigo-800 border-indigo-200/70 hover:bg-indigo-50"
              }`}
            >
              <span>{bab.nama}</span>
              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                  isSelected ? "bg-white/20 text-white" : "bg-indigo-100 text-indigo-700"
                }`}
              >
                {bab._count?.soalList ?? 0}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onSelectBab("NONE")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
            selectedBabId === "NONE"
              ? "bg-amber-600 text-white border-amber-600 shadow-sm"
              : "bg-amber-50/60 text-amber-800 border-amber-200 hover:bg-amber-100/70"
          }`}
        >
          <span>Tanpa Bab</span>
          <span
            className={`px-1.5 py-0.5 rounded-md text-[10px] ${
              selectedBabId === "NONE" ? "bg-white/20 text-white" : "bg-amber-200/70 text-amber-900"
            }`}
          >
            {tanpaBabCount}
          </span>
        </button>
      </div>

      {/* Action Strip for Active Bab */}
      {activeBab && (
        <div className="pt-2.5 border-t border-indigo-100 bg-indigo-50/40 -mx-4 -mb-4 px-4 py-3 rounded-b-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-extrabold text-indigo-900">
                {activeBab.nama}
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                {activeBab._count?.soalList ?? 0} soal (semua jenis)
              </span>
            </div>
            {activeBab.deskripsi && (
              <p className="text-xs text-indigo-700/80 mt-0.5 truncate max-w-xl">
                {activeBab.deskripsi}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={openPickerModal}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition flex items-center gap-1.5 shadow-sm"
            >
              <CheckSquare size={14} /> Pilih Soal ke Bab (Klik-Klik)
            </button>
            <button
              type="button"
              onClick={() => handleMoveBab(-1)}
              disabled={activeBabIndex <= 0}
              title="Geser urutan ke kiri"
              className="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition"
            >
              <ArrowUp size={13} className="-rotate-90" />
            </button>
            <button
              type="button"
              onClick={() => handleMoveBab(1)}
              disabled={activeBabIndex >= babList.length - 1}
              title="Geser urutan ke kanan"
              className="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition"
            >
              <ArrowDown size={13} className="-rotate-90" />
            </button>
            <button
              type="button"
              onClick={() => openEditModal(activeBab)}
              className="px-2.5 py-1.5 rounded-lg bg-white border border-blue-200 text-blue-700 text-xs font-bold hover:bg-blue-50 transition flex items-center gap-1"
            >
              <Edit2 size={13} /> Edit
            </button>
            <button
              type="button"
              onClick={openDeleteModal}
              className="px-2.5 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold hover:bg-rose-100 transition flex items-center gap-1"
            >
              <Lock size={12} /> Hapus Bab
            </button>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH / EDIT BAB */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-gray-800">
                {editingBab ? "Edit Bab Materi" : "Tambah Bab Materi Baru"}
              </h3>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveBab} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                  Nama Bab *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={namaBab}
                  onChange={(e) => setNamaBab(e.target.value)}
                  placeholder="Contoh: Bab 1 - Isim & Fi'il"
                  className="w-full p-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-indigo-500 outline-none text-sm font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                  Deskripsi / Cakupan Materi (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={deskripsiBab}
                  onChange={(e) => setDeskripsiBab(e.target.value)}
                  placeholder="Catatan singkat materi bab ini..."
                  className="w-full p-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-indigo-500 outline-none text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-gray-100 text-gray-600 hover:bg-gray-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingBab}
                  className="px-5 py-2 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingBab && <Loader2 size={14} className="animate-spin" />}
                  {editingBab ? "Simpan Perubahan" : "Buat Bab"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PILIH SOAL KE BAB (KLIK-KLIK CEPAT) */}
      {isPickerOpen && activeBab && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b bg-indigo-50/70 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-indigo-950 text-base flex items-center gap-2">
                  <CheckSquare size={18} className="text-indigo-600" />
                  Pilih Soal untuk: {activeBab.nama}
                </h3>
                <p className="text-xs text-indigo-700/80 mt-0.5">
                  Cukup klik baris soal untuk langsung memasukkan atau mengeluarkan dari Bab ini. Perubahan tersimpan otomatis.
                </p>
              </div>
              <button
                type="button"
                onClick={closePickerModal}
                className="p-1.5 rounded-lg bg-white border border-indigo-100 text-gray-500 hover:text-gray-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* Filter Toolbar */}
            <div className="px-6 py-3 border-b bg-gray-50/80 flex flex-wrap gap-2 items-center justify-between shrink-0">
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { key: "ALL", label: `Semua (${pickerCounts.all})` },
                    { key: "IN_BAB", label: `Di Bab Ini (${pickerCounts.inBab})` },
                    { key: "NONE", label: `Tanpa Bab (${pickerCounts.none})` },
                    { key: "OTHER", label: `Bab Lain (${pickerCounts.other})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setPickerFilter(tab.key)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition border ${
                      pickerFilter === tab.key
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <select
                  value={pickerTipe}
                  onChange={(e) => setPickerTipe(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 bg-white outline-none"
                >
                  <option value="ALL">Semua Jenis Soal</option>
                  {pickerTipeOptions.map((t) => (
                    <option key={t} value={t}>
                      {TIPE_SOAL_LABELS[t] || t}
                    </option>
                  ))}
                </select>

                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    placeholder="Cari teks soal..."
                    className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-white outline-none focus:border-indigo-400 w-48"
                  />
                </div>
              </div>
            </div>

            {/* Soal List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50/40">
              {pickerLoading ? (
                <div className="py-12 text-center text-sm text-gray-500 flex flex-col items-center gap-2">
                  <Loader2 size={24} className="animate-spin text-indigo-500" />
                  Memuat semua soal pada mapel ini...
                </div>
              ) : filteredPickerSoals.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400">
                  Tidak ada soal yang cocok dengan filter ini.
                </div>
              ) : (
                filteredPickerSoals.map((s) => {
                  const inThisBab = s.babId === activeBab.id;
                  const inOtherBab = !!s.babId && s.babId !== activeBab.id;
                  const busy = !!togglingIds[s.id];
                  const plain = stripHtml(s.pertanyaan);
                  const isArabic = /[\u0600-\u06FF]/.test(plain);

                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={busy}
                      onClick={() => handleToggleSoalInBab(s)}
                      className={`w-full text-left p-3.5 rounded-xl border-2 transition-all flex items-start gap-3 ${
                        inThisBab
                          ? "bg-emerald-50/70 border-emerald-400 shadow-sm"
                          : inOtherBab
                            ? "bg-amber-50/40 border-amber-200 hover:border-indigo-300"
                            : "bg-white border-gray-200 hover:border-indigo-300"
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border-2 transition ${
                          inThisBab
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "bg-white border-gray-300 text-transparent"
                        }`}
                      >
                        {busy ? (
                          <Loader2 size={13} className="animate-spin text-indigo-500" />
                        ) : (
                          <Check size={14} />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                            {TIPE_SOAL_LABELS[s.tipeSoal] || s.tipeSoal}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-100 text-orange-700">
                            Bobot {s.bobot}
                          </span>
                          {inThisBab && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-600 text-white">
                              ✓ Masuk {activeBab.nama}
                            </span>
                          )}
                          {inOtherBab && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                              Saat ini di: {s.bab?.nama || "Bab Lain"} (klik untuk pindah)
                            </span>
                          )}
                          {!s.babId && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                              Tanpa Bab
                            </span>
                          )}
                        </div>
                        <p
                          dir="auto"
                          className={`text-sm text-gray-800 line-clamp-2 ${
                            isArabic ? "font-serif text-base leading-relaxed" : ""
                          }`}
                        >
                          {plain || "(Soal bergambar / tanpa teks)"}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="px-6 py-3.5 border-t bg-white flex justify-between items-center shrink-0">
              <span className="text-xs font-bold text-emerald-700">
                Total di {activeBab.nama}: {pickerCounts.inBab} soal
              </span>
              <button
                type="button"
                onClick={closePickerModal}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HAPUS BAB — WAJIB SANDI SUPER ADMIN */}
      {isDeleteOpen && activeBab && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border-t-4 border-rose-600">
            <div className="px-5 py-4 border-b bg-rose-50/70 flex justify-between items-center">
              <h3 className="font-bold text-rose-900 flex items-center gap-2">
                <AlertTriangle size={18} className="text-rose-600" />
                Hapus Bab Materi
              </h3>
              <button
                type="button"
                onClick={() => setIsDeleteOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmDelete} className="p-5 space-y-4">
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1">
                <p className="font-bold">
                  Anda akan menghapus Bab &ldquo;{activeBab.nama}&rdquo;.
                </p>
                <p>
                  Bab ini saat ini berisi{" "}
                  <strong>{activeBab._count?.soalList ?? 0} soal</strong>.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block">
                  Pilih Tindakan terhadap Soal di Dalamnya:
                </label>

                <label
                  className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${
                    !deleteSoals
                      ? "border-indigo-500 bg-indigo-50/50"
                      : "border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="deleteMode"
                    checked={!deleteSoals}
                    onChange={() => setDeleteSoals(false)}
                    className="mt-1 accent-indigo-600"
                  />
                  <div>
                    <span className="block text-xs font-bold text-gray-800">
                      Hapus Bab saja (Aman)
                    </span>
                    <span className="block text-[11px] text-gray-500 mt-0.5">
                      Soal-soal tidak dihapus, melainkan dipindahkan ke kelompok &ldquo;Tanpa Bab&rdquo;.
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${
                    deleteSoals
                      ? "border-rose-500 bg-rose-50"
                      : "border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="deleteMode"
                    checked={deleteSoals}
                    onChange={() => setDeleteSoals(true)}
                    className="mt-1 accent-rose-600"
                  />
                  <div>
                    <span className="block text-xs font-bold text-rose-700">
                      Hapus Bab BESERTA seluruh {activeBab._count?.soalList ?? 0} soal di dalamnya
                    </span>
                    <span className="block text-[11px] text-rose-600/80 mt-0.5">
                      Peringatan: Semua soal di bab ini akan dihapus permanen dan tidak bisa dikembalikan!
                    </span>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Lock size={13} className="text-rose-600" />
                  Verifikasi Sandi Super Admin *
                </label>
                <div className="relative">
                  <input
                    type={showDeletePw ? "text" : "password"}
                    required
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Masukkan sandi Super Admin..."
                    className="w-full p-2.5 pr-10 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white focus:border-rose-500 outline-none text-sm font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDeletePw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                  >
                    {showDeletePw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsDeleteOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-gray-100 text-gray-600 hover:bg-gray-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={deletingBab || !deletePassword.trim()}
                  className="px-5 py-2 rounded-xl text-sm font-bold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {deletingBab ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                  Konfirmasi Hapus
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
