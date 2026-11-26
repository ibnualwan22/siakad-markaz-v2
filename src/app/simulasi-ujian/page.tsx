import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Toaster } from "react-hot-toast";
import prisma from "@/lib/prisma";
import ClientMengerjakanUjian, {
  type SimulationExamData,
} from "@/app/santri/(portal)/ujian/mengerjakan/client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Simulasi Ujian Usbu'i Santri",
  description:
    "Halaman simulasi untuk menguji tampilan, soal, dan keyboard ujian santri tanpa token atau sesi aktif.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

/**
 * Halaman simulasi ujian santri (/simulasi-ujian) — menggunakan komponen
 * ClientMengerjakanUjian yang SAMA PERSIS dengan /santri/ujian/mengerjakan.
 * Tidak memerlukan kode token atau sesi aktif.
 * Soal diambil otomatis dari Program "Tarqiyah", Mapel "Tes" (awal kapital),
 * yang dicentang pada Usbu' 1 (SoalUsbuAssignment.usbuKe = 1).
 */
export default async function SimulasiUjianPage() {
  const program = await prisma.program.findFirst({
    where: { nama_indo: { equals: "Tarqiyah", mode: "insensitive" } },
    include: {
      programMapels: {
        include: { mapel: true },
      },
    },
  });

  // Cari mapel "Tes" (awal kapital persis) di dalam program Tarqiyah
  const tesMapel = program?.programMapels.find(
    (pm) => pm.mapel.nama_indo === "Tes",
  )?.mapel;

  if (!program || !tesMapel) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl max-w-md w-full p-8 text-center shadow-sm border border-gray-200">
          <h1 className="text-xl font-bold text-gray-800 mb-2">
            Data Simulasi Tidak Ditemukan
          </h1>
          <p className="text-sm text-gray-500">
            Program <strong>Tarqiyah</strong> atau mapel <strong>Tes</strong>{" "}
            (awal kapital) tidak ditemukan di database.
          </p>
        </div>
      </div>
    );
  }

  const rawSoals = await prisma.bankSoalUsbu.findMany({
    where: {
      programId: program.id,
      mapelId: tesMapel.id,
      usbuAssignments: {
        some: { usbuKe: 1 },
      },
    },
    include: {
      opsiList: true,
      jenisSoal: { select: { instruksi: true } },
      mapel: { select: { nama_arab: true, nama_indo: true } },
    },
    orderBy: [{ tipeSoal: "asc" }, { createdAt: "asc" }],
  });

  if (rawSoals.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl max-w-md w-full p-8 text-center shadow-sm border border-gray-200">
          <h1 className="text-xl font-bold text-gray-800 mb-2">
            Belum Ada Soal Usbu&apos; 1
          </h1>
          <p className="text-sm text-gray-500">
            Belum ada soal pada Program <strong>{program.nama_indo}</strong>{" "}
            mapel <strong>{tesMapel.nama_indo}</strong> yang dicentang pada
            Usbu&apos; 1.
          </p>
        </div>
      </div>
    );
  }

  // Susun bentuk soal persis seperti /api/santri/ujian/start/route.ts
  const formatted = rawSoals.map((soal, index) => {
    let extractedData: Record<string, unknown> | null = soal.dataTambahan
      ? typeof soal.dataTambahan === "string"
        ? (JSON.parse(soal.dataTambahan) as Record<string, unknown>)
        : (JSON.parse(JSON.stringify(soal.dataTambahan)) as Record<string, unknown>)
      : null;

    if (extractedData) {
      if (soal.tipeSoal === "MENJODOHKAN" && Array.isArray(extractedData.pairs)) {
        const pairs = extractedData.pairs as Array<{ left: string; right: string }>;
        const lefts = pairs.map((p) => p.left);
        const rights = pairs.map((p) => p.right);
        extractedData = { lefts, rights };
      } else if (soal.tipeSoal === "KITABAH" && extractedData.huruf) {
        delete extractedData.jawaban;
      } else if (soal.tipeSoal === "DRAG_KATEGORI" && Array.isArray(extractedData.items)) {
        const items = extractedData.items as Array<{ text: string }>;
        extractedData.categories = extractedData.categories || [];
        extractedData.items = items.map((it) => ({
          text: it.text,
        }));
      } else if (
        soal.tipeSoal === "ISIAN_SAMPING" ||
        soal.tipeSoal === "ISIAN_BAWAH"
      ) {
        delete extractedData.jawaban;
      }
    }

    const safeOpsi = soal.opsiList.map((o) => ({
      id: o.id,
      teks: o.teks,
      gambarUrl: o.gambarUrl,
    }));

    return {
      soalId: soal.id,
      mapelId: soal.mapelId,
      namaMapel: soal.mapel.nama_arab || soal.mapel.nama_indo,
      jenisSoalId: soal.jenisSoalId,
      pertanyaan: soal.pertanyaan,
      gambarUrl: soal.gambarUrl,
      grupSoalId: soal.grupSoalId,
      tipeSoal: soal.tipeSoal,
      perintah: soal.jenisSoal?.instruksi || soal.perintah,
      dataTambahan: extractedData,
      bobot: soal.bobot,
      opsiList: safeOpsi,
      urutanUI: index + 1,
      jawabanId: null,
      opsiTerpilih: null,
      rpiId: null,
      jawabanTeks: null,
      jawabanData: null,
    };
  });

  // Kelompokkan induk + anak grup Qiro'ah agar bacaan tetap menyatu
  const grupMap = new Map<string, typeof formatted>();
  const mandiri: typeof formatted = [];
  for (const s of formatted) {
    if (s.grupSoalId) {
      if (!grupMap.has(s.grupSoalId)) grupMap.set(s.grupSoalId, []);
      grupMap.get(s.grupSoalId)!.push(s);
    } else {
      mandiri.push(s);
    }
  }
  const orderedSoal: typeof formatted = [];
  for (const s of mandiri) {
    orderedSoal.push(s);
    const anak = grupMap.get(s.soalId);
    if (anak) {
      orderedSoal.push(...anak);
      grupMap.delete(s.soalId);
    }
  }
  for (const [, anak] of grupMap) {
    orderedSoal.push(...anak);
  }

  const simulationData: SimulationExamData = {
    sesiId: "simulasi-tarqiyah-tes-u1",
    durasiMenit: 120,
    sisaWaktuDetik: 120 * 60,
    soal: orderedSoal.map((s, i) => ({ ...s, urutanUI: i + 1 })),
  };

  return (
    <>
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-gray-100">
            Memuat Simulasi Ujian...
          </div>
        }
      >
        <ClientMengerjakanUjian
          simulationData={simulationData}
          simulationLabel={`Simulasi Ujian — ${program.nama_indo} / ${tesMapel.nama_indo} (Usbu' 1)`}
        />
      </Suspense>
      <Toaster position="bottom-center" />
    </>
  );
}
