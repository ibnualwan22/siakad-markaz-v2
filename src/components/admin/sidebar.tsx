"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  DoorOpen,
  GraduationCap,
  History,
  Settings,
  Menu,
  X,
  CalendarCheck,
  Bed,
  BookOpen,
  Activity,
  Printer,
  CalendarDays,
  Instagram,
  Palette,
  UserCog,
  LogOut,
  ShieldCheck,
  Calendar,
  Medal,
  Armchair,
  ChevronDown,
  AlertTriangle,
  FileText,
  ClipboardList,
  Trophy,
  ClipboardEdit,
  Database,
  ListChecks,
  QrCode,
  ScanLine,
  Shield,
  ClipboardCheck,
  Eye,
  MapPin,
  Wifi,
  Images,
  Vote,
  Wallet,
  Globe,
  Bell,
  Moon,
  Search,
  Star,
  Clock,
  LayoutGrid,
} from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: any;
  permissionId?: string | string[];
  requiredRole?: string;
  requiredRoles?: string[];
  keywords?: string;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const ABSEN_KELAS_HREF = "/admin/absensi/kelas";
const MAX_PINNED = 6;
const MAX_RECENT = 4;

const navigationGroups: NavGroup[] = [
  {
    title: "Utama",
    items: [
      { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, permissionId: "dashboard", keywords: "beranda home ringkasan" },
      { href: "/admin/jadwal-saya", label: "Jadwal Saya", icon: Calendar, permissionId: "jadwal_saya", keywords: "mengajar sesi pribadi" },
      { href: "/admin/bisyaroh", label: "Bisyaroh Saya", icon: Wallet, permissionId: "jadwal_saya", keywords: "gaji honor insentif" },
    ],
  },
  {
    title: "Absensi & Perizinan",
    items: [
      { href: "/admin/absensi/kelas", label: "Absen Kelas", icon: BookOpen, permissionId: "absen_kelas", keywords: "kehadiran ngajar santri" },
      { href: "/admin/absensi/sakan", label: "Absen Sakan", icon: Bed, permissionId: "absen_sakan", keywords: "asrama kamar malam" },
      { href: "/admin/absensi/kegiatan", label: "Absen Kegiatan", icon: Activity, permissionId: "absen_kegiatan", keywords: "acara wajib" },
      { href: "/admin/absensi/kegiatan/buka-sesi", label: "Buka Sesi Absen", icon: QrCode, permissionId: "absen_kegiatan", keywords: "qr kegiatan" },
      { href: "/admin/absensi/kegiatan/scan", label: "Scan Absen", icon: ScanLine, permissionId: ["pengaturan_kegiatan", "scan_absen_kegiatan"], keywords: "kamera qr barcode" },
      { href: "/admin/absensi/tabirot", label: "Absen Ta'birot", icon: Users, permissionId: "absen_tabirot", keywords: "tabirot kelompok" },
      { href: "/admin/absensi/perizinan", label: "Perizinan Santri", icon: FileText, permissionId: "perizinan_harian", keywords: "izin sakit tasrih keluar" },
      { href: "/admin/absensi/perizinan/data", label: "Data Santri Izin", icon: ClipboardList, permissionId: "perizinan_data", keywords: "daftar izin pulang" },
    ],
  },
  {
    title: "Rekap & Jadwal Absensi",
    items: [
      { href: "/admin/absensi/rekap/kelas", label: "Rekap Kelas", icon: BookOpen, permissionId: "rekap_kelas", keywords: "laporan kehadiran kelas" },
      { href: "/admin/absensi/rekap/sakan", label: "Rekap Sakan", icon: Bed, permissionId: "rekap_sakan", keywords: "laporan asrama" },
      { href: "/admin/absensi/rekap/kegiatan", label: "Rekap Kegiatan", icon: Activity, permissionId: "rekap_kegiatan", keywords: "laporan acara" },
      { href: "/admin/absensi/rekap/tabirot", label: "Rekap Ta'birot", icon: Users, permissionId: "rekap_tabirot", keywords: "laporan tabirot" },
      { href: "/admin/absensi/rekap/pengajar", label: "Rekap Pengajar", icon: UserCog, permissionId: "rekap_pengajar", keywords: "laporan ustadz guru" },
      { href: "/admin/jadwal-sesi", label: "Jadwal Buka/Tutup Sesi", icon: CalendarCheck, permissionId: "manajemen_sesi", keywords: "jam sesi kelas" },
      { href: "/admin/absensi/pengaturan", label: "Pengaturan Kegiatan", icon: Settings, permissionId: "pengaturan_kegiatan", keywords: "config kegiatan" },
    ],
  },
  {
    title: "Data Santri & Kelas",
    items: [
      { href: "/admin/dufah", label: "Manajemen Angkatan & Usbu'", icon: CalendarCheck, permissionId: "manajemen_dufah", keywords: "dufah periode aktif" },
      { href: "/admin/data-santri", label: "Data Santri Duf'ah", icon: Users, permissionId: "data_santri_dufah", keywords: "daftar siswa murid" },
      { href: "/admin/ketua-kelas", label: "Ketua Kelas", icon: ShieldCheck, permissionId: "data_santri", keywords: "rois fashl" },
      { href: "/admin/manajemen-kelas", label: "Alokasi Kelas", icon: Users, permissionId: "alokasi_kelas", keywords: "pembagian kelas" },
      { href: "/admin/kelas", label: "Manajemen Ruang Kelas", icon: DoorOpen, permissionId: "ruang_kelas", keywords: "ruangan fashl" },
      { href: "/admin/jadwal-mengajar", label: "Jadwal Mengajar", icon: Calendar, permissionId: "jadwal_mengajar", keywords: "plotting pengajar" },
    ],
  },
  {
    title: "Ujian Usbu'",
    items: [
      { href: "/admin/ujian-usbu/bank-soal", label: "Bank Soal", icon: Database, permissionId: "ujian_usbu", keywords: "cbt soal ujian" },
      { href: "/admin/ujian-usbu/qc-bank-soal", label: "QC Bank Soal", icon: ShieldCheck, permissionId: "ujian_usbu", keywords: "cek kualitas soal" },
      { href: "/admin/ujian-usbu/essay-review", label: "Review Essay", icon: ClipboardEdit, permissionId: "ujian_usbu", keywords: "koreksi ai esai" },
      { href: "/admin/ujian-usbu/review-jawaban", label: "Review Jawaban", icon: ClipboardCheck, permissionId: "ujian_usbu", keywords: "koreksi santri nilai cbt" },
      { href: "/admin/ujian-usbu/paket", label: "Paket Ujian", icon: CalendarCheck, permissionId: "ujian_usbu", keywords: "sesi token ujian" },
      { href: "/admin/ujian-usbu/monitoring", label: "Monitoring", icon: Activity, permissionId: "ujian_usbu", keywords: "live pantau ujian" },
    ],
  },
  {
    title: "Divisi Tauzi'",
    items: [
      { href: "/admin/tauzi", label: "Sesi Tauzi'", icon: CalendarCheck, permissionId: "tauzi_sesi", keywords: "penempatan awal" },
      { href: "/admin/tauzi/soal", label: "Bank Soal Tauzi'", icon: Database, permissionId: "tauzi_soal", keywords: "soal penempatan" },
      { href: "/admin/tauzi/nilai", label: "Input Nilai Tahriri", icon: ClipboardEdit, permissionId: "tauzi_nilai", keywords: "muqobalah nilai" },
      { href: "/admin/tauzi/hasil", label: "Hasil Tauzi'", icon: ListChecks, permissionId: "tauzi_hasil", keywords: "rekomendasi program" },
    ],
  },
  {
    title: "Akademik & Penilaian",
    items: [
      { href: "/admin/input-nilai-kelas", label: "Input Nilai", icon: BookOpen, permissionId: "input_nilai", keywords: "nilai mapel kelas" },
      { href: "/admin/nilai-kosong", label: "Nilai Kosong", icon: AlertTriangle, permissionId: "monitor_nilai_kosong", keywords: "belum dinilai" },
      { href: "/admin/cetak-usbu", label: "Cetak Nilai Pekanan", icon: Printer, permissionId: "cetak_nilai_pekanan", keywords: "rapor usbu print" },
      { href: "/admin/input-tasmi", label: "Input Tasmi'", icon: BookOpen, permissionId: "input_tasmi", keywords: "setoran hafalan" },
      { href: "/admin/pengaturan/tasmi-config", label: "Konfigurasi Tasmi'", icon: Settings, permissionId: "tasmi_config", keywords: "setting tasmi" },
      { href: "/admin/riwayat", label: "Riwayat Santri", icon: History, permissionId: "riwayat_santri", keywords: "histori alumni" },
    ],
  },
  {
    title: "Syahadah & Wisuda",
    items: [
      { href: "/admin/syahadah", label: "Data Syahadah", icon: GraduationCap, permissionId: "data_syahadah", keywords: "ijazah sertifikat cetak" },
      { href: "/admin/syahadah-offline", label: "Syahadah Offline", icon: GraduationCap, permissionId: "data_syahadah", keywords: "cetak f4 kertas blangko" },
      { href: "/admin/akbarnas-mc", label: "Layout Syahadah MC", icon: GraduationCap, permissionId: "data_syahadah", keywords: "akbarnas" },
      { href: "/admin/syahadah-online", label: "Syahadah Online", icon: GraduationCap, permissionId: "syahadah_online", keywords: "kursus online" },
      { href: "/layout-editor", label: "Layout Syahadah", icon: Palette, permissionId: "layout_syahadah", keywords: "desain template" },
      { href: "/admin/master-data", label: "Pengaturan Syahadah", icon: Settings, permissionId: "pengaturan_syahadah", keywords: "program mapel kkm" },
      { href: "/admin/martabah-ula", label: "Martabah Ula", icon: Medal, permissionId: "martabah_ula", keywords: "juara peringkat terbaik" },
      { href: "/admin/haflah-wada", label: "Haflah Wada'", icon: Armchair, permissionId: "haflah_wada", keywords: "wisuda perpisahan kursi" },
      { href: "/admin/thalib-mitsali", label: "Thalib Mitsali", icon: Trophy, permissionId: "thalib_mitsali", keywords: "santri teladan" },
    ],
  },
  {
    title: "Program Khusus",
    items: [
      { href: "/admin/nadi-hufadz", label: "Nadi Hufadz", icon: BookOpen, permissionId: "nadi_hufadz", keywords: "tahfidz quran" },
      { href: "/admin/munaqosah-hufadz", label: "Munaqosah Hufadz", icon: BookOpen, permissionId: "huffadz", keywords: "ujian tahfidz" },
      { href: "/admin/huffadz/tasmi", label: "Tasmi' Huffadz", icon: BookOpen, permissionId: "huffadz", keywords: "setoran huffadz" },
      { href: "/admin/tadrib-funun", label: "Tadrib Funun", icon: Palette, permissionId: "tadrib_funun", keywords: "seni kaligrafi" },
      { href: "/admin/ubudiyah", label: "Ubudiyah", icon: Moon, permissionId: "ubudiyah", keywords: "ibadah sholat" },
    ],
  },
  {
    title: "Divisi Kebahasaan",
    items: [
      { href: "/admin/mukholif", label: "Tabayun Mukholif", icon: AlertTriangle, permissionId: "mukholif_lughoh", keywords: "pelanggaran bahasa lughoh" },
      { href: "/admin/jasus", label: "Jasus", icon: Eye, permissionId: "jasus_manage", keywords: "pengawas bahasa" },
      { href: "/admin/lajnah", label: "Lajnah", icon: Shield, permissionId: "lajnah_manage", keywords: "pengurus bahasa" },
      { href: "/admin/lajnah/pemilihan", label: "Pemilihan Lajnah", icon: Vote, permissionId: "lajnah_manage", keywords: "voting lajnah" },
      { href: "/admin/monitoring-mukholif", label: "Monitoring Mukholif", icon: ClipboardCheck, permissionId: "monitoring_mukholif", keywords: "pantau pelanggaran" },
    ],
  },
  {
    title: "Markaz Turats",
    items: [
      { href: "/admin/osim", label: "OSIM", icon: Shield, permissionId: "osim_manage", keywords: "organisasi turats" },
      { href: "/admin/osim/pemilihan", label: "Pemilihan OSIM", icon: Vote, permissionId: "osim_manage", keywords: "voting osim" },
    ],
  },
  {
    title: "Publikasi & Layanan",
    items: [
      { href: "/admin/checkout", label: "Check Out Santri", icon: DoorOpen, permissionId: "checkout_pengajuan", keywords: "pulang berhenti keluar" },
      { href: "/admin/notifikasi", label: "Notifikasi Pengumuman", icon: Bell, permissionId: "notifikasi_kelola", keywords: "broadcast push fcm" },
      { href: "/admin/manajemen-konten/agenda", label: "Agenda Rutinan", icon: CalendarDays, permissionId: "agenda_rutinan", keywords: "jadwal kegiatan" },
      { href: "/admin/manajemen-konten/instagram", label: "Konten Instagram", icon: Instagram, permissionId: "konten_instagram", keywords: "medsos sosmed" },
      { href: "/admin/arsip-galeri", label: "Arsip Galeri", icon: Images, permissionId: "arsip_galeri", keywords: "foto dokumentasi drive" },
      { href: "/admin/galeri", label: "Lihat Galeri", icon: Images, keywords: "foto dokumentasi" },
    ],
  },
  {
    title: "Pengaturan & Sistem",
    items: [
      { href: "/admin/manajemen-user", label: "Manajemen User", icon: UserCog, permissionId: "manajemen_user", keywords: "akun staf pengajar" },
      { href: "/admin/manajemen-role", label: "Hak Akses (Role)", icon: ShieldCheck, permissionId: "manajemen_role", keywords: "permission izin" },
      { href: "/admin/checkout/config", label: "Konfigurasi Approver", icon: UserCog, permissionId: "checkout_config", keywords: "persetujuan checkout" },
      { href: "/admin/pengaturan/hari-libur", label: "Hari Libur", icon: Calendar, permissionId: "pengaturan_kegiatan", keywords: "tanggal merah libur" },
      { href: "/admin/denah-lokasi", label: "Denah Lokasi Sakan", icon: MapPin, permissionId: "pengaturan_kegiatan", keywords: "peta 3d map" },
      { href: "/admin/wifi", label: "Pusat Kontrol WiFi", icon: Wifi, permissionId: "manajemen_user", keywords: "voucher radius internet" },
    ],
  },
];

function isItemAllowed(item: NavItem, user: any, permissions: string[]): boolean {
  if (item.requiredRole && user?.role !== item.requiredRole) return false;
  if (item.requiredRoles && !item.requiredRoles.includes(user?.role)) return false;
  if (item.permissionId && !permissions.includes("*")) {
    const ids = Array.isArray(item.permissionId) ? item.permissionId : [item.permissionId];
    if (!ids.some((id) => permissions.includes(id))) return false;
  }
  return true;
}

export function Sidebar({ user, permissions = [] }: { user: any; permissions?: string[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLauncherOpen, setIsLauncherOpen] = useState(false);
  const [activeCtx, setActiveCtx] = useState<{ activeDufah: string | null; usbuLabel: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [launcherQuery, setLauncherQuery] = useState("");
  const [pinnedHrefs, setPinnedHrefs] = useState<string[]>([]);
  const [recentHrefs, setRecentHrefs] = useState<string[]>([]);
  const launcherInputRef = useRef<HTMLInputElement>(null);

  const storageKeyPin = `siakad_pinned_v1_${user?.userId || "anon"}`;
  const storageKeyRecent = `siakad_recent_v1_${user?.userId || "anon"}`;

  // Kumpulkan grup & item yang diizinkan untuk user ini
  const visibleGroups = useMemo(() => {
    return navigationGroups
      .map((group) => ({
        title: group.title,
        items: group.items.filter((item) => isItemAllowed(item, user, permissions)),
      }))
      .filter((group) => group.items.length > 0);
  }, [user, permissions]);

  const allowedItems = useMemo(() => {
    return visibleGroups.flatMap((group) =>
      group.items.map((item) => ({ ...item, groupTitle: group.title })),
    );
  }, [visibleGroups]);

  // Mode pintar aktif saat user memiliki > 10 menu
  const isPowerUser = allowedItems.length > 10;

  // Tentukan href aktif paling spesifik (hindari 2 item nyala sekaligus pada sub-route)
  const activeHref = useMemo(() => {
    if (!pathname) return null;
    let best: string | null = null;
    for (const item of allowedItems) {
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        if (!best || item.href.length > best.length) {
          best = item.href;
        }
      }
    }
    return best;
  }, [pathname, allowedItems]);

  const activeGroupTitle = useMemo(() => {
    if (!activeHref) return null;
    return allowedItems.find((i) => i.href === activeHref)?.groupTitle ?? null;
  }, [activeHref, allowedItems]);

  // State grup yang terbuka:
  // - User <= 10 menu: semua grup terbuka
  // - User > 10 menu: hanya "Utama" dan grup halaman aktif yang terbuka (hemat scroll!)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    if (!isPowerUser) return new Set(visibleGroups.map((g) => g.title));
    const initial = new Set<string>(["Utama"]);
    if (activeGroupTitle) initial.add(activeGroupTitle);
    return initial;
  });

  // Pastikan grup halaman aktif terbuka saat navigasi (dan pada power user jaga tetap ringkas)
  useEffect(() => {
    if (!isPowerUser) {
      setExpandedGroups(new Set(visibleGroups.map((g) => g.title)));
      return;
    }
    setExpandedGroups((prev) => {
      const next = new Set<string>();
      if (prev.has("Utama")) next.add("Utama");
      if (activeGroupTitle) next.add(activeGroupTitle);
      if (next.size === 0 && visibleGroups.length > 0) {
        next.add(visibleGroups[0].title);
      }
      return next;
    });
  }, [activeGroupTitle, isPowerUser, visibleGroups]);

  // Muat menu disematkan (pinned) & terakhir dibuka (recent) dari localStorage
  useEffect(() => {
    try {
      const rawPin = localStorage.getItem(storageKeyPin);
      if (rawPin) {
        const parsed = JSON.parse(rawPin);
        if (Array.isArray(parsed)) setPinnedHrefs(parsed.filter((x) => typeof x === "string"));
      }
      const rawRecent = localStorage.getItem(storageKeyRecent);
      if (rawRecent) {
        const parsed = JSON.parse(rawRecent);
        if (Array.isArray(parsed)) setRecentHrefs(parsed.filter((x) => typeof x === "string"));
      }
    } catch {
      /* abaikan error storage */
    }
  }, [storageKeyPin, storageKeyRecent]);

  // Catat halaman yang sedang dibuka ke daftar Terakhir Dibuka
  useEffect(() => {
    if (!activeHref) return;
    setRecentHrefs((prev) => {
      const next = [activeHref, ...prev.filter((h) => h !== activeHref)].slice(0, MAX_RECENT);
      try {
        localStorage.setItem(storageKeyRecent, JSON.stringify(next));
      } catch {
        /* abaikan */
      }
      return next;
    });
  }, [activeHref, storageKeyRecent]);

  // Shortcut keyboard Ctrl+K / Cmd+K untuk membuka Pencarian Cepat / App Launcher
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsLauncherOpen((open) => !open);
        setLauncherQuery("");
      } else if (e.key === "Escape" && isLauncherOpen) {
        setIsLauncherOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isLauncherOpen]);

  useEffect(() => {
    if (isLauncherOpen) {
      setTimeout(() => launcherInputRef.current?.focus(), 40);
    }
  }, [isLauncherOpen]);

  useEffect(() => {
    fetch("/api/admin/active-context")
      .then((res) => res.json())
      .then((data) => setActiveCtx(data))
      .catch((err) => console.error("Failed to load context", err));
  }, []);

  const toggleGroup = (title: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        if (isPowerUser && title !== "Utama") {
          // Mode accordion rapi: tutup grup lain selain Utama agar tidak jadi scroll panjang
          for (const key of Array.from(next)) {
            if (key !== "Utama") next.delete(key);
          }
        }
        next.add(title);
      }
      return next;
    });
  };

  const togglePin = (href: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPinnedHrefs((prev) => {
      let next: string[];
      if (prev.includes(href)) {
        next = prev.filter((h) => h !== href);
      } else {
        next = [href, ...prev].slice(0, MAX_PINNED);
      }
      try {
        localStorage.setItem(storageKeyPin, JSON.stringify(next));
      } catch {
        /* abaikan */
      }
      return next;
    });
  };

  const pinnedItems = useMemo(() => {
    return pinnedHrefs
      .map((href) => allowedItems.find((i) => i.href === href))
      .filter((i): i is NonNullable<typeof i> => Boolean(i));
  }, [pinnedHrefs, allowedItems]);

  const recentItems = useMemo(() => {
    return recentHrefs
      .filter((href) => href !== activeHref && !pinnedHrefs.includes(href))
      .map((href) => allowedItems.find((i) => i.href === href))
      .filter((i): i is NonNullable<typeof i> => Boolean(i))
      .slice(0, 3);
  }, [recentHrefs, activeHref, pinnedHrefs, allowedItems]);

  // Hasil pencarian di sidebar
  const sidebarSearchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return allowedItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.groupTitle.toLowerCase().includes(q) ||
        (item.keywords && item.keywords.toLowerCase().includes(q)),
    );
  }, [searchQuery, allowedItems]);

  // Hasil pencarian di modal App Launcher
  const launcherFilteredGroups = useMemo(() => {
    const q = launcherQuery.trim().toLowerCase();
    if (!q) return visibleGroups;
    return visibleGroups
      .map((group) => ({
        title: group.title,
        items: group.items.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            group.title.toLowerCase().includes(q) ||
            (item.keywords && item.keywords.toLowerCase().includes(q)),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [launcherQuery, visibleGroups]);

  // Bottom Navigation Mobile:
  // - Tombol "Absen Kelas" WAJIB selalu muncul di bottom navbar bagi setiap user yang punya akses!
  // - Sisa slot (hingga 4 item + tombol "Menu") diisi dari menu favorit (pinned), lalu menu utama.
  const showMenuInBottomNav = allowedItems.length > 5;
  const bottomNavItems = useMemo(() => {
    if (!showMenuInBottomNav) return allowedItems;

    const absenKelasItem = allowedItems.find((i) => i.href === ABSEN_KELAS_HREF);
    const result: typeof allowedItems = [];
    const seen = new Set<string>();
    const pushUnique = (item: (typeof allowedItems)[number] | undefined) => {
      if (!item || seen.has(item.href) || result.length >= 4) return;
      seen.add(item.href);
      result.push(item);
    };

    // 1. Jika user punya akses Absen Kelas, kunci di slot utama bottom navbar!
    // (Kecuali KSU yang menu pertamanya Absen Sakan: taruh Absen Sakan + Absen Kelas)
    const isKsu = (user?.role || "").toUpperCase() === "KSU";
    if (isKsu) {
      pushUnique(allowedItems.find((i) => i.href === "/admin/absensi/sakan"));
      pushUnique(absenKelasItem);
    } else {
      pushUnique(absenKelasItem);
    }

    // 2. Isi slot berikutnya dari menu yang dipin user
    for (const p of pinnedItems) {
      pushUnique(p);
    }

    // 3. Lengkapi sisa slot dari menu awal (Dashboard, Jadwal Saya, dst.)
    for (const item of allowedItems) {
      pushUnique(item);
    }

    return result;
  }, [allowedItems, pinnedItems, showMenuInBottomNav, user?.role]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (e) {
      console.error(e);
    }
  };

  const navigateTo = (href: string) => {
    setIsOpen(false);
    setIsLauncherOpen(false);
    setSearchQuery("");
    setLauncherQuery("");
    router.push(href);
  };

  const renderNavLink = (
    item: NavItem & { groupTitle?: string },
    options?: { showGroupSub?: boolean; showPin?: boolean },
  ) => {
    const isActive = activeHref === item.href;
    const isPinned = pinnedHrefs.includes(item.href);
    const Icon = item.icon;
    return (
      <li key={`${options?.showGroupSub ? "srch-" : ""}${item.href}`}>
        <div className="relative group/item flex items-center">
          <Link
            href={item.href}
            onClick={() => {
              setIsOpen(false);
              setSearchQuery("");
            }}
            className={`neu-nav-item flex-1 min-w-0 flex items-center gap-2.5 text-[13px] ${
              options?.showPin ? "!pr-8" : ""
            } ${isActive ? "active" : ""}`}
            style={!isActive ? { color: "var(--color-text-muted)" } : undefined}
          >
            <Icon
              className="h-[17px] w-[17px] shrink-0 transition-colors"
              style={{ color: isActive ? "var(--color-primary)" : "var(--color-text-subtle)" }}
            />
            <span className="truncate flex-1">
              <span className="block truncate">{item.label}</span>
              {options?.showGroupSub && item.groupTitle && (
                <span className="block text-[10px] font-medium opacity-70 truncate">
                  {item.groupTitle}
                </span>
              )}
            </span>
          </Link>
          {options?.showPin && isPowerUser && (
            <button
              type="button"
              onClick={(e) => togglePin(item.href, e)}
              title={isPinned ? "Lepas dari Akses Cepat" : "Sematkan ke Akses Cepat"}
              aria-label={isPinned ? `Lepas pin ${item.label}` : `Pin ${item.label}`}
              className={`absolute right-1.5 p-1 rounded-md transition-opacity ${
                isPinned
                  ? "opacity-100 text-amber-500"
                  : "opacity-40 lg:opacity-0 lg:group-hover/item:opacity-100 text-slate-400 hover:text-amber-500"
              }`}
            >
              <Star size={13} fill={isPinned ? "currentColor" : "none"} />
            </button>
          )}
        </div>
      </li>
    );
  };

  return (
    <>
      {/* Mobile Top Bar */}
      <div
        className="lg:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-30"
        style={{ background: "var(--bg-app)", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
      >
        <div className="flex items-center gap-2.5">
          <Image
            src="/images/logo-siakad-horizontal.png"
            alt="Logo SIAKAD Markaz Arabiyah"
            width={104}
            height={32}
            className="h-8 w-auto"
          />
        </div>
        <div className="flex items-center gap-1">
          {allowedItems.length > 6 && (
            <button
              type="button"
              onClick={() => {
                setIsLauncherOpen(true);
                setLauncherQuery("");
              }}
              aria-label="Cari & Semua Menu"
              className="p-2 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
              style={{ color: "var(--color-primary)" }}
            >
              <Search className="h-5 w-5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Buka menu navigasi"
            className="p-2 -mr-2 transition-colors rounded-lg"
            style={{ color: "var(--color-text-muted)" }}
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Bottom Navigation for Mobile */}
      <div
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 px-2 py-1.5 flex items-center justify-around pb-safe"
        style={{ background: "var(--bg-app)", boxShadow: "0 -4px 12px rgba(0,0,0,0.06)" }}
      >
        {bottomNavItems.map((item) => {
          const isActive = activeHref === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className="flex flex-col items-center justify-center gap-1 w-16 h-12 rounded-xl transition-all"
              style={
                isActive
                  ? {
                      color: "var(--color-primary)",
                      boxShadow: "var(--shadow-raised-sm)",
                      background: "#ffffff",
                    }
                  : { color: "var(--color-text-subtle)" }
              }
            >
              <Icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[9px] font-bold text-center leading-tight truncate w-full px-1">
                {item.label}
              </span>
            </Link>
          );
        })}
        {showMenuInBottomNav && (
          <button
            type="button"
            onClick={() => {
              if (isPowerUser) {
                setIsLauncherOpen(true);
                setLauncherQuery("");
              } else {
                setIsOpen(true);
              }
            }}
            className="flex flex-col items-center justify-center gap-1 w-16 h-12 rounded-xl transition-colors"
            style={
              isOpen || isLauncherOpen
                ? {
                    color: "var(--color-primary)",
                    boxShadow: "var(--shadow-raised-sm)",
                    background: "#ffffff",
                  }
                : { color: "var(--color-text-subtle)" }
            }
          >
            {isPowerUser ? (
              <LayoutGrid className="h-[22px] w-[22px]" strokeWidth={isLauncherOpen ? 2.5 : 2} />
            ) : (
              <Menu className="h-[22px] w-[22px]" strokeWidth={isOpen ? 2.5 : 2} />
            )}
            <span className="text-[9px] font-bold text-center leading-tight">
              {isPowerUser ? "Menu" : "Lainnya"}
            </span>
          </button>
        )}
      </div>

      {/* Backdrop Sidebar Mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: "rgba(30,41,56,0.4)", backdropFilter: "blur(4px)" }}
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Modal App Launcher & Pencarian Cepat (Ctrl+K) */}
      {isLauncherOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-start justify-center p-3 sm:p-6 pt-12 sm:pt-16 overflow-y-auto"
          style={{ background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)" }}
          onClick={() => setIsLauncherOpen(false)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl border flex flex-col max-h-[82vh]"
            style={{ background: "var(--bg-app)", borderColor: "var(--color-surface-dark)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Search */}
            <div className="p-3.5 sm:p-4 bg-white border-b flex items-center gap-2.5" style={{ borderColor: "var(--color-surface-dark)" }}>
              <Search size={18} style={{ color: "var(--color-primary)" }} className="shrink-0" />
              <input
                ref={launcherInputRef}
                type="text"
                value={launcherQuery}
                onChange={(e) => setLauncherQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const first = launcherFilteredGroups[0]?.items[0];
                    if (first) navigateTo(first.href);
                  }
                }}
                placeholder="Cari menu, fitur, atau divisi... (mis. absen, nilai, izin, syahadah)"
                className="flex-1 bg-transparent outline-none text-sm font-semibold"
                style={{ color: "var(--color-text)" }}
              />
              {launcherQuery && (
                <button
                  type="button"
                  onClick={() => setLauncherQuery("")}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsLauncherOpen(false)}
                className="px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                Tutup
              </button>
            </div>

            {/* Body Grid */}
            <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-5">
              {/* Pinned Favorites saat tidak sedang mengetik query */}
              {!launcherQuery.trim() && pinnedItems.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-amber-600 mb-2">
                    <Star size={12} fill="currentColor" /> Akses Cepat (Disematkan)
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {pinnedItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeHref === item.href;
                      return (
                        <button
                          key={`lp-${item.href}`}
                          type="button"
                          onClick={() => navigateTo(item.href)}
                          className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white border text-left transition-all hover:shadow-md"
                          style={{
                            borderColor: isActive ? "var(--color-primary)" : "#e2e8f0",
                            color: isActive ? "var(--color-primary)" : "var(--color-text)",
                          }}
                        >
                          <div
                            className="p-2 rounded-lg shrink-0"
                            style={{ background: "var(--color-primary-50)", color: "var(--color-primary)" }}
                          >
                            <Icon size={16} />
                          </div>
                          <span className="text-xs font-bold leading-snug line-clamp-2 flex-1">
                            {item.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Semua Grup */}
              {launcherFilteredGroups.length === 0 ? (
                <div className="text-center py-10 text-sm font-medium" style={{ color: "var(--color-text-subtle)" }}>
                  Tidak ada menu yang cocok dengan &ldquo;{launcherQuery}&rdquo;.
                </div>
              ) : (
                launcherFilteredGroups.map((group) => (
                  <div key={`lg-${group.title}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="text-[11px] font-black uppercase tracking-[0.14em]"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        {group.title}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-600">
                        {group.items.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeHref === item.href;
                        const isPinned = pinnedHrefs.includes(item.href);
                        return (
                          <div
                            key={`li-${item.href}`}
                            onClick={() => navigateTo(item.href)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                navigateTo(item.href);
                              }
                            }}
                            className="relative group/card flex items-center gap-2.5 p-2.5 pr-8 rounded-xl bg-white border text-left cursor-pointer transition-all hover:shadow-md"
                            style={{
                              borderColor: isActive ? "var(--color-primary)" : "#e2e8f0",
                              background: isActive ? "var(--color-primary-50)" : "#ffffff",
                            }}
                          >
                            <div
                              className="p-2 rounded-lg shrink-0"
                              style={{
                                background: isActive ? "var(--color-primary)" : "#f1f5f9",
                                color: isActive ? "#ffffff" : "var(--color-primary)",
                              }}
                            >
                              <Icon size={16} />
                            </div>
                            <span
                              className="text-xs font-bold leading-snug line-clamp-2 flex-1"
                              style={{ color: isActive ? "var(--color-primary-dark)" : "var(--color-text)" }}
                            >
                              {item.label}
                            </span>
                            {isPowerUser && (
                              <button
                                type="button"
                                onClick={(e) => togglePin(item.href, e)}
                                title={isPinned ? "Lepas pin" : "Sematkan ke Akses Cepat"}
                                className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md ${
                                  isPinned
                                    ? "text-amber-500"
                                    : "text-slate-300 hover:text-amber-500"
                                }`}
                              >
                                <Star size={13} fill={isPinned ? "currentColor" : "none"} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sidebar Content */}
      <aside
        className={`neu-sidebar fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 overflow-y-auto flex flex-col ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo Area */}
        <div className="hidden lg:flex flex-col p-4 pb-2 items-center justify-center">
          <div className="neu-card p-3.5 flex flex-col items-center gap-2 w-full">
            <Image
              src="/images/logo-siakad-stacked.png"
              alt="Logo SIAKAD Markaz Arabiyah"
              width={150}
              height={163}
              className="h-auto w-[145px]"
            />
          </div>
        </div>

        <nav className="flex-1 p-3.5 space-y-2 mt-3 lg:mt-0 overflow-y-auto">
          {/* Active Context Information */}
          {activeCtx && activeCtx.activeDufah && (
            <div className="px-0.5 mb-2">
              <div
                className="neu-inset flex items-center justify-center gap-2 px-3 py-2 text-[11px] font-bold"
                style={{ color: "var(--color-primary)" }}
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full animate-pulse"
                  style={{ background: "var(--color-success)" }}
                />
                Aktif: {activeCtx.activeDufah} • {activeCtx.usbuLabel}
              </div>
            </div>
          )}

          {/* Pencarian Cepat + Tombol App Launcher (muncul saat menu > 6) */}
          {allowedItems.length > 6 && (
            <div className="flex items-center gap-1.5 mb-2">
              <div className="relative flex-1 min-w-0">
                <Search
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: "var(--color-text-subtle)" }}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && sidebarSearchResults[0]) {
                      navigateTo(sidebarSearchResults[0].href);
                    }
                  }}
                  placeholder="Cari menu... (Ctrl+K)"
                  className="neu-input w-full !py-1.5 !pl-8 !pr-7 text-xs font-semibold"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Hapus pencarian"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              {isPowerUser && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setIsLauncherOpen(true);
                    setLauncherQuery("");
                  }}
                  title="Tampilkan Semua Menu (Grid)"
                  aria-label="Tampilkan Semua Menu"
                  className="p-2 rounded-xl shrink-0 bg-white border transition-all hover:shadow-sm"
                  style={{
                    borderColor: "var(--color-surface-dark)",
                    color: "var(--color-primary)",
                  }}
                >
                  <LayoutGrid size={15} />
                </button>
              )}
            </div>
          )}

          {/* MODE HASIL PENCARIAN */}
          {searchQuery.trim() ? (
            <div className="space-y-1">
              <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                Hasil Pencarian ({sidebarSearchResults.length})
              </div>
              {sidebarSearchResults.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-slate-400">
                  Menu tidak ditemukan.
                </div>
              ) : (
                <ul className="space-y-0.5">
                  {sidebarSearchResults.map((item) =>
                    renderNavLink(item, { showGroupSub: true, showPin: true }),
                  )}
                </ul>
              )}
            </div>
          ) : (
            <>
              {/* AKSES CEPAT (PINNED FAVORITES) */}
              {isPowerUser && pinnedItems.length > 0 && (
                <div className="mb-2 pb-2 border-b" style={{ borderColor: "var(--color-surface-dark)" }}>
                  <div className="flex items-center justify-between px-2.5 py-1">
                    <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-amber-600">
                      <Star size={11} fill="currentColor" /> Akses Cepat
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      {pinnedItems.length}/{MAX_PINNED}
                    </span>
                  </div>
                  <ul className="space-y-0.5 mt-0.5 pl-0.5">
                    {pinnedItems.map((item) => renderNavLink(item, { showPin: true }))}
                  </ul>
                </div>
              )}

              {/* TERAKHIR DIBUKA (RECENT) */}
              {isPowerUser && recentItems.length > 0 && (
                <div className="mb-2 px-1">
                  <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1.5 mb-1">
                    <Clock size={10} /> Terakhir Dibuka
                  </div>
                  <div className="flex flex-wrap gap-1 px-1">
                    {recentItems.map((item) => (
                      <Link
                        key={`rec-${item.href}`}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-white border hover:border-[var(--color-primary)] transition-colors truncate max-w-full"
                        style={{
                          borderColor: "var(--color-surface-dark)",
                          color: "var(--color-text-muted)",
                        }}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* DAFTAR GRUP MENU (SMART ACCORDION) */}
              {visibleGroups.map((group) => {
                const isExpanded = expandedGroups.has(group.title);
                const hasActiveChild = group.items.some((item) => activeHref === item.href);

                return (
                  <div key={group.title} className="mb-0.5">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.title)}
                      className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors cursor-pointer hover:bg-white/60"
                      style={{
                        color: hasActiveChild
                          ? "var(--color-primary)"
                          : "var(--color-text-subtle)",
                      }}
                    >
                      <span className="text-[11px] font-black uppercase tracking-[0.12em] text-left truncate pr-2">
                        {group.title}
                      </span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        {isPowerUser && (
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                            style={{
                              background: hasActiveChild
                                ? "var(--color-primary-50)"
                                : "rgba(148,163,184,0.16)",
                              color: hasActiveChild
                                ? "var(--color-primary)"
                                : "var(--color-text-subtle)",
                            }}
                          >
                            {group.items.length}
                          </span>
                        )}
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform duration-200 ${
                            isExpanded ? "rotate-0" : "-rotate-90"
                          }`}
                        />
                      </span>
                    </button>

                    <div
                      className={`overflow-hidden transition-all duration-200 ease-in-out ${
                        isExpanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
                      }`}
                    >
                      <ul className="space-y-0.5 mt-0.5 pl-1">
                        {group.items.map((item) =>
                          renderNavLink(item, { showPin: true }),
                        )}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </nav>

        {/* User Card */}
        <div className="p-3.5 pt-2 border-t" style={{ borderColor: "var(--color-surface-dark)" }}>
          <div className="neu-inset p-3.5 rounded-xl">
            <p className="text-sm font-bold truncate" style={{ color: "var(--color-text)" }}>
              {user?.nama}
            </p>
            <p className="text-xs mt-0.5 mb-2.5 truncate" style={{ color: "var(--color-text-subtle)" }}>
              {user?.role}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="https://bawwabah.markazarabiyah.site/dashboard"
                className="flex items-center justify-center gap-1.5 font-bold py-2 px-2.5 rounded-lg transition-all text-xs"
                style={{
                  background: "var(--color-primary)",
                  color: "#fff",
                  boxShadow: "var(--shadow-flat)",
                }}
              >
                <Globe size={14} />
                Bawwabah
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center justify-center gap-1.5 font-bold py-2 px-2.5 rounded-lg transition-all text-xs"
                style={{
                  background: "var(--color-danger-light)",
                  color: "var(--color-danger)",
                  boxShadow: "var(--shadow-flat)",
                }}
              >
                <LogOut size={14} />
                Logout
              </button>
            </div>
          </div>
          {/* Mobile footer */}
          <div className="lg:hidden mt-2.5 text-center">
            <p className="text-[10px] font-semibold" style={{ color: "var(--color-text-subtle)" }}>
              Developed by <span className="font-bold" style={{ color: "var(--color-primary)" }}>Aksara X</span> KSU Batch 10
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
