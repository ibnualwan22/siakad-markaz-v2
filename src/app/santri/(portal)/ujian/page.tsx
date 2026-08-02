"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Play, CheckCircle2, Clock, MonitorCheck, BookOpen, Lock } from "lucide-react";
import toast from "react-hot-toast";

export default function DaftarUjianSantriPage() {
  const router = useRouter();
  const [ujianList, setUjianList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal Input Kode
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUjian, setSelectedUjian] = useState<any>(null);
  const [kodeAkses, setKodeAkses] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchUjian();
  }, []);

  const fetchUjian = async () => {
    try {
      const res = await fetch("/api/santri/ujian");
      if (res.ok) setUjianList(await res.json());
    } catch {
      toast.error("Gagal memuat daftar ujian");
    } finally {
      setLoading(false);
    }
  };

  const openInputKode = (ujian: any) => {
    setSelectedUjian(ujian);
    setKodeAkses("");
    setIsModalOpen(true);
  };

  const handleStartExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kodeAkses || kodeAkses.length < 6) return toast.error("Masukkan kode 6 digit dengan benar");
    
    setSubmitting(true);
    try {
      const res = await fetch("/api/santri/ujian/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paketId: selectedUjian.id, kodeAkses })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error);

      // Simpan data soal ke sessionStorage agar aman dan tidak perlu fetch lagi di page ujian
      sessionStorage.setItem(`exam_${data.sesiId}`, JSON.stringify(data));
      
      toast.success("Berhasil masuk. Memulai mode ujian fullscreen...");
      setIsModalOpen(false);
      
      // Redirect to working page
      router.push(`/santri/ujian/mengerjakan?s=${data.sesiId}`);
    } catch (err: any) {
      toast.error(err.message || "Gagal masuk ujian. Cek kembali kode askes Anda.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResumeExam = async (sesiId: string) => {
    // Attempt to start without asking code again if session is still 'MENGERJAKAN'
    // But since API start requires kodeAkses to fetch the questions again if not in session storage,
    // It's actually better to just check if it's stored. If not, prompt the code again.
    const stored = sessionStorage.getItem(`exam_${sesiId}`);
    if (stored) {
      router.push(`/santri/ujian/mengerjakan?s=${sesiId}`);
    } else {
      toast.error("Sesi lokal hilang. Masukkan kembali kode akses untuk melanjutkan ujian.");
      // Just re-open the prompt for this exam
      const pak = ujianList.find(p => p.sesiId === sesiId);
      if (pak) openInputKode(pak);
    }
  };

  if (loading) return <div>Memuat...</div>;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-gradient-to-r from-[var(--color-primary)] to-blue-600 rounded-3xl p-6 md:p-8 text-white shadow-lg mb-8">
        <h1 className="text-2xl md:text-3xl font-display font-bold mb-2">Ujian Usbu' Online (CBT)</h1>
        <p className="text-blue-100 max-w-2xl text-sm md:text-base leading-relaxed">
           Kerjakan ujian pekanan pilihan ganda dari sistem ini. Pastikan Anda menerima kode akses dari pengawas ujian sebelum memulai.
        </p>
      </div>

      {ujianList.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-gray-100 flex flex-col items-center">
           <MonitorCheck size={48} className="text-gray-300 mb-4" />
           <h3 className="text-xl font-bold text-gray-700">Belum Ada Ujian Aktif</h3>
           <p className="text-gray-500 mt-2">Tidak ada ujian yang sedang berlangsung untuk program dan usbu' Anda saat ini.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ujianList.map(ujian => (
            <div key={ujian.id} className={`bg-white rounded-3xl p-6 shadow-sm border-2 transition-all hover:-translate-y-1 ${ujian.status === 'BELUM_MULAI' ? 'hover:border-blue-300' : 'border-gray-100'}`}>
              <div className="flex justify-between items-start mb-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${ujian.status === 'BELUM_DIBUKA' ? 'bg-gray-50 text-gray-400' : 'bg-blue-50 text-blue-600'}`}>
                   {ujian.status === 'BELUM_DIBUKA' ? <Lock size={24} /> : <BookOpen size={24} />}
                </div>
                {ujian.status === 'BELUM_DIBUKA' ? (
                  <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider border border-gray-200">
                    Belum Dibuka
                  </span>
                ) : ujian.status === 'SELESAI' || ujian.status === 'AUTO_SUBMIT' ? (
                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider">
                    Selesai
                  </span>
                ) : ujian.status === 'MENGERJAKAN' ? (
                  <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider animate-pulse">
                    Mengerjakan
                  </span>
                ) : (
                  <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider">
                    Aktif
                  </span>
                )}
              </div>
              
              <h3 className={`text-lg font-bold mb-2 leading-tight ${ujian.status === 'BELUM_DIBUKA' ? 'text-gray-400' : 'text-gray-800'}`}>{ujian.nama}</h3>
              
              <div className={`space-y-2 mt-4 text-sm ${ujian.status === 'BELUM_DIBUKA' ? 'text-gray-400' : 'text-gray-600'}`}>
                <div className="flex items-center gap-2">
                  <Clock size={16} className={ujian.status === 'BELUM_DIBUKA' ? "text-gray-300" : "text-gray-400"}/>
                  <span>Durasi: <strong>{ujian.durasiMenit} Menit</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <MonitorCheck size={16} className={ujian.status === 'BELUM_DIBUKA' ? "text-gray-300" : "text-gray-400"}/>
                  <span>Total: <strong>{ujian.jumlahSoal} Soal</strong></span>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-100 gap-3 flex flex-col">
                {ujian.status === 'BELUM_DIBUKA' ? (
                  <button 
                    disabled
                    className="w-full bg-gray-50 text-gray-400 border border-gray-200 cursor-not-allowed py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
                   >
                     Belum Dibuka <Lock size={16} />
                   </button>
                ) : ujian.status === 'SELESAI' || ujian.status === 'AUTO_SUBMIT' ? (
                  <div className="text-center w-full py-3 bg-green-50 rounded-xl border border-green-100 divide-y divide-green-100/50">
                     <div className="text-[10px] font-bold uppercase text-green-600 mb-2 tracking-wider">Hasil Nilai Per Mapel</div>
                     <div className="pt-2 space-y-1.5 px-3">
                        {ujian.mapelScores?.map((m: any, idx: number) => (
                           <div key={idx} className="flex justify-between items-center text-sm">
                              <span className="font-semibold text-gray-700">{m.mapelName}</span>
                              <span className="font-black text-green-700">{m.score !== null ? m.score : '-'}</span>
                           </div>
                        ))}
                     </div>
                     {ujian.waktuMulaiSantri && ujian.waktuSelesaiSantri && (
                       <div className="text-[10px] text-gray-500 font-semibold pt-2 mt-2">
                         <span className="bg-white/50 px-2 py-1 rounded">Durasi: {(() => {
                           const d = Math.floor((new Date(ujian.waktuSelesaiSantri).getTime() - new Date(ujian.waktuMulaiSantri).getTime()) / 1000);
                           return `${Math.floor(d / 60)} menit ${(d % 60).toString().padStart(2, '0')} detik`;
                         })()}</span>
                       </div>
                     )}
                  </div>
                ) : ujian.status === 'MENGERJAKAN' ? (
                   <button 
                    onClick={() => handleResumeExam(ujian.sesiId)}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
                   >
                     Meneruskan Ujian <Play size={16} fill="currentColor"/>
                   </button>
                ) : (
                  <button 
                    onClick={() => openInputKode(ujian)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
                   >
                     Mulai Ujian <Play size={16} fill="currentColor"/>
                   </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Input Kode Akses */}
      {isModalOpen && selectedUjian && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <div className="h-2 w-full bg-blue-600"></div>
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 bg-gray-50 rounded-full transition-colors">✕</button>
            
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 rotate-12">
                <Lock size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-1">Kode Akses</h3>
              <p className="text-sm text-gray-500 mb-6">Masukkan 6 digit kode yang dibacakan oleh pengawas untuk memulai <strong>{selectedUjian.nama}</strong></p>
              
              <form onSubmit={handleStartExam}>
                <input 
                  type="text" 
                  maxLength={6}
                  required
                  value={kodeAkses}
                  onChange={e => setKodeAkses(e.target.value)}
                  className="w-full text-center text-3xl font-mono tracking-[0.2em] font-bold p-4 rounded-2xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none mb-6 text-gray-800 transition-colors"
                  placeholder="------"
                  autoFocus
                  style={{ textShadow: "1px 1px 0 #fff" }}
                />
                <button 
                  type="submit" 
                  disabled={submitting || kodeAkses.length < 6}
                  className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-blue-700 transition-colors shadow-md disabled:opacity-50"
                >
                  {submitting ? "Memverifikasi..." : (
                    <>Mulai Ujian <Play size={16} fill="currentColor" /></>
                  )}
                </button>
              </form>
              
              <div className="mt-4 p-3 bg-red-50 rounded-xl text-left border border-red-100">
                <p className="text-[11px] text-red-700 font-medium leading-relaxed">
                  <strong>Peringatan Anti-Cheat:</strong> Setelah ujian dimulai, Anda akan masuk ke layar fullscreen. Anda dilarang keluar tab, berpindah aplikasi, atau menutup fullscreen. Ujian akan <strong>Otomatis Di-Submit</strong> jika terdeteksi pelanggaran.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
