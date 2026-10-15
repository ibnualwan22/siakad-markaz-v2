"use client";

import { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import { SURAHS, predikatDariNilai } from "@/lib/huffadz/surah";

interface TasmiRow {
  id: string;
  santriId: string;
  waktuSubmit: string;
  surahNo: number;
  surahNama: string;
  ayatDari: number;
  surahSampaiNo: number;
  surahSampaiNama: string;
  ayatSampai: number;
  juz: number;
  durasiMenit: number;
  nilaiTahfidz: number;
  nilaiTahsin: number;
  nilaiTartil: number;
  nilaiAdab: number;
  catatan: string | null;
  santri: { nama: string };
  penilai: { nama: string } | null;
}

function fmtWaktu(iso: string): string {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      weekday: "long", day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date(iso));
  } catch { return iso; }
}

const NILAI_FIELDS = [
  { key: "nilaiTahfidz", label: "Tahfidz" },
  { key: "nilaiTahsin", label: "Tahsin" },
  { key: "nilaiTartil", label: "Tartil" },
  { key: "nilaiAdab", label: "Adab" },
] as const;

export default function TasmiHuffadzClient({ canEdit }: { canEdit: boolean }) {
  const [santriList, setSantriList] = useState<{ id: string; nama: string }[]>([]);
  const [rows, setRows] = useState<TasmiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filter tabel
  const [fTanggal, setFTanggal] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [fNama, setFNama] = useState("");

  // Form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [santriId, setSantriId] = useState("");
  const [surahNo, setSurahNo] = useState(1);
  const [ayatDari, setAyatDari] = useState("1");
  const [surahSampaiNo, setSurahSampaiNo] = useState(1);
  const [ayatSampai, setAyatSampai] = useState("7");
  const [juz, setJuz] = useState("1");
  const [durasi, setDurasi] = useState("");
  const [nilai, setNilai] = useState<Record<string, string>>({
    nilaiTahfidz: "", nilaiTahsin: "", nilaiTartil: "", nilaiAdab: "",
  });
  const [catatan, setCatatan] = useState("");

  const surah = useMemo(() => SURAHS.find(s => s.no === surahNo)!, [surahNo]);
  const surahSampai = useMemo(() => SURAHS.find(s => s.no === surahSampaiNo)!, [surahSampaiNo]);

  const onSurahChange = (no: number) => {
    const s = SURAHS.find(x => x.no === no)!;
    setSurahNo(no);
    setAyatDari("1");
    // Surat sampai default = surat yang sama
    setSurahSampaiNo(no);
    setAyatSampai(String(s.ayat));
    setJuz(String(s.juzAwal));
  };

  const fetchSantri = async () => {
    try {
      const r = await fetch("/api/admin/huffadz/tasmi?santri=1");
      if (r.ok) setSantriList(await r.json());
    } catch {}
  };

  const fetchRows = async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (fTanggal) p.set("tanggal", fTanggal);
      if (fNama) p.set("q", fNama);
      const r = await fetch(`/api/admin/huffadz/tasmi?${p.toString()}`);
      if (r.ok) setRows(await r.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchSantri(); }, []);
  useEffect(() => { fetchRows(); }, [fTanggal]);

  const resetForm = () => {
    setEditingId(null);
    setSantriId("");
    onSurahChange(1);
    setDurasi("");
    setNilai({ nilaiTahfidz: "", nilaiTahsin: "", nilaiTartil: "", nilaiAdab: "" });
    setCatatan("");
  };

  const startEdit = (row: TasmiRow) => {
    setEditingId(row.id);
    setSantriId(row.santriId);
    setSurahNo(row.surahNo);
    setAyatDari(String(row.ayatDari));
    setSurahSampaiNo(row.surahSampaiNo);
    setAyatSampai(String(row.ayatSampai));
    setJuz(String(row.juz));
    setDurasi(String(row.durasiMenit));
    setNilai({
      nilaiTahfidz: String(row.nilaiTahfidz),
      nilaiTahsin: String(row.nilaiTahsin),
      nilaiTartil: String(row.nilaiTartil),
      nilaiAdab: String(row.nilaiAdab),
    });
    setCatatan(row.catatan || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string, nama: string) => {
    if (!confirm(`Hapus penilaian tasmi' ${nama}?`)) return;
    try {
      const r = await fetch(`/api/admin/huffadz/tasmi/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json()).error || "Gagal");
      toast.success("Dihapus");
      fetchRows();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!santriId) return toast.error("Pilih santri");
    const aDari = parseInt(ayatDari), aSampai = parseInt(ayatSampai);
    if (!aDari || aDari < 1 || aDari > surah.ayat) {
      return toast.error(`Ayat awal harus 1-${surah.ayat}`);
    }
    if (!aSampai || aSampai < 1 || aSampai > surahSampai.ayat) {
      return toast.error(`Ayat akhir harus 1-${surahSampai.ayat}`);
    }
    if (surahSampaiNo < surahNo) return toast.error("Surat akhir tidak boleh sebelum surat awal");
    if (surahSampaiNo === surahNo && aSampai < aDari) {
      return toast.error("Ayat akhir harus ≥ ayat awal");
    }
    const j = parseInt(juz);
    if (!j || j < 1 || j > 30) return toast.error("Juz harus 1-30");
    for (const f of NILAI_FIELDS) {
      const v = parseInt(nilai[f.key]);
      if (isNaN(v) || v < 0 || v > 100) return toast.error(`Nilai ${f.label} harus 0-100`);
    }
    setSaving(true);
    try {
      const body = {
        santriId,
        surahNo,
        surahNama: surah.nama,
        ayatDari: aDari,
        surahSampaiNo,
        surahSampaiNama: surahSampai.nama,
        ayatSampai: aSampai,
        juz: j,
        durasiMenit: parseInt(durasi) || 0,
        nilaiTahfidz: parseInt(nilai.nilaiTahfidz),
        nilaiTahsin: parseInt(nilai.nilaiTahsin),
        nilaiTartil: parseInt(nilai.nilaiTartil),
        nilaiAdab: parseInt(nilai.nilaiAdab),
        catatan: catatan || null,
      };
      const url = editingId ? `/api/admin/huffadz/tasmi/${editingId}` : "/api/admin/huffadz/tasmi";
      const r = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Gagal menyimpan");
      toast.success(editingId ? "Perubahan disimpan" : "Penilaian tersimpan");
      resetForm();
      fetchRows();
    } catch (e: any) { toast.error(e.message); }
    setSaving(false);
  };

  const nilaiBadge = (v: number) => {
    const p = predikatDariNilai(v);
    const color = v < 70 ? "bg-red-100 text-red-700" : v < 80 ? "bg-yellow-100 text-yellow-700" : v < 90 ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700";
    return (
      <span className={`inline-flex flex-col items-center px-2 py-1 rounded-lg ${color}`}>
        <span className="font-black text-sm leading-none">{v}</span>
        <span className="text-[10px] font-bold leading-tight mt-0.5">{p}</span>
      </span>
    );
  };

  const rentangText = (r: TasmiRow) => {
    if (r.surahSampaiNo === r.surahNo) {
      return `${r.surahNama}: ${r.ayatDari}-${r.ayatSampai}`;
    }
    return `${r.surahNama}: ${r.ayatDari} → ${r.surahSampaiNama}: ${r.ayatSampai}`;
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-black text-gray-800 mb-1">Penilaian Tasmi' Huffadz</h1>
      <p className="text-sm text-gray-500 mb-6">Form penilaian setoran tasmi' santri Markaz Huffadz</p>

      {canEdit && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 md:p-6 mb-8">
          <h2 className="font-black text-gray-800 mb-4">{editingId ? "Edit Penilaian" : "Input Penilaian Baru"}</h2>

          <div className="mb-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Santri</label>
            <select value={santriId} onChange={e => setSantriId(e.target.value)} required disabled={!!editingId}
              className="w-full p-3 text-sm font-bold bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-gray-50">
              <option value="">— Pilih santri —</option>
              {santriList.map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Surat</label>
              <select value={surahNo} onChange={e => onSurahChange(parseInt(e.target.value))}
                className="w-full p-3 text-sm font-bold bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none">
                {SURAHS.map(s => (
                  <option key={s.no} value={s.no}>{s.nama}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Ayat Dari</label>
              <input type="number" min={1} max={surah.ayat} value={ayatDari} onChange={e => setAyatDari(e.target.value)} required
                className="w-full p-3 text-sm font-black text-center border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Sampai Surat</label>
              <select value={surahSampaiNo} onChange={e => {
                const no = parseInt(e.target.value);
                const s = SURAHS.find(x => x.no === no)!;
                setSurahSampaiNo(no);
                setAyatSampai(String(s.ayat));
              }}
                className="w-full p-3 text-sm font-bold bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none">
                {SURAHS.filter(s => s.no >= surahNo).map(s => (
                  <option key={s.no} value={s.no}>{s.nama}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Ayat Sampai</label>
              <input type="number" min={1} max={surahSampai.ayat} value={ayatSampai} onChange={e => setAyatSampai(e.target.value)} required
                className="w-full p-3 text-sm font-black text-center border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Juz <span className="normal-case font-medium text-gray-400">(otomatis)</span></label>
              <input type="number" min={1} max={30} value={juz} onChange={e => setJuz(e.target.value)} required
                className="w-full p-3 text-sm font-black text-center border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Durasi (menit)</label>
              <input type="number" min={0} value={durasi} onChange={e => setDurasi(e.target.value)} placeholder="0"
                className="w-full p-3 text-sm font-black text-center border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {NILAI_FIELDS.map(f => {
              const v = parseInt(nilai[f.key]);
              return (
                <div key={f.key}>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">{f.label}</label>
                  <input type="number" min={0} max={100} value={nilai[f.key]}
                    onChange={e => setNilai(prev => ({ ...prev, [f.key]: e.target.value }))} required placeholder="0-100"
                    className="w-full p-3 text-xl font-black text-center border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" />
                  <div className="text-center mt-1.5 text-sm font-bold text-emerald-700 h-5">
                    {!isNaN(v) ? predikatDariNilai(v) : ""}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mb-5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Catatan <span className="normal-case font-medium text-gray-400">(opsional)</span></label>
            <textarea value={catatan} onChange={e => setCatatan(e.target.value)} rows={2} maxLength={500}
              className="w-full p-3 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="flex-1 py-3.5 rounded-xl font-bold text-sm bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-all">
              {saving ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Simpan Penilaian"}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm}
                className="px-6 py-3.5 rounded-xl font-bold text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all">
                Batal
              </button>
            )}
          </div>
        </form>
      )}

      {/* Tabel riwayat */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b flex flex-wrap gap-3 items-center">
          <h2 className="font-black text-gray-800 flex-1">Riwayat Penilaian</h2>
          <input type="date" value={fTanggal} onChange={e => setFTanggal(e.target.value)}
            className="p-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" />
          <input type="text" value={fNama} onChange={e => setFNama(e.target.value)} placeholder="Cari nama..."
            onKeyDown={e => e.key === "Enter" && fetchRows()}
            className="p-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" />
          <button onClick={fetchRows} className="px-4 py-2 text-sm font-bold bg-gray-100 rounded-xl hover:bg-gray-200">Cari</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[880px]">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase text-gray-500">
                <th className="px-4 py-3 text-left">Waktu</th>
                <th className="px-4 py-3 text-left">Nama</th>
                <th className="px-4 py-3 text-left">Surat / Juz</th>
                <th className="px-4 py-3 text-center">Durasi</th>
                <th className="px-4 py-3 text-center">Tahfidz</th>
                <th className="px-4 py-3 text-center">Tahsin</th>
                <th className="px-4 py-3 text-center">Tartil</th>
                <th className="px-4 py-3 text-center">Adab</th>
                {canEdit && <th className="px-4 py-3 text-center">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Memuat...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Belum ada data</td></tr>
              ) : rows.map(r => (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">{fmtWaktu(r.waktuSubmit)}</td>
                  <td className="px-4 py-3 font-bold text-gray-800">{r.santri.nama}</td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-gray-700">{rentangText(r)}</div>
                    <div className="text-xs text-gray-500">Juz {r.juz}</div>
                  </td>
                  <td className="px-4 py-3 text-center">{r.durasiMenit} mnt</td>
                  <td className="px-4 py-3 text-center">{nilaiBadge(r.nilaiTahfidz)}</td>
                  <td className="px-4 py-3 text-center">{nilaiBadge(r.nilaiTahsin)}</td>
                  <td className="px-4 py-3 text-center">{nilaiBadge(r.nilaiTartil)}</td>
                  <td className="px-4 py-3 text-center">{nilaiBadge(r.nilaiAdab)}</td>
                  {canEdit && (
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <button onClick={() => startEdit(r)} className="px-3 py-1.5 text-xs font-bold bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 mr-2">Edit</button>
                      <button onClick={() => handleDelete(r.id, r.santri.nama)} className="px-3 py-1.5 text-xs font-bold bg-red-50 text-red-600 rounded-lg hover:bg-red-100">Hapus</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
