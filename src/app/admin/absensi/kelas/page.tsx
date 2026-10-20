import { Metadata } from "next";
import { getProgramCatalog } from "@/lib/app-data";
import { AbsensiKelasClient } from "@/components/admin/absensi-kelas-client";

import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permission";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Absen Kelas - Admin Panel",
};

export default async function AbsensiKelasPage() {
  await requirePermission("absen_kelas");
  
  // Optimasi: Jalankan fetch session dan programList secara paralel (mempercepat ~30-50%)
  const [session, programList] = await Promise.all([
    getSession(),
    getProgramCatalog()
  ]);
  
  let allowedClassIds: string[] | null = null; // null = all classes allowed
  let teacherSessions: { sesi: string, kelasId: string, isProgramLevel?: boolean, programId?: string, programNama?: string }[] = [];
  let allPengajarSesi: any[] = []; // Untuk Admin Backup Mode (PengajarSesi kelas reguler)
  let allPengajarSesiProgram: any[] = []; // Untuk Admin Backup Mode (PengajarSesiProgram level program)
  
  // Ambil data Taqwim hari ini (kini global: satu tanggal berlaku untuk semua program)
  const { getTodayWibString, parseWibDateString } = await import("@/lib/absensi");
  const todayWib = parseWibDateString(getTodayWibString());
  const taqwimToday = await prisma.tanggalTaqwim.findFirst({
    where: { tanggal: todayWib },
    select: { id: true }
  });
  const isTaqwimToday = !!taqwimToday;
  
  if (session) {
    if (session.role !== "ADMIN") {
      const ps = await prisma.pengajarSesi.findMany({
        where: { userId: session.userId },
        select: { kelasId: true, sesi: true }
      });
      
      const psp = await prisma.pengajarSesiProgram.findMany({
        where: { userId: session.userId },
        include: { program: { include: { kelasList: { select: { id: true } } } } }
      });
      
      if (ps.length > 0 || session.kelasId || psp.length > 0) {
        allowedClassIds = Array.from(new Set(ps.map(p => p.kelasId)));
        
        if (session.kelasId && !allowedClassIds!.includes(session.kelasId)) {
          allowedClassIds!.push(session.kelasId);
        }
        
        psp.forEach((p: any) => {
          // Add all classes in the program
          p.program.kelasList.forEach((k: any) => {
            if (!allowedClassIds!.includes(k.id)) {
              allowedClassIds!.push(k.id);
            }
          });
        });
        
        teacherSessions = ps.map(p => ({ sesi: p.sesi, kelasId: p.kelasId }));
        psp.forEach((p: any) => {
          teacherSessions.push({
            sesi: p.sesi,
            kelasId: `PROGRAM_${p.programId}`,
            isProgramLevel: true,
            programId: p.programId,
            programNama: p.program.nama_indo
          });
        });
        
        // Logika Override Taqwim (global: hari taqwim berlaku untuk semua program)
        if (isTaqwimToday) {
          if (session.kelasId) {
            // Wali Kelas: hapus SEMUA SESI_1 reguler karena hari ini digantikan Taqwim,
            // lalu pasang SESI_1 khusus untuk kelasnya (Taqwim)
            teacherSessions = teacherSessions.filter(ts => ts.sesi !== "SESI_1");
            teacherSessions.push({ sesi: "SESI_1", kelasId: session.kelasId });
          } else {
            // Bukan wali kelas: tidak ada sesi mengajar di hari taqwim
            teacherSessions = teacherSessions.filter(ts => ts.sesi !== "SESI_1");
          }
        }

      } else {
        allowedClassIds = [];
      }
    } else {
      // Ambil pengajar kelas reguler
      allPengajarSesi = await prisma.pengajarSesi.findMany({
        select: {
          sesi: true,
          kelasId: true,
          user: { select: { id: true, nama: true } }
        }
      });

      // Ambil pengajar level program (Sesi 7+)
      allPengajarSesiProgram = await prisma.pengajarSesiProgram.findMany({
        select: {
          sesi: true,
          programId: true,
          user: { select: { id: true, nama: true } },
          program: { select: { id: true, nama_indo: true } }
        }
      });
      
      // Admin backup mode juga harus merefleksikan Taqwim
      if (isTaqwimToday) {
        allPengajarSesi = allPengajarSesi.filter(ps => ps.sesi !== "SESI_1");
      }
    }
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black md:text-4xl ">
          Absen Kelas
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] max-w-2xl">
          Pendataan kehadiran santri di kelas berdasarkan hissoh (sesi).
        </p>
      </div>
      <AbsensiKelasClient 
        programList={programList} 
        allowedClassIds={allowedClassIds} 
        userRole={session?.role}
        userId={session?.userId}
        teacherSessions={teacherSessions}
        allPengajarSesi={allPengajarSesi}
        allPengajarSesiProgram={allPengajarSesiProgram}
      />
    </div>
  );
}
