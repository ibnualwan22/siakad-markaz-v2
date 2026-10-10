import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import { getRiwayatSantriRows, getTranskripAkbarnas } from "@/lib/app-data";

export async function GET(request: Request) {
  const session = await getSession();
  const hasPermission = await checkPermission("riwayat_santri");
  if (!session || (!hasPermission && session.role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const santriId = searchParams.get("santriId");
  const dufah = searchParams.get("dufah");

  if (!santriId || !dufah) {
    return NextResponse.json(
      { error: "santriId dan dufah wajib diisi" },
      { status: 400 }
    );
  }

  try {
    const groups = await getRiwayatSantriRows(dufah, { santriId });
    const group = groups.find((g: any) => g.santriId === santriId);
    const records = group?.records || [];
    // Lampirkan transkrip gabungan Akbarnas (bulan 1 + bulan 2) bila ada
    for (const rec of records) {
      if ((rec.programNama || "").toLowerCase().includes("akbarnas")) {
        rec.transkripGabungan = await getTranskripAkbarnas(santriId, rec.dufahNama);
      } else {
        rec.transkripGabungan = null;
      }
    }
    return NextResponse.json(records);
  } catch (error) {
    console.error("Error fetching riwayat detail:", error);
    return NextResponse.json(
      { error: "Gagal mengambil detail riwayat" },
      { status: 500 }
    );
  }
}
