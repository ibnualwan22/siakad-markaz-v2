"use client";

import { useState, useEffect } from "react";
import { UserCog, Plus, Search, Pencil, Trash2, Shield, Loader2, CheckCircle2, XCircle, Calendar, GraduationCap, X, Home } from "lucide-react";
import toast from "react-hot-toast";

type User = {
  id: string;
  nama: string;
  username: string;
  role: string;
  kelasId: string | null;
  sakan: string | null;
  noHp: string | null;
  isActive: boolean;
  kelas?: { nama: string };
};

type Kelas = {
  id: string;
  nama: string;
};

type PengajarAssignment = {
  id: string;
  kelasId: string;
  sesi: string;
  kelas: { nama: string };
};

const SESI_OPTIONS = [
  { value: "SESI_1", label: "Hissoh Ula (Sesi 1)" },
  { value: "SESI_2", label: "Hissoh Tsaniah (Sesi 2)" },
  { value: "SESI_3", label: "Hissoh Tsalisah (Sesi 3)" },
  { value: "SESI_4", label: "Hissoh Robi'ah (Sesi 4)" },
  { value: "SESI_5", label: "Hissoh Khomisah (Sesi 5)" },
  { value: "SESI_6", label: "Hissoh Sadisah (Sesi 6)" }
];

export default function ManajemenUserPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<string[]>(["ADMIN", "WALI_KELAS", "PENGAJAR", "KSU"]);
  const [rolePermissions, setRolePermissions] = useState<{ role: string, permission: string }[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [sakanList, setSakanList] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Plotting Sesi State
  const [isPlottingModalOpen, setIsPlottingModalOpen] = useState(false);
  const [activePlottingUser, setActivePlottingUser] = useState<User | null>(null);
  const [plottingAssignments, setPlottingAssignments] = useState<{ kelasId: string; sesi: string }[]>([]);
  const [tempKelasId, setTempKelasId] = useState("");
  const [tempSesi, setTempSesi] = useState("");
  const [isSavingPlotting, setIsSavingPlotting] = useState(false);

  // Sakan Link State
  const [isSakanModalOpen, setIsSakanModalOpen] = useState(false);
  const [activeSakanUser, setActiveSakanUser] = useState<User | null>(null);
  const [tempSakan, setTempSakan] = useState("");
  const [isSavingSakan, setIsSavingSakan] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    id: "",
    nama: "",
    username: "",
    password: "",
    role: "PENGAJAR",
    kelasId: "",
    sakan: "",
    noHp: "",
    isActive: true,
  });

  const isEditing = !!formData.id;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [usersRes, kelasRes, rolesRes, sakanRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/kelas"),
        fetch("/api/admin/roles"),
        fetch("/api/admin/sakan-list")
      ]);

      if (usersRes.ok) setUsers(await usersRes.json());
      if (kelasRes.ok) setKelasList(await kelasRes.json());
      if (sakanRes.ok) setSakanList(await sakanRes.json());

      if (rolesRes.ok) {
        const { roles: apiRoles, permissions: apiPerms } = await rolesRes.json();
        setRoles(apiRoles);
        if (apiPerms) setRolePermissions(apiPerms);
      }
    } catch (error) {
      toast.error("Gagal mengambil data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (user?: User) => {
    if (user) {
      setFormData({
        id: user.id,
        nama: user.nama,
        username: user.username,
        password: "", // Kosongkan saat edit
        role: user.role,
        kelasId: user.kelasId || "",
        sakan: user.sakan || "",
        noHp: user.noHp || "",
        isActive: user.isActive,
      });
    } else {
      setFormData({
        id: "",
        nama: "",
        username: "",
        password: "",
        role: "PENGAJAR",
        kelasId: "",
        sakan: "",
        noHp: "",
        isActive: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = isEditing ? `/api/admin/users/${formData.id}` : "/api/admin/users";
      const method = isEditing ? "PUT" : "POST";

      const payload: any = { ...formData };
      if (!payload.kelasId) payload.kelasId = null;
      if (!payload.sakan) payload.sakan = null;
      
      if (!payload.noHp) {
        payload.noHp = null;
      } else {
        // Format nomor HP ke 628...
        let hp = payload.noHp.replace(/\D/g, ""); // Hapus semua karakter non-angka
        if (hp.startsWith("0")) {
          hp = "62" + hp.substring(1);
        } else if (hp.startsWith("8")) {
          hp = "62" + hp;
        }
        payload.noHp = hp;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Gagal menyimpan data");

      toast.success(`User berhasil ${isEditing ? "diperbarui" : "ditambahkan"}`);
      setIsModalOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus user ini?")) return;

    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus user");

      toast.success("User berhasil dihapus");
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // Plotting Sesi Logic
  const handleOpenPlotting = async (user: User) => {
    setActivePlottingUser(user);
    setPlottingAssignments([]);
    setTempKelasId("");
    setTempSesi("");
    setIsPlottingModalOpen(true);

    try {
      const res = await fetch(`/api/admin/pengajar-sesi/${user.id}`);
      if (res.ok) {
        const data: PengajarAssignment[] = await res.json();
        setPlottingAssignments(data.map(d => ({ kelasId: d.kelasId, sesi: d.sesi })));
      }
    } catch (error) {
      toast.error("Gagal memuat jadwal mengajar");
    }
  };

  const handleAddPlotting = () => {
    if (!tempKelasId || !tempSesi) {
      toast.error("Pilih Kelas dan Sesi terlebih dahulu");
      return;
    }

    const exist = plottingAssignments.some(
      a => a.kelasId === tempKelasId && a.sesi === tempSesi
    );

    if (exist) {
      toast.error("Jadwal ini sudah dimasukkan");
      return;
    }

    setPlottingAssignments(prev => [...prev, { kelasId: tempKelasId, sesi: tempSesi }]);
    setTempSesi(""); // Reset sesi agar mudah pilih sesi lain
  };

  const handleRemovePlotting = (index: number) => {
    setPlottingAssignments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSavePlotting = async () => {
    if (!activePlottingUser) return;
    setIsSavingPlotting(true);

    try {
      const res = await fetch(`/api/admin/pengajar-sesi/${activePlottingUser.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments: plottingAssignments }),
      });

      if (!res.ok) throw new Error("Gagal menyimpan alokasi mengajar");

      toast.success("Jadwal mengajar berhasil diperbarui!");
      setIsPlottingModalOpen(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSavingPlotting(false);
    }
  };

  const handleOpenSakanModal = (user: User) => {
    setActiveSakanUser(user);
    setTempSakan(user.sakan || "");
    setIsSakanModalOpen(true);
  };

  const handleSaveSakan = async () => {
    if (!activeSakanUser) return;
    setIsSavingSakan(true);
    try {
      const payload = {
        ...activeSakanUser,
        sakan: tempSakan || null,
        password: "" // Don't update password
      };

      const res = await fetch(`/api/admin/users/${activeSakanUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan Sakan");

      toast.success("Sakan berhasil dihubungkan!");
      setIsSakanModalOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSavingSakan(false);
    }
  };

  const filteredUsers = users.filter((u) =>
    u.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "ADMIN": return "bg-rose-100 text-rose-700 border-rose-200";
      case "WALI_KELAS": return "bg-blue-100 text-blue-700 border-blue-200";
      case "PENGAJAR": return "bg-amber-100 text-amber-700 border-amber-200";
      case "KSU": return "bg-purple-100 text-purple-700 border-purple-200";
      default: return "bg-[var(--color-primary-100)] text-[var(--color-primary)] border-[var(--color-primary-100)]"; // custom dynamic roles
    }
  };

  const canPlotSesi = (role: string) => {
    if (role === "PENGAJAR" || role === "WALI_KELAS") return true;
    const hasAccess = rolePermissions.some(p => p.role === role && (p.permission === "absen_kelas" || p.permission === "manajemen_sesi"));
    return hasAccess;
  };

  const canSetSakan = (role: string) => {
    if (role === "KSU") return true;
    const hasAccess = rolePermissions.some(p => p.role === role && (p.permission === "absen_sakan" || p.permission === "absen_kegiatan"));
    return hasAccess;
  };

  const existingUserForClass = formData.kelasId ? users.find(u => u.kelasId === formData.kelasId && u.id !== formData.id) : null;
  const selectedKelas = formData.kelasId ? kelasList.find(k => k.id === formData.kelasId) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)] flex items-center gap-2">
            <UserCog className="h-6 w-6 text-[var(--color-primary)]" />
            Manajemen User
          </h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">
            Kelola data dan tugas mengajar Wali Kelas, Pengajar, KSU, dan role kustom lainnya.
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus size={18} />
          Tambah User
        </button>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-[var(--color-surface-dark)] overflow-hidden">
        <div className="p-4 border-b border-[var(--color-surface-dark)] flex flex-col md:flex-row items-center gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-subtle)] h-5 w-5" />
            <input
              type="text"
              placeholder="Cari nama, username, atau role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-[var(--color-primary)]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-[var(--color-text-muted)] uppercase bg-[var(--color-secondary)]/50 border-b border-[var(--color-surface-dark)]">
                <tr>
                  <th className="px-6 py-4 font-semibold">Nama / Username</th>
                  <th className="px-6 py-4 font-semibold">Role</th>
                  <th className="px-6 py-4 font-semibold">Hubungan Tugas</th>
                  <th className="px-6 py-4 font-semibold text-center">Status</th>
                  <th className="px-6 py-4 font-semibold text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-[var(--color-text-muted)]">
                      Tidak ada data user ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-[var(--color-secondary)]/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-[var(--color-text)]">{user.nama}</div>
                        <div className="text-[var(--color-text-muted)] text-xs">@{user.username}</div>
                        {user.noHp && (
                          <div className="text-[var(--color-text-subtle)] text-xs mt-0.5">📱 {user.noHp}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getRoleBadgeColor(user.role)}`}>
                          {user.role.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-[var(--color-text-muted)]">
                        {user.role === "WALI_KELAS" && (
                          <div className="mb-2">
                            <span>Wali: {user.kelas?.nama || <span className="text-rose-500 font-semibold">Belum diset</span>}</span>
                          </div>
                        )}
                        {canSetSakan(user.role) && (
                          <div className="mb-2">
                            <span>Sakan Default: {user.sakan || <span className="text-rose-500 font-semibold">Belum diset</span>}</span>
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {canPlotSesi(user.role) && (
                            <button
                              onClick={() => handleOpenPlotting(user)}
                              className="flex items-center gap-1 bg-[var(--color-primary-50)] hover:bg-[var(--color-primary-100)] text-[var(--color-primary)] font-bold px-2.5 py-1 rounded-lg border border-[var(--color-primary-100)] transition-colors"
                            >
                              <Calendar size={12} />
                              Plotting Sesi
                            </button>
                          )}
                          {canSetSakan(user.role) && (
                            <button
                              onClick={() => handleOpenSakanModal(user)}
                              className="flex items-center gap-1 bg-violet-50 hover:bg-violet-100 text-violet-700 font-bold px-2.5 py-1 rounded-lg border border-violet-200 transition-colors"
                            >
                              <Home size={12} />
                              Hubungkan Sakan
                            </button>
                          )}
                        </div>
                        {!canPlotSesi(user.role) && !canSetSakan(user.role) && user.role !== "WALI_KELAS" && (
                          <span className="text-[var(--color-text-subtle)]">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {user.isActive ? (
                          <div className="flex items-center justify-center gap-1 text-[var(--color-primary)] font-medium">
                            <CheckCircle2 size={16} /> <span className="text-xs">Aktif</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1 text-[var(--color-text-subtle)] font-medium">
                            <XCircle size={16} /> <span className="text-xs">Nonaktif</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenModal(user)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit User"
                          >
                            <Pencil size={18} />
                          </button>
                          {user.username !== "admin" && (
                            <button
                              onClick={() => handleDelete(user.id)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Hapus User"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--color-surface)] flex justify-between items-center bg-[var(--color-secondary)]/50">
              <h2 className="text-lg font-bold text-[var(--color-text)] flex items-center gap-2">
                <Shield className="h-5 w-5 text-[var(--color-primary)]" />
                {isEditing ? "Edit User" : "Tambah User Baru"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-[var(--color-text-subtle)] hover:text-[var(--color-text-muted)]">
                <XCircle size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--color-text)] mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={formData.nama}
                  onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--color-surface-dark)] rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                  placeholder="Misal: Ust. Fulan"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--color-text)] mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--color-surface-dark)] rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                  placeholder="Hanya huruf dan angka, tanpa spasi"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                  Password {isEditing && <span className="text-[var(--color-text-subtle)] font-normal">(Kosongkan jika tidak diubah)</span>}
                </label>
                <input
                  type="password"
                  required={!isEditing}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--color-surface-dark)] rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                  placeholder="Minimal 6 karakter"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                  Nomor HP (WhatsApp) <span className="text-[var(--color-text-subtle)] font-normal">(Opsional)</span>
                </label>
                <input
                  type="text"
                  value={formData.noHp}
                  onChange={(e) => setFormData({ ...formData, noHp: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--color-surface-dark)] rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                  placeholder="Contoh: 081234567890"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--color-text)] mb-1">Role Akun</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value, kelasId: "", sakan: "" })}
                  className="w-full px-3 py-2 border border-[var(--color-surface-dark)] rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                >
                  {roles.map(role => (
                    <option key={role} value={role}>{role.replace("_", " ")}</option>
                  ))}
                </select>
              </div>

              {/* Wali Kelas / Custom Role Option for assigning a main class */}
              {(formData.role === "WALI_KELAS" || (!["ADMIN", "KSU", "PENGAJAR"].includes(formData.role) && canPlotSesi(formData.role))) && (
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                    Hubungkan ke Kelas Utama (Opsional untuk Role Custom)
                  </label>
                  <select
                    required={formData.role === "WALI_KELAS"}
                    value={formData.kelasId}
                    onChange={(e) => setFormData({ ...formData, kelasId: e.target.value })}
                    className="w-full px-3 py-2 border border-[var(--color-surface-dark)] rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Pilih Kelas --</option>
                    {kelasList.map(k => (
                      <option key={k.id} value={k.id}>{k.nama}</option>
                    ))}
                  </select>
                  {existingUserForClass && selectedKelas && (
                    <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs text-amber-800">
                        <span className="font-bold">Catatan:</span> Kelas <strong>{selectedKelas.nama}</strong> saat ini sudah terhubung dengan <strong>{existingUserForClass.nama}</strong>. Jika Anda menyimpan, maka user tersebut akan ditimpa.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {canSetSakan(formData.role) && (
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text)] mb-1">Hubungkan Sakan (Default)</label>
                  <select
                    value={formData.sakan}
                    onChange={(e) => setFormData({ ...formData, sakan: e.target.value })}
                    className="w-full px-3 py-2 border border-[var(--color-surface-dark)] rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Pilih Sakan --</option>
                    {sakanList.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              )}

              {isEditing && (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded border-slate-300 text-[var(--color-primary)] focus:ring-emerald-500"
                  />
                  <label htmlFor="isActive" className="text-sm font-semibold text-[var(--color-text)]">Akun Aktif</label>
                </div>
              )}

              <div className="pt-4 border-t border-[var(--color-surface)] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] rounded-lg transition-colors flex items-center gap-2"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Simpan User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Plotting Sesi Modal */}
      {isPlottingModalOpen && activePlottingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--color-surface)] flex justify-between items-center bg-[var(--color-secondary)]/50">
              <h2 className="text-lg font-bold text-[var(--color-text)] flex items-center gap-2">
                <Calendar className="h-5 w-5 text-[var(--color-primary)]" />
                Plotting Sesi & Kelas Mengajar
              </h2>
              <button onClick={() => setIsPlottingModalOpen(false)} className="text-[var(--color-text-subtle)] hover:text-[var(--color-text-muted)]">
                <XCircle size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-[var(--color-secondary)] p-3 rounded-xl border border-[var(--color-surface-dark)]">
                <p className="text-xs text-[var(--color-text-muted)]">Nama Pengajar</p>
                <p className="font-bold text-[var(--color-text)]">{activePlottingUser.nama}</p>
                <p className="text-xs text-[var(--color-text-muted)]">@{activePlottingUser.username}</p>
              </div>

              {/* Form Input Plotting */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end bg-[var(--color-primary-50)]/30 p-3 rounded-xl border border-emerald-100">
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-[var(--color-text)] mb-1">Kelas</label>
                  <select
                    value={tempKelasId}
                    onChange={(e) => setTempKelasId(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="">-- Pilih Kelas --</option>
                    {kelasList.map(k => (
                      <option key={k.id} value={k.id}>{k.nama}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-[var(--color-text)] mb-1">Sesi Mengajar</label>
                  <select
                    value={tempSesi}
                    onChange={(e) => setTempSesi(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="">-- Pilih Sesi --</option>
                    {SESI_OPTIONS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleAddPlotting}
                  className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-bold py-1.5 px-3 rounded-lg text-xs flex justify-center items-center gap-1"
                >
                  <Plus size={14} /> Tambah
                </button>
              </div>

              {/* List assignments */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--color-text-muted)]">Jadwal yang Ditugaskan</p>
                <div className="border border-[var(--color-surface-dark)] rounded-xl overflow-y-auto max-h-48 divide-y divide-slate-100">
                  {plottingAssignments.length === 0 ? (
                    <p className="text-xs text-[var(--color-text-subtle)] text-center py-8">Belum ada kelas & sesi yang diplotting.</p>
                  ) : (
                    plottingAssignments.map((assign, index) => {
                      const kelasObj = kelasList.find(k => k.id === assign.kelasId);
                      const sesiObj = SESI_OPTIONS.find(s => s.value === assign.sesi);
                      return (
                        <div key={index} className="flex items-center justify-between p-3 hover:bg-[var(--color-secondary)]/50">
                          <div>
                            <p className="text-xs font-bold text-[var(--color-text)]">{kelasObj?.nama || "Kelas tidak ditemukan"}</p>
                            <p className="text-[11px] text-[var(--color-text-muted)]">{sesiObj?.label || assign.sesi}</p>
                          </div>
                          <button
                            onClick={() => handleRemovePlotting(index)}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-[var(--color-surface)] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsPlottingModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSavePlotting}
                  disabled={isSavingPlotting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] rounded-lg transition-colors flex items-center gap-2"
                >
                  {isSavingPlotting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Simpan Jadwal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sakan Modal */}
      {isSakanModalOpen && activeSakanUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--color-surface)] flex justify-between items-center bg-[var(--color-secondary)]/50">
              <h2 className="text-lg font-bold text-[var(--color-text)] flex items-center gap-2">
                <Home className="h-5 w-5 text-violet-600" />
                Hubungkan Sakan
              </h2>
              <button onClick={() => setIsSakanModalOpen(false)} className="text-[var(--color-text-subtle)] hover:text-[var(--color-text-muted)]">
                <XCircle size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-[var(--color-secondary)] p-3 rounded-xl border border-[var(--color-surface-dark)]">
                <p className="text-xs text-[var(--color-text-muted)]">Nama User</p>
                <p className="font-bold text-[var(--color-text)]">{activeSakanUser.nama}</p>
                <p className="text-xs text-[var(--color-text-muted)]">@{activeSakanUser.username}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--color-text)] mb-1">Sakan Default</label>
                <select
                  value={tempSakan}
                  onChange={(e) => setTempSakan(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">-- Tidak dihubungkan --</option>
                  {sakanList.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-[var(--color-surface)] flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsSakanModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveSakan}
                  disabled={isSavingSakan}
                  className="px-4 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors flex items-center gap-2"
                >
                  {isSavingSakan && <Loader2 className="h-4 w-4 animate-spin" />}
                  Simpan Sakan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
