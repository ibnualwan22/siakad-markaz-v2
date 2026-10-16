import { Metadata } from "next";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Clock, Calendar, CheckCircle2, AlertTriangle } from "lucide-react";
import { requirePermission } from "@/lib/permission";
import { getTodayWibString, parseWibDateString } from "@/lib/absensi";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Jadwal Saya - Admin Panel",
};

export default async function JadwalSayaPage() {
  await requirePermission("jadwal_saya");
  const session = await getSession();
  if (!session) return null;

  // 1. Ambil jadwal Sesi Global
  const globalSesi = await prisma.jadwalSesi.findMany({
    where: { isActive: true },
    orderBy: { sesi: 'asc' }
  });

  // 2. Ambil penugasan pengajar biasa
  const pengajarSesi = await prisma.pengajarSesi.findMany({
    where: { userId: session.userId },
    include: { kelas: { include: { program: true } } }
  });

  const pengajarSesiProgram = await prisma.pengajarSesiProgram.findMany({
    where: { userId: session.userId },
    include: { program: true }
  });

  // Ambil data Wali Kelas jika dia wali kelas
  let waliKelasData = null;
  if (session.kelasId) {
    waliKelasData = await prisma.kelas.findUnique({
      where: { id: session.kelasId },
      include: { program: true }
    });
  }

  // Cari program-program apa saja yang diajar oleh user ini
  const programIds = new Set<string>();
  pengajarSesi.forEach(p => {
    if (p.kelas?.programId) programIds.add(p.kelas.programId);
  });
  pengajarSesiProgram.forEach(p => {
    programIds.add(p.programId);
  });
  if (waliKelasData?.programId) {
    programIds.add(waliKelasData.programId);
  }

  // 3. Ambil Sesi Tambahan untuk program-program tersebut
  const sesiTambahan = await prisma.sesiTambahanProgram.findMany({
    where: { 
      programId: { in: Array.from(programIds) },
      isActive: true 
    }
  });

    // 4. Cek Taqwim (kini global: satu konfigurasi + tanggal untuk semua program)
  const allTaqwimDates = await prisma.tanggalTaqwim.findMany({
    orderBy: { tanggal: 'asc' }
  });

  const taqwimConfig = await prisma.sesiTaqwim.findFirst();

  const todayWibStr = getTodayWibString(); // YYYY-MM-DD
  const todayWib = parseWibDateString(todayWibStr);
  const taqwimHariIni = !!taqwimConfig?.isActive && allTaqwimDates.some(t => t.tanggal.toISOString().startsWith(todayWibStr));


  // 5. Susun Jadwal
  const jadwalItems: any[] = [];

  // Gabungkan Sesi Global dan Tambahan ke dalam satu Set sesi yang relevan
  const allSesiKeys = new Set(globalSesi.map(s => s.sesi));
  sesiTambahan.forEach(s => allSesiKeys.add(s.sesi));
  const sortedSesiKeys = Array.from(allSesiKeys).sort((a,b) => parseInt(a.replace('SESI_','')) - parseInt(b.replace('SESI_','')));

  for (const sesi of sortedSesiKeys) {
    // Cari kelas apa yang diajar di sesi ini (bisa jadi kosong)
    const ps = pengajarSesi.find(p => p.sesi === sesi);
    const psp = pengajarSesiProgram.find(p => p.sesi === sesi);
    let kelasTujuan: any = ps?.kelas || null;
    let isProgramLevel = false;

    if (psp) {
      kelasTujuan = { nama: `Seluruh Program ${psp.program.nama_indo}`, programId: psp.programId };
      isProgramLevel = true;
    }

    // Default jadwal
    let jamBuka = "";
    let jamTutup = "";
    let label = `Sesi ${sesi.replace('SESI_', '')}`;
    let isTaqwim = false;
    let isWaliKelasTaqwim = false;

    // Logika Sesi 1 Taqwim Override (global)
    if (sesi === "SESI_1" && taqwimHariIni && taqwimConfig) {
      isTaqwim = true;
      jamBuka = taqwimConfig.jamBuka;
      jamTutup = taqwimConfig.jamTutup;
      label = "Sesi Taqwim";

      if (waliKelasData) {
        kelasTujuan = waliKelasData; // Wali kelas mengisi taqwim di kelasnya
        isWaliKelasTaqwim = true;
      } else {
        kelasTujuan = null; // Pengajar biasa ditiadakan jadwalnya hari ini
      }
    }

    if (!isTaqwim) {
      // Prioritas pengambilan jam:
      // 1. Jika pengajar level program (psp) → cari dari SesiTambahanProgram programnya dulu
      // 2. Jika tidak ada sesi tambahan → fallback ke sesi global
      // 3. Jika pengajar kelas reguler (ps) → langsung ke sesi global
      if (isProgramLevel && psp) {
        const st = sesiTambahan.find(s => s.sesi === sesi && s.programId === psp.programId);
        if (st) {
          jamBuka = st.jamBuka;
          jamTutup = st.jamTutup;
        } else {
          // Fallback ke global jika program tidak punya sesi tambahan
          const gs = globalSesi.find(g => g.sesi === sesi);
          if (gs) { jamBuka = gs.jamBuka; jamTutup = gs.jamTutup; label = gs.label || label; }
        }
      } else {
        // Pengajar kelas reguler: ambil dari global dulu, lalu sesi tambahan
        const gs = globalSesi.find(g => g.sesi === sesi);
        if (gs) {
          jamBuka = gs.jamBuka;
          jamTutup = gs.jamTutup;
          label = gs.label || label;
        } else {
          // Sesi Tambahan (untuk kelas yang programnya punya sesi tambahan)
          const st = sesiTambahan.find(s => s.sesi === sesi && s.programId === kelasTujuan?.programId);
          if (st) {
            jamBuka = st.jamBuka;
            jamTutup = st.jamTutup;
          }
        }
      }
    }


    // Tampilkan card hanya jika:
    // 1. Dia ada jadwal di sesi ini (kelasTujuan != null) ATAU
    // 2. Sesi ini adalah sesi global (untuk info status Kosong)
    const isGlobal = globalSesi.some(g => g.sesi === sesi);
    if (kelasTujuan || isGlobal) {
      jadwalItems.push({
        sesi,
        label,
        jamBuka,
        jamTutup,
        kelas: kelasTujuan ? kelasTujuan.nama : null,
        isProgramLevel,
        isTaqwimInfo: isTaqwim && isWaliKelasTaqwim ? "Otomatis ditugaskan (Wali Kelas)" : (isTaqwim ? "Ditiadakan (Hari Taqwim)" : null)
      });
    }
  }


  // 6. Tambahkan Kartu Info Taqwim Permanen untuk Wali Kelas
  if (waliKelasData && taqwimConfig) {
    const dateStrings = allTaqwimDates.map(d => {
       const tgl = d.tanggal.toISOString().split('T')[0];
       return new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    });

    jadwalItems.unshift({
      sesi: "TAQWIM_INFO",
      label: "Jadwal Khusus Taqwim",
      jamBuka: taqwimConfig.jamBuka,
      jamTutup: taqwimConfig.jamTutup,
      kelas: waliKelasData.nama,
      isTaqwimInfo: !taqwimConfig.isActive
        ? "Taqwim sedang nonaktif"
        : (dateStrings.length > 0 ? "Aktif pada: " + dateStrings.join(', ') : "Belum ada tanggal aktif"),
      isSpecialTaqwimCard: true
    });
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black md:text-4xl  flex items-center gap-3">
          <Calendar className="h-8 w-8 text-[var(--color-primary)]" />
          Jadwal Mengajar Saya
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] max-w-2xl">
          Berikut adalah jadwal kelas yang harus Anda ajar hari ini berdasarkan pengaturan sesi dan konfigurasi kurikulum.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {jadwalItems.map((jadwal, idx) => (
          <div key={`${jadwal.sesi}_${idx}`} className={`rounded-3xl border p-6 md:p-8 transition-all shadow-sm flex flex-col justify-between ${jadwal.isSpecialTaqwimCard ? 'bg-amber-50 border-amber-200' : (jadwal.kelas ? 'bg-[var(--color-primary-50)]/70 border-[var(--color-primary-100)]' : 'bg-white border-[var(--color-surface-dark)] opacity-80')}`}>
             <div>
               <div className="flex justify-between items-start mb-6">
                 <div>
                   <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-lg ${jadwal.kelas ? 'bg-[var(--color-primary-100)] text-[var(--color-primary-dark)]' : 'bg-[var(--color-surface)] text-[var(--color-text-muted)]'}`}>
                     {jadwal.sesi.replace('_', ' ')}
                   </span>
                   <h3 className="text-xl font-black text-[var(--color-text)] mt-4">{jadwal.label}</h3>
                 </div>
                 {jadwal.kelas ? (
                   <CheckCircle2 className="text-emerald-500 w-8 h-8" />
                 ) : jadwal.isTaqwimInfo ? (
                   <AlertTriangle className={jadwal.isSpecialTaqwimCard ? "text-[var(--color-primary)] w-8 h-8" : "text-amber-500 w-8 h-8"} />
                 ) : null}
               </div>
               
               {jadwal.jamBuka && jadwal.jamTutup ? (
                 <div className="flex items-center gap-2 text-[var(--color-text-muted)] font-mono text-sm font-bold bg-white/60 w-max px-3 py-1.5 rounded-lg border border-[var(--color-surface-dark)]/50 mb-6">
                    <Clock className="w-4 h-4 text-[var(--color-text-subtle)]" />
                    {jadwal.jamBuka} - {jadwal.jamTutup}
                 </div>
               ) : (
                 <div className="mb-6 h-8"></div>
               )}
             </div>
             
             <div className="pt-5 border-t border-[var(--color-surface-dark)]/50">
               {jadwal.kelas ? (
                 <div>
                   <p className={`text-[11px] uppercase tracking-[0.2em] font-black mb-1.5 ${jadwal.isProgramLevel ? 'text-amber-600' : 'text-[var(--color-primary)]'}`}>{jadwal.isProgramLevel ? 'Mengajar' : 'Mengajar Kelas'}</p>
                   <p className={`text-2xl font-black text-[var(--color-text)] ${jadwal.isProgramLevel ? 'text-xl text-amber-700' : ''}`}>{jadwal.kelas}</p>
                   {jadwal.isTaqwimInfo && <p className={`text-xs mt-2 font-bold ${jadwal.isSpecialTaqwimCard ? 'text-[var(--color-primary)]' : 'text-amber-600'}`}>{jadwal.isTaqwimInfo}</p>}
                 </div>
               ) : (
                 <div>
                   <p className="text-[11px] uppercase tracking-[0.2em] font-black text-[var(--color-text-subtle)] mb-1.5">Status</p>
                   <p className={`text-lg font-bold ${jadwal.isTaqwimInfo ? 'text-amber-600' : 'text-[var(--color-text-muted)]'}`}>
                     {jadwal.isTaqwimInfo || "Kosong (Tidak Ada Jadwal)"}
                   </p>
                 </div>
               )}
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}