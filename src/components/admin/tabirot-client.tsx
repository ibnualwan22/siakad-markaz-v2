"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import Link from "next/link";
import { Plus, Users, MapPin, Calendar, X, Edit, Trash2 } from "lucide-react";

type Kelompok = {
  id: string;
  tempat: string;
  bulanKe: number;
  isActive: boolean;
  _count?: { anggotaList: number };
};

export function TabirotClient({ canEdit }: { canEdit: boolean }) {
  const [kelompokList, setKelompokList] = useState<Kelompok[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [tempat, setTempat] = useState("");
  const [bulanKe, setBulanKe] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showEditLokasiModal, setShowEditLokasiModal] = useState(false);
  const [showDeleteLokasiModal, setShowDeleteLokasiModal] = useState(false);
  const [targetLokasi, setTargetLokasi] = useState("");
  const [newLokasiName, setNewLokasiName] = useState("");

  const fetchKelompok = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/absensi/tabirot");
      const data = await res.json();
      if (data.success) {
        setKelompokList(data.data);
      } else {
        toast.error("Gagal memuat daftar kelompok");
      }
    } catch {
      toast.error("Gagal memuat data kelompok");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchKelompok();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/absensi/tabirot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempat, bulanKe }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Kelompok berhasil dibuat");
        setShowModal(false);
        setTempat("");
        setBulanKe(1);
        fetchKelompok();
      } else {
        toast.error(data.error || "Gagal membuat kelompok");
      }
    } catch {
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditLokasi = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/absensi/tabirot/lokasi", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldTempat: targetLokasi, newTempat: newLokasiName }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Nama lokasi berhasil diubah");
        setShowEditLokasiModal(false);
        fetchKelompok();
      } else {
        toast.error(data.error || "Gagal mengubah lokasi");
      }
    } catch {
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLokasi = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/absensi/tabirot/lokasi?tempat=${encodeURIComponent(targetLokasi)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Lokasi berhasil dihapus");
        setShowDeleteLokasiModal(false);
        fetchKelompok();
      } else {
        toast.error(data.error || "Gagal menghapus lokasi");
      }
    } catch {
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Kelompokkan berdasarkan tempat agar tampilannya lebih rapi
  const groupedList = kelompokList.reduce<Record<string, Kelompok[]>>((acc, k) => {
    if (!acc[k.tempat]) acc[k.tempat] = [];
    acc[k.tempat].push(k);
    return acc;
  }, {});

  const sortedTempat = Object.keys(groupedList).sort();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-[var(--radius-2xl)] border border-[var(--color-surface-dark)] shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text)]">Daftar Kelompok</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Pilih kelompok untuk absen atau kelola anggota</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-full bg-blue-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            <Plus size={18} /> Tambah Kelompok
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-[var(--color-text-muted)] font-semibold">Memuat data...</div>
      ) : kelompokList.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-[var(--radius-2xl)] border border-[var(--color-surface-dark)] text-[var(--color-text-muted)] font-semibold">
          Belum ada kelompok Ta'birot yang dibuat.
        </div>
      ) : (
        <div className="space-y-8">
          {sortedTempat.map(tempatKey => (
            <div key={tempatKey} className="space-y-4">
              <h3 className="text-lg font-bold text-[var(--color-text)] flex items-center justify-between border-b border-[var(--color-surface-dark)] pb-2">
                <div className="flex items-center gap-2">
                  <MapPin size={20} className="text-pink-600" />
                  {tempatKey}
                </div>
                {canEdit && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setTargetLokasi(tempatKey);
                        setNewLokasiName(tempatKey);
                        setShowEditLokasiModal(true);
                      }}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition"
                      title="Edit Lokasi"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => {
                        setTargetLokasi(tempatKey);
                        setShowDeleteLokasiModal(true);
                      }}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition"
                      title="Hapus Lokasi"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {groupedList[tempatKey].sort((a,b) => a.bulanKe - b.bulanKe).map((k) => (
                  <Link 
                    key={k.id}
                    href={`/admin/absensi/tabirot/${k.id}`}
                    className="flex flex-col justify-between rounded-[var(--radius-xl)] bg-white p-5 border border-[var(--color-surface-dark)] transition-transform hover:-translate-y-1 hover:shadow-md group"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3 border-b border-[var(--color-surface-dark)] pb-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-pink-100 px-3 py-1 text-xs font-bold text-pink-700 uppercase tracking-wider">
                          Bulan ke-{k.bulanKe}
                        </span>
                        {!k.isActive && (
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded-md text-[10px] font-bold">NONAKTIF</span>
                        )}
                      </div>
                      <h4 className="font-bold text-[var(--color-text)] text-lg mb-1 group-hover:text-blue-600 transition-colors">
                        {k.tempat}
                      </h4>
                    </div>
                    <div className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-muted)]">
                      <Users size={16} className="text-blue-500" />
                      {k._count?.anggotaList || 0} Santri Anggota
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Tambah Kelompok */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-[var(--radius-2xl)] shadow-xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-[var(--color-surface-dark)]">
              <h3 className="text-lg font-bold text-[var(--color-text)]">Tambah Kelompok Ta'birot</h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-2">Nama Tempat</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Qoah Baharun"
                  value={tempat}
                  onChange={(e) => setTempat(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-surface-dark)] bg-[var(--color-surface-light)] px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-2">Bulan Ke-</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={bulanKe}
                  onChange={(e) => setBulanKe(parseInt(e.target.value) || 1)}
                  className="w-full rounded-xl border border-[var(--color-surface-dark)] bg-[var(--color-surface-light)] px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
                />
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-[var(--color-surface-dark)]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2 text-sm font-bold text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] rounded-full transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !tempat}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-full transition disabled:opacity-50"
                >
                  {isSubmitting ? "Menyimpan..." : "Simpan Kelompok"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Lokasi */}
      {showEditLokasiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-[var(--radius-2xl)] shadow-xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-[var(--color-surface-dark)]">
              <h3 className="text-lg font-bold text-[var(--color-text)]">Edit Nama Lokasi</h3>
              <button 
                onClick={() => setShowEditLokasiModal(false)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditLokasi} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-2">Nama Lokasi Baru</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Qoah Baharun"
                  value={newLokasiName}
                  onChange={(e) => setNewLokasiName(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-surface-dark)] bg-[var(--color-surface-light)] px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
                />
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-[var(--color-surface-dark)]">
                <button
                  type="button"
                  onClick={() => setShowEditLokasiModal(false)}
                  className="px-5 py-2 text-sm font-bold text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] rounded-full transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newLokasiName || newLokasiName === targetLokasi}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-full transition disabled:opacity-50"
                >
                  {isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Hapus Lokasi */}
      {showDeleteLokasiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-[var(--radius-2xl)] shadow-xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-[var(--color-surface-dark)]">
              <h3 className="text-lg font-bold text-red-600">Hapus Lokasi</h3>
              <button 
                onClick={() => setShowDeleteLokasiModal(false)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100/50 text-sm">
                Apakah Anda yakin ingin menghapus lokasi <strong className="font-bold">{targetLokasi}</strong>? Tindakan ini akan menghapus semua kelompok yang berada di lokasi ini beserta data di dalamnya secara permanen.
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-[var(--color-surface-dark)]">
                <button
                  type="button"
                  onClick={() => setShowDeleteLokasiModal(false)}
                  className="px-5 py-2 text-sm font-bold text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] rounded-full transition"
                >
                  Batal
                </button>
                <button
                  onClick={handleDeleteLokasi}
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-full transition disabled:opacity-50"
                >
                  {isSubmitting ? "Menghapus..." : "Ya, Hapus"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
