import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { getSantriSession } from "@/lib/santri-auth";
import { TranskripDocument } from "@/components/admin/transkrip-document";
import { calcAkumulatif, calcAkbarnasMapelAverage, calcMapelNilaiAkhir, applyNilaiTambahan } from "@/lib/grade-calculator";

// Halaman transkrip untuk santri — isi sama persis dengan transkrip admin
// (/admin/syahadah/[id]/transkrip), hanya dibatasi pada riwayat milik sendiri.
export default async function SantriTranskripPage({ params }: { params: Promise<{ riwayatId: string }> }) {
  const session = await getSantriSession();
  if (!session) redirect("/santri/login");
  const { riwayatId } = await params;

  const riwayat = await prisma.riwayatSantri.findUnique({
    where: { id: riwayatId },
    include: {
      santri: true,
      program: { include: { programMapels: { include: { mapel: true }, orderBy: { urutan: "asc" } } } },
      nilaiList: true,
    },
  });

  if (!riwayat || riwayat.santriId !== session.santriId) notFound();
  if (!riwayat.program) {
    return <div className="p-8 text-center text-rose-600 font-bold">Data program belum lengkap.</div>;
  }

  const santriName = riwayat.santri.nama ?? "Tanpa Nama";
  const programName = riwayat.program.nama_indo;
  const isAkbarnas = programName.toLowerCase().includes("akbarnas");

  // Untuk non-Akbarnas: hanya 1 riwayat (bulan berjalan).
  // Untuk Akbarnas: ambil juga bulan sebelumnya agar tampil gabungan seperti di admin.
  let b1Riwayat: any = riwayat;
  let b2Riwayat: any = null;
  if (isAkbarnas) {
    const getDufahNum = (name: string) => {
      const m = (name || "").match(/\d+/);
      return m ? parseInt(m[0], 10) : 0;
    };
    const currNum = getDufahNum(riwayat.dufahNama);
    const prevList: any[] = await prisma.riwayatSantri.findMany({
      where: {
        santriId: riwayat.santriId,
        program: { nama_indo: { contains: "akbarnas", mode: "insensitive" } },
      },
      include: { nilaiList: true },
    });
    const prev = prevList
      .filter((r) => getDufahNum(r.dufahNama) < currNum && getDufahNum(r.dufahNama) > 0)
      .sort((a, b) => getDufahNum(b.dufahNama) - getDufahNum(a.dufahNama))[0];
    if (prev) {
      b1Riwayat = prev;
      b2Riwayat = riwayat;
    }
  }

  const items = [];

  for (const pm of riwayat.program.programMapels) {
    const m = pm.mapel;

    const n1 = b1Riwayat ? b1Riwayat.nilaiList.find((x: any) => x.mapelId === m.id) : null;
    const jtB1 = m.jumlah_tes ?? 3;
    let b1_n = n1?.nilaiNihai ?? null;
    if (jtB1 === 1 && b1_n === null && n1?.nilaiAkhir !== null && n1?.nilaiAkhir !== undefined) {
      b1_n = n1.nilaiAkhir;
    }
    const b1 = { u1: n1?.nilaiUsbu1 ?? null, u2: n1?.nilaiUsbu2 ?? null, n: b1_n };

    const n2 = b2Riwayat ? b2Riwayat.nilaiList.find((x: any) => x.mapelId === m.id) : null;
    const jtB2 = m.jumlah_tes_b2 ?? jtB1;
    let b2_n = n2?.nilaiNihai ?? null;
    if (jtB2 === 1 && b2_n === null && n2?.nilaiAkhir !== null && n2?.nilaiAkhir !== undefined) {
      b2_n = n2.nilaiAkhir;
    }
    const b2 = { u1: n2?.nilaiUsbu1 ?? null, u2: n2?.nilaiUsbu2 ?? null, n: b2_n };

    const b1Avg = calcMapelNilaiAkhir({ u1: b1.u1, u2: b1.u2, n: b1.n }, isAkbarnas);
    const b2Avg = calcMapelNilaiAkhir({ u1: b2.u1, u2: b2.u2, n: b2.n }, isAkbarnas);

    let nilaiAkhir: number | null = null;
    const records = [n1, n2].filter(Boolean) as any[];
    if (isAkbarnas) {
      nilaiAkhir = calcAkbarnasMapelAverage(records);
    } else {
      if (n1) {
        if (n1.nilaiAkhir !== null && n1.nilaiAkhir !== undefined) {
          nilaiAkhir = n1.nilaiAkhir;
        } else {
          nilaiAkhir = calcMapelNilaiAkhir({ u1: b1.u1, u2: b1.u2, n: b1.n }, false);
        }
      }
    }

    let tambahan = 0;
    if (n2 && (n2 as any).nilaiTambahan > 0) {
      tambahan = (n2 as any).nilaiTambahan;
    } else if (n1 && (n1 as any).nilaiTambahan > 0) {
      tambahan = (n1 as any).nilaiTambahan;
    }
    if (nilaiAkhir !== null && tambahan > 0) {
      nilaiAkhir = applyNilaiTambahan(nilaiAkhir, tambahan);
    }

    items.push({
      mapel: m.nama_indo,
      bobot: m.bobot ?? 1,
      bobotUsbu: (m as any).bobot_usbu ?? 1,
      masukAkumulasi: m.masuk_akumulasi ?? true,
      b1: { ...b1, avg: b1Avg },
      b2: { ...b2, avg: b2Avg },
      nilaiAkhir,
    });
  }

  const rataRataAkhir = calcAkumulatif(
    items
      .filter((item) => item.masukAkumulasi && item.nilaiAkhir !== null)
      .map((item) => ({ score: item.nilaiAkhir!, bobot: item.bobot }))
  );

  return (
    <div className="min-h-screen bg-slate-200 p-4 md:p-8">
      <div className="mb-4 text-center">
        <Link href="/santri/riwayat" className="text-slate-500 hover:text-slate-800 underline text-sm font-semibold">
          &larr; Kembali ke Riwayat Duf&apos;ah
        </Link>
      </div>
      <TranskripDocument
        santriName={santriName}
        programName={programName}
        isAkbarnas={isAkbarnas}
        items={items}
        rataRataAkhir={rataRataAkhir}
      />
    </div>
  );
}
