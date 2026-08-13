"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, Save, Loader2, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

type RolePermission = {
  id: string;
  role: string;
  permission: string;
};

const AVAILABLE_PERMISSIONS = [
  // Utama
  { id: "dashboard", label: "Dashboard (Lihat)", desc: "Akses melihat halaman dashboard utama", category: "Utama", type: "lihat" },
  { id: "dashboard_edit", label: "Dashboard (Aksi)", desc: "Akses melakukan aksi/edit di dashboard", category: "Utama", type: "aksi" },
  { id: "jadwal_saya", label: "Jadwal Saya (Lihat)", desc: "Akses melihat jadwal mengajar sendiri", category: "Utama", type: "lihat" },
  { id: "jadwal_saya_edit", label: "Jadwal Saya (Aksi)", desc: "Akses mengubah jadwal mengajar sendiri", category: "Utama", type: "aksi" },

  // Divisi Angkatan (Duf'ah)
  { id: "manajemen_dufah", label: "Manajemen Angkatan & Usbu' (Lihat)", desc: "Akses melihat angkatan dan status usbu'", category: "Divisi Angkatan (Duf'ah)", type: "lihat" },
  { id: "manajemen_dufah_edit", label: "Manajemen Angkatan & Usbu' (Aksi)", desc: "Akses menambah, mengubah, dan menghapus angkatan/usbu'", category: "Divisi Angkatan (Duf'ah)", type: "aksi" },

  // Divisi Data Santri
  { id: "data_santri_dufah", label: "Data Santri Duf'ah (Lihat)", desc: "Akses melihat data santri duf'ah", category: "Divisi Data Santri", type: "lihat" },
  { id: "data_santri_dufah_edit", label: "Data Santri Duf'ah (Aksi)", desc: "Akses mengedit data santri duf'ah", category: "Divisi Data Santri", type: "aksi" },

  // Divisi Absensi
  { id: "absen_sakan", label: "Absen Sakan (Lihat)", desc: "Akses melihat absensi sakan", category: "Divisi Absensi", type: "lihat" },
  { id: "absen_sakan_edit", label: "Absen Sakan (Aksi)", desc: "Akses melakukan absensi sakan", category: "Divisi Absensi", type: "aksi" },
  { id: "absen_kelas", label: "Absen Kelas (Lihat)", desc: "Akses melihat absensi kelas", category: "Divisi Absensi", type: "lihat" },
  { id: "absen_kelas_edit", label: "Absen Kelas (Aksi)", desc: "Akses melakukan absensi kelas", category: "Divisi Absensi", type: "aksi" },
  { id: "manajemen_sesi", label: "Jadwal Buka/Tutup Sesi (Lihat)", desc: "Akses melihat jadwal sesi", category: "Divisi Absensi", type: "lihat" },
  { id: "manajemen_sesi_edit", label: "Jadwal Buka/Tutup Sesi (Aksi)", desc: "Akses mengatur jadwal sesi", category: "Divisi Absensi", type: "aksi" },
  { id: "absen_kegiatan", label: "Absen Kegiatan (Lihat)", desc: "Akses melihat absensi kegiatan", category: "Divisi Absensi", type: "lihat" },
  { id: "absen_kegiatan_edit", label: "Absen Kegiatan (Aksi)", desc: "Akses melakukan absensi kegiatan", category: "Divisi Absensi", type: "aksi" },
  { id: "absen_tabirot", label: "Absen Ta'birot", desc: "Akses melihat rekap dan melakukan absensi harian", category: "Divisi Absensi", type: "aksi" },
  { id: "absen_tabirot_edit", label: "Kelola Ta'birot", desc: "Akses menambahkan tempat dan memasukkan anggota santri", category: "Divisi Absensi", type: "aksi" },
  { id: "rekap_sakan", label: "Rekap Sakan (Lihat)", desc: "Akses melihat rekap absensi sakan", category: "Divisi Absensi", type: "lihat" },
  { id: "rekap_sakan_edit", label: "Rekap Sakan (Aksi)", desc: "Akses mendownload/mencetak rekap sakan", category: "Divisi Absensi", type: "aksi" },
  { id: "rekap_kegiatan", label: "Rekap Kegiatan (Lihat)", desc: "Akses melihat rekap absensi kegiatan", category: "Divisi Absensi", type: "lihat" },
  { id: "rekap_kegiatan_edit", label: "Rekap Kegiatan (Aksi)", desc: "Akses mendownload/mencetak rekap kegiatan", category: "Divisi Absensi", type: "aksi" },
  { id: "rekap_tabirot", label: "Rekap Ta'birot (Lihat)", desc: "Akses melihat rekap absensi ta'birot", category: "Divisi Absensi", type: "lihat" },
  { id: "rekap_tabirot_edit", label: "Rekap Ta'birot (Aksi)", desc: "Akses mendownload/mencetak rekap ta'birot", category: "Divisi Absensi", type: "aksi" },
  { id: "rekap_kelas", label: "Rekap Kelas (Lihat)", desc: "Akses melihat rekap absensi kelas", category: "Divisi Absensi", type: "lihat" },
  { id: "rekap_kelas_edit", label: "Rekap Kelas (Aksi)", desc: "Akses mendownload/mencetak rekap kelas", category: "Divisi Absensi", type: "aksi" },
  { id: "rekap_pengajar", label: "Rekap Pengajar (Lihat)", desc: "Akses melihat rekap absensi pengajar", category: "Divisi Absensi", type: "lihat" },
  { id: "rekap_pengajar_edit", label: "Rekap Pengajar (Aksi)", desc: "Akses mengubah jam / mengelola absen pengajar", category: "Divisi Absensi", type: "aksi" },
  { id: "pengaturan_kegiatan", label: "Pengaturan Kegiatan (Lihat)", desc: "Akses melihat jenis kegiatan absensi", category: "Divisi Absensi", type: "lihat" },
  { id: "pengaturan_kegiatan_edit", label: "Pengaturan Kegiatan (Aksi)", desc: "Akses menambah/mengedit jenis kegiatan absensi", category: "Divisi Absensi", type: "aksi" },

  // Divisi Perizinan
  { id: "perizinan_harian", label: "Izin Harian (Lihat)", desc: "Akses melihat & membuat izin harian kelas", category: "Divisi Perizinan", type: "lihat" },
  { id: "perizinan_harian_edit", label: "Izin Harian (Aksi)", desc: "Akses membuat/menghapus izin harian kelas", category: "Divisi Perizinan", type: "aksi" },
  { id: "perizinan_berhari", label: "Izin Kosong/Sakit (Lihat)", desc: "Akses melihat daftar izin berhari-hari", category: "Divisi Perizinan", type: "lihat" },
  { id: "perizinan_berhari_edit", label: "Izin Kosong/Sakit (Aksi)", desc: "Akses membuat tasrih izin berhari-hari", category: "Divisi Perizinan", type: "aksi" },
  { id: "perizinan_keluar_pare", label: "Izin Keluar Pare (Lihat)", desc: "Akses melihat izin keluar pare", category: "Divisi Perizinan", type: "lihat" },
  { id: "perizinan_keluar_pare_edit", label: "Izin Keluar Pare (Aksi)", desc: "Akses membuat tasrih izin keluar pare", category: "Divisi Perizinan", type: "aksi" },
  { id: "perizinan_tabirot", label: "Izin Ta'birot (Lihat)", desc: "Akses melihat izin ta'birot khusus", category: "Divisi Perizinan", type: "lihat" },
  { id: "perizinan_tabirot_edit", label: "Izin Ta'birot (Aksi)", desc: "Akses membuat tasrih izin ta'birot", category: "Divisi Perizinan", type: "aksi" },
  { id: "pengaturan_perizinan", label: "Pengaturan Perizinan", desc: "Akses menu pengaturan jam & config perizinan", category: "Divisi Perizinan", type: "lihat" },
  { id: "perizinan_data", label: "Data Santri Izin (Lihat)", desc: "Akses melihat data santri izin", category: "Divisi Perizinan", type: "lihat" },
  { id: "perizinan_data_edit", label: "Data Santri Izin (Aksi)", desc: "Akses konfirmasi kehadiran & approve request", category: "Divisi Perizinan", type: "aksi" },
  { id: "checkout_pengajuan", label: "Check Out Santri (Aksi)", desc: "Akses melihat dan merespon pengajuan check out santri", category: "Divisi Perizinan", type: "aksi" },
  { id: "checkout_config", label: "Konfigurasi Check Out (Aksi)", desc: "Akses menentukan siapa yang berwenang men-approve check out", category: "Divisi Perizinan", type: "aksi" },

  // Divisi Kelas
  { id: "alokasi_kelas", label: "Alokasi Kelas (Lihat)", desc: "Akses melihat alokasi kelas santri", category: "Divisi Kelas", type: "lihat" },
  { id: "alokasi_kelas_edit", label: "Alokasi Kelas (Aksi)", desc: "Akses memplotting kelas santri", category: "Divisi Kelas", type: "aksi" },
  { id: "ruang_kelas", label: "Manajemen Ruang Kelas (Lihat)", desc: "Akses melihat daftar ruang kelas", category: "Divisi Kelas", type: "lihat" },
  { id: "ruang_kelas_edit", label: "Manajemen Ruang Kelas (Aksi)", desc: "Akses menambah/mengedit ruang kelas", category: "Divisi Kelas", type: "aksi" },
  { id: "jadwal_mengajar", label: "Jadwal Mengajar (Lihat)", desc: "Akses melihat jadwal mengajar", category: "Divisi Kelas", type: "lihat" },
  { id: "jadwal_mengajar_edit", label: "Jadwal Mengajar (Aksi)", desc: "Akses mengatur jadwal mengajar pengajar", category: "Divisi Kelas", type: "aksi" },

  // Divisi Tauzi'
  { id: "tauzi_sesi", label: "Sesi Tauzi' (Lihat/Aksi)", desc: "Akses mengelola periode gelombang tes", category: "Divisi Tauzi'", type: "aksi" },
  { id: "tauzi_soal", label: "Bank Soal (Lihat/Aksi)", desc: "Akses mengelola soal ujian tauzi", category: "Divisi Tauzi'", type: "aksi" },
  { id: "tauzi_nilai", label: "Input Nilai Tahriri (Aksi)", desc: "Akses melihat dan menginput hasil ujian muqobalah / tahriri", category: "Divisi Tauzi'", type: "aksi" },
  { id: "tauzi_hasil", label: "Hasil Ujian (Lihat)", desc: "Akses melihat papan rekap data hasil tauzi'", category: "Divisi Tauzi'", type: "lihat" },
  { id: "tauzi_hasil_edit", label: "Hasil Ujian (Aksi Edit)", desc: "Akses memanipulasi (edit manual) nilai dari tabel laporan hasil ujian", category: "Divisi Tauzi'", type: "aksi" },

  // Divisi Syahadah
  { id: "data_syahadah", label: "Data Syahadah (Lihat)", desc: "Akses melihat data syahadah & profil santri", category: "Divisi Syahadah", type: "lihat" },
  { id: "data_syahadah_edit", label: "Data Syahadah (Aksi)", desc: "Akses mengedit data syahadah & profil santri", category: "Divisi Syahadah", type: "aksi" },
  { id: "syahadah_online", label: "Syahadah Online", desc: "Akses melihat, menambah, mengubah, mengatur dan mencetak syahadah online", category: "Divisi Syahadah", type: "aksi" },
  { id: "martabah_ula", label: "Martabah Ula (Lihat)", desc: "Akses melihat data santri Martabah Ula", category: "Divisi Syahadah", type: "lihat" },
  { id: "martabah_ula_edit", label: "Martabah Ula (Aksi)", desc: "Akses memproses data Martabah Ula", category: "Divisi Syahadah", type: "aksi" },
  { id: "haflah_wada", label: "Haflah Wada' (Lihat)", desc: "Akses melihat data Haflah Wada'", category: "Divisi Syahadah", type: "lihat" },
  { id: "haflah_wada_edit", label: "Haflah Wada' (Aksi)", desc: "Akses memproses data Haflah Wada'", category: "Divisi Syahadah", type: "aksi" },
  { id: "input_nilai", label: "Input Nilai (Lihat)", desc: "Akses melihat nilai santri", category: "Divisi Syahadah", type: "lihat" },
  { id: "input_nilai_edit", label: "Input Nilai (Aksi)", desc: "Akses menginput & mengubah nilai santri", category: "Divisi Syahadah", type: "aksi" },
  { id: "monitor_nilai_kosong", label: "Nilai Kosong (Lihat)", desc: "Akses melihat santri dengan nilai kosong", category: "Divisi Syahadah", type: "lihat" },
  { id: "monitor_nilai_kosong_edit", label: "Nilai Kosong (Aksi)", desc: "Akses menindaklanjuti nilai kosong", category: "Divisi Syahadah", type: "aksi" },
  { id: "cetak_nilai_pekanan", label: "Cetak Nilai Pekanan (Lihat)", desc: "Akses melihat cetakan nilai pekanan", category: "Divisi Syahadah", type: "lihat" },
  { id: "cetak_nilai_pekanan_edit", label: "Cetak Nilai Pekanan (Aksi)", desc: "Akses mencetak nilai pekanan", category: "Divisi Syahadah", type: "aksi" },
  { id: "thalib_mitsali", label: "Thalib Mitsali (Lihat)", desc: "Akses melihat halaman Thalib Mitsali (Peringkat 1)", category: "Divisi Syahadah", type: "lihat" },
  { id: "layout_syahadah", label: "Layout Syahadah (Lihat)", desc: "Akses melihat layout syahadah", category: "Divisi Syahadah", type: "lihat" },
  { id: "layout_syahadah_edit", label: "Layout Syahadah (Aksi)", desc: "Akses mendesain layout syahadah", category: "Divisi Syahadah", type: "aksi" },
  { id: "riwayat_santri", label: "Riwayat Santri (Lihat)", desc: "Akses melihat riwayat historis santri", category: "Divisi Syahadah", type: "lihat" },
  { id: "riwayat_santri_edit", label: "Riwayat Santri (Aksi)", desc: "Akses mengedit riwayat santri", category: "Divisi Syahadah", type: "aksi" },
  { id: "pengaturan_syahadah", label: "Pengaturan Syahadah (Lihat)", desc: "Akses melihat pengaturan syahadah", category: "Divisi Syahadah", type: "lihat" },
  { id: "pengaturan_syahadah_edit", label: "Pengaturan Syahadah (Aksi)", desc: "Akses mengubah pengaturan syahadah (Kop, TTD, Bobot Mapel)", category: "Divisi Syahadah", type: "aksi" },

  // Divisi CBT / Ujian
  { id: "ujian_usbu", label: "CBT / Ujian (Lihat)", desc: "Akses melihat monitoring sesi ujian dan bank soal", category: "Divisi CBT / Ujian", type: "lihat" },
  { id: "ujian_usbu_edit", label: "CBT / Ujian (Aksi)", desc: "Akses membuat ujian baru, mengedit bank soal, dan membuka sesi ujian globa", category: "Divisi CBT / Ujian", type: "aksi" },

  // Manajemen Aplikasi
  { id: "manajemen_user", label: "Manajemen User (Lihat)", desc: "Akses melihat daftar user", category: "Manajemen Aplikasi", type: "lihat" },
  { id: "manajemen_user_edit", label: "Manajemen User (Aksi)", desc: "Akses menambah, mengubah, dan menghapus user", category: "Manajemen Aplikasi", type: "aksi" },
  { id: "manajemen_role", label: "Hak Akses (Role) (Lihat)", desc: "Akses melihat daftar role & permission", category: "Manajemen Aplikasi", type: "lihat" },
  { id: "manajemen_role_edit", label: "Hak Akses (Role) (Aksi)", desc: "Akses mengubah hak akses role", category: "Manajemen Aplikasi", type: "aksi" },
  { id: "agenda_rutinan", label: "Agenda Rutinan (Lihat)", desc: "Akses melihat agenda rutinan", category: "Manajemen Aplikasi", type: "lihat" },
  { id: "agenda_rutinan_edit", label: "Agenda Rutinan (Aksi)", desc: "Akses mengelola agenda rutinan", category: "Manajemen Aplikasi", type: "aksi" },
  { id: "konten_instagram", label: "Konten Instagram (Lihat)", desc: "Akses melihat feed instagram", category: "Manajemen Aplikasi", type: "lihat" },
  { id: "konten_instagram_edit", label: "Konten Instagram (Aksi)", desc: "Akses mengelola feed instagram", category: "Manajemen Aplikasi", type: "aksi" }
];

export default function ManajemenRolePage() {
  const [roles, setRoles] = useState<string[]>([]);
  const [permissionsMap, setPermissionsMap] = useState<Record<string, Set<string>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeRole, setActiveRole] = useState("KSU");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Custom Role input
  const [newRoleName, setNewRoleName] = useState("");
  const [isAddingRole, setIsAddingRole] = useState(false);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/roles");
      if (!res.ok) throw new Error("Gagal mengambil data");
      const { roles: apiRoles, permissions }: { roles: string[], permissions: RolePermission[] } = await res.json();
      
      setRoles(apiRoles);
      
      const newMap: Record<string, Set<string>> = {};
      // Inisialisasi set kosong untuk tiap role
      apiRoles.forEach(r => {
        newMap[r] = new Set();
      });
      // Admin otomatis dapat semua permission
      if (newMap["ADMIN"]) {
        AVAILABLE_PERMISSIONS.forEach(p => newMap["ADMIN"].add(p.id));
      }
      
      permissions.forEach(p => {
        if (newMap[p.role]) {
          newMap[p.role].add(p.permission);
        }
      });
      
      setPermissionsMap(newMap);
      if (apiRoles.length > 0 && !apiRoles.includes(activeRole)) {
        setActiveRole(apiRoles[0]);
      }
    } catch (error) {
      toast.error("Gagal mengambil permissions");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = (permId: string) => {
    setPermissionsMap(prev => {
      const newMap = { ...prev };
      const roleSet = new Set(newMap[activeRole]);
      if (roleSet.has(permId)) {
        roleSet.delete(permId);
      } else {
        roleSet.add(permId);
      }
      newMap[activeRole] = roleSet;
      return newMap;
    });
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: activeRole,
          permissions: Array.from(permissionsMap[activeRole] || [])
        })
      });
      
      if (!res.ok) throw new Error("Gagal menyimpan");
      toast.success(`Permission ${activeRole} berhasil disimpan`);
    } catch (error) {
      toast.error("Gagal menyimpan perubahan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddRole = (e: React.FormEvent) => {
    e.preventDefault();
    const formattedRole = newRoleName.trim().toUpperCase().replace(/\s+/g, "_");
    if (!formattedRole) return;
    
    if (roles.includes(formattedRole)) {
      toast.error("Role sudah terdaftar");
      return;
    }
    
    setRoles(prev => [...prev, formattedRole]);
    setPermissionsMap(prev => ({
      ...prev,
      [formattedRole]: new Set()
    }));
    setActiveRole(formattedRole);
    setNewRoleName("");
    setIsAddingRole(false);
    toast.success(`Role ${formattedRole} berhasil ditambahkan ke daftar. Jangan lupa klik Simpan setelah memberi permission.`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)] flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-[var(--color-primary)]" />
            Manajemen Role & Permission
          </h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">
            Atur modul apa saja yang bisa diakses oleh masing-masing Role pengguna (Dinamis).
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-[var(--color-surface-dark)] overflow-hidden flex flex-col md:flex-row min-h-[500px]">
        {/* Sidebar Roles */}
        <div className="w-full md:w-64 bg-[var(--color-secondary)] border-r border-[var(--color-surface-dark)] p-4 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold text-[var(--color-text-subtle)] uppercase tracking-wider">Pilih Role</p>
            <button 
              onClick={() => setIsAddingRole(!isAddingRole)}
              className="text-xs flex items-center gap-1 text-[var(--color-primary)] hover:text-[var(--color-primary)] font-bold"
            >
              <Plus size={14} /> Baru
            </button>
          </div>

          {isAddingRole && (
            <form onSubmit={handleAddRole} className="mb-4 bg-white p-3 rounded-xl border border-[var(--color-surface-dark)] space-y-2">
              <input
                type="text"
                required
                placeholder="NAMA_ROLE"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs uppercase"
              />
              <div className="flex justify-end gap-2 text-xs">
                <button 
                  type="button" 
                  onClick={() => setIsAddingRole(false)} 
                  className="px-2 py-1 text-[var(--color-text-muted)] font-semibold"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="px-2 py-1 bg-[var(--color-primary)] text-white rounded font-semibold hover:bg-[var(--color-primary-dark)]"
                >
                  Tambah
                </button>
              </div>
            </form>
          )}

          <div className="flex flex-row md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0 flex-1">
            {roles.map(role => (
              <button
                key={role}
                onClick={() => setActiveRole(role)}
                className={`text-left px-4 py-3 rounded-xl text-sm font-semibold transition-all flex-shrink-0 ${
                  activeRole === role 
                    ? "bg-[var(--color-primary-100)] text-[var(--color-primary)] shadow-sm border border-[var(--color-primary-100)]" 
                    : "text-[var(--color-text-muted)] hover:bg-slate-200/50"
                }`}
              >
                {role.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        {/* Permissions Content */}
        <div className="flex-1 p-6 relative">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[var(--color-surface)]">
                <div>
                  <h2 className="text-lg font-bold text-[var(--color-text)]">
                    Hak Akses: {activeRole.replace("_", " ")}
                  </h2>
                  <p className="text-sm text-[var(--color-text-muted)]">Centang modul yang diizinkan untuk diakses.</p>
                </div>
                <button
                  onClick={handleSave}
                  disabled={isSubmitting || activeRole === "ADMIN"}
                  className="flex items-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] disabled:opacity-50 disabled:hover:bg-[var(--color-primary)] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save size={18} />}
                  Simpan Perubahan
                </button>
              </div>

              {activeRole === "ADMIN" && (
                <div className="bg-amber-50 text-amber-700 p-4 rounded-xl text-sm border border-amber-200 mb-6">
                  <strong>Peringatan:</strong> Role ADMIN secara otomatis memiliki semua akses. Anda tidak perlu mengatur permission untuk role ini.
                </div>
              )}

              <div className="space-y-8">
                {Object.entries(
                  AVAILABLE_PERMISSIONS.reduce((acc, perm) => {
                    if (!acc[perm.category]) acc[perm.category] = [];
                    acc[perm.category].push(perm);
                    return acc;
                  }, {} as Record<string, typeof AVAILABLE_PERMISSIONS>)
                ).map(([category, perms]) => (
                  <div key={category} className="space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-primary)] border-b border-slate-100 pb-2">
                      {category}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {perms.map(perm => (
                        <label 
                          key={perm.id} 
                          className={`flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer ${
                            permissionsMap[activeRole]?.has(perm.id) 
                              ? "bg-[var(--color-primary-50)] border-[var(--color-primary-100)] shadow-sm" 
                              : "bg-white border-[var(--color-surface-dark)] hover:border-slate-300"
                          } ${activeRole === "ADMIN" ? "opacity-70 pointer-events-none cursor-not-allowed" : ""}`}
                        >
                          <div className="pt-0.5">
                            <input
                              type="checkbox"
                              checked={permissionsMap[activeRole]?.has(perm.id) || false}
                              onChange={() => handleToggle(perm.id)}
                              disabled={activeRole === "ADMIN"}
                              className="w-5 h-5 rounded border-slate-300 text-[var(--color-primary)] focus:ring-emerald-500"
                            />
                          </div>
                          <div>
                            <p className={`text-sm font-bold ${permissionsMap[activeRole]?.has(perm.id) ? "text-[var(--color-primary-dark)]" : "text-[var(--color-text)]"}`}>
                              {perm.label}
                            </p>
                            <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                              {perm.desc}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
