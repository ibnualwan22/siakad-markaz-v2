import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";

export const dynamic = "force-dynamic";

// GET — izin syahadah organisasi untuk sesi admin yang login.
// Dipakai halaman admin Lajnah/OSIM untuk menampilkan tab Template & Layout
// (edit) dan tombol Cetak. ADMIN selalu true (lihat lib/permission).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [lajnah_syahadah, osim_syahadah] = await Promise.all([
    checkPermission("lajnah_syahadah"),
    checkPermission("osim_syahadah"),
  ]);
  return NextResponse.json({ lajnah_syahadah, osim_syahadah });
}
