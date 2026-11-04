import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSantriSession } from "@/lib/santri-auth";
import { getActiveDufahName } from "@/lib/absensi";

export const dynamic = "force-dynamic";

// Angket Nadi Hufadz milik santri yang login, dufah aktif saja.
// Satu santri satu angket per dufah; menulis/mengubah hanya bila terdaftar
// sebagai peserta DAN angket sedang dibuka admin. Melihat isi sendiri tetap
// bisa walau angket sudah ditutup.
export async function GET() {
  const session = await getSantriSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dufahAktif = (await getActiveDufahName()) || "";
  if (!dufahAktif) return NextResponse.json({ error: "Dufah aktif tidak ditemukan" }, { status: 400 });

  const [peserta, periode, angket] = await Promise.all([
    prisma.nadiHufadzPeserta.findUnique({
      where: { santriId_dufahNama: { santriId: session.santriId, dufahNama: dufahAktif } },
    }),
    prisma.nadiHufadzPeriode.findUnique({ where: { dufahNama: dufahAktif } }),
    prisma.nadiHufadzAngket.findUnique({
      where: { santriId_dufahNama: { santriId: session.santriId, dufahNama: dufahAktif } },
    }),
  ]);

  return NextResponse.json({
    dufahAktif,
    sudahDaftar: !!peserta,
    angketDibuka: periode?.angketDibuka ?? false,
    angket: angket ? { isi: angket.isi, updatedAt: angket.updatedAt } : null,
  });
}

// POST { isi } — tulis/ubah angket sendiri. Isi kosong = hapus angket
// (kembali ke status "Belum mengisi").
export async function POST(request: Request) {
  const session = await getSantriSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dufahAktif = (await getActiveDufahName()) || "";
  if (!dufahAktif) return NextResponse.json({ error: "Dufah aktif tidak ditemukan" }, { status: 400 });

  const peserta = await prisma.nadiHufadzPeserta.findUnique({
    where: { santriId_dufahNama: { santriId: session.santriId, dufahNama: dufahAktif } },
  });
  if (!peserta) {
    return NextResponse.json(
      { error: "Angket hanya bisa diisi peserta Nadi Hufadz yang terdaftar." },
      { status: 403 }
    );
  }

  const periode = await prisma.nadiHufadzPeriode.findUnique({
    where: { dufahNama: dufahAktif },
  });
  if (!periode?.angketDibuka) {
    return NextResponse.json(
      { error: `Pengisian angket ${dufahAktif} sedang ditutup.` },
      { status: 403 }
    );
  }

  const body = await request.json();
  const isi = typeof body.isi === "string" ? body.isi.trim() : "";
  if (!isi) {
    await prisma.nadiHufadzAngket.deleteMany({
      where: { santriId: session.santriId, dufahNama: dufahAktif },
    });
    return NextResponse.json({ angket: null });
  }

  const angket = await prisma.nadiHufadzAngket.upsert({
    where: { santriId_dufahNama: { santriId: session.santriId, dufahNama: dufahAktif } },
    update: { isi },
    create: { santriId: session.santriId, dufahNama: dufahAktif, isi },
  });

  return NextResponse.json({ angket: { isi: angket.isi, updatedAt: angket.updatedAt } });
}
