import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";

/**
 * Jenis override izin per user (tabel UserPermission):
 * - "GRANT": memberi izin yang tidak dimiliki role-nya.
 * - "DENY": mencabut izin yang dimiliki role-nya.
 */
export type UserPermissionJenis = "GRANT" | "DENY";

/**
 * Daftar izin efektif satu user: izin role-nya, dikurangi yang dicabut
 * per-user, ditambah yang diberi per-user.
 *
 * ADMIN selalu mendapat ["*"] (semua izin), sama seperti sebelumnya.
 * Dipakai bersama oleh checkPermission() dan layout admin (sidebar), agar
 * menu dan penegakan API membaca aturan yang sama.
 */
export async function getEffectivePermissions(
  userId: string,
  role: string
): Promise<string[]> {
  if (role === "ADMIN") return ["*"];

  const [rolePerms, userPerms] = await Promise.all([
    prisma.rolePermission.findMany({
      where: { role: role as any },
      select: { permission: true },
    }),
    prisma.userPermission.findMany({
      where: { userId },
      select: { permission: true, jenis: true },
    }),
  ]);

  const efektif = new Set(rolePerms.map((p) => p.permission));
  for (const up of userPerms) {
    // Satu baris per (user, permission) — GRANT dan DENY tidak bisa
    // hidup berdampingan. DENY mengalahkan izin role; GRANT menambah.
    if (up.jenis === "DENY") efektif.delete(up.permission);
    else if (up.jenis === "GRANT") efektif.add(up.permission);
  }
  return [...efektif];
}

/**
 * Memeriksa apakah user saat ini memiliki permission yang diminta.
 * Jika tidak, akan me-redirect ke dashboard dengan pesan error.
 *
 * Aturan: ADMIN lolos semua; selain itu izin efektif = izin role
 * (minus yang dicabut per-user) + izin yang diberi per-user.
 *
 * @param permissionId ID permission yang dibutuhkan (contoh: "absen_kelas")
 * @returns boolean true jika memiliki akses, false jika tidak (hanya untuk pengecekan tanpa redirect)
 */
export async function checkPermission(permissionId: string): Promise<boolean> {
  const session = await getSession();

  if (!session) return false;
  if (session.role === "ADMIN") return true; // Admin punya akses penuh

  const efektif = await getEffectivePermissions(session.userId, session.role);
  return efektif.includes(permissionId);
}

/**
 * True bila user saat ini memiliki SALAH SATU dari permission yang diminta.
 * Dipakai untuk gerbang "salah satu cukup" (mis. baca scan vs pengaturan
 * di absensi kegiatan, atau bypass filter program CBT).
 */
export async function hasAnyPermission(...permissionIds: string[]): Promise<boolean> {
  const session = await getSession();

  if (!session) return false;
  if (session.role === "ADMIN") return true; // Admin punya akses penuh

  const efektif = await getEffectivePermissions(session.userId, session.role);
  return permissionIds.some((p) => efektif.includes(p));
}

/**
 * Memaksa halaman untuk mengecek permission. Jika gagal, redirect ke dashboard.
 * Panggil ini di bagian atas Server Component (page.tsx).
 *
 * @param permissionId ID permission yang dibutuhkan
 */
export async function requirePermission(permissionId: string) {
  const hasAccess = await checkPermission(permissionId);

  if (!hasAccess) {
    // Redirect ke dashboard karena tidak punya izin
    redirect("/admin/dashboard?error=unauthorized");
  }
}
