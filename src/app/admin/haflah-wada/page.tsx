import { requirePermission } from "@/lib/permission";
import { getDashboardSantriRows } from "@/lib/app-data";
import { getActiveDufahName } from "@/lib/absensi";
import { hitungNilaiAkhir, predikatArab, predikatIndo } from "@/lib/munaqosah-hufadz";
import prisma from "@/lib/prisma";
import { HaflahWadaClient } from "@/components/admin/haflah-wada-client";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Haflah Wada' - Admin Panel",
};

export default async function HaflahWadaPage() {
  await requirePermission("haflah_wada");

  const [santriRows, kelasList, activeDufahName] = await Promise.all([
    getDashboardSantriRows(),
    prisma.kelas.findMany({
      include: {
        waliKelas: true,
      }
    }),
    getActiveDufahName()
  ]);

  const dufahLabel = activeDufahName ?? "Aktif";

  // Fetch all active santri inside graduating programs, including those who failed or haven't completed (TIDAK_LULUS).
  // Santri yang sudah checkout tidak ditampilkan di denah maupun susunan barisan.
  const eligibleRows = santriRows.filter((santri: any) =>
    santri.isAktif && !santri.isCheckedOut && santri.programId
  );

  // Penanda syahadah ditahan untuk dufah aktif. Hanya dipakai prosesi
  // (denah & pemanggilan); cetak dan status kelulusan tidak membacanya.
  const ditahanRows = activeDufahName
    ? await prisma.syahadahDitahan.findMany({
        where: { dufahNama: activeDufahName },
        orderBy: { createdAt: "asc" },
      })
    : [];

  // Hufadz: kelulusan ditentukan Munaqosah saja, bukan Usbu — jalur Usbu
  // selalu menjatuhkan mereka ke TIDAK_LULUS (is_tasmi=false + mapel dummy
  // tanpa nilai lengkap). Timpa status + rata-rata + predikat baris HUFADZ
  // dari record Munaqosah dufah aktif. Override lokal halaman ini saja;
  // Data Syahadah, cetak, dan portal tidak berubah.
  // Pemetaan: akhir >= 60 -> LULUS (syahadah tercetak dengan predikat),
  // akhir < 60 -> MUSYAROKAH (tetap dipanggil, syahadah tanpa nilai).
  // Tanpa record -> tetap TIDAK_LULUS (belakang, tidak dipanggil).
  const munaqosahRows = activeDufahName
    ? await prisma.munaqosahHufadz.findMany({
        where: { dufahNama: activeDufahName },
      })
    : [];
  const munaqosahMap = new Map(munaqosahRows.map((m) => [m.santriId, m]));
  const haflahRows = eligibleRows.map((santri: any) => {
    if (santri.programKategori !== "HUFADZ") return santri;
    const rec = munaqosahMap.get(santri.id);
    if (!rec) return santri;
    const akhir = hitungNilaiAkhir({
      nilaiHafalan: rec.nilaiHafalan,
      nilaiKelancaran: rec.nilaiKelancaran,
      nilaiTajwid: rec.nilaiTajwid,
      nilaiMakhorijulHuruf: rec.nilaiMakhorijulHuruf,
    });
    return {
      ...santri,
      statusKelulusan: akhir >= 60 ? "LULUS" : "MUSYAROKAH",
      average: akhir,
      averagePredikat: {
        indo: predikatIndo(akhir) ?? "-",
        arab: predikatArab(akhir) ?? "-",
      },
    };
  });

  return (
    <div className="space-y-6 print:space-y-0">
      <div className="flex flex-col gap-2 print:hidden">
        <h1 className="text-3xl font-black md:text-4xl ">
          Haflah Wada'
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] max-w-2xl">
          Manajemen denah tempat duduk dan urutan pemanggilan santri pada acara Haflah Wada'.
        </p>
      </div>

      <HaflahWadaClient 
        santriRows={haflahRows} 
        kelasList={kelasList}
        dufahLabel={dufahLabel}
        ditahanList={ditahanRows.map((d) => ({ santriId: d.santriId, catatan: d.catatan }))}
        dufahNama={activeDufahName}
      />
    </div>
  );
}
