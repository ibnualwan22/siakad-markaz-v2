import { DenahLokasiClient } from "@/components/admin/denah-lokasi-client";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Admin - Denah Lokasi Sakan",
};

export default async function DenahLokasiAdminPage() {
  const session = await getSession();
  if (!session) {
    redirect("/admin/login");
  }

  return <DenahLokasiClient />;
}
