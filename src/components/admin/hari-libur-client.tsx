"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Plus, Trash2, Edit2, Calendar, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

type HariLibur = {
  id: string;
  tanggal: string;
  nama: string;
  isSemuaSesi: boolean;
  sesiLibur: string[];
  keterangan: string | null;
};

const SESI_LIST = [
  "SESI_1", "SESI_2", "SESI_3", "SESI_4", "SESI_5",
  "SESI_6", "SESI_7", "SESI_8", "SESI_9", "SESI_10"
];

function getWibDateString(offsetDays = 0): string {
  const wib = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
  wib.setDate(wib.getDate() + offsetDays);
  return wib.toISOString().split("T")[0];
}

export function HariLiburClient() {
  const [data, setData] = useState<HariLibur[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState(getWibDateString().substring(0, 7)); // YYYY-MM
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState("");
  
  const [formTanggal, setFormTanggal] = useState("");
  const [formNama, setFormNama] = useState("");
  const [formIsSemuaSesi, setFormIsSemuaSesi] = useState(true);
  const [formSesiLibur, setFormSesiLibur] = useState<string[]>([]);
  const [formKeterangan, setFormKeterangan] = useState("");

  const [isSaving, setIsSaving] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/hari-libur?month=${filterMonth}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      toast.error("Gagal mengambil data hari libur");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterMonth]);

  const resetForm = () => {
    setFormTanggal("");
    setFormNama("");
    setFormIsSemuaSesi(true);
    setFormSesiLibur([]);
    setFormKeterangan("");
    setIsEdit(false);
    setEditId("");
  };

  const handleOpenAdd = () => {
    resetForm();
    setFormTanggal(getWibDateString());
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: HariLibur) => {
    setIsEdit(true);
    setEditId(item.id);
    setFormTanggal(new Date(item.tanggal).toISOString().split("T")[0]);
    setFormNama(item.nama);
    setFormIsSemuaSesi(item.isSemuaSesi);
    setFormSesiLibur(item.sesiLibur || []);
    setFormKeterangan(item.keterangan || "");
    setIsModalOpen(true);
  };

  const handleSesiToggle = (sesi: string) => {
    setFormSesiLibur(prev => 
      prev.includes(sesi) ? prev.filter(s => s !== sesi) : [...prev, sesi]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTanggal || !formNama) return toast.error("Tanggal dan nama harus diisi!");
    
    setIsSaving(true);
    try {
      const payload = {
        tanggal: formTanggal,
        nama: formNama,
        isSemuaSesi: formIsSemuaSesi,
        sesiLibur: formIsSemuaSesi ? [] : formSesiLibur,
        keterangan: formKeterangan
      };
      
      let res;
      if (isEdit) {
        res = await fetch(`/api/admin/hari-libur/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`/api/admin/hari-libur`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        toast.success(`Berhasil ${isEdit ? "mengubah" : "menambah"} hari libur`);
        setIsModalOpen(false);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || "Gagal menyimpan");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, nama: string) => {
    if (!confirm(`Hapus libur "${nama}"?`)) return;
    try {
      const res = await fetch(`/api/admin/hari-libur/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Terhapus");
        fetchData();
      } else {
        toast.error("Gagal menghapus");
      }
    } catch {
      toast.error("Gagal");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-[var(--color-surface-dark)]">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-[var(--color-text)]">
            <Calendar className="h-6 w-6 text-violet-600" />
            Kelola Hari Libur
          </h2>
          <p className="text-sm font-semibold text-[var(--color-text-muted)] mt-1">
            Tentukan hari atau sesi libur agar absensi otomatis menyesuaikan
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <input 
            type="month" 
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-surface-dark)] rounded-xl font-bold text-sm text-[var(--color-text)] outline-none"
          />
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl px-5 py-2 font-bold transition-all text-sm shadow-sm hover:shadow"
          >
            <Plus className="h-4 w-4" />
            Tambah Libur
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-[var(--color-surface-dark)] shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-20 text-violet-600">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-[var(--color-text-subtle)] text-center">
            <Calendar className="h-12 w-12 mb-4 opacity-50" />
            <p className="font-bold">Tidak ada hari libur di bulan ini.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[var(--color-secondary)]">
                <tr>
                  <th className="px-6 py-4 font-bold text-sm text-[var(--color-text)]">TANGGAL</th>
                  <th className="px-6 py-4 font-bold text-sm text-[var(--color-text)]">NAMA LIBUR</th>
                  <th className="px-6 py-4 font-bold text-sm text-[var(--color-text)]">CAKUPAN</th>
                  <th className="px-6 py-4 font-bold text-sm text-[var(--color-text)] text-right">AKSI</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item.id} className="border-b border-[var(--color-surface)] hover:bg-[var(--color-surface-light)] transition">
                    <td className="px-6 py-4 font-bold text-[var(--color-text)] text-sm">
                      {format(new Date(item.tanggal), "EEEE, d MMM yyyy", { locale: localeId })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-[var(--color-primary)] text-sm">{item.nama}</div>
                      {item.keterangan && <div className="text-xs text-[var(--color-text-muted)] font-semibold mt-0.5">{item.keterangan}</div>}
                    </td>
                    <td className="px-6 py-4">
                      {item.isSemuaSesi ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold uppercase">
                          Full Hari (Semua Sesi)
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {item.sesiLibur.map(s => (
                            <span key={s} className="inline-block px-1.5 py-0.5 bg-violet-100 text-violet-800 text-[10px] rounded font-bold">
                              {s.replace("SESI_", "")}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id, item.nama)}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-[var(--color-surface-dark)] flex items-center justify-between bg-white shrink-0">
              <h3 className="font-bold text-lg text-[var(--color-text)]">
                {isEdit ? "Edit Hari Libur" : "Tambah Hari Libur"}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold p-2 bg-slate-100 rounded-full"
              >
                Tutup
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
              <div>
                <label className="block text-sm font-bold text-[var(--color-text-muted)] mb-2">Tanggal</label>
                <input 
                  type="date"
                  required
                  value={formTanggal}
                  onChange={(e) => setFormTanggal(e.target.value)}
                  className="w-full bg-[var(--color-secondary)] border border-[var(--color-surface-dark)] rounded-xl px-4 py-2.5 text-sm font-semibold outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-[var(--color-text-muted)] mb-2">Nama Kegiatan Libur</label>
                <input 
                  type="text"
                  required
                  placeholder="Contoh: Idul Adha, Pulang Semester..."
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  className="w-full bg-[var(--color-secondary)] border border-[var(--color-surface-dark)] rounded-xl px-4 py-2.5 text-sm font-semibold outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-[var(--color-text-muted)] mb-3">Cakupan Libur</label>
                <div className="flex gap-4 p-4 border border-[var(--color-surface-dark)] rounded-2xl bg-[var(--color-surface-light)]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      checked={formIsSemuaSesi}
                      onChange={() => setFormIsSemuaSesi(true)}
                      className="accent-violet-600 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-sm font-bold text-[var(--color-text)]">Semua Sesi (Full Day)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      checked={!formIsSemuaSesi}
                      onChange={() => setFormIsSemuaSesi(false)}
                      className="accent-violet-600 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-sm font-bold text-[var(--color-text)]">Pilih Sesi Spesifik</span>
                  </label>
                </div>
              </div>

              {!formIsSemuaSesi && (
                <div>
                  <label className="block text-sm font-bold text-[var(--color-text-muted)] mb-2">Pilih Sesi Libur</label>
                  <div className="grid grid-cols-5 gap-2 border border-[var(--color-surface-dark)] p-3 rounded-2xl bg-white shadow-sm">
                    {SESI_LIST.map(sesi => (
                      <label key={sesi} className={`flex items-center justify-center p-2 rounded-xl text-xs font-bold cursor-pointer transition border ${formSesiLibur.includes(sesi) ? 'bg-violet-100 border-violet-200 text-violet-700' : 'bg-[var(--color-surface)] border-transparent text-[var(--color-text-subtle)] hover:bg-[var(--color-surface-dark)]'}`}>
                        <input 
                          type="checkbox"
                          className="hidden"
                          checked={formSesiLibur.includes(sesi)}
                          onChange={() => handleSesiToggle(sesi)}
                        />
                        {sesi.replace("SESI_", "")}
                      </label>
                    ))}
                  </div>
                  {formSesiLibur.length === 0 && <p className="text-xs font-bold text-rose-500 mt-2">Pilih minimal 1 sesi</p>}
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-[var(--color-text-muted)] mb-2">Keterangan Tambahan (Opsional)</label>
                <textarea 
                  rows={2}
                  value={formKeterangan}
                  onChange={(e) => setFormKeterangan(e.target.value)}
                  className="w-full bg-[var(--color-secondary)] border border-[var(--color-surface-dark)] rounded-xl px-4 py-2.5 text-sm font-semibold outline-none focus:border-violet-500 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSaving || (!formIsSemuaSesi && formSesiLibur.length === 0)}
                className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white rounded-xl py-3 font-bold text-sm transition shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...</>
                ) : (
                  "Simpan Hari Libur"
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
