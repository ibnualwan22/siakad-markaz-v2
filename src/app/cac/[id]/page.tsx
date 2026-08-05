import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verifikasi Sertifikat CAC - Markaz Arabiyah",
};

export default async function CacVerificationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const riwayat = await prisma.riwayatSantri.findUnique({
    where: { id },
    include: {
      santri: true,
      program: true,
      syahadahCacRecord: true
    }
  });

  if (!riwayat || !riwayat.syahadahCacRecord) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-800">
      <div className="bg-white max-w-md w-full rounded-2xl shadow-xl overflow-hidden border border-slate-100">
        <div className="bg-blue-600 p-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_white_1px,_transparent_1.5px)] bg-[length:10px_10px]" />
          
          <div className="relative z-10">
            <div className="bg-white/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-white/30 shadow-lg">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">Terverifikasi Resmi</h1>
            <p className="text-blue-100 text-sm">Sertifikat Kompetensi Markaz Arabiyah</p>
          </div>
        </div>
        
        <div className="p-8">
          <div className="bg-green-50 text-green-800 rounded-xl p-4 text-sm text-center mb-6 border border-green-200">
            Sertifikat dengan nomor seri <strong className="block text-green-900 mt-1 text-base">{riwayat.syahadahCacRecord.serialNumber}</strong> adalah sah dan valid terdaftar dalam database institusi.
          </div>
          
          <div className="space-y-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Nama Pemegang Sertifikat</p>
              <p className="font-bold text-lg text-slate-900 border-b border-slate-100 pb-3">{(riwayat.santri.nama ?? "TANPA NAMA").toUpperCase()}</p>
            </div>
            
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Gelar Profesional</p>
              <div className="border-b border-slate-100 pb-3">
                <p className="font-bold text-xl text-blue-700">C.AC.</p>
                <p className="font-medium text-sm text-slate-500">Certified Arabic Competency</p>
              </div>
            </div>
            
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Lulus dari Program</p>
              <p className="font-semibold text-slate-800 pb-1">Martabah Ula ({riwayat.program?.nama_indo})</p>
              <p className="text-sm text-slate-500">Siswa telah berhasil menyelesaikan kurikulum yang ditentukan dan dinyatakan kompeten.</p>
            </div>
          </div>
        </div>
        
        <div className="bg-slate-50 p-4 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Diterbitkan oleh<br/>
            <strong>Markaz Arabiyah</strong>
          </p>
          <img src="/images/stamp.png" alt="Stamp" className="h-10 opacity-70" />
        </div>
      </div>
    </div>
  );
}
