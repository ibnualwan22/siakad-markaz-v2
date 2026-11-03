import prisma from "@/lib/prisma";
import {
  hitungNilaiAkhir,
  predikatIndo,
  isMusyarokah,
} from "@/lib/munaqosah-hufadz";

export const dynamic = "force-dynamic";

// Halaman publik verifikasi keaslian syahadah Munaqosah (tanpa login).
// QR di sertifikat mengarah ke sini. Untuk musyarokah, nilai TIDAK
// ditampilkan — hanya status keikutsertaan.
export default async function VerifikasiMunaqosahPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const rec = await prisma.munaqosahHufadz.findUnique({
    where: { verifyToken: token },
    include: { santri: { select: { nama: true } } },
  });

  if (!rec) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <div className="max-w-md text-center bg-white rounded-2xl border p-8">
          <h1 className="text-2xl font-bold text-red-700">Sertifikat tidak ditemukan</h1>
          <p className="mt-2 text-slate-600">
            Kode verifikasi ini tidak cocok dengan data munaqosah mana pun.
            Periksa kembali QR yang dipindai.
          </p>
        </div>
      </div>
    );
  }

  const nilaiAkhir = hitungNilaiAkhir(rec);
  const musyarokah = isMusyarokah(nilaiAkhir);
  const predikat = predikatIndo(nilaiAkhir);
  const tanggal = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(rec.tanggal);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border p-8 space-y-4 text-center">
        <div className="text-5xl">✓</div>
        <h1 className="text-2xl font-bold text-emerald-700">Sertifikat Asli</h1>
        <p className="text-sm text-slate-500">
          Syahadah Munaqosah ini tercatat di sistem Markaz Huffadz.
        </p>
        <dl className="text-left text-sm space-y-2 pt-2">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Nama</dt>
            <dd className="font-bold">{rec.santri.nama}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Program</dt>
            <dd className="font-bold">Markaz Huffadz</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Dufah</dt>
            <dd className="font-bold">{rec.dufahNama}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Juz</dt>
            <dd className="font-bold" dir="rtl">{rec.juzTeks}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Tanggal munaqosah</dt>
            <dd className="font-bold">{tanggal}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Status</dt>
            <dd className="font-bold">
              {musyarokah ? "Musyarokah" : `Lulus — ${predikat}`}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
