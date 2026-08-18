"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  FileText,
  CalendarCheck,
  Clock,
  Shield,
  RefreshCw,
  LogOut,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  MapPin,
  DoorOpen,
  ClipboardCheck,
  AlertTriangle
} from "lucide-react";
import { useState } from "react";

const baseNavItems = [
  { href: "/santri/dashboard", label: "Beranda", icon: LayoutDashboard },
  { href: "/santri/nilai", label: "Nilai", icon: FileText },
  { href: "/santri/ujian", label: "Ujian", icon: ClipboardCheck },
  { href: "/santri/absen-kegiatan", label: "Absen Mandiri", icon: CalendarCheck },
  { href: "/santri/absensi", label: "Absensi", icon: CalendarCheck },
  { href: "/santri/riwayat", label: "Riwayat", icon: Clock },
  { href: "/santri/perizinan", label: "Perizinan", icon: Shield },
  { href: "/santri/daftar-ulang", label: "Daftar Ulang", icon: RefreshCw },
  { href: "/santri/checkout", label: "Check Out", icon: DoorOpen },
];

export function SantriSidebar({
  nama,
  isAktif,
  isKetuaKelas,
  isLajnah,
  isJasus
}: {
  nama: string;
  isAktif: boolean;
  isKetuaKelas?: boolean;
  isLajnah?: boolean;
  isJasus?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  let navItems = isKetuaKelas 
    ? [...baseNavItems, { href: "/santri/berita-acara", label: "Berita Acara", icon: ClipboardCheck }]
    : [...baseNavItems];

  if (isJasus || isLajnah) {
    navItems = [...navItems, { href: "/santri/mukholif", label: "Lapor Mukholif", icon: AlertTriangle }];
  }

  if (isLajnah) {
    navItems = [...navItems, { href: "/santri/eksekusi-mukholif", label: "Eksekusi Iqob", icon: Shield }];
  }

  const handleLogout = async () => {
    await fetch("/api/santri/auth/logout", { method: "POST" });
    router.push("/santri/login");
    router.refresh();
  };

  const sidebarContent = (
    <>
      {/* Header */}
      <div className="p-4 flex items-center gap-3">
        <div
          className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
          style={{
            background: "var(--color-primary)",
            color: "#fff",
            boxShadow:
              "3px 3px 8px rgba(0,102,102,0.3), -2px -2px 6px rgba(0,133,133,0.15)",
          }}
        >
          <GraduationCap size={20} />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <h2
              className="text-sm font-bold truncate"
              style={{ color: "var(--color-text)" }}
            >
              SIAKAD
            </h2>
            <p
              className="text-[10px] font-semibold truncate"
              style={{ color: "var(--color-primary)" }}
            >
              Markaz Arabiyah
            </p>
          </div>
        )}
      </div>

      {/* User Info */}
      {!collapsed && (
        <div className="mx-4 mb-4">
          <div
            className="rounded-xl p-3"
            style={{
              background: "var(--color-primary-50)",
              boxShadow: "var(--shadow-inset-sm)",
            }}
          >
            <p
              className="text-xs font-bold truncate"
              style={{ color: "var(--color-text)" }}
            >
              {nama}
            </p>
            {!isAktif && (
              <span
                className="inline-block mt-1 text-[9px] font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: "var(--color-warning-light)",
                  color: "var(--color-warning)",
                }}
              >
                Tidak Aktif
              </span>
            )}
          </div>
        </div>
      )}

      {/* Nav Items */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`neu-nav-item flex items-center gap-3 text-xs ${isActive ? "active" : ""}`}
              style={{
                color: isActive
                  ? "var(--color-primary)"
                  : "var(--color-text-muted)",
                justifyContent: collapsed ? "center" : "flex-start",
                padding: collapsed ? "12px" : undefined,
              }}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={18} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 mt-auto">
        <button
          onClick={handleLogout}
          className="neu-nav-item flex items-center gap-3 text-xs w-full"
          style={{
            color: "var(--color-danger)",
            justifyContent: collapsed ? "center" : "flex-start",
            padding: collapsed ? "12px" : undefined,
          }}
          title={collapsed ? "Keluar" : undefined}
        >
          <LogOut size={18} />
          {!collapsed && <span>Keluar</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="santri-mobile-menu-btn fixed top-4 left-4 z-50 lg:hidden neu-button p-2.5 rounded-xl"
        aria-label="Menu"
      >
        <Menu size={20} style={{ color: "var(--color-text)" }} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
          <div
            className="absolute left-0 top-0 bottom-0 w-64 flex flex-col"
            style={{
              background: "var(--bg-sidebar)",
              boxShadow: "4px 0 20px rgba(0,0,0,0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute right-2 top-2">
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-lg"
                style={{ color: "var(--color-text-muted)" }}
              >
                <X size={18} />
              </button>
            </div>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col flex-shrink-0 border-r h-screen sticky top-0"
        style={{
          width: collapsed ? "72px" : "220px",
          background: "var(--bg-sidebar)",
          borderColor: "var(--color-surface-dark)",
          transition: "width 0.25s ease",
        }}
      >
        {sidebarContent}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 mx-auto mb-3 rounded-lg"
          style={{ color: "var(--color-text-subtle)" }}
          title={collapsed ? "Lebarkan" : "Perkecil"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </aside>
    </>
  );
}

export function SantriBottomNav() {
  const pathname = usePathname();

  // Hanya tampilkan 5 icon utama di bottom nav agar tidak berjejalan (sisanya di sidemenu / menu cepat)
  const bottomItems = baseNavItems.filter((item: any) => 
    ["Beranda", "Absensi", "Absen Mandiri", "Nilai", "Perizinan"].includes(item.label)
  );

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden border-t bg-white"
      style={{
        borderColor: "var(--color-surface-dark)",
        boxShadow: "0 -2px 10px rgba(0,0,0,0.06)",
        paddingBottom: "env(safe-area-inset-bottom)", // Fix untuk iPhone tab bar
      }}
    >
      <div className="flex items-center justify-around py-1.5 px-1 max-w-lg mx-auto">
        {bottomItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          
          // Singkat teks khusus bottom nav jika perlu
          let shortLabel = item.label;
          if (item.label === "Absen Mandiri") shortLabel = "Absen";

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-xl transition-all"
              style={{
                color: isActive
                  ? "var(--color-primary)"
                  : "var(--color-text-subtle)",
                background: isActive ? "var(--color-primary-50)" : "transparent",
              }}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span
                className="text-[9px] font-bold text-center leading-tight mt-0.5 truncate w-[52px]"
                style={{ letterSpacing: "0.03em" }}
              >
                {shortLabel}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
