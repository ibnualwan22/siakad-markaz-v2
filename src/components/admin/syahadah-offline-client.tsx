"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import TemplateSyahadahOfflineTab from "./template-syahadah-offline-tab";
import {
  OFFLINE_STAGE_H_MM,
  OFFLINE_STAGE_W_MM,
  offlineLembagaKey,
  offlineMusyarokahProgramKey,
  offlineProgramKey,
} from "@/lib/syahadah-offline";
import {
  LEMBAGA_LIST,
  lembagaFromProgramKategori,
  lembagaLabel,
  type LembagaId,
} from "@/lib/lembaga";

export type OfflineProgramOption = {
  id: string;
  nama_indo: string;
  nama_arab: string;
  kategori?: string;
  mapelList: Array<{
    id: string;
    nama_indo: string;
    nama_arab: string;
    urutan: number;
    jumlah_tes: number;
    tampil_di_syahadah: boolean;
    masuk_akumulasi: boolean;
    bobot: number;
    bobot_usbu: number;
    bulan_aktif: number;
    jumlah_tes_b2: number | null;
  }>;
};

type DesignVariant = "lulus" | "musyarokah";
type LayoutScope = "global" | "program";

export default function SyahadahOfflineClient({
  programs,
}: {
  programs: OfflineProgramOption[];
}) {
  const [lembaga, setLembaga] = useState<LembagaId>("ARABIYAH");
  const [variant, setVariant] = useState<DesignVariant>("lulus");
  const [scope, setScope] = useState<LayoutScope>("global");

  const lembagaPrograms = useMemo(() => {
    return programs
      .filter((p) => lembagaFromProgramKategori(p.kategori) === lembaga)
      .sort((a, b) => a.nama_indo.localeCompare(b.nama_indo, "id"));
  }, [programs, lembaga]);

  const [programId, setProgramId] = useState<string>("");

  const activeProgram = useMemo(() => {
    return (
      lembagaPrograms.find((p) => p.id === programId) ||
      lembagaPrograms[0] ||
      null
    );
  }, [lembagaPrograms, programId]);

  const isMusyarokah = variant === "musyarokah";
  const isHufadz = lembaga === "HUFADZ";

  // 1 Background per lembaga per varian (Lulus sendiri, Musyarokah sendiri)
  const lembagaKey = offlineLembagaKey(lembaga, isMusyarokah);
  const lembagaBaseKey = offlineLembagaKey(lembaga, false);

  const [lembagaBgUrl, setLembagaBgUrl] = useState<string | null>(null);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [bgVersion, setBgVersion] = useState(0);

  useEffect(() => {
    let ignore = false;
    fetch(`/api/admin/syahadah-offline/template?programKey=${lembagaKey}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((tpl) => {
        if (!ignore && tpl) {
          setLembagaBgUrl(tpl.backgroundUrl ?? null);
        }
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [lembagaKey]);

  const handleUploadLembagaBg = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBg(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("programKey", lembagaKey);
      const res = await fetch("/api/admin/syahadah-offline/template/upload", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error((await res.json()).error || "Gagal upload");
      const { url, publicId } = await res.json();
      const put = await fetch("/api/admin/syahadah-offline/template", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programKey: lembagaKey,
          backgroundUrl: url,
          backgroundId: publicId,
        }),
      });
      if (!put.ok) throw new Error("Gagal menyimpan background lembaga");
      setLembagaBgUrl(url);
      setBgVersion((v) => v + 1);
      toast.success(
        `Background ${isMusyarokah ? "Musyarokah" : "Lulus"} untuk semua program ${lembagaLabel(lembaga)} berhasil diupload`,
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal upload");
    } finally {
      setUploadingBg(false);
      e.target.value = "";
    }
  };

  // Tentukan programKey editor berdasarkan mode: Global Lembaga vs Per Program
  const activeKey =
    scope === "global"
      ? lembagaKey
      : activeProgram
        ? isMusyarokah
          ? offlineMusyarokahProgramKey(activeProgram.nama_indo)
          : offlineProgramKey(activeProgram.nama_indo)
        : lembagaKey;

  const copyBaseKey =
    scope === "global"
      ? lembagaBaseKey
      : activeProgram
        ? offlineProgramKey(activeProgram.nama_indo)
        : lembagaBaseKey;

  const activeLabel =
    scope === "global"
      ? `Global ${lembagaLabel(lembaga)} (${isMusyarokah ? "Musyarokah" : "Lulus"})`
      : `${activeProgram?.nama_indo || "-"} (${isMusyarokah ? "Musyarokah" : "Lulus"})`;

  const slotCount =
    scope === "global"
      ? isHufadz
        ? 4
        : 12
      : activeProgram
        ? isHufadz
          ? 4
          : (activeProgram.mapelList ?? []).filter(
              (m) => m.tampil_di_syahadah !== false,
            ).length
        : 12;

  return (
    <div className="space-y-6 offline-print-reset">
      {/* Card 1: Pilih Lembaga & Varian Desain */}
      <div className="no-print bg-white rounded-2xl border p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base">
              1. Pilih Lembaga &amp; Jenis Syahadah
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              Cukup upload <strong>1 background Lulus</strong> dan{" "}
              <strong>1 background Musyarokah</strong> per lembaga — otomatis dipakai oleh semua program di lembaga tersebut.
            </p>
          </div>
          <a
            href={`/cetak-offline/tes/${activeKey}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm"
          >
            🖨️ Cetak Tes ({scope === "global" ? "Global" : activeProgram?.nama_indo || "-"})
          </a>
        </div>

        {/* Lembaga Tabs */}
        <div className="flex flex-wrap gap-2">
          {LEMBAGA_LIST.map((l) => {
            const count = programs.filter(
              (p) => lembagaFromProgramKategori(p.kategori) === l.id,
            ).length;
            const active = lembaga === l.id;
            const dot =
              l.id === "ARABIYAH"
                ? "bg-sky-400"
                : l.id === "TURATS"
                  ? "bg-amber-400"
                  : "bg-emerald-400";
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => setLembaga(l.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold border transition ${
                  active
                    ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
                <span>{l.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    active
                      ? "bg-white/20 text-white"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {count} program
                </span>
              </button>
            );
          })}
        </div>

        {/* Varian Tabs: Lulus vs Musyarokah */}
        <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setVariant("lulus")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold border transition ${
              variant === "lulus"
                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <span>Desain Lulus (Non-Musyarokah)</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                variant === "lulus"
                  ? "bg-white/20 text-white"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              Kertas Pre-Printed
            </span>
          </button>

          <button
            type="button"
            onClick={() => setVariant("musyarokah")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold border transition ${
              variant === "musyarokah"
                ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <span>Desain Musyarokah</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                variant === "musyarokah"
                  ? "bg-white/20 text-white"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              Kertas Polos · Tanpa Nilai
            </span>
          </button>
        </div>
      </div>

      {/* Card 2: Upload 1 Background untuk Semua Program di Lembaga ini */}
      <div
        className={`no-print rounded-2xl border p-5 space-y-3 ${
          isMusyarokah ? "bg-amber-50/40 border-amber-200" : "bg-white"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base">
              2. Background {isMusyarokah ? "Musyarokah" : "Lulus"} —{" "}
              {lembagaLabel(lembaga)} (F4 {OFFLINE_STAGE_W_MM} ×{" "}
              {OFFLINE_STAGE_H_MM} mm)
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {isMusyarokah
                ? `Dipakai bersama oleh seluruh ${lembagaPrograms.length} program di ${lembagaLabel(lembaga)} dan OTOMATIS ikut tercetak di kertas polos.`
                : `Dipakai bersama oleh seluruh ${lembagaPrograms.length} program di ${lembagaLabel(lembaga)} (acuan editor & unduhan santri; default tidak tercetak di kertas pre-printed).`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {lembagaBgUrl ? (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                ✓ Background Terupload
              </span>
            ) : (
              <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700">
                Belum Ada Background
              </span>
            )}
            <label
              className={`inline-block px-4 py-2.5 rounded-xl text-white text-xs font-bold cursor-pointer hover:opacity-90 ${
                isMusyarokah ? "bg-amber-600" : "bg-[var(--color-primary)]"
              } ${uploadingBg ? "opacity-60 pointer-events-none" : ""}`}
            >
              {uploadingBg
                ? "Mengupload..."
                : lembagaBgUrl
                  ? "Ganti Background Lembaga"
                  : "Upload Background Lembaga"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUploadLembagaBg}
                disabled={uploadingBg}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Card 3: Pilih Cakupan Pengaturan Layout (Global Lembaga vs Per Program) */}
      <div className="no-print bg-white rounded-2xl border p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base">
              3. Cakupan Pengaturan Layout
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              Gunakan <strong>Layout Global</strong> untuk mengatur posisi sekali dan langsung menerapkannya ke semua program {lembagaLabel(lembaga)}. Atau pilih{" "}
              <strong>Layout Per Program</strong> untuk penyesuaian khusus 1 program tertentu.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setScope("global")}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold border transition ${
              scope === "global"
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
          >
            🌐 Layout Global {lembagaLabel(lembaga)} (Ubah Semua {lembagaPrograms.length} Program)
          </button>

          <button
            type="button"
            onClick={() => setScope("program")}
            disabled={lembagaPrograms.length === 0}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold border transition disabled:opacity-40 ${
              scope === "program"
                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
          >
            🎯 Layout Per Program (Override 1 Program)
          </button>
        </div>

        {scope === "program" && lembagaPrograms.length > 0 && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              Program:
            </label>
            <select
              value={activeProgram?.id || ""}
              onChange={(e) => setProgramId(e.target.value)}
              className="w-full max-w-md px-3.5 py-2 border rounded-xl text-sm font-bold bg-slate-50 focus:bg-white outline-none focus:border-indigo-500"
            >
              {lembagaPrograms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama_indo}
                  {p.nama_arab ? ` — ${p.nama_arab}` : ""}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-[var(--color-text-muted)]">
              Perubahan di sini hanya berlaku untuk program{" "}
              <strong>{activeProgram?.nama_indo}</strong>.
            </span>
          </div>
        )}
      </div>

      {/* Unified Editor Workspace */}
      <TemplateSyahadahOfflineTab
        key={`${activeKey}:${bgVersion}`}
        programKey={activeKey}
        baseProgramKey={copyBaseKey}
        programLabel={activeLabel}
        apiBase="/api/admin/syahadah-offline/template"
        canEdit
        slotCount={slotCount}
        isMusyarokah={isMusyarokah}
        isHufadz={isHufadz}
        isGlobalLembaga={scope === "global"}
        lembagaName={lembagaLabel(lembaga)}
        sharedBackgroundUrl={lembagaBgUrl}
        hideUploadCard
      />
    </div>
  );
}
