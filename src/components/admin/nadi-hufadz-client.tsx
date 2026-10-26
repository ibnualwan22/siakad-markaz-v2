"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { PREDIKAT_TASMI, NADI_HUFADZ_MAX_PERTEMUAN, NADI_HUFADZ_MIN_HADIR } from "@/lib/nadi-hufadz";

type Peserta = {
  id: string;
  santriId: string;
  nama: string;
  kehadiran: number;
  eligibleTasmi: boolean;
  tasmi: any;
};

type Setoran = {
  id: string;
  pertemuanKe: number;
  tanggal: string;
  juz: string | null;
  surat: string | null;
  ayat: string | null;
  lulus: boolean;
  penyimak: { nama: string } | null;
  catatan: string | null;
};

const TABS = [
  { id: "peserta", label: "Peserta" },
  { id: "setoran", label: "Input Setoran" },
  { id: "tasmi", label: "Tasmi'" },
  { id: "template", label: "Template & Layout" },
  { id: "cetak", label: "Cetak" },
] as const;

const FIELD_KEYS = ["nama", "juz", "predikat", "periode"] as const;
const FIELD_SAMPLE: Record<string, string> = {
  nama: "Nama Santri",
  juz: "٢٣",
  predikat: "ممتاز",
  periode: "١١ أبريل إلى ٥ مايو ٢٠٢٦",
};

export default function NadiHufadzClient({
  dufahAktif,
  santriAktif,
  canEdit,
}: {
  dufahAktif: string;
  santriAktif: { id: string; nama: string }[];
  canEdit: boolean;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("peserta");
  const [pesertaList, setPesertaList] = useState<Peserta[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendaftaranDibuka, setPendaftaranDibuka] = useState<boolean | null>(null);
  const [toggleLoading, setToggleLoading] = useState(false);

  const fetchPeserta = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/nadi-hufadz/peserta?dufahNama=${encodeURIComponent(dufahAktif)}`);
      const json = await res.json();
      setPesertaList(json.data || []);
    } catch {
      toast.error("Gagal memuat peserta");
    } finally {
      setLoading(false);
    }
  };

  const fetchPendaftaran = async () => {
    try {
      const res = await fetch(`/api/admin/nadi-hufadz/periode?dufahNama=${encodeURIComponent(dufahAktif)}`);
      const json = await res.json();
      setPendaftaranDibuka(!!json.dibuka);
    } catch {
      setPendaftaranDibuka(false);
    }
  };

  const togglePendaftaran = async () => {
    if (pendaftaranDibuka === null) return;
    setToggleLoading(true);
    try {
      const res = await fetch("/api/admin/nadi-hufadz/periode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dufahNama: dufahAktif, dibuka: !pendaftaranDibuka }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mengubah status");
      setPendaftaranDibuka(!!json.dibuka);
      toast.success(json.dibuka ? "Pendaftaran dibuka" : "Pendaftaran ditutup");
    } catch (e: any) {
      toast.error(e.message || "Gagal mengubah status");
    } finally {
      setToggleLoading(false);
    }
  };

  useEffect(() => {
    fetchPeserta();
    fetchPendaftaran();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dufahAktif]);

  return (
    <div className="space-y-6">
      {dufahAktif !== "" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-surface-dark)] bg-white px-4 py-3">
          <p className="text-sm">
            Pendaftaran {dufahAktif}:{" "}
            <span className={`font-bold ${pendaftaranDibuka ? "text-emerald-700" : "text-red-600"}`}>
              {pendaftaranDibuka === null ? "Memuat..." : pendaftaranDibuka ? "DIBUKA" : "DITUTUP"}
            </span>
            <span className="text-[var(--color-text-muted)]">
              {" "}— menutup hanya menghalangi pendaftar baru, peserta yang sudah terdaftar tetap berjalan.
            </span>
          </p>
          {canEdit && (
            <button
              onClick={togglePendaftaran}
              disabled={toggleLoading || pendaftaranDibuka === null}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
            >
              {toggleLoading ? "Menyimpan..." : pendaftaranDibuka ? "Tutup Pendaftaran" : "Buka Pendaftaran"}
            </button>
          )}
        </div>
      )}
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

      {tab === "peserta" && (
        <PesertaTab
          pesertaList={pesertaList}
          santriAktif={santriAktif}
          canEdit={canEdit}
          dufahAktif={dufahAktif}
          onRefresh={fetchPeserta}
        />
      )}
      {tab === "setoran" && (
        <SetoranTab pesertaList={pesertaList} canEdit={canEdit} />
      )}
      {tab === "tasmi" && (
        <TasmiTab pesertaList={pesertaList} canEdit={canEdit} onRefresh={fetchPeserta} />
      )}
      {tab === "template" && <TemplateTab canEdit={canEdit} />}
      {tab === "cetak" && <CetakTab pesertaList={pesertaList} loading={loading} />}
    </div>
  );
}

/* ================= TAB PESERTA ================= */
function PesertaTab({
  pesertaList,
  santriAktif,
  canEdit,
  dufahAktif,
  onRefresh,
}: {
  pesertaList: Peserta[];
  santriAktif: { id: string; nama: string }[];
  canEdit: boolean;
  dufahAktif: string;
  onRefresh: () => void;
}) {
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);

  const terdaftar = new Set(pesertaList.map((p) => p.santriId));
  const kandidat = santriAktif
    .filter((s) => !terdaftar.has(s.id))
    .filter((s) => s.nama.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 20);

  const tambah = async (santriId: string) => {
    setAdding(true);
    try {
      const res = await fetch("/api/admin/nadi-hufadz/peserta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ santriId, dufahNama: dufahAktif }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Gagal");
      toast.success("Peserta ditambahkan");
      setSearch("");
      onRefresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAdding(false);
    }
  };

  const hapus = async (id: string, nama: string) => {
    if (!confirm(`Hapus ${nama} dari peserta? Seluruh setoran & tasmi' ikut terhapus.`)) return;
    try {
      const res = await fetch(`/api/admin/nadi-hufadz/peserta?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus");
      toast.success("Peserta dihapus");
      onRefresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      {canEdit && (
        <div className="bg-white rounded-2xl border p-5 space-y-3">
          <h3 className="font-bold">Tambah Peserta</h3>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama santri aktif..."
            className="w-full px-4 py-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
          />
          {search && (
            <div className="max-h-56 overflow-y-auto border rounded-xl divide-y">
              {kandidat.length === 0 && (
                <p className="p-3 text-sm text-[var(--color-text-muted)]">Tidak ditemukan</p>
              )}
              {kandidat.map((s) => (
                <button
                  key={s.id}
                  disabled={adding}
                  onClick={() => tambah(s.id)}
                  className="w-full text-left p-3 hover:bg-slate-50 text-sm font-medium"
                >
                  {s.nama}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="p-3 font-bold">Nama</th>
                <th className="p-3 font-bold">Kehadiran</th>
                <th className="p-3 font-bold">Status Tasmi&apos;</th>
                <th className="p-3 font-bold">Syahadah</th>
                {canEdit && <th className="p-3 font-bold">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {pesertaList.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/50">
                  <td className="p-3 font-semibold">{p.nama}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${p.kehadiran >= NADI_HUFADZ_MIN_HADIR ? "bg-emerald-500" : "bg-amber-500"}`}
                          style={{ width: `${(p.kehadiran / NADI_HUFADZ_MAX_PERTEMUAN) * 100}%` }}
                        />
                      </div>
                      <span className="font-bold">{p.kehadiran}/{NADI_HUFADZ_MAX_PERTEMUAN}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    {p.tasmi ? (
                      <span className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded text-xs font-bold">Sudah tasmi&apos;</span>
                    ) : p.eligibleTasmi ? (
                      <span className="text-blue-700 bg-blue-50 px-2 py-1 rounded text-xs font-bold">Layak tasmi&apos;</span>
                    ) : (
                      <span className="text-slate-500 bg-slate-100 px-2 py-1 rounded text-xs font-bold">Belum layak</span>
                    )}
                  </td>
                  <td className="p-3">
                    {p.tasmi ? (
                      <a
                        href={`/cetak-template/nadi-hufadz/${p.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-700 font-bold hover:underline text-xs"
                      >
                        Cetak
                      </a>
                    ) : (
                      <span className="text-slate-400 text-xs">-</span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="p-3">
                      <button
                        onClick={() => hapus(p.id, p.nama)}
                        className="text-rose-600 hover:underline text-xs font-bold"
                      >
                        Hapus
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {pesertaList.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-[var(--color-text-muted)]">
                    Belum ada peserta di dufah ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ================= TAB SETORAN ================= */
function SetoranTab({ pesertaList, canEdit }: { pesertaList: Peserta[]; canEdit: boolean }) {
  const [pesertaId, setPesertaId] = useState("");
  const [setoran, setSetoran] = useState<Setoran[]>([]);
  const [formKe, setFormKe] = useState<number | null>(null);
  const [form, setForm] = useState({ tanggal: "", juz: "", surat: "", ayat: "", lulus: true, catatan: "" });
  const [saving, setSaving] = useState(false);

  const fetchSetoran = async (pid: string) => {
    const res = await fetch(`/api/admin/nadi-hufadz/setoran?pesertaId=${pid}`);
    setSetoran(await res.json());
  };

  useEffect(() => {
    if (pesertaId) fetchSetoran(pesertaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pesertaId]);

  const byKe = new Map(setoran.map((s) => [s.pertemuanKe, s]));

  const bukaForm = (ke: number) => {
    const ada = byKe.get(ke);
    setFormKe(ke);
    setForm({
      tanggal: ada ? ada.tanggal.slice(0, 10) : new Date().toISOString().slice(0, 10),
      juz: ada?.juz || "",
      surat: ada?.surat || "",
      ayat: ada?.ayat || "",
      lulus: ada ? ada.lulus : true,
      catatan: ada?.catatan || "",
    });
  };

  const simpan = async () => {
    if (!form.tanggal) return toast.error("Tanggal wajib diisi");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/nadi-hufadz/setoran", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pesertaId, pertemuanKe: formKe, ...form }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Gagal");
      toast.success(`Setoran pertemuan ${formKe} tersimpan`);
      setFormKe(null);
      fetchSetoran(pesertaId);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const hapus = async (id: string, ke: number) => {
    if (!confirm(`Hapus setoran pertemuan ${ke}?`)) return;
    await fetch(`/api/admin/nadi-hufadz/setoran?id=${id}`, { method: "DELETE" });
    toast.success("Dihapus");
    fetchSetoran(pesertaId);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border p-5">
        <label className="text-sm font-bold block mb-2">Pilih Peserta</label>
        <select
          value={pesertaId}
          onChange={(e) => { setPesertaId(e.target.value); setFormKe(null); }}
          className="w-full px-4 py-2.5 border rounded-xl outline-none"
        >
          <option value="">-- Pilih --</option>
          {pesertaList.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nama} ({p.kehadiran}/{NADI_HUFADZ_MAX_PERTEMUAN})
            </option>
          ))}
        </select>
      </div>

      {pesertaId && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {Array.from({ length: NADI_HUFADZ_MAX_PERTEMUAN }, (_, i) => i + 1).map((ke) => {
              const ada = byKe.get(ke);
              return (
                <button
                  key={ke}
                  onClick={() => canEdit && bukaForm(ke)}
                  disabled={!canEdit}
                  className={`p-4 rounded-2xl border text-left transition-colors ${
                    ada
                      ? ada.lulus
                        ? "bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
                        : "bg-amber-50 border-amber-200 hover:bg-amber-100"
                      : "bg-white hover:bg-slate-50 border-dashed"
                  } ${formKe === ke ? "ring-2 ring-[var(--color-primary)]" : ""}`}
                >
                  <p className="font-black text-lg">#{ke}</p>
                  {ada ? (
                    <>
                      <p className="text-xs text-[var(--color-text-muted)]">{ada.tanggal.slice(0, 10)}</p>
                      <p className="text-xs font-bold mt-1">{ada.lulus ? "Lulus" : "Tidak lulus"}</p>
                      <p className="text-xs text-[var(--color-text-muted)] truncate">{ada.penyimak?.nama || ""}</p>
                    </>
                  ) : (
                    <p className="text-xs text-[var(--color-text-muted)]">Belum diinput</p>
                  )}
                </button>
              );
            })}
          </div>

          {formKe !== null && canEdit && (
            <div className="bg-white rounded-2xl border p-5 space-y-4">
              <h3 className="font-bold">Setoran Pertemuan #{formKe}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-bold block mb-1">Tanggal *</label>
                  <input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                    className="w-full px-4 py-2.5 border rounded-xl outline-none" />
                </div>
                <div>
                  <label className="text-sm font-bold block mb-1">Juz</label>
                  <input value={form.juz} onChange={(e) => setForm({ ...form, juz: e.target.value })}
                    placeholder="cth: 23" className="w-full px-4 py-2.5 border rounded-xl outline-none" />
                </div>
                <div>
                  <label className="text-sm font-bold block mb-1">Surat</label>
                  <input value={form.surat} onChange={(e) => setForm({ ...form, surat: e.target.value })}
                    placeholder="cth: Al-Mulk" className="w-full px-4 py-2.5 border rounded-xl outline-none" />
                </div>
                <div>
                  <label className="text-sm font-bold block mb-1">Ayat</label>
                  <input value={form.ayat} onChange={(e) => setForm({ ...form, ayat: e.target.value })}
                    placeholder="cth: 1-12" className="w-full px-4 py-2.5 border rounded-xl outline-none" />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="lulus" checked={form.lulus}
                    onChange={(e) => setForm({ ...form, lulus: e.target.checked })}
                    className="w-5 h-5" />
                  <label htmlFor="lulus" className="text-sm font-bold">Lulus</label>
                </div>
                <div>
                  <label className="text-sm font-bold block mb-1">Catatan</label>
                  <input value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })}
                    className="w-full px-4 py-2.5 border rounded-xl outline-none" />
                </div>
              </div>
              <p className="text-xs text-[var(--color-text-muted)]">
                Nama penyimak otomatis terisi dari admin yang login saat menyimpan.
              </p>
              <div className="flex gap-2">
                <button onClick={simpan} disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white font-bold hover:opacity-90 disabled:opacity-50">
                  {saving ? "Menyimpan..." : "Simpan"}
                </button>
                <button onClick={() => setFormKe(null)} className="px-5 py-2.5 rounded-xl border font-bold">
                  Batal
                </button>
                {byKe.get(formKe) && (
                  <button onClick={() => hapus(byKe.get(formKe)!.id, formKe)}
                    className="px-5 py-2.5 rounded-xl text-rose-600 font-bold hover:bg-rose-50">
                    Hapus
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ================= TAB TASMI' ================= */
function TasmiTab({
  pesertaList,
  canEdit,
  onRefresh,
}: {
  pesertaList: Peserta[];
  canEdit: boolean;
  onRefresh: () => void;
}) {
  const eligible = pesertaList.filter((p) => p.eligibleTasmi && !p.tasmi);
  const sudah = pesertaList.filter((p) => p.tasmi);
  const [formId, setFormId] = useState<string | null>(null);
  const [form, setForm] = useState({ juzTeks: "", predikat: PREDIKAT_TASMI[0] as string, tanggal: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);

  const simpan = async () => {
    if (!form.juzTeks) return toast.error("Juz wajib diisi");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/nadi-hufadz/tasmi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pesertaId: formId, ...form }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Gagal");
      toast.success("Tasmi' tersimpan");
      setFormId(null);
      onRefresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const hapus = async (id: string, nama: string) => {
    if (!confirm(`Hapus data tasmi' ${nama}?`)) return;
    await fetch(`/api/admin/nadi-hufadz/tasmi?id=${id}`, { method: "DELETE" });
    toast.success("Dihapus");
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border p-5">
        <h3 className="font-bold mb-3">Layak Tasmi&apos; (belum diinput) — {eligible.length}</h3>
        {eligible.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">Belum ada yang layak atau semua sudah diinput.</p>
        ) : (
          <div className="space-y-3">
            {eligible.map((p) => (
              <div key={p.id} className="border rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold">{p.nama}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">Kehadiran {p.kehadiran}/{NADI_HUFADZ_MAX_PERTEMUAN}</p>
                  </div>
                  {canEdit && (
                    <button onClick={() => { setFormId(p.id); setForm({ juzTeks: "", predikat: PREDIKAT_TASMI[0], tanggal: new Date().toISOString().slice(0, 10) }); }}
                      className="px-4 py-2 rounded-xl bg-[var(--color-primary)] text-white text-sm font-bold">
                      Input Tasmi&apos;
                    </button>
                  )}
                </div>
                {formId === p.id && canEdit && (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t pt-4">
                    <div>
                      <label className="text-sm font-bold block mb-1">Juz (teks bebas) *</label>
                      <input value={form.juzTeks} onChange={(e) => setForm({ ...form, juzTeks: e.target.value })}
                        placeholder="cth: 1, 2, 3 atau 5" className="w-full px-4 py-2.5 border rounded-xl outline-none" />
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">Otomatis dirapikan: berurutan → ١-٣, loncat → ١، ٥، ٧</p>
                    </div>
                    <div>
                      <label className="text-sm font-bold block mb-1">Predikat *</label>
                      <select value={form.predikat} onChange={(e) => setForm({ ...form, predikat: e.target.value })}
                        className="w-full px-4 py-2.5 border rounded-xl outline-none">
                        {PREDIKAT_TASMI.map((pr) => (
                          <option key={pr} value={pr}>{pr}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-bold block mb-1">Tanggal *</label>
                      <input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                        className="w-full px-4 py-2.5 border rounded-xl outline-none" />
                    </div>
                    <div className="sm:col-span-3 flex gap-2">
                      <button onClick={simpan} disabled={saving}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold disabled:opacity-50">
                        {saving ? "Menyimpan..." : "Simpan"}
                      </button>
                      <button onClick={() => setFormId(null)} className="px-5 py-2.5 rounded-xl border font-bold">Batal</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border p-5">
        <h3 className="font-bold mb-3">Sudah Tasmi&apos; — {sudah.length}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="p-3 font-bold">Nama</th>
                <th className="p-3 font-bold">Juz</th>
                <th className="p-3 font-bold">Predikat</th>
                <th className="p-3 font-bold">Tanggal</th>
                {canEdit && <th className="p-3 font-bold">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {sudah.map((p) => (
                <tr key={p.id}>
                  <td className="p-3 font-semibold">{p.nama}</td>
                  <td className="p-3" dir="rtl">{p.tasmi.juzTeks}</td>
                  <td className="p-3" dir="rtl">{p.tasmi.predikat}</td>
                  <td className="p-3">{String(p.tasmi.tanggal).slice(0, 10)}</td>
                  {canEdit && (
                    <td className="p-3 flex gap-3">
                      <button
                        onClick={() => { setFormId(p.id); setForm({ juzTeks: p.tasmi.juzTeks, predikat: p.tasmi.predikat, tanggal: String(p.tasmi.tanggal).slice(0, 10) }); }}
                        className="text-blue-600 font-bold hover:underline text-xs"
                      >
                        Edit
                      </button>
                      <button onClick={() => hapus(p.tasmi.id, p.nama)} className="text-rose-600 font-bold hover:underline text-xs">
                        Hapus
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {sudah.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-[var(--color-text-muted)]">Belum ada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {formId && sudah.some((p) => p.id === formId) && canEdit && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t pt-4">
            <div>
              <label className="text-sm font-bold block mb-1">Juz *</label>
              <input value={form.juzTeks} onChange={(e) => setForm({ ...form, juzTeks: e.target.value })}
                className="w-full px-4 py-2.5 border rounded-xl outline-none" />
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">Predikat *</label>
              <select value={form.predikat} onChange={(e) => setForm({ ...form, predikat: e.target.value })}
                className="w-full px-4 py-2.5 border rounded-xl outline-none">
                {PREDIKAT_TASMI.map((pr) => (<option key={pr} value={pr}>{pr}</option>))}
              </select>
            </div>
            <div>
              <label className="text-sm font-bold block mb-1">Tanggal *</label>
              <input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                className="w-full px-4 py-2.5 border rounded-xl outline-none" />
            </div>
            <div className="sm:col-span-3 flex gap-2">
              <button onClick={simpan} disabled={saving} className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold disabled:opacity-50">
                {saving ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
              <button onClick={() => setFormId(null)} className="px-5 py-2.5 rounded-xl border font-bold">Batal</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================= TAB TEMPLATE ================= */
function TemplateTab({ canEdit }: { canEdit: boolean }) {
  const [bg, setBg] = useState<string | null>(null);
  const [positions, setPositions] = useState<Record<string, any>>({});
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<any>(null);

  const load = async () => {
    const res = await fetch("/api/admin/nadi-hufadz/template?programKey=nadi-hufadz");
    const tpl = await res.json();
    setBg(tpl.backgroundUrl);
    setPositions(tpl.fieldPositions || {});
  };
  useEffect(() => { load(); }, []);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("programKey", "nadi-hufadz");
      const res = await fetch("/api/admin/nadi-hufadz/template/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.json()).error || "Gagal upload");
      const { url, publicId } = await res.json();
      const put = await fetch("/api/admin/nadi-hufadz/template", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programKey: "nadi-hufadz", backgroundUrl: url, backgroundId: publicId }),
      });
      if (!put.ok) throw new Error("Gagal menyimpan template");
      setBg(url);
      toast.success("Background terupload");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const savePositions = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/nadi-hufadz/template", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programKey: "nadi-hufadz", fieldPositions: positions }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan");
      toast.success("Layout tersimpan");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const onChipDown = (e: React.PointerEvent, key: string) => {
    if (!canEdit || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    dragRef.current = {
      key, startX: e.clientX, startY: e.clientY,
      origX: positions[key]?.x ?? 50, origY: positions[key]?.y ?? 50,
      w: rect.width, h: rect.height,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const nx = Math.min(100, Math.max(0, d.origX + ((e.clientX - d.startX) / d.w) * 100));
    const ny = Math.min(100, Math.max(0, d.origY + ((e.clientY - d.startY) / d.h) * 100));
    setPositions((p: any) => ({ ...p, [d.key]: { ...p[d.key], x: Math.round(nx * 10) / 10, y: Math.round(ny * 10) / 10 } }));
  };
  const onUp = () => { dragRef.current = null; };

  const setField = (key: string, patch: any) =>
    setPositions((p: any) => ({ ...p, [key]: { ...p[key], ...patch } }));

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border p-5 space-y-3">
        <h3 className="font-bold">Background Desain</h3>
        {canEdit && (
          <label className="inline-block px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white font-bold cursor-pointer hover:opacity-90">
            {uploading ? "Mengupload..." : "Upload Desain Baru"}
            <input type="file" accept="image/*" className="hidden" onChange={upload} disabled={uploading} />
          </label>
        )}
        <p className="text-xs text-[var(--color-text-muted)]">Format gambar (JPG/PNG), maksimal 10MB. Tersimpan di Cloudinary.</p>
      </div>

      <div className="bg-white rounded-2xl border p-5 space-y-4">
        <h3 className="font-bold">Atur Posisi Field {canEdit && <span className="font-normal text-sm text-[var(--color-text-muted)]">(geser label di atas desain)</span>}</h3>
        {!bg ? (
          <p className="text-sm text-[var(--color-text-muted)]">Upload background terlebih dahulu.</p>
        ) : (
          <>
            <div
              ref={wrapRef}
              className="relative w-full max-w-3xl mx-auto border rounded-xl overflow-hidden select-none touch-none"
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={bg} alt="Template" className="w-full block" draggable={false} />
              {FIELD_KEYS.map((key) => {
                const cfg = positions[key] || { x: 50, y: 50 };
                return (
                  <div
                    key={key}
                    onPointerDown={(e) => onChipDown(e, key)}
                    className={`absolute px-2 py-1 rounded text-xs font-bold border-2 whitespace-nowrap ${
                      canEdit ? "cursor-move bg-yellow-300/90 border-yellow-600" : "bg-white/80 border-slate-400"
                    }`}
                    style={{ left: `${cfg.x}%`, top: `${cfg.y}%`, transform: "translate(-50%, -50%)" }}
                  >
                    {FIELD_SAMPLE[key]}
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {FIELD_KEYS.map((key) => {
                const cfg = positions[key] || {};
                return (
                  <div key={key} className="border rounded-xl p-3 space-y-2">
                    <p className="font-bold text-sm capitalize">{key}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <label>X (%)
                        <input type="number" step="0.5" value={cfg.x ?? 50}
                          onChange={(e) => setField(key, { x: Number(e.target.value) })}
                          disabled={!canEdit} className="w-full px-2 py-1 border rounded" />
                      </label>
                      <label>Y (%)
                        <input type="number" step="0.5" value={cfg.y ?? 50}
                          onChange={(e) => setField(key, { y: Number(e.target.value) })}
                          disabled={!canEdit} className="w-full px-2 py-1 border rounded" />
                      </label>
                      <label>Font (px)
                        <input type="number" value={cfg.fontSize ?? 28}
                          onChange={(e) => setField(key, { fontSize: Number(e.target.value) })}
                          disabled={!canEdit} className="w-full px-2 py-1 border rounded" />
                      </label>
                      <label>Lebar maks (%)
                        <input type="number" value={cfg.maxWidth ?? 80}
                          onChange={(e) => setField(key, { maxWidth: Number(e.target.value) })}
                          disabled={!canEdit} className="w-full px-2 py-1 border rounded" />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>

            {canEdit && (
              <button onClick={savePositions} disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold disabled:opacity-50">
                {saving ? "Menyimpan..." : "Simpan Layout"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ================= TAB CETAK ================= */
function CetakTab({ pesertaList, loading }: { pesertaList: Peserta[]; loading: boolean }) {
  const siap = pesertaList.filter((p) => p.tasmi);
  return (
    <div className="bg-white rounded-2xl border p-5">
      <h3 className="font-bold mb-3">Siap Cetak — {siap.length} santri</h3>
      {loading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Memuat...</p>
      ) : siap.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">Belum ada yang bisa dicetak (butuh data tasmi&apos;).</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="p-3 font-bold">Nama</th>
                <th className="p-3 font-bold">Juz</th>
                <th className="p-3 font-bold">Predikat</th>
                <th className="p-3 font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {siap.map((p) => (
                <tr key={p.id}>
                  <td className="p-3 font-semibold">{p.nama}</td>
                  <td className="p-3" dir="rtl">{p.tasmi.juzTeks}</td>
                  <td className="p-3" dir="rtl">{p.tasmi.predikat}</td>
                  <td className="p-3">
                    <a
                      href={`/cetak-template/nadi-hufadz/${p.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-xl bg-[var(--color-primary)] text-white text-xs font-bold"
                    >
                      Cetak
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
