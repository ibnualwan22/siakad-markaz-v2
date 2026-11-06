import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSantriTranskrip } from "@/lib/santri-transkrip";
import { getSantriSession } from "@/lib/santri-auth";
import { TranskripDocument } from "@/components/admin/transkrip-document";


// Halaman transkrip untuk santri — isi sama persis dengan transkrip admin
// (/admin/syahadah/[id]/transkrip), hanya dibatasi pada riwayat milik sendiri.
export default async function SantriTranskripPage({ params }: { params: Promise<{ riwayatId: string }> }) {
  const session = await getSantriSession();
  if (!session) redirect("/santri/login");
  const { riwayatId } = await params;

  const data = await getSantriTranskrip(riwayatId,session.santriId);
  if(!data) notFound();
  const {santriName,programName,isAkbarnas,items,rataRataAkhir}=data;

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
