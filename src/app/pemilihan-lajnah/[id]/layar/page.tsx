import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import ElectionDisplay from "@/components/pemilihan/election-display";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Layar Acara — Pemilihan Lajnah",
  robots: { index: false, follow: false },
};

export default async function ElectionDisplayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  if (session.role !== "ADMIN") {
    const permission = await prisma.rolePermission.findUnique({
      where: { role_permission: { role: session.role, permission: "lajnah_manage" } },
    });
    if (!permission) {
      return (
        <main className="min-h-screen flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold mb-3">Akses layar acara terbatas</h1>
            <p className="text-gray-600 mb-6">Gunakan akun panitia yang memiliki akses mengelola lajnah.</p>
            <a href="/admin/dashboard" className="text-[var(--color-primary)] underline">Kembali ke admin</a>
          </div>
        </main>
      );
    }
  }

  const { id } = await params;
  return <ElectionDisplay sessionId={id} />;
}
