"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Users, DoorOpen, GraduationCap, History, Settings, Menu, X, CalendarCheck, Bed, BookOpen, Activity, BarChart3, Printer, CalendarDays, Instagram, Palette, UserCog, LogOut, ShieldCheck, Calendar, Medal, Armchair, ChevronDown, AlertTriangle, FileText, ClipboardList, Trophy, ClipboardEdit, Database, ListChecks, QrCode, Shield, ClipboardCheck, Eye } from "lucide-react";
import { useState, useEffect } from "react";
import { SyncSantriButton } from "./sync-santri-button";

const navigationGroups = [
  {
    title: "Utama",
    items: [
      { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, permissionId: "dashboard" },
      { href: "/admin/jadwal-saya", label: "Jadwal Saya", icon: Calendar, permissionId: "jadwal_saya" },
    ]
  },
  {
    title: "Divisi Angkatan (Duf'ah)",
    items: [
      { href: "/admin/dufah", label: "Manajemen Angkatan & Usbu'", icon: CalendarCheck, permissionId: "manajemen_dufah" },
    ]
  },
  {
    title: "Divisi Data Santri",
    items: [
      { href: "/admin/data-santri", label: "Data Santri Duf'ah", icon: Users, permissionId: "data_santri_dufah" },
      { href: "/admin/ketua-kelas", label: "Ketua Kelas", icon: ShieldCheck, permissionId: "data_santri" },
    ]
  },
  {
    title: "Divisi Absensi",
    items: [
      { href: "/admin/absensi/sakan", label: "Absen Sakan", icon: Bed, permissionId: "absen_sakan" },
      { href: "/admin/absensi/kelas", label: "Absen Kelas", icon: BookOpen, permissionId: "absen_kelas" },
      { href: "/admin/jadwal-sesi", label: "Jadwal Buka/Tutup Sesi", icon: CalendarCheck, permissionId: "manajemen_sesi" },
      { href: "/admin/absensi/kegiatan", label: "Absen Kegiatan", icon: Activity, permissionId: "absen_kegiatan" },
      { href: "/admin/absensi/kegiatan/buka-sesi", label: "Buka Sesi Absen", icon: QrCode, permissionId: "absen_kegiatan" },
      { href: "/admin/absensi/tabirot", label: "Absen Ta'birot", icon: Users, permissionId: "absen_tabirot" },
      { href: "/admin/absensi/rekap/sakan", label: "Rekap Sakan", icon: Bed, permissionId: "rekap_sakan" },
      { href: "/admin/absensi/rekap/kegiatan", label: "Rekap Kegiatan", icon: Activity, permissionId: "rekap_kegiatan" },
      { href: "/admin/absensi/rekap/tabirot", label: "Rekap Ta'birot", icon: Users, permissionId: "rekap_tabirot" },
      { href: "/admin/absensi/rekap/kelas", label: "Rekap Kelas", icon: BookOpen, permissionId: "rekap_kelas" },
      { href: "/admin/absensi/rekap/pengajar", label: "Rekap Pengajar", icon: UserCog, permissionId: "rekap_pengajar" },
      { href: "/admin/absensi/pengaturan", label: "Pengaturan Kegiatan", icon: Settings, permissionId: "pengaturan_kegiatan" },
      { href: "/admin/absensi/perizinan", label: "Perizinan Santri", icon: FileText, permissionId: "perizinan_harian" },
      { href: "/admin/absensi/perizinan/data", label: "Data Santri Izin", icon: ClipboardList, permissionId: "perizinan_data" },
    ]
  },
  {
    title: "Divisi Kelas",
    items: [
      { href: "/admin/manajemen-kelas", label: "Alokasi Kelas", icon: Users, permissionId: "alokasi_kelas" },
      { href: "/admin/kelas", label: "Manajemen Ruang Kelas", icon: DoorOpen, permissionId: "ruang_kelas" },
      { href: "/admin/jadwal-mengajar", label: "Jadwal Mengajar", icon: Calendar, permissionId: "jadwal_mengajar" },
    ]
  },
  {
    title: "Divisi Tauzi'",
    items: [
      { href: "/admin/tauzi", label: "Sesi Tauzi'", icon: CalendarCheck, permissionId: "tauzi_sesi" },
      { href: "/admin/tauzi/soal", label: "Bank Soal", icon: Database, permissionId: "tauzi_soal" },
      { href: "/admin/tauzi/nilai", label: "Input Nilai Tahriri", icon: ClipboardEdit, permissionId: "tauzi_nilai" },
      { href: "/admin/tauzi/hasil", label: "Hasil Tauzi'", icon: ListChecks, permissionId: "tauzi_hasil" },
    ]
  },
  {
    title: "Ujian Usbu'",
    items: [
      { href: "/admin/ujian-usbu/bank-soal", label: "Bank Soal", icon: Database, permissionId: "ujian_usbu" },
      { href: "/admin/ujian-usbu/qc-bank-soal", label: "QC Bank Soal", icon: ShieldCheck, permissionId: "ujian_usbu" },
      { href: "/admin/ujian-usbu/essay-review", label: "Review Essay", icon: ClipboardEdit, permissionId: "ujian_usbu" },
      { href: "/admin/ujian-usbu/review-jawaban", label: "Review Jawaban", icon: ClipboardCheck, permissionId: "ujian_usbu" },
      { href: "/admin/ujian-usbu/paket", label: "Paket Ujian", icon: CalendarCheck, permissionId: "ujian_usbu" },
      { href: "/admin/ujian-usbu/monitoring", label: "Monitoring", icon: Activity, permissionId: "ujian_usbu" },
    ],
  },
  {
    title: "Divisi Syahadah",
    items: [
      { href: "/admin/syahadah", label: "Data Syahadah", icon: GraduationCap, permissionId: "data_syahadah" },
      { href: "/admin/syahadah-online", label: "Syahadah Online", icon: GraduationCap, permissionId: "syahadah_online" },
      { href: "/admin/martabah-ula", label: "Martabah Ula", icon: Medal, permissionId: "martabah_ula" },
      { href: "/admin/haflah-wada", label: "Haflah Wada'", icon: Armchair, permissionId: "haflah_wada" },
      { href: "/admin/input-tasmi", label: "Input Tasmi'", icon: BookOpen, permissionId: "input_tasmi" },
      { href: "/admin/input-nilai-kelas", label: "Input Nilai", icon: BookOpen, permissionId: "input_nilai" },
      { href: "/admin/nilai-kosong", label: "Nilai Kosong", icon: AlertTriangle, permissionId: "monitor_nilai_kosong" },
      { href: "/admin/cetak-usbu", label: "Cetak Nilai Pekanan", icon: Printer, permissionId: "cetak_nilai_pekanan" },
      { href: "/admin/thalib-mitsali", label: "Thalib Mitsali", icon: Trophy, permissionId: "thalib_mitsali" },
      { href: "/layout-editor", label: "Layout Syahadah", icon: Palette, permissionId: "layout_syahadah" },
      { href: "/admin/riwayat", label: "Riwayat Santri", icon: History, permissionId: "riwayat_santri" },
      { href: "/admin/pengaturan/tasmi-config", label: "Konfigurasi Tasmi'", icon: Settings, permissionId: "tasmi_config" },
      { href: "/admin/master-data", label: "Pengaturan Syahadah", icon: Settings, permissionId: "pengaturan_syahadah" },
    ]
  },
  {
    title: "Manajemen Aplikasi",
    items: [
      { href: "/admin/checkout", label: "Check Out Santri", icon: DoorOpen, permissionId: "checkout_pengajuan" },
      { href: "/admin/checkout/config", label: "Konfigurasi Approver", icon: UserCog, permissionId: "checkout_config" },
      { href: "/admin/manajemen-user", label: "Manajemen User", icon: UserCog, permissionId: "manajemen_user" },
      { href: "/admin/manajemen-role", label: "Hak Akses (Role)", icon: ShieldCheck, permissionId: "manajemen_role" },
      { href: "/admin/pengaturan/hari-libur", label: "Hari Libur", icon: Calendar, permissionId: "pengaturan_kegiatan" },
      { href: "/admin/manajemen-konten/agenda", label: "Agenda Rutinan", icon: CalendarDays, permissionId: "agenda_rutinan" },
      { href: "/admin/manajemen-konten/instagram", label: "Konten Instagram", icon: Instagram, permissionId: "konten_instagram" },
    ]
  },
  {
    title: "Divisi Kebahasaan",
    items: [
      { href: "/admin/mukholif", label: "Tabayun Mukholif", icon: AlertTriangle, permissionId: "mukholif_lughoh" },
      { href: "/admin/jasus", label: "Jasus", icon: Eye, permissionId: "jasus_manage" },
      { href: "/admin/lajnah", label: "Lajnah", icon: Shield, permissionId: "lajnah_manage" },
      { href: "/admin/monitoring-mukholif", label: "Monitoring Mukholif", icon: ClipboardCheck, permissionId: "monitoring_mukholif" },
    ]
  }
];

export function Sidebar({ user, permissions = [] }: { user: any, permissions?: string[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [activeCtx, setActiveCtx] = useState<{ activeDufah: string | null; usbuLabel: string } | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Auto-expand group that contains the active page
  useEffect(() => {
    const activeGroup = navigationGroups.find(group =>
      group.items.some((item: any) => pathname === item.href || pathname?.startsWith(`${item.href}/`))
    );
    if (activeGroup) {
      setCollapsedGroups(prev => {
        const next = new Set(prev);
        next.delete(activeGroup.title);
        return next;
      });
    }
  }, [pathname]);

  const toggleGroup = (title: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };

  // Kumpulkan semua menu yang diizinkan untuk user ini
  const allowedItems: any[] = [];
  navigationGroups.forEach((group) => {
    group.items.forEach((item: any) => {
      let allowed = true;
      if (item.requiredRole && user?.role !== item.requiredRole) allowed = false;
      if (item.requiredRoles && !item.requiredRoles.includes(user?.role)) allowed = false;
      if (item.permissionId && !permissions.includes("*") && !permissions.includes(item.permissionId)) allowed = false;
      if (allowed) allowedItems.push(item);
    });
  });

  const showMenuInBottomNav = allowedItems.length > 5;
  const bottomNavItems = showMenuInBottomNav ? allowedItems.slice(0, 4) : allowedItems;

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetch("/api/admin/active-context")
      .then((res) => res.json())
      .then((data) => setActiveCtx(data))
      .catch((err) => console.error("Failed to load context", err));
  }, []);

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-30" style={{ background: "var(--bg-app)", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        <div className="flex items-center gap-2.5">
          <Image
            src="/images/Logo Markaz.png"
            alt="Logo Markaz Arabiyah"
            width={32}
            height={32}
            className="rounded-lg"
            style={{ boxShadow: "var(--shadow-flat)" }}
          />
          <span className="font-bold tracking-wide text-sm font-display" style={{ color: "var(--color-text)" }}>Markaz Arabiyah</span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 -mr-2 transition-colors rounded-lg"
          style={{ color: "var(--color-text-muted)" }}
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Bottom Navigation for Mobile */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 px-2 py-1.5 flex items-center justify-around pb-safe" style={{ background: "var(--bg-app)", boxShadow: "0 -4px 12px rgba(0,0,0,0.06)" }}>
        {bottomNavItems.map(item => {
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} onClick={() => setIsOpen(false)} className="flex flex-col items-center justify-center gap-1 w-16 h-12 rounded-xl transition-all" style={isActive ? { color: "var(--color-primary)", boxShadow: "var(--shadow-raised-sm)", background: "#ffffff" } : { color: "var(--color-text-subtle)" }}>
              <Icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[9px] font-bold text-center leading-tight truncate w-full px-1">{item.label}</span>
            </Link>
          )
        })}
        {showMenuInBottomNav && (
          <button onClick={() => setIsOpen(true)} className="flex flex-col items-center justify-center gap-1 w-16 h-12 rounded-xl transition-colors" style={isOpen ? { color: "var(--color-primary)", boxShadow: "var(--shadow-raised-sm)", background: "#ffffff" } : { color: "var(--color-text-subtle)" }}>
            <Menu className="h-[22px] w-[22px]" strokeWidth={isOpen ? 2.5 : 2} />
            <span className="text-[9px] font-bold text-center leading-tight">Lainnya</span>
          </button>
        )}
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: "rgba(30,41,56,0.4)", backdropFilter: "blur(4px)" }}
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Content */}
      <aside
        className={`neu-sidebar fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 overflow-y-auto flex flex-col ${isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        {/* Logo Area */}
        <div className="hidden lg:flex flex-col p-5 items-center justify-center">
          <div className="neu-card p-4 flex flex-col items-center gap-3 w-full">
            <Image
              src="/images/Logo Markaz.png"
              alt="Logo Markaz Arabiyah"
              width={56}
              height={56}
              className="rounded-xl"
            />
            <h1 className="text-center text-[14px] font-bold tracking-wide leading-tight font-display" style={{ color: "var(--color-text)" }}>
              Sistem Akademik<br />
              <span className="font-bold text-[13px] tracking-normal" style={{ color: "var(--color-primary)" }}>Markaz Arabiyah</span>
            </h1>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 mt-4 lg:mt-0 overflow-y-auto">
          {/* Active Context Information */}
          {activeCtx && activeCtx.activeDufah && (
            <div className="px-1 mb-3 lg:mt-0 mt-2">
              <div className="neu-inset flex items-center justify-center gap-2 px-3 py-2.5 text-[11px] font-bold" style={{ color: "var(--color-primary)" }}>
                <span className="h-1.5 w-1.5 shrink-0 rounded-full animate-pulse" style={{ background: "var(--color-success)" }} />
                Aktif: {activeCtx.activeDufah} • {activeCtx.usbuLabel}
              </div>
            </div>
          )}

          {navigationGroups.map((group) => {
            const filteredItems = group.items.filter((item: any) => {
              if (item.requiredRole && user?.role !== item.requiredRole) return false;
              if (item.requiredRoles && !item.requiredRoles.includes(user?.role)) return false;

              // Filter permission
              if (item.permissionId && !permissions.includes("*") && !permissions.includes(item.permissionId)) {
                return false;
              }

              return true;
            });

            if (filteredItems.length === 0) return null;

            const isCollapsed = collapsedGroups.has(group.title);
            const hasActiveChild = filteredItems.some((item: any) =>
              pathname === item.href || pathname?.startsWith(`${item.href}/`)
            );

            return (
              <div key={group.title} className="mb-1">
                <button
                  onClick={() => toggleGroup(group.title)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors cursor-pointer group"
                  style={{ color: hasActiveChild ? "var(--color-primary)" : "var(--color-text-subtle)" }}
                >
                  <span className="text-[11px] font-black uppercase tracking-[0.15em]">
                    {group.title}
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}
                  />
                </button>

                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[1000px] opacity-100'}`}>
                  <ul className="space-y-0.5 mt-1 pl-1">
                    {filteredItems.map((item) => {
                      const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                      const Icon = item.icon;
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setIsOpen(false)}
                            className={`neu-nav-item group flex items-center gap-3 text-[13px] ${isActive ? 'active' : ''}`}
                            style={!isActive ? { color: "var(--color-text-muted)" } : undefined}
                          >
                            <Icon className="h-[18px] w-[18px] transition-colors" style={{ color: isActive ? "var(--color-primary)" : "var(--color-text-subtle)" }} />
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>

              </div>
            );
          })}
        </nav>

        {/* Sync Button */}
        {user?.role === "ADMIN" && (
          <div className="px-4 mt-auto pt-2">
            <SyncSantriButton />
          </div>
        )}

        {/* User Card */}
        <div className="p-4 pt-0">
          <div className="neu-inset p-4 rounded-xl">
            <p className="text-sm font-bold" style={{ color: "var(--color-text)" }}>{user?.nama}</p>
            <p className="text-xs mt-0.5 mb-3" style={{ color: "var(--color-text-subtle)" }}>{user?.role}</p>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 font-bold py-2 px-3 rounded-lg transition-all text-sm"
              style={{
                background: "var(--color-danger-light)",
                color: "var(--color-danger)",
                boxShadow: "var(--shadow-flat)"
              }}
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
          {/* Mobile footer */}
          <div className="lg:hidden mt-3 text-center">
            <p className="text-[10px] font-semibold" style={{ color: "var(--color-text-subtle)" }}>
              Developed by <span className="font-bold" style={{ color: "var(--color-primary)" }}>Aksara X</span> KSU Batch 10
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
