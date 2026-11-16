"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  TADRIB_FUNUN_MAX_PERTEMUAN,
  TADRIB_FUNUN_MIN_HADIR,
  templateProgramKey,
} from "@/lib/tadrib-funun";
import TemplateSyahadahTab from "@/components/admin/template-syahadah-tab";

type Jenis = {
  id: string;
  nama: string;
  deskripsi: string | null;
  isActive: boolean;
  minHadir: number;
  jumlahPeserta: number;
};

type Peserta = {
  id: string;
  santriId: string;
  nama: string;
  jenis: { id: string; nama: string };
  tanggalDaftar: string;
  kehadiran: number;
  minHadir: number;
  eligible: boolean;
  diterbitkan: boolean;
  diterbitkanAt: string | null;
  diterbitkanOleh: string | null;
};

type Hadir = {
  id: string;
  pertemuanKe: number;
  tanggal: string;
  pencatat: { nama: string } | null;
};

const TABS = [
  { id: "jenis", label: "Jenis" },
  { id: "peserta", label: "Peserta" },
  { id: "hadir", label: "Input Absen" },
  { id: "template", label: "Template & Layout" },
  { id: "cetak", label: "Cetak" },
] as const;

export default function TadribFununClient({
  dufahAktif,
  santriAktif,
  canEdit,
}: {
  dufahAktif: string;
  santriAktif: { id: string; nama: string }[];
  canEdit: boolean;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("jenis");
  const [jenisList, setJenisList] = useState<Jenis[]>([]);
  const [pesertaList, setPesertaList] = useState<Peserta[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendaftaranDibuka, setPendaftaranDibuka] = useState<boolean | null>(null);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [filterJenis, setFilterJenis] = useState("");

  const fetchJenis = async () => {
    try {
      const res = await fetch("/api/admin/tadrib-funun/jenis");
      const json = await res.json();
      setJenisList(Array.isArray(json) ? json : []);
    } catch {
      toast.error("Gagal memuat jenis");
    }
  };

  const fetchPeserta = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ dufahNama: dufahAktif });
      if (filterJenis) q.set("jenisId", filterJenis);
      const res = await fetch(`/api/admin/tadrib-funun/peserta?${q.toString()}`);
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
      const res = await fetch(`/api/admin/tadrib-funun/periode?dufahNama=${encodeURIComponent(dufahAktif)}`);
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
      const res = await fetch("/api/admin/tadrib-funun/periode", {
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
    fetchJenis();
    fetchPendaftaran();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dufahAktif]);

  useEffect(() => {
    fetchPeserta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dufahAktif, filterJenis]);

  return (
    <div className="space-y-6">
      {dufahAktif !== "" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-surface-dark)] bg-white px-4 py-3">
          <p className="text-sm">
            Pendaftaran {dufahAktif} (semua jenis):{" "}
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

      {/* Ringkasan dufah aktif — mengikuti filter jenis bila sedang dipakai */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Jenis aktif", nilai: jenisList.filter((j) => j.isActive).length },
          { label: `Peserta — ${dufahAktif || "-"}`, nilai: pesertaList.length },
          { label: "Layak syahadah", nilai: pesertaList.filter((p) => p.eligible && !p.diterbitkan).length },
          { label: "Syahadah terbit", nilai: pesertaList.filter((p) => p.diterbitkan).length },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border px-4 py-3">
            <p className="text-2xl font-black">{c.nilai}</p>
            <p className="text-xs text-[var(--color-text-muted)] font-bold">{c.label}</p>
          </div>
        ))}
      </div>

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

      {tab === "jenis" && (
        <JenisTab jenisList={jenisList} canEdit={canEdit} onRefresh={fetchJenis} />
      )}
      {tab === "peserta" && (
        <PesertaTab
          pesertaList={pesertaList}
          jenisList={jenisList}
          santriAktif={santriAktif}
          canEdit={canEdit}
          dufahAktif={dufahAktif}
          filterJenis={filterJenis}
          setFilterJenis={setFilterJenis}
          onRefresh={fetchPeserta}
        />
      )}
      {tab === "hadir" && (
        <HadirTab
          dufahAktif={dufahAktif}
          jenisList={jenisList}
          canEdit={canEdit}
          onRefresh={fetchPeserta}
        />
      )}
      {tab === "template" && <TemplateTab jenisList={jenisList} canEdit={canEdit} />}
      {tab === "cetak" && <CetakTab pesertaList={pesertaList} loading={loading} />}
    </div>
  );
}

/* ================= TAB JENIS ================= */
function JenisTab({
  jenisList,
  canEdit,
  onRefresh,
}: {
  jenisList: Jenis[];
  canEdit: boolean;
  onRefresh: () => void;
}) {
  const [nama, setNama] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [minHadir, setMinHadir] = useState(String(TADRIB_FUNUN_MIN_HADIR));
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editNama, setEditNama] = useState("");
  const [editDeskripsi, setEditDeskripsi] = useState("");
  const [editMinHadir, setEditMinHadir] = useState(String(TADRIB_FUNUN_MIN_HADIR));
  const [editSaving, setEditSaving] = useState(false);

  const tambah = async () => {
    const nilai = Number(minHadir);
    if (!nama.trim()) return toast.error("Nama jenis wajib diisi");
    if (!Number.isInteger(nilai) || nilai < 1 || nilai > TADRIB_FUNUN_MAX_PERTEMUAN) {
      return toast.error(`Minimal kehadiran harus bilangan bulat 1-${TADRIB_FUNUN_MAX_PERTEMUAN}`);
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/tadrib-funun/jenis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama: nama.trim(), deskripsi: deskripsi.trim() || undefined, minHadir: nilai }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menambah jenis");
      toast.success(`Jenis "${json.nama}" ditambahkan`);
      setNama("");
      setDeskripsi("");
      setMinHadir(String(TADRIB_FUNUN_MIN_HADIR));
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || "Gagal menambah jenis");
    } finally {
      setSaving(false);
    }
  };

  const mulaiEdit = (j: Jenis) => {
    setEditId(j.id);
    setEditNama(j.nama);
    setEditDeskripsi(j.deskripsi || "");
    setEditMinHadir(String(j.minHadir));
  };

  const simpanEdit = async () => {
    if (!editId) return;
    const nilai = Number(editMinHadir);
    if (!editNama.trim()) return toast.error("Nama jenis wajib diisi");
    if (!Number.isInteger(nilai) || nilai < 1 || nilai > TADRIB_FUNUN_MAX_PERTEMUAN) {
      return toast.error(`Minimal kehadiran harus bilangan bulat 1-${TADRIB_FUNUN_MAX_PERTEMUAN}`);
    }
    setEditSaving(true);
    try {
      const res = await fetch("/api/admin/tadrib-funun/jenis", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editId, nama: editNama.trim(), deskripsi: editDeskripsi.trim(), minHadir: nilai }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan jenis");
      toast.success("Jenis disimpan");
      setEditId(null);
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || "Gagal menyimpan jenis");
    } finally {
      setEditSaving(false);
    }
  };

  const toggleAktif = async (j: Jenis) => {
    try {
      const res = await fetch("/api/admin/tadrib-funun/jenis", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: j.id, isActive: !j.isActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mengubah status");
      toast.success(j.isActive ? `Jenis "${j.nama}" dinonaktifkan` : `Jenis "${j.nama}" diaktifkan`);
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || "Gagal mengubah status");
    }
  };

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="bg-white rounded-2xl border p-5 space-y-3">
          <h3 className="font-bold">Tambah Jenis Baru</h3>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_140px_auto] gap-3">
            <input
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Nama jenis (mis. Kaligrafi)"
              className="rounded-xl border px-3 py-2 text-sm"
            />
            <input
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              placeholder="Deskripsi (opsional)"
              className="rounded-xl border px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2 text-sm">
              Min. hadir
              <input
                type="number"
                min={1}
                max={TADRIB_FUNUN_MAX_PERTEMUAN}
                value={minHadir}
                onChange={(e) => setMinHadir(e.target.value)}
                aria-label="Minimal kehadiran"
                className="w-16 rounded-lg border px-2 py-2 text-sm font-bold"
              />
              <span className="text-xs text-[var(--color-text-muted)]">dari {TADRIB_FUNUN_MAX_PERTEMUAN}</span>
            </label>
            <button
              onClick={tambah}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? "Menyimpan..." : "Tambah Jenis"}
            </button>
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">
            Setiap jenis punya syahadah sendiri (template diatur di tab Template &amp; Layout).
            Menonaktifkan jenis menghalangi pendaftar baru; peserta yang sudah terdaftar tidak terpengaruh.
          </p>
        </div>
      )}

      <div className="bg-white rounded-2xl border overflow-hidden">
        {jenisList.length === 0 ? (
          <p className="p-5 text-sm text-[var(--color-text-muted)]">Belum ada jenis. Tambahkan jenis pertama di atas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="p-3 font-bold">Nama</th>
                  <th className="p-3 font-bold">Deskripsi</th>
                  <th className="p-3 font-bold">Min. Hadir</th>
                  <th className="p-3 font-bold">Peserta</th>
                  <th className="p-3 font-bold">Status</th>
                  {canEdit && <th className="p-3 font-bold">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {jenisList.map((j) => (
                  <tr key={j.id}>
                    <td className="p-3 font-semibold">{j.nama}</td>
                    <td className="p-3 text-[var(--color-text-muted)]">{j.deskripsi || "—"}</td>
                    <td className="p-3 font-bold">{j.minHadir}x</td>
                    <td className="p-3">{j.jumlahPeserta}</td>
                    <td className="p-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${j.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {j.isActive ? "AKTIF" : "NONAKTIF"}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => (editId === j.id ? setEditId(null) : mulaiEdit(j))}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-bold"
                          >
                            {editId === j.id ? "Batal" : "Ubah"}
                          </button>
                          <button
                            onClick={() => toggleAktif(j)}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-bold"
                          >
                            {j.isActive ? "Nonaktifkan" : "Aktifkan"}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {canEdit && editId && (
        <div className="bg-white rounded-2xl border p-5 space-y-3">
          <h3 className="font-bold">Ubah Jenis</h3>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_140px_auto] gap-3">
            <input
              value={editNama}
              onChange={(e) => setEditNama(e.target.value)}
              placeholder="Nama jenis"
              className="rounded-xl border px-3 py-2 text-sm"
            />
            <input
              value={editDeskripsi}
              onChange={(e) => setEditDeskripsi(e.target.value)}
              placeholder="Deskripsi (opsional)"
              className="rounded-xl border px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2 text-sm">
              Min. hadir
              <input
                type="number"
                min={1}
                max={TADRIB_FUNUN_MAX_PERTEMUAN}
                value={editMinHadir}
                onChange={(e) => setEditMinHadir(e.target.value)}
                aria-label="Minimal kehadiran"
                className="w-16 rounded-lg border px-2 py-2 text-sm font-bold"
              />
            </label>
            <button
              onClick={simpanEdit}
              disabled={editSaving}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
            >
              {editSaving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= TAB PESERTA ================= */
function PesertaTab({
  pesertaList,
  jenisList,
  santriAktif,
  canEdit,
  dufahAktif,
  filterJenis,
  setFilterJenis,
  onRefresh,
}: {
  pesertaList: Peserta[];
  jenisList: Jenis[];
  santriAktif: { id: string; nama: string }[];
  canEdit: boolean;
  dufahAktif: string;
  filterJenis: string;
  setFilterJenis: (v: string) => void;
  onRefresh: () => void;
}) {
  const [tambahSantriId, setTambahSantriId] = useState("");
  const [tambahJenisId, setTambahJenisId] = useState("");
  const [tambahLoading, setTambahLoading] = useState(false);
  const [terbitLoading, setTerbitLoading] = useState<string | null>(null);
  // Riwayat hadir pindah ke tab ini (dulu di tab Input Absen).
  const [riwayatPeserta, setRiwayatPeserta] = useState<Peserta | null>(null);
  const [riwayatList, setRiwayatList] = useState<Hadir[]>([]);
  const [riwayatLoading, setRiwayatLoading] = useState(false);
  const [hapusRiwayatId, setHapusRiwayatId] = useState<string | null>(null);

  const tambahPeserta = async () => {
    if (!tambahSantriId || !tambahJenisId) return toast.error("Pilih santri dan jenis");
    setTambahLoading(true);
    try {
      const res = await fetch("/api/admin/tadrib-funun/peserta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ santriId: tambahSantriId, jenisId: tambahJenisId, dufahNama: dufahAktif }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menambah peserta");
      toast.success("Peserta ditambahkan");
      setTambahSantriId("");
      setTambahJenisId("");
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || "Gagal menambah peserta");
    } finally {
      setTambahLoading(false);
    }
  };

  const terbitkan = async (p: Peserta, aksi: "terbitkan" | "batalkan") => {
    setTerbitLoading(p.id);
    try {
      const res = await fetch("/api/admin/tadrib-funun/terbitkan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pesertaId: p.id, aksi }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal");
      toast.success(aksi === "terbitkan" ? `Syahadah ${p.nama} diterbitkan` : `Penerbitan syahadah ${p.nama} dibatalkan`);
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || "Gagal");
    } finally {
      setTerbitLoading(null);
    }
  };

  const bukaRiwayat = async (p: Peserta) => {
    setRiwayatPeserta(p);
    setRiwayatLoading(true);
    try {
      const res = await fetch(`/api/admin/tadrib-funun/hadir?pesertaId=${encodeURIComponent(p.id)}`);
      const json = await res.json();
      setRiwayatList(Array.isArray(json) ? json : []);
    } catch {
      toast.error("Gagal memuat riwayat");
    } finally {
      setRiwayatLoading(false);
    }
  };

  const hapusRiwayat = async (id: string) => {
    setHapusRiwayatId(id);
    try {
      const res = await fetch(`/api/admin/tadrib-funun/hadir?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menghapus");
      toast.success("Absen dihapus");
      if (riwayatPeserta) bukaRiwayat(riwayatPeserta);
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || "Gagal menghapus");
    } finally {
      setHapusRiwayatId(null);
    }
  };

  const jenisAktif = jenisList.filter((j) => j.isActive);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-bold">Filter jenis:</label>
        <select
          value={filterJenis}
          onChange={(e) => setFilterJenis(e.target.value)}
          className="rounded-xl border px-3 py-2 text-sm bg-white"
        >
          <option value="">Semua jenis</option>
          {jenisList.map((j) => (
            <option key={j.id} value={j.id}>{j.nama}</option>
          ))}
        </select>
        <span className="text-sm text-[var(--color-text-muted)]">{pesertaList.length} peserta — {dufahAktif}</span>
      </div>

      {canEdit && (
        <div className="bg-white rounded-2xl border p-5 space-y-3">
          <h3 className="font-bold">Tambah Peserta Manual</h3>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
            <select
              value={tambahSantriId}
              onChange={(e) => setTambahSantriId(e.target.value)}
              className="rounded-xl border px-3 py-2 text-sm bg-white"
            >
              <option value="">Pilih santri...</option>
              {santriAktif.map((s) => (
                <option key={s.id} value={s.id}>{s.nama}</option>
              ))}
            </select>
            <select
              value={tambahJenisId}
              onChange={(e) => setTambahJenisId(e.target.value)}
              className="rounded-xl border px-3 py-2 text-sm bg-white"
            >
              <option value="">Pilih jenis...</option>
              {jenisAktif.map((j) => (
                <option key={j.id} value={j.id}>{j.nama}</option>
              ))}
            </select>
            <button
              onClick={tambahPeserta}
              disabled={tambahLoading}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
            >
              {tambahLoading ? "Menyimpan..." : "Tambah Peserta"}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border overflow-hidden">
        {pesertaList.length === 0 ? (
          <p className="p-5 text-sm text-[var(--color-text-muted)]">Belum ada peserta.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="p-3 font-bold">Nama</th>
                  <th className="p-3 font-bold">Jenis</th>
                  <th className="p-3 font-bold">Kehadiran</th>
                  <th className="p-3 font-bold">Status</th>
                  <th className="p-3 font-bold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pesertaList.map((p) => (
                  <tr key={p.id}>
                    <td className="p-3 font-semibold">{p.nama}</td>
                    <td className="p-3">{p.jenis.nama}</td>
                    <td className="p-3 font-bold">{p.kehadiran}/{p.minHadir}</td>
                    <td className="p-3">
                      {p.diterbitkan ? (
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">SYAHADAH TERBIT</span>
                      ) : p.eligible ? (
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-blue-50 text-blue-700">LAYAK — BELUM TERBIT</span>
                      ) : (
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-500">BELUM LAYAK</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        {canEdit && !p.diterbitkan && (
                          <button
                            onClick={() => terbitkan(p, "terbitkan")}
                            disabled={terbitLoading === p.id || !p.eligible}
                            title={p.eligible ? "Terbitkan syahadah" : `Kehadiran belum mencapai ${p.minHadir}x`}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-40"
                          >
                            {terbitLoading === p.id ? "..." : "Terbitkan"}
                          </button>
                        )}
                        {canEdit && p.diterbitkan && (
                          <button
                            onClick={() => terbitkan(p, "batalkan")}
                            disabled={terbitLoading === p.id}
                            className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 text-xs font-bold disabled:opacity-50"
                          >
                            {terbitLoading === p.id ? "..." : "Batalkan Terbit"}
                          </button>
                        )}
                        {p.diterbitkan && (
                          <a
                            href={`/cetak-template/${templateProgramKey(p.jenis.id)}/${p.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white text-xs font-bold"
                          >
                            Cetak
                          </a>
                        )}
                        <button
                          onClick={() => bukaRiwayat(p)}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold"
                        >
                          Riwayat
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {riwayatPeserta && (
        <div className="bg-white rounded-2xl border p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold">Riwayat Hadir — {riwayatPeserta.nama} ({riwayatPeserta.jenis.nama})</h3>
            <button
              onClick={() => setRiwayatPeserta(null)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold"
            >
              Tutup
            </button>
          </div>
          {riwayatLoading ? (
            <p className="text-sm">Memuat...</p>
          ) : riwayatList.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">Belum ada absen.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="p-3 font-bold">Pertemuan</th>
                    <th className="p-3 font-bold">Tanggal</th>
                    <th className="p-3 font-bold">Pencatat</th>
                    {canEdit && <th className="p-3 font-bold">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {riwayatList.map((h) => (
                    <tr key={h.id}>
                      <td className="p-3 font-bold">Pertemuan {h.pertemuanKe}</td>
                      <td className="p-3">{String(h.tanggal).slice(0, 10)}</td>
                      <td className="p-3">{h.pencatat?.nama || "-"}</td>
                      {canEdit && (
                        <td className="p-3">
                          <button
                            onClick={() => hapusRiwayat(h.id)}
                            disabled={hapusRiwayatId === h.id}
                            className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-bold disabled:opacity-50"
                          >
                            {hapusRiwayatId === h.id ? "..." : "Hapus"}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ================= TAB ABSEN ================= */
// Format ala absen sakan: pilih kategori dulu, lalu SEMUA peserta kategori
// itu tampil sekaligus dalam satu tabel. Tiap baris cukup ditekan "Hadir"
// untuk pertemuan yang dipilih, lalu satu tombol Simpan untuk semuanya.
// Riwayat + hapus per peserta pindah ke tab Peserta (tombol "Riwayat").
function HadirTab({
  dufahAktif,
  jenisList,
  canEdit,
  onRefresh,
}: {
  dufahAktif: string;
  jenisList: Jenis[];
  canEdit: boolean;
  onRefresh: () => void;
}) {
  // Filter kategori milik tab ini sendiri: mulai kosong, nama baru muncul
  // setelah kategori dipilih (tanpa "Semua jenis", tanpa default).
  const [jenisId, setJenisId] = useState("");
  const [pesertaList, setPesertaList] = useState<Peserta[]>([]);
  const [pertemuanKe, setPertemuanKe] = useState(1);
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  // pesertaId -> catatan hadir yang sudah tersimpan untuk pertemuan ini.
  const [tersimpan, setTersimpan] = useState<Record<string, { id: string; tanggal: string }>>({});
  // pesertaId -> centang "Hadir" saat ini.
  const [centang, setCentang] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchPesertaJenis = async (id: string) => {
    if (!id) {
      setPesertaList([]);
      return;
    }
    setLoading(true);
    try {
      const q = new URLSearchParams({ dufahNama: dufahAktif, jenisId: id });
      const res = await fetch(`/api/admin/tadrib-funun/peserta?${q.toString()}`);
      const json = await res.json();
      setPesertaList(json.data || []);
    } catch {
      toast.error("Gagal memuat peserta");
    } finally {
      setLoading(false);
    }
  };

  const fetchTersimpan = async (id: string, pertemuan: number) => {
    if (!id) {
      setTersimpan({});
      setCentang({});
      return;
    }
    try {
      const res = await fetch(
        `/api/admin/tadrib-funun/hadir?jenisId=${encodeURIComponent(id)}&pertemuanKe=${pertemuan}`
      );
      const json = await res.json();
      const simpan: Record<string, { id: string; tanggal: string }> = {};
      const cek: Record<string, boolean> = {};
      if (Array.isArray(json)) {
        for (const h of json) {
          simpan[h.pesertaId] = { id: h.id, tanggal: String(h.tanggal).slice(0, 10) };
          cek[h.pesertaId] = true;
        }
      }
      setTersimpan(simpan);
      setCentang(cek);
    } catch {
      toast.error("Gagal memuat status hadir");
    }
  };

  useEffect(() => {
    setTersimpan({});
    setCentang({});
    fetchPesertaJenis(jenisId);
    fetchTersimpan(jenisId, pertemuanKe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jenisId]);

  useEffect(() => {
    fetchTersimpan(jenisId, pertemuanKe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pertemuanKe]);

  const toggleCentang = (id: string) => {
    setCentang((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const simpan = async () => {
    if (!jenisId) return toast.error("Pilih kategori dulu");
    if (!tanggal) return toast.error("Tanggal wajib diisi");
    setSaving(true);
    let berhasil = 0;
    let gagal = 0;
    try {
      for (const p of pesertaList) {
        const mauHadir = !!centang[p.id];
        const sudah = tersimpan[p.id];
        try {
          if (mauHadir) {
            // Sudah tercatat dengan tanggal yang sama: tidak perlu ditulis ulang.
            if (sudah && sudah.tanggal === tanggal) continue;
            const res = await fetch("/api/admin/tadrib-funun/hadir", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pesertaId: p.id, pertemuanKe, tanggal }),
            });
            if (!res.ok) throw new Error();
            berhasil++;
          } else if (sudah) {
            // Dicentang-lepas: hapus catatan pertemuan ini.
            const res = await fetch(`/api/admin/tadrib-funun/hadir?id=${encodeURIComponent(sudah.id)}`, {
              method: "DELETE",
            });
            if (!res.ok) throw new Error();
            berhasil++;
          }
        } catch {
          gagal++;
        }
      }
      if (gagal > 0) {
        toast.error(`${berhasil} tersimpan, ${gagal} gagal — coba simpan lagi`);
      } else {
        toast.success(`Pertemuan ${pertemuanKe} disimpan (${berhasil} perubahan)`);
      }
      fetchTersimpan(jenisId, pertemuanKe);
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const jumlahHadir = pesertaList.filter((p) => centang[p.id]).length;
  const jumlahBelum = pesertaList.length - jumlahHadir;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block text-xs text-[var(--color-text-muted)] mb-1">Filter kategori</span>
          <select
            value={jenisId}
            onChange={(e) => setJenisId(e.target.value)}
            className="rounded-xl border px-3 py-2 text-sm bg-white"
          >
            <option value="">Pilih kategori...</option>
            {jenisList.map((j) => (
              <option key={j.id} value={j.id}>{j.nama}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-xs text-[var(--color-text-muted)] mb-1">Pertemuan ke-</span>
          <select
            value={pertemuanKe}
            onChange={(e) => setPertemuanKe(Number(e.target.value))}
            className="rounded-xl border px-3 py-2 text-sm bg-white"
          >
            {Array.from({ length: TADRIB_FUNUN_MAX_PERTEMUAN }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>Pertemuan {n}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-xs text-[var(--color-text-muted)] mb-1">Tanggal</span>
          <input
            type="date"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            className="rounded-xl border px-3 py-2 text-sm"
          />
        </label>
        {canEdit && (
          <button
            onClick={simpan}
            disabled={saving || !jenisId}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : "Simpan Absen"}
          </button>
        )}
        {jenisId && (
          <span className="text-sm text-[var(--color-text-muted)]">{pesertaList.length} peserta</span>
        )}
      </div>

      {!jenisId ? (
        <div className="bg-white rounded-2xl border p-5">
          <p className="text-sm text-[var(--color-text-muted)]">Pilih kategori dulu untuk menampilkan peserta.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-4 bg-white rounded-2xl border px-5 py-3 text-sm font-bold">
            <span>Hadir: {jumlahHadir}</span>
            <span className="text-[var(--color-text-muted)]">Belum: {jumlahBelum}</span>
            <span className="text-[var(--color-text-muted)]">Pertemuan {pertemuanKe}</span>
          </div>

          <div className="bg-white rounded-2xl border overflow-hidden">
            {loading ? (
              <p className="p-5 text-sm">Memuat...</p>
            ) : pesertaList.length === 0 ? (
              <p className="p-5 text-sm text-[var(--color-text-muted)]">Belum ada peserta di kategori ini.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left">
                    <tr>
                      <th className="p-3 font-bold w-12 text-center">#</th>
                      <th className="p-3 font-bold">Nama</th>
                      <th className="p-3 font-bold">Kehadiran</th>
                      <th className="p-3 font-bold">Hadir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pesertaList.map((p, i) => (
                      <tr key={p.id}>
                        <td className="p-3 text-center font-bold text-[var(--color-text-muted)]">{i + 1}</td>
                        <td className="p-3 font-semibold">
                          {p.nama}
                          {p.diterbitkan ? (
                            <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">SYAHADAH TERBIT</span>
                          ) : p.eligible ? (
                            <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">LAYAK</span>
                          ) : null}
                        </td>
                        <td className="p-3 font-bold">{p.kehadiran}/{p.minHadir}</td>
                        <td className="p-3">
                          <button
                            onClick={() => toggleCentang(p.id)}
                            disabled={!canEdit}
                            className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all disabled:opacity-50 ${
                              centang[p.id]
                                ? "bg-emerald-600 text-white shadow-sm"
                                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                            }`}
                          >
                            {centang[p.id] ? "Hadir ✓" : "Hadir"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">
            Menyimpan pertemuan yang sama akan menimpa tanggal sebelumnya. Melepas centang lalu menyimpan akan menghapus catatan pertemuan itu.
          </p>
        </>
      )}
    </div>
  );
}

/* ================= TAB TEMPLATE ================= */
function TemplateTab({
  jenisList,
  canEdit,
}: {
  jenisList: Jenis[];
  canEdit: boolean;
}) {
  const [jenisId, setJenisId] = useState("");

  useEffect(() => {
    if (!jenisId && jenisList.length > 0) setJenisId(jenisList[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jenisList]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border p-5">
        <label className="text-sm font-bold block mb-2">Template syahadah untuk jenis</label>
        <select
          value={jenisId}
          onChange={(e) => setJenisId(e.target.value)}
          className="w-full md:w-96 rounded-xl border px-3 py-2 text-sm bg-white"
        >
          {jenisList.map((j) => (
            <option key={j.id} value={j.id}>{j.nama}</option>
          ))}
        </select>
        <p className="text-xs text-[var(--color-text-muted)] mt-2">
          Setiap jenis punya background + posisi field sendiri. Nama ekstrakurikuler
          sudah ada di background, jadi field yang dicetak hanya nama santri dan
          tanggal periode.
        </p>
      </div>
      {jenisId && (
        <TemplateSyahadahTab
          programKey={templateProgramKey(jenisId)}
          apiBase="/api/admin/tadrib-funun/template"
          canEdit={canEdit}
        />
      )}
    </div>
  );
}

/* ================= TAB CETAK ================= */
function CetakTab({ pesertaList, loading }: { pesertaList: Peserta[]; loading: boolean }) {
  const siap = pesertaList.filter((p) => p.diterbitkan);
  return (
    <div className="bg-white rounded-2xl border p-5">
      <h3 className="font-bold mb-3">Siap Cetak — {siap.length} santri</h3>
      {loading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Memuat...</p>
      ) : siap.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">Belum ada syahadah yang diterbitkan (terbitkan dulu di tab Peserta).</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="p-3 font-bold">Nama</th>
                <th className="p-3 font-bold">Jenis</th>
                <th className="p-3 font-bold">Kehadiran</th>
                <th className="p-3 font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {siap.map((p) => (
                <tr key={p.id}>
                  <td className="p-3 font-semibold">{p.nama}</td>
                  <td className="p-3">{p.jenis.nama}</td>
                  <td className="p-3 font-bold">{p.kehadiran}/{p.minHadir}</td>
                  <td className="p-3">
                    <a
                      href={`/cetak-template/${templateProgramKey(p.jenis.id)}/${p.id}`}
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
