import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ArsipGaleriClient } from "@/components/santri/arsip-galeri-client";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lihat Galeri - Admin Panel",
};

// Halaman lihat galeri untuk admin — tampilannya sama persis seperti
// yang dilihat santri (mode lihat saja, bukan konfigurasi).
// Bisa diakses semua admin tanpa permission khusus.
export default async function AdminLihatGaleriPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="space-y-6">
      <ArsipGaleriClient apiBase="/api/admin/galeri" />
    </div>
  );
}
