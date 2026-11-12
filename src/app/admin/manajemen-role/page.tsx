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
  { id: "absen_kelas_koreksi", label: "Absen Kelas (Koreksi)", desc: "Akses menyimpan koreksi absen kelas di luar hari ini dan di luar jendela sesi (seperti ADMIN, tanpa hak admin lainnya)", category: "Divisi Absensi", type: "aksi" },
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
  { id: "scan_absen_kegiatan", label: "Scan Absen Kegiatan", desc: "Akses scan QR kehadiran di gerbang (tanpa bisa membuka/menutup sesi)", category: "Divisi Absensi", type: "aksi" },

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
  { id: "nadi_hufadz", label: "Nadi Hufadz (Lihat)", desc: "Akses melihat data Nadi Hufadz", category: "Divisi Syahadah", type: "lihat" },
  { id: "nadi_hufadz_edit", label: "Nadi Hufadz (Aksi)", desc: "Akses mengelola peserta, setoran, tasmi', template & cetak Nadi Hufadz", category: "Divisi Syahadah", type: "aksi" },
  { id: "tadrib_funun", label: "Tadrib Funun (Lihat)", desc: "Akses melihat data Tadrib Funun", category: "Divisi Syahadah", type: "lihat" },
  { id: "tadrib_funun_edit", label: "Tadrib Funun (Aksi)", desc: "Akses mengelola jenis, peserta, absen, penerbitan syahadah, template & cetak Tadrib Funun", category: "Divisi Syahadah", type: "aksi" },
  { id: "ubudiyah", label: "Ubudiyah (Lihat)", desc: "Akses melihat data Qism Ubudiyah dan rekap absensi ubudiyah", category: "Divisi Absensi", type: "lihat" },
  { id: "ubudiyah_edit", label: "Ubudiyah (Aksi)", desc: "Akses menunjuk dan menonaktifkan Qism Ubudiyah", category: "Divisi Absensi", type: "aksi" },
  { id: "huffadz", label: "Tasmi' Huffadz (Lihat)", desc: "Akses melihat penilaian tasmi' Markaz Huffadz", category: "Divisi Syahadah", type: "lihat" },
  { id: "huffadz_edit", label: "Tasmi' Huffadz (Aksi)", desc: "Akses input, edit & hapus penilaian tasmi' Markaz Huffadz", category: "Divisi Syahadah", type: "aksi" },
  { id: "input_tasmi", label: "Input Tasmi' (Lihat)", desc: "Akses melihat status tasmi' santri dan input nilai kolom tasmi'", category: "Divisi Syahadah", type: "lihat" },
  { id: "input_tasmi_edit", label: "Input Tasmi' (Aksi)", desc: "Akses mem-bypass otomatisasi centang status tasmi' secara manual", category: "Divisi Syahadah", type: "aksi" },
  { id: "tasmi_config", label: "Konfigurasi Tasmi' (Aksi)", desc: "Akses mengatur kolom mana dari mapel mana saja yang menjadi syarat mutlak Tasmi'", category: "Divisi Syahadah", type: "aksi" },

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
  { id: "konten_instagram_edit", label: "Konten Instagram (Aksi)", desc: "Akses mengelola feed instagram", category: "Manajemen Aplikasi", type: "aksi" },
  { id: "arsip_galeri", label: "Arsip Galeri", desc: "Akses mengelola arsip galeri (judul + link Google Drive)", category: "Manajemen Aplikasi", type: "aksi" },
  { id: "notifikasi_kelola", label: "Notifikasi Pengumuman", desc: "Akses mengelola template pengirim, jadwal pengumuman, dan riwayat pengiriman notifikasi ke santri", category: "Manajemen Aplikasi", type: "aksi" },

  // Divisi Kebahasaan
  { id: "mukholif_lughoh", label: "Mukholif Lughoh (Lihat)", desc: "Akses melihat daftar laporan pelanggaran bahasa", category: "Divisi Kebahasaan", type: "lihat" },
  { id: "mukholif_lughoh_edit", label: "Mukholif Lughoh (Aksi)", desc: "Akses melakukan tabayun/verifikasi pelanggaran bahasa", category: "Divisi Kebahasaan", type: "aksi" },
  { id: "lajnah_manage", label: "Kelola Lajnah", desc: "Akses mengelola anggota lajnah pengeksekusi iqob", category: "Divisi Kebahasaan", type: "aksi" },
  { id: "lajnah_syahadah", label: "Cetak Syahadah Lajnah", desc: "Akses mencetak syahadah anggota Lajnah dan mengatur template & layout-nya", category: "Divisi Kebahasaan", type: "aksi" },
  { id: "osim_manage", label: "Kelola OSIM", desc: "Akses mengelola anggota OSIM dan pemilihan OSIM Markaz Turats", category: "Markaz Turats", type: "aksi" },
  { id: "osim_syahadah", label: "Cetak Syahadah OSIM", desc: "Akses mencetak syahadah anggota OSIM dan mengatur template & layout-nya", category: "Markaz Turats", type: "aksi" },
  { id: "jasus_manage", label: "Kelola Jasus", desc: "Akses mengelola anggota jasus pelapor pelanggaran bahasa", category: "Divisi Kebahasaan", type: "aksi" },
  { id: "monitoring_mukholif", label: "Monitoring Mukholif", desc: "Akses dashboard monitoring eksekusi iqob", category: "Divisi Kebahasaan", type: "lihat" }
];

export default function ManajemenRolePage() {
  const [mode, setMode] = useState<"role" | "user">("role");
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
            Tab &ldquo;Per User&rdquo; memberi atau mencabut izin untuk satu user tertentu, tanpa mengubah role-nya.
          </p>
        </div>
        {/* Saklar Per Role / Per User */}
        <div className="flex rounded-xl border border-[var(--color-surface-dark)] bg-white p-1 shrink-0">
          {(["role", "user"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                mode === m
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              {m === "role" ? "Per Role" : "Per User"}
            </button>
          ))}
        </div>
      </div>

      {mode === "user" ? (
        <UserPermissionsSection />
      ) : (
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
      )}
    </div>
  );
}

// ================= IZIN KHUSUS PER USER =================
// Memberi (GRANT) atau mencabut (DENY) izin untuk satu user tertentu,
// tanpa mengubah role-nya. Tanpa override, user mengikuti izin role-nya.
// DENY mengalahkan izin role; GRANT menambah izin di luar role.
type UserCari = { id: string; nama: string; username: string; role: string };
type UserDetail = {
  user: UserCari;
  rolePermissions: string[];
  overrides: { permission: string; jenis: "GRANT" | "DENY"; diberikanOleh: string | null; createdAt: string }[];
};

function UserPermissionsSection() {
  const [q, setQ] = useState("");
  const [hasil, setHasil] = useState<UserCari[]>([]);
  const [mencari, setMencari] = useState(false);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [overrides, setOverrides] = useState<Record<string, "GRANT" | "DENY">>({});
  const [memuat, setMemuat] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);

  const cari = async (nilai: string) => {
    setQ(nilai);
    if (nilai.trim().length < 2) {
      setHasil([]);
      return;
    }
    setMencari(true);
    try {
      const res = await fetch(`/api/admin/user-permissions?search=${encodeURIComponent(nilai.trim())}`);
      const json = await res.json();
      setHasil(json.users || []);
    } catch {
      setHasil([]);
    } finally {
      setMencari(false);
    }
  };

  const pilih = async (u: UserCari) => {
    setMemuat(true);
    try {
      const res = await fetch(`/api/admin/user-permissions?userId=${encodeURIComponent(u.id)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat izin user");
      setDetail(json);
      const map: Record<string, "GRANT" | "DENY"> = {};
      (json.overrides || []).forEach((o: { permission: string; jenis: "GRANT" | "DENY" }) => {
        map[o.permission] = o.jenis;
      });
      setOverrides(map);
    } catch (e: any) {
      toast.error(e.message || "Gagal memuat izin user");
    } finally {
      setMemuat(false);
    }
  };

  const setOverride = (permId: string, jenis: "GRANT" | "DENY" | null) => {
    setOverrides((prev) => {
      const next = { ...prev };
      if (jenis === null) delete next[permId];
      else next[permId] = jenis;
      return next;
    });
  };

  const simpan = async () => {
    if (!detail) return;
    setMenyimpan(true);
    try {
      const res = await fetch("/api/admin/user-permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: detail.user.id,
          overrides: Object.entries(overrides).map(([permission, jenis]) => ({ permission, jenis })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan");
      toast.success(`Izin khusus ${detail.user.nama} berhasil disimpan`);
    } catch (e: any) {
      toast.error(e.message || "Gagal menyimpan perubahan");
    } finally {
      setMenyimpan(false);
    }
  };

  const roleSet = new Set(detail?.rolePermissions || []);
  const efektif = (permId: string) => {
    if (overrides[permId] === "GRANT") return true;
    if (overrides[permId] === "DENY") return false;
    return roleSet.has(permId);
  };
  const jumlahOverride = Object.keys(overrides).length;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[var(--color-surface-dark)] overflow-hidden p-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[var(--color-text)]">Izin Khusus Per User</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Cari user berdasarkan nama atau username, lalu atur izin khususnya.{" "}
          <strong>Diberi</strong> menambah izin di luar role-nya, <strong>Dicabut</strong> mencabut izin yang
          dimiliki role-nya, <strong>Sesuai role</strong> menghapus override dan kembali ke aturan role.
          Perubahan berlaku langsung setelah disimpan (tanpa login ulang).
        </p>
      </div>

      <div>
        <input
          type="text"
          value={q}
          onChange={(e) => cari(e.target.value)}
          placeholder="Ketik minimal 2 huruf nama atau username..."
          className="w-full md:w-96 px-3 py-2.5 border border-slate-300 rounded-xl text-sm"
        />
        {mencari && <p className="text-xs text-[var(--color-text-muted)] mt-2">Mencari...</p>}
        {hasil.length > 0 && (
          <div className="mt-2 w-full md:w-96 rounded-xl border border-[var(--color-surface-dark)] divide-y overflow-hidden">
            {hasil.map((u) => (
              <button
                key={u.id}
                onClick={() => pilih(u)}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 ${
                  detail?.user.id === u.id ? "bg-[var(--color-primary-50)] font-bold" : ""
                }`}
              >
                {u.nama} <span className="text-[var(--color-text-muted)]">(@{u.username} • {u.role.replace("_", " ")})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {memuat && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-500" /> Memuat izin user...
        </div>
      )}

      {detail && !memuat && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--color-surface)]">
            <div>
              <h3 className="text-lg font-bold text-[var(--color-text)]">
                {detail.user.nama} <span className="text-sm font-normal text-[var(--color-text-muted)]">@{detail.user.username}</span>
              </h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                Role: <strong>{detail.user.role.replace("_", " ")}</strong>
                {jumlahOverride > 0 && (
                  <> • <span className="text-amber-700 font-bold">{jumlahOverride} override khusus</span></>
                )}
              </p>
            </div>
            <button
              onClick={simpan}
              disabled={menyimpan}
              className="flex items-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
            >
              {menyimpan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save size={18} />}
              Simpan Izin User
            </button>
          </div>

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
                  {perms.map((perm) => {
                    const dariRole = roleSet.has(perm.id);
                    const ov = overrides[perm.id] || null;
                    const ya = efektif(perm.id);
                    return (
                      <div
                        key={perm.id}
                        className={`p-4 rounded-xl border transition-all ${
                          ov
                            ? "bg-amber-50 border-amber-300 shadow-sm"
                            : ya
                              ? "bg-[var(--color-primary-50)] border-[var(--color-primary-100)]"
                              : "bg-white border-[var(--color-surface-dark)]"
                        }`}
                      >
                        <p className="text-sm font-bold text-[var(--color-text)]">{perm.label}</p>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">{perm.desc}</p>
                        <p className="text-xs mt-2">
                          <span className="text-[var(--color-text-muted)]">Dari role: </span>
                          <strong className={dariRole ? "text-emerald-700" : "text-slate-500"}>
                            {dariRole ? "YA" : "TIDAK"}
                          </strong>
                          {" • "}
                          <span className="text-[var(--color-text-muted)]">Efektif: </span>
                          <strong className={ya ? "text-emerald-700" : "text-red-600"}>
                            {ya ? "YA" : "TIDAK"}
                          </strong>
                          {ov && (
                            <span className="ml-2 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                              {ov === "GRANT" ? "DIBERI KHUSUS" : "DICABUT KHUSUS"}
                            </span>
                          )}
                        </p>
                        <div className="flex gap-1.5 mt-3">
                          {([
                            [null, "Sesuai role"],
                            ["GRANT", "Diberi"],
                            ["DENY", "Dicabut"],
                          ] as const).map(([nilai, label]) => (
                            <button
                              key={label}
                              onClick={() => setOverride(perm.id, nilai)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                ov === nilai || (nilai === null && !ov)
                                  ? nilai === "DENY"
                                    ? "bg-red-600 text-white"
                                    : nilai === "GRANT"
                                      ? "bg-emerald-600 text-white"
                                      : "bg-slate-700 text-white"
                                  : "bg-white border border-slate-300 text-[var(--color-text-muted)] hover:border-slate-400"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
