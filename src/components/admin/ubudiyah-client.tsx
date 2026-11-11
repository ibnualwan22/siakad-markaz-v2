"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { UbudiyahKegiatan, UbudiyahStatus } from "@prisma/client";
import {
  UBUDIYAH_KEGIATAN_LABEL,
  UBUDIYAH_KEGIATAN_ORDER,
  UBUDIYAH_STATUS_LABEL,
} from "@/lib/ubudiyah";

type QismRow = {
  id: string;
  santriId: string;
  nama: string;
  sakan: string;
  dufahNama: string;
  isActive: boolean;
  createdAt: string;
};

type RekapRow = {
  riwayatId: string;
  santriId: string;
  nama: string;
  sakan: string;
  kategori: string;
  kegiatan: UbudiyahKegiatan;
  status: UbudiyahStatus;
  keterangan: string | null;
  pencatatId: string | null;
  pencatatNama: string | null;
};

const TABS = [
  { id: "qism", label: "Qism" },
  { id: "rekap", label: "Rekap" },
] as const;

const BULAN_ID = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

/** Date -> "YYYY-MM-DD" lokal (tanpa geser zona waktu). */
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "2026-11-11" -> "11 Nov 2026" */
function formatTanggalId(dateStr: string): string {
  const m = String(dateStr).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(dateStr).slice(0, 10);
  const bulan = BULAN_ID[Number(m[2]) - 1] || m[2];
  return `${Number(m[3])} ${bulan} ${m[1]}`;
}

export default function UbudiyahClient({
  dufahAktif,
  santriAktif,
  canEdit,
}: {
  dufahAktif: string;
  santriAktif: { id: string; nama: string; sakan: string }[];
  canEdit: boolean;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("qism");

  // ---- Tab Qism ----
  const [sakanList, setSakanList] = useState<string[]>([]);
  const [sakan, setSakan] = useState("");
  const [qismList, setQismList] = useState<QismRow[]>([]);
  const [qismLoading, setQismLoading] = useState(false);
  const [pilihSantri, setPilihSantri] = useState<Set<string>>(new Set());
  const [tambahLoading, setTambahLoading] = useState(false);
  const [nonaktifLoading, setNonaktifLoading] = useState<string | null>(null);

  // ---- Tab Rekap ----
  const [tanggal, setTanggal] = useState(todayStr());
  const [filterSakan, setFilterSakan] = useState("");
  const [filterKegiatan, setFilterKegiatan] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [rekapRows, setRekapRows] = useState<RekapRow[]>([]);
  const [rekapTanggal, setRekapTanggal] = useState("");
  const [rekapLoading, setRekapLoading] = useState(false);

  // Daftar sakan dari /api/admin/sakan-list (sumber yang sama dengan
  // halaman admin lain — daftar sakan santri aktif).
  useEffect(() => {
    fetch("/api/admin/sakan-list")
      .then((r) => r.json())
      .then((j) => setSakanList(Array.isArray(j) ? j : []))
      .catch(() => setSakanList([]));
  }, []);

  const fetchQism = async (sakanNama: string) => {
    if (!sakanNama) {
      setQismList([]);
      return;
    }
    setQismLoading(true);
    try {
      const q = new URLSearchParams({ sakan: sakanNama });
      if (dufahAktif) q.set("dufahNama", dufahAktif);
      const res = await fetch(`/api/admin/ubudiyah/qism?${q.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat Qism");
      setQismList(json.data || []);
    } catch (e: any) {
      toast.error(e.message || "Gagal memuat Qism");
    } finally {
      setQismLoading(false);
    }
  };

  useEffect(() => {
    fetchQism(sakan);
    setPilihSantri(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sakan, dufahAktif]);

  const fetchRekap = async (
    tgl: string,
    sakanNama: string,
    kegiatan: string,
    status: string
  ) => {
    setRekapLoading(true);
    try {
      const q = new URLSearchParams({ tanggal: tgl });
      if (sakanNama) q.set("sakan", sakanNama);
      if (kegiatan) q.set("kegiatan", kegiatan);
      if (status) q.set("status", status);
      const res = await fetch(`/api/admin/ubudiyah/rekap?${q.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat rekap");
      setRekapRows(json.data || []);
      setRekapTanggal(json.tanggal || tgl);
    } catch (e: any) {
      toast.error(e.message || "Gagal memuat rekap");
    } finally {
      setRekapLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "rekap") {
      fetchRekap(tanggal, filterSakan, filterKegiatan, filterStatus);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, tanggal, filterSakan, filterKegiatan, filterStatus]);

  const santriDiSakan = sakan
    ? santriAktif.filter((s) => s.sakan === sakan)
    : [];
  const sudahQism = new Set(qismList.map((q) => q.santriId));
  const kandidatBaru = santriDiSakan.filter((s) => !sudahQism.has(s.id));

  const togglePilih = (id: string) => {
    setPilihSantri((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const tambahQism = async () => {
    const ids = [...pilihSantri];
    if (ids.length === 0) return toast.error("Pilih minimal satu santri");
    if (!sakan) return toast.error("Pilih sakan dulu");
    setTambahLoading(true);
    try {
      const res = await fetch("/api/admin/ubudiyah/qism", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          santriIds: ids,
          sakan,
          dufahNama: dufahAktif || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menambah Qism");
      toast.success(
        `${ids.length} santri ditunjuk sebagai Qism Ubudiyah di ${sakan}`
      );
      setPilihSantri(new Set());
      fetchQism(sakan);
    } catch (e: any) {
      toast.error(e.message || "Gagal menambah Qism");
    } finally {
      setTambahLoading(false);
    }
  };

  const nonaktifkan = async (row: QismRow) => {
    setNonaktifLoading(row.id);
    try {
      const res = await fetch(
        `/api/admin/ubudiyah/qism?id=${encodeURIComponent(row.id)}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menonaktifkan");
      toast.success(`${row.nama} bukan lagi Qism Ubudiyah`);
      fetchQism(sakan);
    } catch (e: any) {
      toast.error(e.message || "Gagal menonaktifkan");
    } finally {
      setNonaktifLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap border-b border-[var(--color-surface-dark)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "qism" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-bold">Sakan:</label>
            <select
              value={sakan}
              onChange={(e) => setSakan(e.target.value)}
              className="rounded-xl border px-3 py-2 text-sm bg-white"
            >
              <option value="">Pilih sakan...</option>
              {sakanList.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {sakan && (
              <span className="text-sm text-[var(--color-text-muted)]">
                {qismList.length} Qism aktif
                {dufahAktif ? ` — ${dufahAktif}` : ""}
              </span>
            )}
          </div>

          {!sakan ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              Pilih sakan untuk melihat Qism Ubudiyah dan menunjuk Qism baru.
            </p>
          ) : (
            <>
              {canEdit && (
                <div className="bg-white rounded-2xl border p-5 space-y-3">
                  <h3 className="font-bold">Tunjuk Qism Baru</h3>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Pilih santri dari sakan {sakan}. Satu sakan boleh punya
                    lebih dari satu Qism.
                  </p>
                  {kandidatBaru.length === 0 ? (
                    <p className="text-sm text-[var(--color-text-muted)]">
                      Semua santri aktif di sakan ini sudah menjadi Qism.
                    </p>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
                        {kandidatBaru.map((s) => (
                          <label
                            key={s.id}
                            className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm cursor-pointer hover:border-[var(--color-primary)]"
                          >
                            <input
                              type="checkbox"
                              checked={pilihSantri.has(s.id)}
                              onChange={() => togglePilih(s.id)}
                              className="h-4 w-4 accent-emerald-600"
                            />
                            <span className="font-semibold">{s.nama}</span>
                          </label>
                        ))}
                      </div>
                      <button
                        onClick={tambahQism}
                        disabled={tambahLoading || pilihSantri.size === 0}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {tambahLoading
                          ? "Menyimpan..."
                          : `Tunjuk sebagai Qism (${pilihSantri.size})`}
                      </button>
                    </>
                  )}
                </div>
              )}

              <div className="bg-white rounded-2xl border overflow-hidden">
                {qismLoading ? (
                  <p className="p-5 text-sm text-[var(--color-text-muted)]">
                    Memuat...
                  </p>
                ) : qismList.length === 0 ? (
                  <p className="p-5 text-sm text-[var(--color-text-muted)]">
                    Belum ada Qism Ubudiyah di sakan {sakan}
                    {dufahAktif ? ` untuk ${dufahAktif}` : ""}.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-left">
                        <tr>
                          <th className="p-3 font-bold">Nama</th>
                          <th className="p-3 font-bold">Sakan</th>
                          <th className="p-3 font-bold">Dufah</th>
                          <th className="p-3 font-bold">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {qismList.map((q) => (
                          <tr key={q.id}>
                            <td className="p-3 font-semibold">{q.nama}</td>
                            <td className="p-3">{q.sakan}</td>
                            <td className="p-3">{q.dufahNama}</td>
                            <td className="p-3">
                              {canEdit && (
                                <button
                                  onClick={() => nonaktifkan(q)}
                                  disabled={nonaktifLoading === q.id}
                                  className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50"
                                >
                                  {nonaktifLoading === q.id
                                    ? "..."
                                    : "Nonaktifkan"}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {tab === "rekap" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-bold">Tanggal:</label>
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="rounded-xl border px-3 py-2 text-sm bg-white"
            />
            <select
              value={filterSakan}
              onChange={(e) => setFilterSakan(e.target.value)}
              className="rounded-xl border px-3 py-2 text-sm bg-white"
            >
              <option value="">Semua sakan</option>
              {sakanList.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={filterKegiatan}
              onChange={(e) => setFilterKegiatan(e.target.value)}
              className="rounded-xl border px-3 py-2 text-sm bg-white"
            >
              <option value="">Semua kegiatan</option>
              {UBUDIYAH_KEGIATAN_ORDER.map((k) => (
                <option key={k} value={k}>
                  {UBUDIYAH_KEGIATAN_LABEL[k]}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-xl border px-3 py-2 text-sm bg-white"
            >
              <option value="">Semua status</option>
              {(Object.keys(UBUDIYAH_STATUS_LABEL) as UbudiyahStatus[]).map(
                (st) => (
                  <option key={st} value={st}>
                    {UBUDIYAH_STATUS_LABEL[st]}
                  </option>
                )
              )}
            </select>
            <span className="text-sm text-[var(--color-text-muted)]">
              {rekapRows.length} baris
            </span>
          </div>

          <div className="bg-white rounded-2xl border overflow-hidden">
            {rekapLoading ? (
              <p className="p-5 text-sm text-[var(--color-text-muted)]">
                Memuat...
              </p>
            ) : rekapRows.length === 0 ? (
              <p className="p-5 text-sm text-[var(--color-text-muted)]">
                Belum ada absen Ubudiyah
                {rekapTanggal ? ` pada ${formatTanggalId(rekapTanggal)}` : ""}.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left">
                    <tr>
                      <th className="p-3 font-bold">Tanggal</th>
                      <th className="p-3 font-bold">Nama</th>
                      <th className="p-3 font-bold">Sakan</th>
                      <th className="p-3 font-bold">Kegiatan</th>
                      <th className="p-3 font-bold">Status</th>
                      <th className="p-3 font-bold">Keterangan</th>
                      <th className="p-3 font-bold">Pencatat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rekapRows.map((r) => (
                      <tr key={`${r.riwayatId}-${r.kegiatan}`}>
                        <td className="p-3 whitespace-nowrap">
                          {formatTanggalId(rekapTanggal)}
                        </td>
                        <td className="p-3 font-semibold">
                          {r.nama}{" "}
                          {r.kategori === "KSU" && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                              KSU
                            </span>
                          )}
                        </td>
                        <td className="p-3">{r.sakan}</td>
                        <td className="p-3">
                          {UBUDIYAH_KEGIATAN_LABEL[r.kegiatan]}
                        </td>
                        <td className="p-3">
                          {UBUDIYAH_STATUS_LABEL[r.status]}
                        </td>
                        <td className="p-3">{r.keterangan || "-"}</td>
                        <td className="p-3">{r.pencatatNama || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
