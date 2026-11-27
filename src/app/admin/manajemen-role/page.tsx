"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ShieldCheck,
  Save,
  Loader2,
  Plus,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Check,
  Users,
  Shield,
  SlidersHorizontal,
} from "lucide-react";
import toast from "react-hot-toast";

type RolePermission = {
  id: string;
  role: string;
  permission: string;
};

type PermissionDef = {
  id: string;
  label: string;
  desc: string;
  category: string;
  type: "lihat" | "aksi";
};

const AVAILABLE_PERMISSIONS: PermissionDef[] = [
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
  { id: "reminder_pengajar_toggle", label: "Reminder Pengajar (Aktif/Nonaktif)", desc: "Akses mengaktifkan atau menonaktifkan cron pengingat WA bagi pengajar yang belum absen", category: "Divisi Absensi", type: "aksi" },
  { id: "pengaturan_kegiatan", label: "Pengaturan Kegiatan (Lihat)", desc: "Akses melihat jenis kegiatan absensi", category: "Divisi Absensi", type: "lihat" },
  { id: "pengaturan_kegiatan_edit", label: "Pengaturan Kegiatan (Aksi)", desc: "Akses menambah/mengedit jenis kegiatan absensi", category: "Divisi Absensi", type: "aksi" },
  { id: "scan_absen_kegiatan", label: "Scan Absen Kegiatan", desc: "Akses scan QR kehadiran di gerbang (tanpa bisa membuka/menutup sesi)", category: "Divisi Absensi", type: "aksi" },
  { id: "ubudiyah", label: "Ubudiyah (Lihat)", desc: "Akses melihat data Qism Ubudiyah dan rekap absensi ubudiyah", category: "Divisi Absensi", type: "lihat" },
  { id: "ubudiyah_edit", label: "Ubudiyah (Aksi)", desc: "Akses menunjuk dan menonaktifkan Qism Ubudiyah", category: "Divisi Absensi", type: "aksi" },

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
  { id: "huffadz", label: "Tasmi' Huffadz (Lihat)", desc: "Akses melihat penilaian tasmi' Markaz Huffadz", category: "Divisi Syahadah", type: "lihat" },
  { id: "huffadz_edit", label: "Tasmi' Huffadz (Aksi)", desc: "Akses input, edit & hapus penilaian tasmi' Markaz Huffadz", category: "Divisi Syahadah", type: "aksi" },
  { id: "input_tasmi", label: "Input Tasmi' (Lihat)", desc: "Akses melihat status tasmi' santri dan input nilai kolom tasmi'", category: "Divisi Syahadah", type: "lihat" },
  { id: "input_tasmi_edit", label: "Input Tasmi' (Aksi)", desc: "Akses mem-bypass otomatisasi centang status tasmi' secara manual", category: "Divisi Syahadah", type: "aksi" },
  { id: "tasmi_config", label: "Konfigurasi Tasmi' (Aksi)", desc: "Akses mengatur kolom mana dari mapel mana saja yang menjadi syarat mutlak Tasmi'", category: "Divisi Syahadah", type: "aksi" },

  // Divisi CBT / Ujian
  { id: "ujian_usbu", label: "CBT / Ujian (Lihat)", desc: "Akses melihat monitoring sesi ujian dan bank soal", category: "Divisi CBT / Ujian", type: "lihat" },
  { id: "ujian_usbu_edit", label: "CBT / Ujian (Aksi)", desc: "Akses membuat ujian baru, mengedit bank soal, dan membuka sesi ujian global", category: "Divisi CBT / Ujian", type: "aksi" },

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
  { id: "jasus_manage", label: "Kelola Jasus", desc: "Akses mengelola anggota jasus pelapor pelanggaran bahasa", category: "Divisi Kebahasaan", type: "aksi" },
  { id: "monitoring_mukholif", label: "Monitoring Mukholif", desc: "Akses dashboard monitoring eksekusi iqob", category: "Divisi Kebahasaan", type: "lihat" },

  // Markaz Turats
  { id: "osim_manage", label: "Kelola OSIM", desc: "Akses mengelola anggota OSIM dan pemilihan OSIM Markaz Turats", category: "Markaz Turats", type: "aksi" },
  { id: "osim_syahadah", label: "Cetak Syahadah OSIM", desc: "Akses mencetak syahadah anggota OSIM dan mengatur template & layout-nya", category: "Markaz Turats", type: "aksi" },
];

type ModuleRow = {
  key: string;
  title: string;
  desc: string;
  category: string;
  viewPerm?: PermissionDef;
  editPerm?: PermissionDef;
  singlePerm?: PermissionDef;
};

type CategoryGroup = {
  category: string;
  permissions: PermissionDef[];
  rows: ModuleRow[];
};

function stripSuffix(label: string): string {
  return label.replace(/\s*\((?:Lihat|Aksi|Aksi Edit)\)\s*$/i, "").trim();
}

function buildCategoryGroups(perms: PermissionDef[]): CategoryGroup[] {
  const byCategory = new Map<string, PermissionDef[]>();
  for (const p of perms) {
    if (!byCategory.has(p.category)) byCategory.set(p.category, []);
    byCategory.get(p.category)!.push(p);
  }

  const groups: CategoryGroup[] = [];
  for (const [category, list] of byCategory.entries()) {
    const byId = new Map(list.map((p) => [p.id, p]));
    const consumed = new Set<string>();
    const rows: ModuleRow[] = [];

    for (const p of list) {
      if (consumed.has(p.id)) continue;

      if (!p.id.endsWith("_edit")) {
        const editCounterpart = byId.get(`${p.id}_edit`);
        if (editCounterpart) {
          consumed.add(p.id);
          consumed.add(editCounterpart.id);
          rows.push({
            key: p.id,
            title: stripSuffix(p.label),
            desc: `${p.desc} • ${editCounterpart.desc}`,
            category,
            viewPerm: p,
            editPerm: editCounterpart,
          });
          continue;
        }
      }

      consumed.add(p.id);
      rows.push({
        key: p.id,
        title: stripSuffix(p.label),
        desc: p.desc,
        category,
        singlePerm: p,
      });
    }

    groups.push({ category, permissions: list, rows });
  }

  return groups;
}

const ALL_CATEGORY_GROUPS = buildCategoryGroups(AVAILABLE_PERMISSIONS);

function shortCategoryName(cat: string): string {
  return cat.replace(/^Divisi\s+/i, "");
}

function countSetDiff(a?: Set<string>, b?: Set<string>): number {
  const setA = a ?? new Set<string>();
  const setB = b ?? new Set<string>();
  let diff = 0;
  for (const x of setA) if (!setB.has(x)) diff++;
  for (const x of setB) if (!setA.has(x)) diff++;
  return diff;
}

export default function ManajemenRolePage() {
  const [mode, setMode] = useState<"role" | "user">("role");
  const [roles, setRoles] = useState<string[]>([]);
  const [permissionsMap, setPermissionsMap] = useState<Record<string, Set<string>>>({});
  const [savedPermissionsMap, setSavedPermissionsMap] = useState<Record<string, Set<string>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeRole, setActiveRole] = useState("KSU");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter & Navigasi agar tidak scroll naik-turun
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  // Custom Role input
  const [newRoleName, setNewRoleName] = useState("");
  const [isAddingRole, setIsAddingRole] = useState(false);

  useEffect(() => {
    fetchRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchRoles = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/roles");
      if (!res.ok) throw new Error("Gagal mengambil data");
      const { roles: apiRoles, permissions }: { roles: string[]; permissions: RolePermission[] } = await res.json();

      setRoles(apiRoles);

      const newMap: Record<string, Set<string>> = {};
      apiRoles.forEach((r) => {
        newMap[r] = new Set();
      });
      if (newMap["ADMIN"]) {
        AVAILABLE_PERMISSIONS.forEach((p) => newMap["ADMIN"].add(p.id));
      }

      permissions.forEach((p) => {
        if (newMap[p.role]) {
          newMap[p.role].add(p.permission);
        }
      });

      const savedSnapshot: Record<string, Set<string>> = {};
      Object.entries(newMap).forEach(([r, s]) => {
        savedSnapshot[r] = new Set(s);
      });

      setPermissionsMap(newMap);
      setSavedPermissionsMap(savedSnapshot);
      if (apiRoles.length > 0 && !apiRoles.includes(activeRole)) {
        setActiveRole(apiRoles[0]);
      }
    } catch {
      toast.error("Gagal mengambil permissions");
    } finally {
      setIsLoading(false);
    }
  };

  const activeSet = permissionsMap[activeRole] ?? new Set<string>();
  const savedActiveSet = savedPermissionsMap[activeRole] ?? new Set<string>();
  const dirtyCount = activeRole === "ADMIN" ? 0 : countSetDiff(activeSet, savedActiveSet);

  const handleSelectRole = (nextRole: string) => {
    if (nextRole === activeRole) return;
    if (dirtyCount > 0) {
      const ok = confirm(
        `Role ${activeRole.replace(/_/g, " ")} memiliki ${dirtyCount} perubahan yang belum disimpan. Pindah role tetap menyimpan draft di tab ini — lanjutkan?`
      );
      if (!ok) return;
    }
    setActiveRole(nextRole);
  };

  const handleToggle = (permId: string, autoEnablePairId?: string) => {
    if (activeRole === "ADMIN") return;
    setPermissionsMap((prev) => {
      const roleSet = new Set(prev[activeRole]);
      if (roleSet.has(permId)) {
        roleSet.delete(permId);
      } else {
        roleSet.add(permId);
        // Jika mencentang Aksi, otomatis aktifkan izin Lihat pasangannya agar halaman bisa dibuka
        if (autoEnablePairId && !roleSet.has(autoEnablePairId)) {
          roleSet.add(autoEnablePairId);
        }
      }
      return { ...prev, [activeRole]: roleSet };
    });
  };

  const handleBulkCategory = (catPerms: PermissionDef[], enable: boolean) => {
    if (activeRole === "ADMIN") return;
    setPermissionsMap((prev) => {
      const roleSet = new Set(prev[activeRole]);
      for (const p of catPerms) {
        if (enable) roleSet.add(p.id);
        else roleSet.delete(p.id);
      }
      return { ...prev, [activeRole]: roleSet };
    });
  };

  const handleResetActiveRole = () => {
    setPermissionsMap((prev) => ({
      ...prev,
      [activeRole]: new Set(savedPermissionsMap[activeRole] ?? []),
    }));
    toast("Perubahan dibatalkan");
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const currentList = Array.from(permissionsMap[activeRole] || []);
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: activeRole,
          permissions: currentList,
        }),
      });

      if (!res.ok) throw new Error("Gagal menyimpan");
      setSavedPermissionsMap((prev) => ({
        ...prev,
        [activeRole]: new Set(currentList),
      }));
      toast.success(`Permission ${activeRole.replace(/_/g, " ")} berhasil disimpan`);
    } catch {
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

    setRoles((prev) => [...prev, formattedRole]);
    setPermissionsMap((prev) => ({
      ...prev,
      [formattedRole]: new Set(),
    }));
    setSavedPermissionsMap((prev) => ({
      ...prev,
      [formattedRole]: new Set(),
    }));
    setActiveRole(formattedRole);
    setNewRoleName("");
    setIsAddingRole(false);
    toast.success(`Role ${formattedRole} ditambahkan. Pilih permission lalu klik Simpan.`);
  };

  // Hitung daftar kategori & baris yang lolos filter
  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const activeRoleSet = permissionsMap[activeRole] ?? new Set<string>();

    return ALL_CATEGORY_GROUPS.filter(
      (g) => selectedCategory === "ALL" || g.category === selectedCategory
    )
      .map((g) => {
        const rows = g.rows.filter((row) => {
          const rowPerms = [row.viewPerm, row.editPerm, row.singlePerm].filter(
            (p): p is PermissionDef => Boolean(p)
          );

          if (q) {
            const matchText =
              row.title.toLowerCase().includes(q) ||
              row.category.toLowerCase().includes(q) ||
              rowPerms.some(
                (p) =>
                  p.label.toLowerCase().includes(q) ||
                  p.desc.toLowerCase().includes(q) ||
                  p.id.toLowerCase().includes(q)
              );
            if (!matchText) return false;
          }

          if (statusFilter === "active") {
            return rowPerms.some((p) => activeRoleSet.has(p.id));
          }
          if (statusFilter === "inactive") {
            return rowPerms.some((p) => !activeRoleSet.has(p.id));
          }
          return true;
        });

        return { ...g, rows };
      })
      .filter((g) => g.rows.length > 0);
  }, [searchQuery, selectedCategory, statusFilter, permissionsMap, activeRole]);

  const toggleCollapseCategory = (cat: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const allCollapsed =
    filteredGroups.length > 0 &&
    filteredGroups.every((g) => Boolean(collapsedCategories[g.category]));

  const handleToggleAllCollapse = () => {
    const nextState: Record<string, boolean> = {};
    filteredGroups.forEach((g) => {
      nextState[g.category] = !allCollapsed;
    });
    setCollapsedCategories(nextState);
  };

  const totalActiveInRole = activeSet.size;

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)] flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-[var(--color-primary)]" />
            Manajemen Role & Permission
          </h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">
            Atur izin modul per Role atau berikan pengecualian khusus pada satu User. Gunakan pencarian atau tab divisi untuk berpindah cepat tanpa scroll panjang.
          </p>
        </div>

        {/* Saklar Per Role / Per User */}
        <div className="flex rounded-xl border border-[var(--color-surface-dark)] bg-white p-1 shrink-0 self-start md:self-auto shadow-xs">
          <button
            onClick={() => setMode("role")}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 cursor-pointer ${
              mode === "role"
                ? "bg-[var(--color-primary)] text-white shadow-xs"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            <Shield size={15} />
            Per Role
          </button>
          <button
            onClick={() => setMode("user")}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 cursor-pointer ${
              mode === "user"
                ? "bg-[var(--color-primary)] text-white shadow-xs"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            <Users size={15} />
            Per User
          </button>
        </div>
      </div>

      {mode === "user" ? (
        <UserPermissionsSection />
      ) : (
        <div className="flex flex-col lg:flex-row gap-5 items-start">
          {/* Sticky Sidebar Daftar Role */}
          <aside className="w-full lg:w-64 shrink-0 bg-white rounded-2xl shadow-sm border border-[var(--color-surface-dark)] p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-black text-[var(--color-text-subtle)] uppercase tracking-wider">
                Daftar Role ({roles.length})
              </p>
              <button
                onClick={() => setIsAddingRole(!isAddingRole)}
                className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--color-primary-50)] text-[var(--color-primary)] hover:bg-[var(--color-primary-100)] font-bold transition-colors cursor-pointer"
              >
                <Plus size={14} /> Baru
              </button>
            </div>

            {isAddingRole && (
              <form
                onSubmit={handleAddRole}
                className="mb-3 bg-[var(--color-secondary)] p-3 rounded-xl border border-[var(--color-surface-dark)] space-y-2"
              >
                <input
                  type="text"
                  required
                  placeholder="NAMA_ROLE"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs uppercase font-semibold outline-none focus:border-[var(--color-primary)]"
                />
                <div className="flex justify-end gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setIsAddingRole(false)}
                    className="px-2 py-1 text-[var(--color-text-muted)] font-semibold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 bg-[var(--color-primary)] text-white rounded-lg font-semibold hover:bg-[var(--color-primary-dark)] cursor-pointer"
                  >
                    Tambah
                  </button>
                </div>
              </form>
            )}

            <div className="flex flex-row lg:flex-col gap-1.5 overflow-x-auto lg:overflow-y-auto pb-1 lg:pb-0">
              {roles.map((role) => {
                const count = permissionsMap[role]?.size ?? 0;
                const roleDirty = role !== "ADMIN" && countSetDiff(permissionsMap[role], savedPermissionsMap[role]) > 0;
                const isSelected = activeRole === role;
                return (
                  <button
                    key={role}
                    onClick={() => handleSelectRole(role)}
                    className={`text-left px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 flex items-center justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? "bg-[var(--color-primary)] text-white shadow-sm"
                        : "text-[var(--color-text-muted)] hover:bg-slate-100 hover:text-[var(--color-text)]"
                    }`}
                  >
                    <span className="truncate flex items-center gap-1.5">
                      {role.replace(/_/g, " ")}
                      {roleDirty && (
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isSelected ? "bg-amber-300" : "bg-amber-500"
                          }`}
                          title="Ada perubahan belum disimpan"
                        />
                      )}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-slate-100 text-[var(--color-text-subtle)]"
                      }`}
                    >
                      {role === "ADMIN" ? "Semua" : count}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Main Permission Matrix Area */}
          <div className="flex-1 min-w-0 w-full bg-white rounded-2xl shadow-sm border border-[var(--color-surface-dark)] relative">
            {isLoading ? (
              <div className="py-24 flex flex-col items-center justify-center gap-3 text-sm text-[var(--color-text-muted)]">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
                <span>Memuat daftar hak akses...</span>
              </div>
            ) : (
              <>
                {/* Sticky Top Toolbar: Judul Role + Simpan + Pencarian + Filter + Pill Divisi */}
                <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-[var(--color-surface-dark)] rounded-t-2xl p-4 sm:p-5 space-y-3.5 shadow-[0_4px_16px_-10px_rgba(15,23,42,0.12)]">
                  {/* Baris 1: Nama Role + Tombol Simpan */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold text-[var(--color-text)]">
                          Hak Akses: {activeRole.replace(/_/g, " ")}
                        </h2>
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary)]">
                          {totalActiveInRole} / {AVAILABLE_PERMISSIONS.length} izin aktif
                        </span>
                        {dirtyCount > 0 && (
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                            {dirtyCount} perubahan belum disimpan
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {dirtyCount > 0 && (
                        <button
                          type="button"
                          onClick={handleResetActiveRole}
                          disabled={isSubmitting}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-slate-200 text-[var(--color-text-muted)] hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <RotateCcw size={15} />
                          Batal
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSubmitting || activeRole === "ADMIN"}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                          dirtyCount > 0
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200"
                            : "bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white"
                        }`}
                      >
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save size={16} />}
                        Simpan Perubahan
                      </button>
                    </div>
                  </div>

                  {/* Baris 2: Pencarian Instan + Filter Status */}
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-subtle)]" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Cari modul atau izin (mis. pengajar, ujian, reminder, syahadah)..."
                        className="w-full pl-9 pr-8 py-2 text-sm bg-[var(--color-secondary)] border border-[var(--color-surface-dark)] rounded-xl outline-none focus:bg-white focus:border-[var(--color-primary)] transition-colors"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          aria-label="Hapus pencarian"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1 bg-[var(--color-secondary)] p-1 rounded-xl border border-[var(--color-surface-dark)] shrink-0">
                      {(
                        [
                          ["all", "Semua"],
                          ["active", "Aktif"],
                          ["inactive", "Belum Aktif"],
                        ] as const
                      ).map(([val, lbl]) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setStatusFilter(val)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            statusFilter === val
                              ? "bg-white text-[var(--color-primary)] shadow-xs"
                              : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                          }`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>

                    {selectedCategory === "ALL" && filteredGroups.length > 1 && (
                      <button
                        type="button"
                        onClick={handleToggleAllCollapse}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold border border-[var(--color-surface-dark)] text-[var(--color-text-muted)] hover:bg-slate-50 shrink-0 cursor-pointer"
                      >
                        {allCollapsed ? "Buka Semua" : "Ringkas Semua"}
                      </button>
                    )}
                  </div>

                  {/* Baris 3: Tab Pill Cepat per Divisi */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                    <button
                      type="button"
                      onClick={() => setSelectedCategory("ALL")}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-colors cursor-pointer ${
                        selectedCategory === "ALL"
                          ? "bg-[var(--color-primary)] text-white"
                          : "bg-slate-100 text-[var(--color-text-muted)] hover:bg-slate-200/70"
                      }`}
                    >
                      Semua Divisi
                    </button>
                    {ALL_CATEGORY_GROUPS.map((g) => {
                      const activeInCat = g.permissions.filter((p) => activeSet.has(p.id)).length;
                      const isCatSelected = selectedCategory === g.category;
                      return (
                        <button
                          key={g.category}
                          type="button"
                          onClick={() => setSelectedCategory(g.category)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-colors flex items-center gap-1.5 cursor-pointer ${
                            isCatSelected
                              ? "bg-[var(--color-primary)] text-white"
                              : activeInCat > 0
                                ? "bg-[var(--color-primary-50)] text-[var(--color-primary-dark)] hover:bg-[var(--color-primary-100)]"
                                : "bg-slate-100 text-[var(--color-text-muted)] hover:bg-slate-200/70"
                          }`}
                        >
                          <span>{shortCategoryName(g.category)}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                              isCatSelected
                                ? "bg-white/20 text-white"
                                : "bg-white/80 text-[var(--color-text-muted)]"
                            }`}
                          >
                            {activeInCat}/{g.permissions.length}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Isi Matriks Permission */}
                <div className="p-4 sm:p-5 space-y-4">
                  {activeRole === "ADMIN" && (
                    <div className="bg-amber-50 text-amber-800 px-4 py-3 rounded-xl text-xs sm:text-sm border border-amber-200">
                      <strong>Catatan:</strong> Role <strong>ADMIN</strong> otomatis memiliki seluruh hak akses. Anda tidak perlu mengubah centang untuk role ini.
                    </div>
                  )}

                  {filteredGroups.length === 0 ? (
                    <div className="py-12 text-center space-y-2">
                      <p className="text-sm font-bold text-[var(--color-text)]">
                        Tidak ada izin yang cocok dengan filter saat ini.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("");
                          setSelectedCategory("ALL");
                          setStatusFilter("all");
                        }}
                        className="text-xs font-bold text-[var(--color-primary)] hover:underline cursor-pointer"
                      >
                        Reset semua filter
                      </button>
                    </div>
                  ) : (
                    filteredGroups.map((group) => {
                      const isCollapsed =
                        selectedCategory === "ALL" && !searchQuery && Boolean(collapsedCategories[group.category]);
                      const activeCountInCat = group.permissions.filter((p) => activeSet.has(p.id)).length;
                      const allSelectedInCat = activeCountInCat === group.permissions.length;

                      return (
                        <section
                          key={group.category}
                          className="border border-[var(--color-surface-dark)] rounded-2xl overflow-hidden bg-white"
                        >
                          {/* Header Accordion Divisi */}
                          <div className="bg-slate-50/90 px-4 py-2.5 border-b border-[var(--color-surface)] flex flex-wrap items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => toggleCollapseCategory(group.category)}
                              className="flex items-center gap-2 text-left cursor-pointer group"
                            >
                              {isCollapsed ? (
                                <ChevronRight className="h-4 w-4 text-[var(--color-primary)]" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-[var(--color-primary)]" />
                              )}
                              <h3 className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-primary)] group-hover:underline">
                                {group.category}
                              </h3>
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-[var(--color-text-muted)]">
                                {activeCountInCat} / {group.permissions.length} aktif
                              </span>
                            </button>

                            {activeRole !== "ADMIN" && (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleBulkCategory(group.permissions, !allSelectedInCat)}
                                  className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
                                >
                                  {allSelectedInCat ? "Kosongkan Divisi" : "Pilih Semua"}
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Daftar Baris Modul Padat */}
                          {!isCollapsed && (
                            <div className="divide-y divide-slate-100">
                              {group.rows.map((row) => {
                                const isPaired = Boolean(row.viewPerm && row.editPerm);
                                const viewChecked = row.viewPerm ? activeSet.has(row.viewPerm.id) : false;
                                const editChecked = row.editPerm ? activeSet.has(row.editPerm.id) : false;
                                const singleChecked = row.singlePerm ? activeSet.has(row.singlePerm.id) : false;
                                const anyActive = viewChecked || editChecked || singleChecked;

                                return (
                                  <div
                                    key={row.key}
                                    className={`px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                                      anyActive ? "bg-[var(--color-primary-50)]/45" : "hover:bg-slate-50/70"
                                    }`}
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-bold text-[var(--color-text)]">
                                          {row.title}
                                        </p>
                                        {row.singlePerm && (
                                          <span
                                            className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                              row.singlePerm.type === "lihat"
                                                ? "bg-sky-100 text-sky-700"
                                                : "bg-amber-100 text-amber-800"
                                            }`}
                                          >
                                            {row.singlePerm.type === "lihat" ? "Lihat" : "Khusus"}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5 leading-snug">
                                        {row.desc}
                                      </p>
                                    </div>

                                    {/* Toggle Pill Kanan */}
                                    <div
                                      className={`flex items-center gap-2 shrink-0 ${
                                        activeRole === "ADMIN" ? "opacity-70 pointer-events-none" : ""
                                      }`}
                                    >
                                      {isPaired && row.viewPerm && row.editPerm ? (
                                        <>
                                          <TogglePill
                                            label="Lihat"
                                            title={row.viewPerm.desc}
                                            checked={viewChecked}
                                            disabled={activeRole === "ADMIN"}
                                            tone="view"
                                            onClick={() => handleToggle(row.viewPerm!.id)}
                                          />
                                          <TogglePill
                                            label="Aksi"
                                            title={`${row.editPerm.desc} (otomatis mengaktifkan Lihat)`}
                                            checked={editChecked}
                                            disabled={activeRole === "ADMIN"}
                                            tone="edit"
                                            onClick={() => handleToggle(row.editPerm!.id, row.viewPerm!.id)}
                                          />
                                        </>
                                      ) : (
                                        row.singlePerm && (
                                          <TogglePill
                                            label={singleChecked ? "Aktif" : "Nonaktif"}
                                            title={row.singlePerm.desc}
                                            checked={singleChecked}
                                            disabled={activeRole === "ADMIN"}
                                            tone={row.singlePerm.type === "lihat" ? "view" : "edit"}
                                            onClick={() => handleToggle(row.singlePerm!.id)}
                                          />
                                        )
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </section>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TogglePill({
  label,
  title,
  checked,
  disabled,
  tone,
  onClick,
}: {
  label: string;
  title?: string;
  checked: boolean;
  disabled?: boolean;
  tone: "view" | "edit";
  onClick: () => void;
}) {
  const activeStyle =
    tone === "view"
      ? "bg-sky-600 text-white border-sky-600 shadow-xs"
      : "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-xs";

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer min-w-[78px] justify-center ${
        checked
          ? activeStyle
          : "bg-white text-[var(--color-text-muted)] border-slate-200 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <span
        className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
          checked ? "bg-white/20 border-white/40 text-white" : "border-slate-300 bg-white"
        }`}
      >
        {checked && <Check size={11} strokeWidth={3} />}
      </span>
      <span>{label}</span>
    </button>
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

function countOverrideDiff(
  a: Record<string, "GRANT" | "DENY">,
  b: Record<string, "GRANT" | "DENY">
): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let diff = 0;
  for (const k of keys) {
    if (a[k] !== b[k]) diff++;
  }
  return diff;
}

function UserPermissionsSection() {
  const [q, setQ] = useState("");
  const [hasil, setHasil] = useState<UserCari[]>([]);
  const [mencari, setMencari] = useState(false);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [overrides, setOverrides] = useState<Record<string, "GRANT" | "DENY">>({});
  const [savedOverrides, setSavedOverrides] = useState<Record<string, "GRANT" | "DENY">>({});
  const [memuat, setMemuat] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);

  // Filter & Navigasi untuk Per User
  const [permSearch, setPermSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [filterMode, setFilterMode] = useState<"all" | "effective" | "overrides">("all");

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
      setSavedOverrides({ ...map });
      setHasil([]);
      setQ(u.nama);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal memuat izin user");
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
      setSavedOverrides({ ...overrides });
      toast.success(`Izin khusus ${detail.user.nama} berhasil disimpan`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan perubahan");
    } finally {
      setMenyimpan(false);
    }
  };

  const roleSet = useMemo(() => new Set(detail?.rolePermissions || []), [detail]);
  const efektif = (permId: string) => {
    if (overrides[permId] === "GRANT") return true;
    if (overrides[permId] === "DENY") return false;
    return roleSet.has(permId);
  };
  const jumlahOverride = Object.keys(overrides).length;
  const dirtyCount = countOverrideDiff(overrides, savedOverrides);

  const filteredCategories = useMemo(() => {
    const query = permSearch.trim().toLowerCase();
    return ALL_CATEGORY_GROUPS.filter(
      (g) => selectedCategory === "ALL" || g.category === selectedCategory
    )
      .map((g) => {
        const list = g.permissions.filter((p) => {
          if (query) {
            const match =
              p.label.toLowerCase().includes(query) ||
              p.desc.toLowerCase().includes(query) ||
              p.id.toLowerCase().includes(query) ||
              p.category.toLowerCase().includes(query);
            if (!match) return false;
          }
          if (filterMode === "overrides") return Boolean(overrides[p.id]);
          if (filterMode === "effective") {
            if (overrides[p.id] === "GRANT") return true;
            if (overrides[p.id] === "DENY") return false;
            return roleSet.has(p.id);
          }
          return true;
        });
        return { category: g.category, permissions: list };
      })
      .filter((g) => g.permissions.length > 0);
  }, [permSearch, selectedCategory, filterMode, overrides, roleSet]);

  return (
    <div className="space-y-4">
      {/* Kartu Pencarian User */}
      <div className="bg-white rounded-2xl shadow-sm border border-[var(--color-surface-dark)] p-5 space-y-3">
        <div>
          <h2 className="text-base font-bold text-[var(--color-text)] flex items-center gap-2">
            <SlidersHorizontal size={16} className="text-[var(--color-primary)]" />
            Izin Khusus Per User
          </h2>
          <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-1">
            Cari user berdasarkan nama/username, lalu beri (<strong>Diberi</strong>) atau cabut (<strong>Dicabut</strong>) izin tertentu tanpa mengubah role-nya.
          </p>
        </div>

        <div className="relative w-full md:w-[420px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-subtle)]" />
          <input
            type="text"
            value={q}
            onChange={(e) => cari(e.target.value)}
            placeholder="Ketik minimal 2 huruf nama atau username..."
            className="w-full pl-9 pr-8 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:border-[var(--color-primary)]"
          />
          {q && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                setHasil([]);
              }}
              aria-label="Hapus pencarian user"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={15} />
            </button>
          )}
          {mencari && <p className="text-xs text-[var(--color-text-muted)] mt-2">Mencari...</p>}
          {hasil.length > 0 && (
            <div className="mt-2 rounded-xl border border-[var(--color-surface-dark)] bg-white shadow-lg divide-y overflow-hidden absolute left-0 right-0 z-30">
              {hasil.map((u) => (
                <button
                  key={u.id}
                  onClick={() => pilih(u)}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 cursor-pointer ${
                    detail?.user.id === u.id ? "bg-[var(--color-primary-50)] font-bold" : ""
                  }`}
                >
                  {u.nama}{" "}
                  <span className="text-[var(--color-text-muted)] text-xs">
                    (@{u.username} • {u.role.replace(/_/g, " ")})
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {memuat && (
        <div className="bg-white rounded-2xl border border-[var(--color-surface-dark)] p-10 flex items-center justify-center gap-2 text-sm text-[var(--color-text-muted)]">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--color-primary)]" /> Memuat izin user...
        </div>
      )}

      {detail && !memuat && (
        <div className="bg-white rounded-2xl shadow-sm border border-[var(--color-surface-dark)]">
          {/* Sticky Bar User */}
          <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-[var(--color-surface-dark)] rounded-t-2xl p-4 sm:p-5 space-y-3.5 shadow-[0_4px_16px_-10px_rgba(15,23,42,0.12)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-[var(--color-text)]">
                    {detail.user.nama}
                  </h3>
                  <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                    @{detail.user.username}
                  </span>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    Role: {detail.user.role.replace(/_/g, " ")}
                  </span>
                  {jumlahOverride > 0 && (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      {jumlahOverride} override khusus
                    </span>
                  )}
                  {dirtyCount > 0 && (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      {dirtyCount} belum disimpan
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {dirtyCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setOverrides({ ...savedOverrides })}
                    disabled={menyimpan}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-slate-200 text-[var(--color-text-muted)] hover:bg-slate-50 cursor-pointer"
                  >
                    <RotateCcw size={15} />
                    Batal
                  </button>
                )}
                <button
                  onClick={simpan}
                  disabled={menyimpan}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                    dirtyCount > 0
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200"
                      : "bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white"
                  }`}
                >
                  {menyimpan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save size={16} />}
                  Simpan Izin User
                </button>
              </div>
            </div>

            {/* Search + Filter Per User */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-subtle)]" />
                <input
                  type="text"
                  value={permSearch}
                  onChange={(e) => setPermSearch(e.target.value)}
                  placeholder="Cari nama izin atau divisi..."
                  className="w-full pl-9 pr-8 py-2 text-sm bg-[var(--color-secondary)] border border-[var(--color-surface-dark)] rounded-xl outline-none focus:bg-white focus:border-[var(--color-primary)]"
                />
                {permSearch && (
                  <button
                    type="button"
                    onClick={() => setPermSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1 bg-[var(--color-secondary)] p-1 rounded-xl border border-[var(--color-surface-dark)] shrink-0">
                {(
                  [
                    ["all", "Semua"],
                    ["effective", "Efektif Aktif"],
                    ["overrides", `Override (${jumlahOverride})`],
                  ] as const
                ).map(([val, lbl]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setFilterMode(val)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      filterMode === val
                        ? "bg-white text-[var(--color-primary)] shadow-xs"
                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {/* Pill Divisi Per User */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              <button
                type="button"
                onClick={() => setSelectedCategory("ALL")}
                className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-colors cursor-pointer ${
                  selectedCategory === "ALL"
                    ? "bg-[var(--color-primary)] text-white"
                    : "bg-slate-100 text-[var(--color-text-muted)] hover:bg-slate-200/70"
                }`}
              >
                Semua Divisi
              </button>
              {ALL_CATEGORY_GROUPS.map((g) => {
                const ovInCat = g.permissions.filter((p) => Boolean(overrides[p.id])).length;
                const isSelected = selectedCategory === g.category;
                return (
                  <button
                    key={g.category}
                    type="button"
                    onClick={() => setSelectedCategory(g.category)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-colors flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? "bg-[var(--color-primary)] text-white"
                        : ovInCat > 0
                          ? "bg-amber-100 text-amber-800 hover:bg-amber-200/80"
                          : "bg-slate-100 text-[var(--color-text-muted)] hover:bg-slate-200/70"
                    }`}
                  >
                    <span>{shortCategoryName(g.category)}</span>
                    {ovInCat > 0 && (
                      <span
                        className={`text-[10px] px-1.5 rounded-full ${
                          isSelected ? "bg-white/25 text-white" : "bg-amber-200/80 text-amber-900"
                        }`}
                      >
                        {ovInCat}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Daftar Baris Izin Per User */}
          <div className="p-4 sm:p-5 space-y-4">
            {filteredCategories.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <p className="text-sm font-bold text-[var(--color-text)]">
                  Tidak ada izin yang sesuai filter.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setPermSearch("");
                    setSelectedCategory("ALL");
                    setFilterMode("all");
                  }}
                  className="text-xs font-bold text-[var(--color-primary)] hover:underline cursor-pointer"
                >
                  Reset filter
                </button>
              </div>
            ) : (
              filteredCategories.map((group) => (
                <section
                  key={group.category}
                  className="border border-[var(--color-surface-dark)] rounded-2xl overflow-hidden"
                >
                  <div className="bg-slate-50 px-4 py-2.5 border-b border-[var(--color-surface)]">
                    <h4 className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-primary)]">
                      {group.category}
                    </h4>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {group.permissions.map((perm) => {
                      const dariRole = roleSet.has(perm.id);
                      const ov = overrides[perm.id] || null;
                      const ya = efektif(perm.id);

                      return (
                        <div
                          key={perm.id}
                          className={`px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors ${
                            ov
                              ? "bg-amber-50/70"
                              : ya
                                ? "bg-[var(--color-primary-50)]/40"
                                : "bg-white hover:bg-slate-50/60"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-bold text-[var(--color-text)]">{perm.label}</p>
                              <span className="text-[11px] text-[var(--color-text-muted)]">
                                Role:{" "}
                                <strong className={dariRole ? "text-emerald-700" : "text-slate-500"}>
                                  {dariRole ? "YA" : "TIDAK"}
                                </strong>
                              </span>
                              <span className="text-[11px] text-[var(--color-text-muted)]">
                                • Efektif:{" "}
                                <strong className={ya ? "text-emerald-700" : "text-red-600"}>
                                  {ya ? "YA" : "TIDAK"}
                                </strong>
                              </span>
                              {ov && (
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    ov === "GRANT"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-rose-100 text-rose-800"
                                  }`}
                                >
                                  {ov === "GRANT" ? "DIBERI KHUSUS" : "DICABUT KHUSUS"}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[var(--color-text-muted)] mt-0.5 leading-snug">
                              {perm.desc}
                            </p>
                          </div>

                          <div className="flex items-center gap-1 shrink-0 bg-slate-100 p-1 rounded-xl self-start md:self-auto">
                            {(
                              [
                                [null, "Sesuai role"],
                                ["GRANT", "Diberi"],
                                ["DENY", "Dicabut"],
                              ] as const
                            ).map(([nilai, label]) => {
                              const activeBtn = ov === nilai || (nilai === null && !ov);
                              return (
                                <button
                                  key={label}
                                  type="button"
                                  onClick={() => setOverride(perm.id, nilai)}
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                    activeBtn
                                      ? nilai === "DENY"
                                        ? "bg-red-600 text-white shadow-xs"
                                        : nilai === "GRANT"
                                          ? "bg-emerald-600 text-white shadow-xs"
                                          : "bg-slate-700 text-white shadow-xs"
                                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                                  }`}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
