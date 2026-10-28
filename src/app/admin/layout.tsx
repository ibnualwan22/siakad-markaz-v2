import { Sidebar } from "@/components/admin/sidebar";
import { Toaster } from "react-hot-toast";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { PushPermissionPrompt } from "@/components/admin/push-permission-prompt";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  // Ambil permission sesuai role
  let permissions: string[] = [];
  if (session) {
    if (session.role === "ADMIN") {
      permissions = ["*"]; // Admin bisa semua
    } else {
      const rolePerms = await prisma.rolePermission.findMany({
        where: { role: session.role as any },
        select: { permission: true }
      });
      permissions = rolePerms.map(p => p.permission);
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ background: "var(--bg-app)" }}>
      <Sidebar user={session} permissions={permissions} />
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pb-24 lg:pb-8">
          <div className="mx-auto max-w-6xl w-full">
            {children}
          </div>
        </div>
        {/* Footer */}
        <footer className="app-footer hidden lg:block border-t" style={{ borderColor: "var(--color-surface-dark)" }}>
          Developed by <span className="font-bold" style={{ color: "var(--color-primary)" }}>Aksara X</span> KSU Batch 10
        </footer>
      </main>
      {/* Modal izin notifikasi global: muncul saat pertama membuka area
          admin (setelah login), hanya bila belum diputuskan. Dua tahap:
          modal penjelasan dulu, prompt browser hanya setelah Aktifkan.
          Tanpa kartu banner (banner tetap ada di halaman rekap sebagai
          jalur manual). */}
      {session && (
        <PushPermissionPrompt
          banner={false}
          autoOpenOnMount
          benefitText="Aktifkan notifikasi Siakad? Kamu akan menerima laporan absen sakan langsung di perangkat ini — sakan yang sudah lapor beserta sakan yang belum absen — tanpa perlu membuka grup WA."
        />
      )}
      <Toaster position="bottom-center" toastOptions={{
        style: {
          fontWeight: "600",
          fontSize: "14px",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-raised)",
          background: "var(--bg-card)",
          color: "var(--color-text)"
        }
      }} />
    </div>
  );
}
