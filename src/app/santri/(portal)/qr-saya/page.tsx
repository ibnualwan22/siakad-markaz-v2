import { redirect } from "next/navigation";
import { Metadata } from "next";
import { getSantriSession } from "@/lib/santri-auth";
import { signSantriQr } from "@/lib/qr-signing";
import { QrSayaClient } from "@/components/santri/qr-saya-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "QR Saya - Portal Santri",
};

export default async function QrSayaPage() {
  const session = await getSantriSession();
  if (!session || !session.isAktif) redirect("/santri/login");

  let payload: string | null = null;
  let error: string | null = null;
  try {
    payload = signSantriQr(session.santriId);
  } catch {
    error = "QR_SIGNING_SECRET belum diset di server.";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black md:text-3xl">QR Saya</h1>
        <p className="mt-1 text-sm text-gray-500">
          QR unik milikmu untuk absensi kegiatan oleh petugas.
        </p>
      </div>
      <QrSayaClient nama={session.nama} payload={payload} error={error} />
    </div>
  );
}
