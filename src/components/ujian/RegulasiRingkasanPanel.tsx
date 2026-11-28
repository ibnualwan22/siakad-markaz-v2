"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Edit2,
  Info,
  Lock,
  Plus,
  RefreshCw,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  TIPE_SOAL_LABELS,
  evaluateMapelRegulasi,
  type RegulasiQismRule,
  type AssignedSoalLite,
  type MapelEvalResult,
} from "@/lib/regulasi-soal-usbu";

export type RegulasiRuleWithId = RegulasiQismRule & { id: string };

type RingkasanSoalRow = {
  id: string;
  mapelId: string;
  tipeSoal: string;
  bobot: number;
  bulanKe: number;
  pertanyaan: string;
  bab?: { id: string; nama: string } | null;
  jenisSoal?: { id: string; nama: string } | null;
};

type RingkasanMapelRow = {
  mapelId: string;
  mapelNama: string;
  evaluation: MapelEvalResult;
  soals: RingkasanSoalRow[];
};

type RingkasanPayload = {
  programId: string;
  programNama: string;
  isAkbarnas: boolean;
  usbuKe: number;
  bulanKe: number;
  totalSoalGlobal: number;
  totalBobotGlobal: number;
  mapelOver100Count: number;
  mapelReadyCount: number;
  mapelWithRegulasiCount: number;
  mapels: RingkasanMapelRow[];
};

function stripHtml(html: string): string {
  return (html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : Number(n.toFixed(2)).toString();
}

// =========================================================================
// MODAL EDITOR REGULASI QISM (PER PROGRAM + MAPEL + BULAN)
// =========================================================================
function RegulasiEditorModal({
  programId,
  mapelId,
  mapelNama,
  bulanKe,
  onClose,
  onSaved,
}: {
  programId: string;
  mapelId: string;
  mapelNama: string;
  bulanKe: number;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [rules, setRules] = useState<RegulasiRuleWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  // New Qism form
  const [newTipe, setNewTipe] = useState("PG");
  const [newJumlah, setNewJumlah] = useState(5);
  const [newBobot, setNewBobot] = useState(2);
  const [newCatatan, setNewCatatan] = useState("");
  const [adding, setAdding] = useState(false);

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/ujian-usbu/regulasi?programId=${programId}&mapelId=${mapelId}&bulanKe=${bulanKe}`,
      );
      const data = await res.json();
      setRules(data.rules || []);
    } catch {
      toast.error("Gagal memuat panduan regulasi");
    } finally {
      setLoading(false);
    }
  }, [programId, mapelId, bulanKe]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const totalTargetBobot =
    Math.round(
      rules.reduce((a, r) => a + r.targetJumlah * r.targetBobot, 0) * 100,
    ) / 100;

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const res = await fetch("/api/admin/ujian-usbu/regulasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId,
          mapelId,
          bulanKe,
          tipeSoal: newTipe,
          targetJumlah: Number(newJumlah),
          targetBobot: Number(newBobot),
          catatan: newCatatan.trim() || null,
          usbuBerlaku: "1,2",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menambah Qism");
      toast.success("Qism panduan ditambahkan");
      setNewCatatan("");
      await loadRules();
      await onSaved();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menambah Qism");
    } finally {
      setAdding(false);
    }
  };

  const handleUpdateRule = async (rule: RegulasiRuleWithId) => {
    setSavingId(rule.id);
    try {
      const res = await fetch("/api/admin/ujian-usbu/regulasi", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: rule.id,
          tipeSoal: rule.tipeSoal,
          targetJumlah: Number(rule.targetJumlah),
          targetBobot: Number(rule.targetBobot),
          catatan: rule.catatan,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan Qism");
      toast.success(`Qism ${rule.urutanQism} diperbarui`);
      await onSaved();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm("Hapus Qism ini dari panduan?")) return;
    try {
      const res = await fetch(`/api/admin/ujian-usbu/regulasi?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.json()).error || "Gagal hapus");
      toast.success("Qism dihapus");
      await loadRules();
      await onSaved();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus");
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center shrink-0">
          <div>
            <h3 className="font-bold text-gray-800 text-base">
              Edit Panduan Pencetangan (Usbu&apos; 1 &amp; 2) — {mapelNama}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Total target bobot saat ini:{" "}
              <strong
                className={
                  totalTargetBobot > 100
                    ? "text-rose-600"
                    : Math.abs(totalTargetBobot - 100) < 0.01
                      ? "text-emerald-600"
                      : "text-amber-600"
                }
              >
                {fmtNum(totalTargetBobot)} / 100
              </strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-gray-800"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="py-10 text-center text-sm text-gray-500">
              <Loader2 size={22} className="animate-spin mx-auto mb-2 text-indigo-500" />
              Memuat regulasi...
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((r) => (
                <div
                  key={r.id}
                  className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/60 space-y-2.5"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                    <div className="sm:col-span-5">
                      <label className="text-[10px] font-bold uppercase text-gray-500 block mb-1">
                        Qism {r.urutanQism} — Jenis Soal
                      </label>
                      <select
                        value={r.tipeSoal}
                        onChange={(e) =>
                          setRules((prev) =>
                            prev.map((x) =>
                              x.id === r.id ? { ...x, tipeSoal: e.target.value } : x,
                            ),
                          )
                        }
                        className="w-full p-2 text-xs font-semibold rounded-lg border border-gray-200 bg-white"
                      >
                        {Object.entries(TIPE_SOAL_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold uppercase text-gray-500 block mb-1">
                        Jml Soal
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={r.targetJumlah}
                        onChange={(e) =>
                          setRules((prev) =>
                            prev.map((x) =>
                              x.id === r.id
                                ? { ...x, targetJumlah: Number(e.target.value) }
                                : x,
                            ),
                          )
                        }
                        className="w-full p-2 text-xs font-bold text-center rounded-lg border border-gray-200 bg-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold uppercase text-gray-500 block mb-1">
                        Bobot/Soal
                      </label>
                      <input
                        type="number"
                        min={0.5}
                        step="any"
                        value={r.targetBobot}
                        onChange={(e) =>
                          setRules((prev) =>
                            prev.map((x) =>
                              x.id === r.id
                                ? { ...x, targetBobot: Number(e.target.value) }
                                : x,
                            ),
                          )
                        }
                        className="w-full p-2 text-xs font-bold text-center rounded-lg border border-gray-200 bg-white"
                      />
                    </div>
                    <div className="sm:col-span-3 flex items-center justify-end gap-1.5">
                      <span className="text-xs font-bold text-gray-600 mr-1">
                        = {fmtNum(r.targetJumlah * r.targetBobot)}
                      </span>
                      <button
                        type="button"
                        disabled={savingId === r.id}
                        onClick={() => handleUpdateRule(r)}
                        className="px-2.5 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {savingId === r.id ? "..." : "Simpan"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRule(r.id)}
                        className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100"
                        title="Hapus Qism"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={r.catatan || ""}
                    onChange={(e) =>
                      setRules((prev) =>
                        prev.map((x) =>
                          x.id === r.id ? { ...x, catatan: e.target.value } : x,
                        ),
                      )
                    }
                    placeholder="Catatan panduan (opsional, misal: Menentukan 1 mufradat yang cocok...)"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-blue-100 bg-blue-50/40 text-blue-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-300"
                  />
                </div>
              ))}

              {rules.length === 0 && (
                <p className="text-xs text-gray-400 italic text-center py-4">
                  Belum ada Qism panduan untuk mapel ini. Tambahkan di bawah.
                </p>
              )}
            </div>
          )}

          {/* Add New Qism */}
          <form
            onSubmit={handleAddRule}
            className="p-4 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/30 space-y-3"
          >
            <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-1.5">
              <Plus size={14} /> Tambah Qism Baru
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <select
                value={newTipe}
                onChange={(e) => setNewTipe(e.target.value)}
                className="sm:col-span-5 p-2 text-xs font-semibold rounded-lg border border-gray-200 bg-white"
              >
                {Object.entries(TIPE_SOAL_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={newJumlah}
                onChange={(e) => setNewJumlah(Number(e.target.value))}
                placeholder="Jml"
                className="sm:col-span-2 p-2 text-xs font-bold text-center rounded-lg border border-gray-200 bg-white"
              />
              <input
                type="number"
                min={0.5}
                step="any"
                value={newBobot}
                onChange={(e) => setNewBobot(Number(e.target.value))}
                placeholder="Bobot"
                className="sm:col-span-2 p-2 text-xs font-bold text-center rounded-lg border border-gray-200 bg-white"
              />
              <button
                type="submit"
                disabled={adding}
                className="sm:col-span-3 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50"
              >
                {adding ? "Menambah..." : `+ Tambah (${fmtNum(newJumlah * newBobot)} poin)`}
              </button>
            </div>
            <input
              type="text"
              value={newCatatan}
              onChange={(e) => setNewCatatan(e.target.value)}
              placeholder="Catatan khusus dari panduan (opsional)..."
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-white"
            />
          </form>
        </div>

        <div className="px-6 py-3 border-t bg-gray-50 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gray-800 text-white text-sm font-bold hover:bg-gray-900"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// 1. COMPACT STICKY GUIDE BAR (DI HALAMAN DAFTAR BANK SOAL)
// =========================================================================
export function RegulasiStickyBar({
  programId,
  mapelId,
  mapelNama,
  isAkbarnas,
  usbuKe,
  bulanKe,
  rules,
  assignedSoals,
  onOpenFullRingkasan,
  onRefreshData,
}: {
  programId: string;
  mapelId: string;
  mapelNama: string;
  isAkbarnas: boolean;
  usbuKe: number;
  bulanKe: number;
  rules: RegulasiRuleWithId[];
  assignedSoals: AssignedSoalLite[];
  onOpenFullRingkasan: () => void;
  onRefreshData: () => Promise<void> | void;
}) {
  const [syncing, setSyncing] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  if (!programId || !mapelId) return null;

  if (usbuKe !== 1 && usbuKe !== 2) {
    return (
      <div className="mb-4 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <Info size={15} className="text-slate-500 shrink-0" />
          <span>
            Panduan &amp; penguncian kuota otomatis saat ini aktif untuk{" "}
            <strong>Usbu&apos; 1 &amp; Usbu&apos; 2</strong> (Usbu&apos; 3 menyusul).
          </span>
        </div>
        <button
          type="button"
          onClick={onOpenFullRingkasan}
          className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 flex items-center gap-1"
        >
          <ClipboardList size={13} /> Ringkasan Soal Ujian
        </button>
      </div>
    );
  }

  const activeRules = rules.filter((r) => {
    const allowed = (r.usbuBerlaku || "1,2")
      .split(",")
      .map((x) => Number(x.trim()));
    return allowed.includes(usbuKe);
  });

  const evalRes = evaluateMapelRegulasi(activeRules, assignedSoals);
  const hasMismatchBobot = evalRes.qisms.some((q) => q.bobotMismatchCount > 0);
  const allPas =
    evalRes.hasRegulasi &&
    evalRes.isExact100 &&
    evalRes.qisms.every((q) => q.status === "PAS") &&
    evalRes.extraSoals.length === 0;
  const hasNotes = evalRes.qisms.some((q) => !!q.catatan);

  const handleSyncBobot = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/ujian-usbu/regulasi", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync-bobot",
          programId,
          mapelId,
          usbuKe,
          bulanKe: isAkbarnas ? bulanKe : 1,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal sinkron bobot");
      toast.success(
        `Berhasil menyinkronkan bobot ${json.updated || 0} soal sesuai panduan!`,
      );
      await onRefreshData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal sinkron bobot");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div
      className={`mb-5 rounded-xl border-2 p-4 shadow-sm transition-colors ${
        evalRes.isOver100
          ? "bg-rose-50 border-rose-400"
          : allPas
            ? "bg-emerald-50/70 border-emerald-300"
            : "bg-white border-blue-200"
      }`}
    >
      {/* Top Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div
            className={`px-2.5 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1.5 ${
              evalRes.isOver100
                ? "bg-rose-600 text-white"
                : allPas
                  ? "bg-emerald-600 text-white"
                  : "bg-blue-600 text-white"
            }`}
          >
            {evalRes.isOver100 ? (
              <AlertTriangle size={14} />
            ) : allPas ? (
              <CheckCircle2 size={14} />
            ) : (
              <ClipboardList size={14} />
            )}
            Panduan Usbu&apos; {usbuKe}
            {isAkbarnas ? ` (Bln ${bulanKe})` : ""} — {mapelNama}
          </div>

          <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-gray-700">
            Terpilih: {evalRes.totalSoal}
            {evalRes.hasRegulasi ? ` / ${evalRes.targetTotalSoal}` : ""} soal
          </span>

          <span
            className={`text-xs font-extrabold px-2.5 py-1 rounded-lg border ${
              evalRes.isOver100
                ? "bg-rose-100 border-rose-300 text-rose-800"
                : evalRes.isExact100
                  ? "bg-emerald-100 border-emerald-300 text-emerald-800"
                  : "bg-amber-50 border-amber-200 text-amber-800"
            }`}
          >
            Bobot Mapel: {fmtNum(evalRes.totalBobot)} / 100
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasNotes && (
            <button
              type="button"
              onClick={() => setShowNotes((v) => !v)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 flex items-center gap-1"
            >
              <Info size={13} /> {showNotes ? "Sembunyikan Catatan" : "Catatan PDF"}
            </button>
          )}
          {hasMismatchBobot && (
            <button
              type="button"
              onClick={handleSyncBobot}
              disabled={syncing}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 flex items-center gap-1 disabled:opacity-50"
            >
              {syncing ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Sparkles size={13} />
              )}
              Sinkron Bobot
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsEditorOpen(true)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-1"
          >
            <Edit2 size={12} /> Edit Panduan
          </button>
          <button
            type="button"
            onClick={onOpenFullRingkasan}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1 shadow-sm"
          >
            <ClipboardList size={13} /> Ringkasan Semua Mapel
          </button>
        </div>
      </div>

      {/* Warning Bobot > 100 */}
      {evalRes.isOver100 && (
        <div className="mt-3 p-2.5 rounded-lg bg-rose-100 border border-rose-300 text-xs font-bold text-rose-800 flex items-center gap-2">
          <AlertTriangle size={15} className="shrink-0" />
          PERINGATAN: Total bobot soal terpilih untuk mapel ini melebihi 100 ({fmtNum(evalRes.totalBobot)} poin). Mohon kurangi soal atau sinkronkan bobot agar tidak lewat 100.
        </div>
      )}

      {/* Qism Progress Pills */}
      {evalRes.hasRegulasi ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {evalRes.qisms.map((q) => {
            const isFull = q.terpilihJumlah >= q.targetJumlah;
            const isOver = q.status === "LEBIH";
            return (
              <div
                key={`${q.urutanQism}-${q.tipeSoal}`}
                className={`px-3 py-1.5 rounded-lg border text-xs flex flex-col gap-0.5 ${
                  isOver
                    ? "bg-rose-100 border-rose-300 text-rose-900"
                    : isFull
                      ? "bg-emerald-100/80 border-emerald-300 text-emerald-900"
                      : "bg-gray-50 border-gray-200 text-gray-700"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <span className="text-[10px] opacity-70">Q{q.urutanQism}</span>
                  <span>{q.tipeLabel}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold flex items-center gap-0.5 ${
                      isOver
                        ? "bg-rose-600 text-white"
                        : isFull
                          ? "bg-emerald-600 text-white"
                          : "bg-amber-200 text-amber-900"
                    }`}
                  >
                    {isFull && !isOver && <Lock size={9} />}
                    {q.terpilihJumlah}/{q.targetJumlah}
                  </span>
                  <span className="text-[10px] font-semibold opacity-75">
                    @{fmtNum(q.targetBobot)}pt
                  </span>
                </div>
                {showNotes && q.catatan && (
                  <p className="text-[11px] text-sky-800 font-medium bg-sky-50 px-2 py-0.5 rounded border border-sky-100 mt-0.5">
                    {q.catatan}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-2.5 text-xs text-gray-500 italic">
          Belum ada aturan panduan Qism untuk mapel ini di Usbu&apos; {usbuKe}. Klik &ldquo;Edit Panduan&rdquo; jika ingin menambahkan.
        </p>
      )}

      {evalRes.extraSoals.length > 0 && (
        <div className="mt-2.5 p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-900">
          Soal di luar jenis panduan:{" "}
          {evalRes.extraSoals
            .map(
              (e) =>
                `${TIPE_SOAL_LABELS[e.tipeSoal] || e.tipeSoal} (${e.count} soal, ${fmtNum(e.bobot)}pt)`,
            )
            .join(", ")}
        </div>
      )}

      {isEditorOpen && (
        <RegulasiEditorModal
          programId={programId}
          mapelId={mapelId}
          mapelNama={mapelNama}
          bulanKe={isAkbarnas ? bulanKe : 1}
          onClose={() => setIsEditorOpen(false)}
          onSaved={onRefreshData}
        />
      )}
    </div>
  );
}

// =========================================================================
// 2. FULL TAB RINGKASAN SOAL TERPILIH UNTUK DIUJIKAN
// =========================================================================
export function RegulasiRingkasanView({
  programId,
  isAkbarnas,
  defaultUsbuKe = 1,
  defaultBulanKe = 1,
  onUncheckSoal,
  onJumpToMapel,
}: {
  programId: string;
  isAkbarnas: boolean;
  defaultUsbuKe?: number;
  defaultBulanKe?: number;
  onUncheckSoal?: () => void;
  onJumpToMapel?: (mapelId: string) => void;
}) {
  const [usbuKe, setUsbuKe] = useState<number>(defaultUsbuKe);
  const bulanKe = defaultBulanKe;
  const [data, setData] = useState<RingkasanPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedMapels, setExpandedMapels] = useState<Record<string, boolean>>({});
  const [editorTarget, setEditorTarget] = useState<{ mapelId: string; mapelNama: string } | null>(null);
  const [syncingMapel, setSyncingMapel] = useState<string | null>(null);
  const [uncheckingId, setUncheckingId] = useState<string | null>(null);

  const fetchRingkasan = useCallback(async () => {
    if (!programId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/ujian-usbu/ringkasan?programId=${programId}&usbuKe=${usbuKe}&bulanKe=${isAkbarnas ? bulanKe : 1}`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat ringkasan");
      setData(json);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat ringkasan");
    } finally {
      setLoading(false);
    }
  }, [programId, usbuKe, bulanKe, isAkbarnas]);

  useEffect(() => {
    fetchRingkasan();
  }, [fetchRingkasan]);

  const handleSyncMapel = async (mapelId: string) => {
    setSyncingMapel(mapelId);
    try {
      const res = await fetch("/api/admin/ujian-usbu/regulasi", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync-bobot",
          programId,
          mapelId,
          usbuKe,
          bulanKe: isAkbarnas ? bulanKe : 1,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal sinkron");
      toast.success(`Bobot ${json.updated || 0} soal disinkronkan sesuai panduan`);
      await fetchRingkasan();
      onUncheckSoal?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal sinkron bobot");
    } finally {
      setSyncingMapel(null);
    }
  };

  const handleQuickUncheck = async (soalId: string) => {
    setUncheckingId(soalId);
    try {
      const res = await fetch("/api/admin/ujian-usbu/bank-soal/assign", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ soalIds: [soalId], usbuKe }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Gagal melepas soal");
      toast.success(`Soal dilepas dari Usbu' ${usbuKe}`);
      await fetchRingkasan();
      onUncheckSoal?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal melepas soal");
    } finally {
      setUncheckingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Filter Usbu & Bulan */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase text-gray-500 mr-1">
            Pilih Ujian:
          </span>
          {[1, 2, 3].map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUsbuKe(u)}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold border transition ${
                usbuKe === u
                  ? "bg-[var(--color-primary)] text-white border-transparent shadow-sm"
                  : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
              }`}
            >
              Usbu&apos; {u} {u === 3 ? "(Belum Dikunci)" : ""}
            </button>
          ))}

          {isAkbarnas && (
            <span className="ml-2 px-3 py-1 rounded-lg text-xs font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-200">
              Akbarnas Aktif: Bulan {bulanKe}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={fetchRingkasan}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 flex items-center gap-1.5"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Muat Ulang
        </button>
      </div>

      {loading && !data ? (
        <div className="py-16 text-center text-sm text-gray-500 bg-white rounded-2xl border">
          <Loader2 size={28} className="animate-spin mx-auto mb-3 text-indigo-500" />
          Memuat ringkasan soal ujian...
        </div>
      ) : data ? (
        <>
          {/* Global Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">
                Total Soal Terpilih (Global)
              </span>
              <div className="text-3xl font-extrabold text-gray-800 mt-1">
                {data.totalSoalGlobal}{" "}
                <span className="text-sm font-semibold text-gray-400">soal</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Program {data.programNama} • Usbu&apos; {data.usbuKe}
                {data.isAkbarnas ? ` (Bulan ${data.bulanKe})` : ""}
              </p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">
                Kesiapan Mapel Sesuai Panduan
              </span>
              <div className="text-3xl font-extrabold text-emerald-600 mt-1">
                {data.mapelReadyCount}{" "}
                <span className="text-base font-bold text-gray-400">
                  / {data.mapelWithRegulasiCount} mapel
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Mapel dengan jumlah soal &amp; bobot pas 100/100
              </p>
            </div>

            <div
              className={`rounded-2xl p-5 border-2 shadow-sm ${
                data.mapelOver100Count > 0
                  ? "bg-rose-50 border-rose-400"
                  : "bg-emerald-50/60 border-emerald-200"
              }`}
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block">
                Validasi Batas Bobot (Maks 100 / Mapel)
              </span>
              {data.mapelOver100Count > 0 ? (
                <>
                  <div className="text-2xl font-extrabold text-rose-700 mt-1 flex items-center gap-2">
                    <AlertTriangle size={22} /> {data.mapelOver100Count} Mapel Melebihi 100!
                  </div>
                  <p className="text-xs text-rose-700 mt-1 font-medium">
                    Periksa kartu merah di bawah dan kurangi soal atau sinkronkan bobot.
                  </p>
                </>
              ) : (
                <>
                  <div className="text-2xl font-extrabold text-emerald-700 mt-1 flex items-center gap-2">
                    <CheckCircle2 size={22} /> Semua Mapel Aman (≤ 100)
                  </div>
                  <p className="text-xs text-emerald-700/80 mt-1">
                    Tidak ada mapel yang melebihi batas bobot 100 poin.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Per-Mapel Breakdown Cards */}
          <div className="space-y-4">
            {data.mapels.map((m) => {
              const ev = m.evaluation;
              const isExpanded = !!expandedMapels[m.mapelId];
              const hasMismatch = ev.qisms.some((q) => q.bobotMismatchCount > 0);
              const isReady =
                ev.hasRegulasi &&
                ev.isExact100 &&
                ev.qisms.every((q) => q.status === "PAS") &&
                ev.extraSoals.length === 0;

              return (
                <div
                  key={m.mapelId}
                  className={`rounded-2xl bg-white border-2 shadow-sm overflow-hidden ${
                    ev.isOver100
                      ? "border-rose-400"
                      : isReady
                        ? "border-emerald-300"
                        : "border-gray-100"
                  }`}
                >
                  {/* Mapel Header */}
                  <div
                    className={`px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                      ev.isOver100
                        ? "bg-rose-50"
                        : isReady
                          ? "bg-emerald-50/60"
                          : "bg-gray-50/70"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="font-extrabold text-base text-gray-800">
                        {m.mapelNama}
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white border border-gray-200 text-gray-700">
                        {ev.totalSoal}
                        {ev.hasRegulasi ? ` / ${ev.targetTotalSoal}` : ""} Soal
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                          ev.isOver100
                            ? "bg-rose-600 text-white"
                            : ev.isExact100
                              ? "bg-emerald-600 text-white"
                              : "bg-amber-100 text-amber-800 border border-amber-300"
                        }`}
                      >
                        Bobot: {fmtNum(ev.totalBobot)} / 100
                      </span>
                      {ev.isOver100 && (
                        <span className="text-xs font-bold text-rose-700 flex items-center gap-1">
                          <AlertTriangle size={14} /> Melebihi 100!
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {hasMismatch && (usbuKe === 1 || usbuKe === 2) && (
                        <button
                          type="button"
                          onClick={() => handleSyncMapel(m.mapelId)}
                          disabled={syncingMapel === m.mapelId}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold hover:bg-amber-200 flex items-center gap-1"
                        >
                          <Sparkles size={12} />
                          {syncingMapel === m.mapelId ? "Menyinkronkan..." : "Sinkron Bobot"}
                        </button>
                      )}
                      {(usbuKe === 1 || usbuKe === 2) && (
                        <button
                          type="button"
                          onClick={() =>
                            setEditorTarget({ mapelId: m.mapelId, mapelNama: m.mapelNama })
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 text-xs font-bold hover:bg-gray-100 flex items-center gap-1"
                        >
                          <Edit2 size={12} /> Edit Panduan
                        </button>
                      )}
                      {onJumpToMapel && (
                        <button
                          type="button"
                          onClick={() => onJumpToMapel(m.mapelId)}
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold hover:bg-indigo-100 flex items-center gap-1"
                        >
                          <ExternalLink size={12} /> Pilih Soal
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedMapels((prev) => ({
                            ...prev,
                            [m.mapelId]: !prev[m.mapelId],
                          }))
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 text-xs font-bold hover:bg-gray-100 flex items-center gap-1"
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        Daftar Soal ({m.soals.length})
                      </button>
                    </div>
                  </div>

                  {/* Qism Table */}
                  {ev.hasRegulasi && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-gray-50/80 text-gray-500 uppercase text-[10px] border-y border-gray-100">
                          <tr>
                            <th className="py-2.5 px-4">Qism</th>
                            <th className="py-2.5 px-3">Jenis Soal</th>
                            <th className="py-2.5 px-3 text-center">Terpilih / Target</th>
                            <th className="py-2.5 px-3 text-center">Bobot / Soal</th>
                            <th className="py-2.5 px-3 text-center">Subtotal</th>
                            <th className="py-2.5 px-3 text-center">Status</th>
                            <th className="py-2.5 px-4">Catatan Panduan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {ev.qisms.map((q) => (
                            <tr key={`${q.urutanQism}-${q.tipeSoal}`} className="hover:bg-gray-50/60">
                              <td className="py-2.5 px-4 font-bold text-gray-600">
                                Qism {q.urutanQism}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-gray-800">
                                {q.tipeLabel}
                              </td>
                              <td className="py-2.5 px-3 text-center font-extrabold">
                                {q.terpilihJumlah} / {q.targetJumlah}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {fmtNum(q.targetBobot)}
                                {q.bobotMismatchCount > 0 && (
                                  <span className="ml-1 text-[10px] text-amber-700 font-bold">
                                    ({q.bobotMismatchCount} beda)
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold">
                                {fmtNum(q.terpilihBobot)} / {fmtNum(q.targetSubtotal)}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                    q.status === "PAS"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : q.status === "LEBIH"
                                        ? "bg-rose-100 text-rose-800"
                                        : "bg-amber-100 text-amber-800"
                                  }`}
                                >
                                  {q.status === "PAS" ? "✓ PAS" : q.status}
                                </span>
                              </td>
                              <td className="py-2.5 px-4">
                                {q.catatan ? (
                                  <span className="text-sky-700 font-semibold">
                                    {q.catatan}
                                  </span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {ev.extraSoals.length > 0 && (
                    <div className="px-5 py-2.5 bg-amber-50 border-t border-amber-100 text-xs text-amber-900 font-semibold">
                      Tipe soal tambahan di luar panduan:{" "}
                      {ev.extraSoals
                        .map(
                          (e) =>
                            `${TIPE_SOAL_LABELS[e.tipeSoal] || e.tipeSoal} (${e.count} soal • ${fmtNum(e.bobot)} poin)`,
                        )
                        .join(", ")}
                    </div>
                  )}

                  {/* Expandable List of Selected Soals */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 p-4 bg-gray-50/50 space-y-2">
                      {m.soals.length === 0 ? (
                        <p className="text-xs text-gray-400 italic text-center py-4">
                          Belum ada soal yang dicentang untuk Usbu&apos; {usbuKe} pada mapel ini.
                        </p>
                      ) : (
                        m.soals.map((s, idx) => {
                          const plain = stripHtml(s.pertanyaan);
                          const isArabic = /[\u0600-\u06FF]/.test(plain);
                          return (
                            <div
                              key={s.id}
                              className="p-3 rounded-xl bg-white border border-gray-200 flex items-start justify-between gap-3"
                            >
                              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                                  {idx + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                                      {TIPE_SOAL_LABELS[s.tipeSoal] || s.tipeSoal}
                                    </span>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-100 text-orange-700">
                                      Bobot {fmtNum(s.bobot)}
                                    </span>
                                    {s.bab?.nama && (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">
                                        {s.bab.nama}
                                      </span>
                                    )}
                                  </div>
                                  <p
                                    dir="auto"
                                    className={`text-xs text-gray-800 line-clamp-2 ${
                                      isArabic ? "font-serif text-sm" : ""
                                    }`}
                                  >
                                    {plain || "(Soal bergambar)"}
                                  </p>
                                </div>
                              </div>

                              <button
                                type="button"
                                disabled={uncheckingId === s.id}
                                onClick={() => handleQuickUncheck(s.id)}
                                className="px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold hover:bg-rose-100 shrink-0 disabled:opacity-50"
                              >
                                {uncheckingId === s.id ? "..." : "Lepas"}
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      {editorTarget && (
        <RegulasiEditorModal
          programId={programId}
          mapelId={editorTarget.mapelId}
          mapelNama={editorTarget.mapelNama}
          bulanKe={isAkbarnas ? bulanKe : 1}
          onClose={() => setEditorTarget(null)}
          onSaved={fetchRingkasan}
        />
      )}
    </div>
  );
}
