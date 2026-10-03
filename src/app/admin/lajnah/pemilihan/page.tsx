"use client";

import { useState, useEffect } from "react";
import { Vote, Plus, Pencil, Trash2, Loader2, X, Play, Square, Trophy, Search, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";

type Sesi = {
  id: string;
  judul: string;
  dufahNama: string;
  status: string;
  rencanaTutupAt: string | null;
  dibukaAt: string | null;
  ditutupAt: string | null;
  _count: { paslonList: number; suaraList: number };
};

type Paslon = {
  id: string;
  nomorUrut: number;
  fotoUrl: string | null;
  visiMisi: string | null;
  santri1: { id: string; nama: string };
  santri2: { id: string; nama: string };
  _count: { suaraList: number };
};

export default function PemilihanLajnahPage() {
  const [dufahList, setDufahList] = useState<any[]>([]);
  const [activeDufah, setActiveDufah] = useState("");
  const [sesiList, setSesiList] = useState<Sesi[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);

  // Modal sesi
  const [showSesiModal, setShowSesiModal] = useState(false);
  const [judul, setJudul] = useState("");
  const [sesiDufah, setSesiDufah] = useState("");

  // Modal paslon
  const [showPaslonModal, setShowPaslonModal] = useState(false);
  const [q1, setQ1] = useState("");
  const [q2, setQ2] = useState("");
  const [res1, setRes1] = useState<any[]>([]);
  const [res2, setRes2] = useState<any[]>([]);
  const [sel1, setSel1] = useState<any>(null);
  const [sel2, setSel2] = useState<any>(null);
  const [fotoUrl, setFotoUrl] = useState("");
  const [visiMisi, setVisiMisi] = useState("");

  // Modal buka
  const [showBukaModal, setShowBukaModal] = useState(false);
  const [rencanaTutup, setRencanaTutup] = useState("");

  // Hasil tutup
  const [hasilTutup, setHasilTutup] = useState<any>(null);

  useEffect(() => { init(); }, []);
  useEffect(() => { if (activeDufah) muatSesi(activeDufah); }, [activeDufah]);

  const init = async () => {
    try {
      const [dRes, cRes] = await Promise.all([fetch("/api/admin/dufah"), fetch("/api/admin/active-context")]);
      const dData = await dRes.json();
      const cData = await cRes.json();
      setDufahList(Array.isArray(dData) ? dData : []);
      setActiveDufah(cData.activeDufah || dData[0]?.nama || "");
    } finally { setLoading(false); }
  };

  const muatSesi = async (dufahNama: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/pemilihan-lajnah?dufahNama=${encodeURIComponent(dufahNama)}`);
      setSesiList(await res.json());
    } catch { toast.error("Gagal memuat sesi"); }
    finally { setLoading(false); }
  };

  const muatDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/pemilihan-lajnah/${id}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setSelected(j);
    } catch (e: any) { toast.error(e.message); }
  };

  const buatSesi = async () => {
    if (!judul.trim() || !sesiDufah) return toast.error("Judul dan dufah wajib diisi");
    try {
      const res = await fetch("/api/admin/pemilihan-lajnah", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ judul: judul.trim(), dufahNama: sesiDufah }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast.success("Sesi dibuat");
      setShowSesiModal(false); setJudul("");
      muatSesi(activeDufah);
    } catch (e: any) { toast.error(e.message); }
  };

  const cariSantri = async (q: string, mana: 1 | 2) => {
    if (mana === 1) setQ1(q); else setQ2(q);
    if (q.length < 2) { mana === 1 ? setRes1([]) : setRes2([]); return; }
    try {
      const res = await fetch(`/api/admin/lajnah/search-santri?q=${encodeURIComponent(q)}`);
      const j = await res.json();
      mana === 1 ? setRes1(j) : setRes2(j);
    } catch { /* abaikan */ }
  };

  const tambahPaslon = async () => {
    if (!sel1 || !sel2) return toast.error("Pilih dua santri (rois & wakil)");
    if (sel1.id === sel2.id) return toast.error("Rois dan wakil harus berbeda");
    try {
      const res = await fetch(`/api/admin/pemilihan-lajnah/${selected.id}/paslon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          santri1Id: sel1.id, santri2Id: sel2.id,
          fotoUrl: fotoUrl.trim() || null, visiMisi: visiMisi.trim() || null,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast.success(`Paslon ${j.nomorUrut} ditambahkan`);
      setShowPaslonModal(false);
      setSel1(null); setSel2(null); setQ1(""); setQ2(""); setFotoUrl(""); setVisiMisi("");
      muatDetail(selected.id);
    } catch (e: any) { toast.error(e.message); }
  };

  const hapusPaslon = async (pid: string, no: number) => {
    if (!confirm(`Hapus paslon ${no}?`)) return;
    try {
      const res = await fetch(`/api/admin/pemilihan-lajnah/${selected.id}/paslon/${pid}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast.success("Paslon dihapus");
      muatDetail(selected.id);
    } catch (e: any) { toast.error(e.message); }
  };

  const bukaSesi = async () => {
    try {
      const res = await fetch(`/api/admin/pemilihan-lajnah/${selected.id}/buka`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rencanaTutupAt: rencanaTutup || null }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast.success("Pemilihan DIBUKA — santri sudah bisa memilih");
      setShowBukaModal(false); setRencanaTutup("");
      muatDetail(selected.id); muatSesi(activeDufah);
    } catch (e: any) { toast.error(e.message); }
  };

  const tutupSesi = async () => {
    if (!confirm("Tutup pemilihan dan tetapkan pemenang? Pemenang otomatis menjadi anggota lajnah.")) return;
    try {
      const res = await fetch(`/api/admin/pemilihan-lajnah/${selected.id}/tutup`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setHasilTutup(j);
      toast.success("Pemilihan ditutup");
      muatDetail(selected.id); muatSesi(activeDufah);
    } catch (e: any) { toast.error(e.message); }
  };

  const hapusSesi = async (s: Sesi) => {
    if (!confirm(`Hapus sesi "${s.judul}"?`)) return;
    try {
      const res = await fetch(`/api/admin/pemilihan-lajnah/${s.id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast.success("Sesi dihapus");
      if (selected?.id === s.id) setSelected(null);
      muatSesi(activeDufah);
    } catch (e: any) { toast.error(e.message); }
  };

  const statusBadge = (st: string) => (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${st === "BUKA" ? "bg-emerald-100 text-emerald-800" : st === "TUTUP" ? "bg-gray-200 text-gray-700" : "bg-amber-100 text-amber-800"}`}>
      {st}
    </span>
  );

  // ============ DETAIL SESI ============
  if (selected) {
    const s = selected;
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <button onClick={() => { setSelected(null); setHasilTutup(null); }} className="text-sm text-blue-600 hover:underline mb-3">← Kembali ke daftar sesi</button>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2"><Vote className="w-5 h-5" /> {s.judul}</h1>
            <p className="text-sm text-gray-500">{s.dufahNama} • {statusBadge(s.status)}</p>
          </div>
          <div className="flex gap-2">
            {s.status === "DRAFT" && (
              <button onClick={() => setShowBukaModal(true)} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                <Play className="w-4 h-4" /> Buka Pemilihan
              </button>
            )}
            {s.status === "BUKA" && (
              <button onClick={tutupSesi} className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                <Square className="w-4 h-4" /> Tutup & Tetapkan
              </button>
            )}
          </div>
        </div>

        {s.rencanaTutupAt && s.status === "BUKA" && (
          <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-2.5 mb-4">
            Rencana ditutup: {new Date(s.rencanaTutupAt).toLocaleString("id-ID")}
          </p>
        )}

        {hasilTutup?.pemenang && (
          <div className="mb-4 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 p-4 text-center">
            <Trophy className="w-10 h-10 mx-auto text-white" />
            <p className="text-white/90 text-xs font-semibold uppercase tracking-widest">Pemenang — otomatis jadi anggota lajnah</p>
            <p className="text-white text-lg font-bold">Paslon {hasilTutup.pemenang.nomorUrut} ({hasilTutup.pemenang.suara} suara)</p>
            <p className="text-white text-sm">{hasilTutup.pemenang.santri1.nama} & {hasilTutup.pemenang.santri2.nama}</p>
          </div>
        )}

        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">Paslon ({s.paslonList?.length || 0})</h2>
          {s.status === "DRAFT" && (
            <button onClick={() => setShowPaslonModal(true)} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-sm">
              <Plus className="w-4 h-4" /> Tambah Paslon
            </button>
          )}
        </div>

        <div className="grid gap-3">
          {(s.paslonList || []).map((p: Paslon) => (
            <div key={p.id} className="border rounded-xl p-4 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center text-white text-xl font-bold shrink-0">
                    {p.fotoUrl ? <img src={p.fotoUrl} alt="" className="w-12 h-12 rounded-xl object-cover" /> : p.nomorUrut}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">Paslon {p.nomorUrut}</p>
                    <p className="text-sm text-gray-600 truncate">{p.santri1.nama} & {p.santri2.nama}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-bold bg-gray-100 px-2.5 py-1 rounded-full">{p._count.suaraList} suara</span>
                  {s.status === "DRAFT" && (
                    <button onClick={() => hapusPaslon(p.id, p.nomorUrut)} className="p-2 hover:bg-gray-100 rounded-lg">
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  )}
                </div>
              </div>
              {p.visiMisi && <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{p.visiMisi}</p>}
            </div>
          ))}
          {(s.paslonList || []).length === 0 && (
            <p className="text-center text-gray-500 py-8 text-sm">Belum ada paslon. Tambahkan minimal 1 paslon sebelum membuka.</p>
          )}
        </div>

        {/* Modal tambah paslon */}
        {showPaslonModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowPaslonModal(false)}>
            <div className="bg-white rounded-2xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-lg">Tambah Paslon</h2>
                <button onClick={() => setShowPaslonModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
              </div>
              {[{ q: q1, res: res1, sel: sel1, setSel: setSel1, label: "Calon Rois (Santri 1)", mana: 1 as const },
                { q: q2, res: res2, sel: sel2, setSel: setSel2, label: "Calon Wakil (Santri 2)", mana: 2 as const }].map((f) => (
                <div key={f.mana} className="mb-3">
                  <label className="text-sm text-gray-600 block mb-1">{f.label}</label>
                  {f.sel ? (
                    <div className="flex items-center justify-between border rounded-lg px-3 py-2 bg-emerald-50">
                      <span className="text-sm font-medium">{f.sel.nama}</span>
                      <button onClick={() => f.setSel(null)} className="text-xs text-red-600">Ganti</button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                        <input
                          value={f.q}
                          onChange={(e) => cariSantri(e.target.value, f.mana)}
                          placeholder="Ketik nama santri..."
                          className="border rounded-lg pl-9 pr-3 py-2 text-sm w-full"
                        />
                      </div>
                      {f.res.length > 0 && (
                        <div className="border rounded-lg mt-1 max-h-36 overflow-y-auto">
                          {f.res.map((r: any) => (
                            <button
                              key={r.id}
                              onClick={() => { f.setSel(r); f.mana === 1 ? setRes1([]) : setRes2([]); }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b last:border-0"
                            >
                              <span className="font-medium">{r.nama}</span>
                              <span className="text-xs text-gray-500 block">{r.kelas} • {r.asrama}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
              <label className="text-sm text-gray-600 block mb-1">Link Foto (opsional)</label>
              <input value={fotoUrl} onChange={(e) => setFotoUrl(e.target.value)} placeholder="https://..." className="border rounded-lg px-3 py-2 text-sm w-full mb-3" />
              <label className="text-sm text-gray-600 block mb-1">Visi & Misi (opsional)</label>
              <textarea value={visiMisi} onChange={(e) => setVisiMisi(e.target.value)} rows={3} placeholder="Visi misi paslon..." className="border rounded-lg px-3 py-2 text-sm w-full mb-4" />
              <button onClick={tambahPaslon} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-sm font-medium">
                Tambah Paslon
              </button>
            </div>
          </div>
        )}

        {/* Modal buka sesi */}
        {showBukaModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowBukaModal(false)}>
            <div className="bg-white rounded-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
              <h2 className="font-bold text-lg mb-3">Buka Pemilihan</h2>
              <p className="text-sm text-gray-600 mb-3">Santri di {s.dufahNama} langsung bisa memilih setelah dibuka.</p>
              <label className="text-sm text-gray-600 block mb-1">Rencana tutup (opsional — untuk countdown)</label>
              <input
                type="datetime-local"
                value={rencanaTutup}
                onChange={(e) => setRencanaTutup(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm w-full mb-4"
              />
              <div className="flex gap-2">
                <button onClick={() => setShowBukaModal(false)} className="flex-1 py-2.5 rounded-xl border text-sm">Batal</button>
                <button onClick={bukaSesi} className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold">
                  Buka Sekarang
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============ DAFTAR SESI ============
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <Vote className="w-6 h-6" /> Pemilihan Rois Lajnah
        </h1>
        <button
          onClick={() => { setSesiDufah(activeDufah); setShowSesiModal(true); }}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Buat Sesi
        </button>
      </div>

      <div className="mb-4">
        <label className="text-sm text-gray-600 block mb-1">Filter Dufah</label>
        <select value={activeDufah} onChange={(e) => setActiveDufah(e.target.value)} className="border rounded-lg px-3 py-2 text-sm w-full md:w-72">
          {dufahList.map((d: any) => (
            <option key={d.nama} value={d.nama}>{d.nama}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
      ) : sesiList.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Vote className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>Belum ada sesi pemilihan untuk dufah ini.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {sesiList.map((se) => (
            <div key={se.id} className="border rounded-xl p-4 bg-white shadow-sm flex items-center justify-between gap-3">
              <button onClick={() => muatDetail(se.id)} className="text-left min-w-0 flex-1">
                <p className="font-semibold hover:text-emerald-700 truncate">{se.judul}</p>
                <p className="text-xs text-gray-500">
                  {se._count.paslonList} paslon • {se._count.suaraList} suara
                </p>
              </button>
              <div className="flex items-center gap-2 shrink-0">
                {statusBadge(se.status)}
                {se.status === "DRAFT" && (
                  <button onClick={() => hapusSesi(se)} className="p-2 hover:bg-gray-100 rounded-lg" title="Hapus">
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showSesiModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowSesiModal(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">Buat Sesi Pemilihan</h2>
              <button onClick={() => setShowSesiModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <label className="text-sm text-gray-600 block mb-1">Judul</label>
            <input value={judul} onChange={(e) => setJudul(e.target.value)} placeholder="cth: Pemilihan Rois Lajnah 1447 H" className="border rounded-lg px-3 py-2 text-sm w-full mb-3" />
            <label className="text-sm text-gray-600 block mb-1">Dufah</label>
            <select value={sesiDufah} onChange={(e) => setSesiDufah(e.target.value)} className="border rounded-lg px-3 py-2 text-sm w-full mb-4">
              {dufahList.map((d: any) => (
                <option key={d.nama} value={d.nama}>{d.nama}</option>
              ))}
            </select>
            <button onClick={buatSesi} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-sm font-medium">
              Buat Sesi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
