import prisma from "@/lib/prisma";

// Resolver jendela sesi sisi server (Fase 2: validasi waktu simpan absensi).
// Preseden sama seperti yang dipakai klien (absensi-kelas-client):
//   1) Taqwim: SESI_1 pada tanggal taqwim & konfigurasi taqwim aktif
//   2) SesiTambahanProgram: override sesi milik program kelas tsb (isActive)
//   3) JadwalSesi global
// Jendela berlaku = jamBuka s.d. jamTutup + toleransiMenit.
// Asumsi (keputusan user 20 Okt 2026): tidak ada sesi malam — aritmetika
// memakai menit-dalam-hari tanpa penanganan lintas tengah malam.

export interface SesiWindow {
  bukaMenit: number;
  tutupMenit: number;
  toleransiMenit: number;
  akhirMenit: number; // tutupMenit + toleransiMenit
  sumber: "taqwim" | "tambahan" | "global";
}

function jamKeMenit(jam: string): number {
  const [h, m] = jam.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function buatWindow(jamBuka: string, jamTutup: string, toleransiMenit: number | null | undefined, sumber: SesiWindow["sumber"]): SesiWindow {
  const tutup = jamKeMenit(jamTutup);
  const tol = toleransiMenit ?? 0;
  return { bukaMenit: jamKeMenit(jamBuka), tutupMenit: tutup, toleransiMenit: tol, akhirMenit: tutup + tol, sumber };
}

export async function resolveSesiWindowServer(
  sesi: string,
  programId: string | null,
  parsedDate: Date
): Promise<SesiWindow | null> {
  if (sesi === "SESI_1") {
    const cfg = await prisma.sesiTaqwim.findFirst({ where: { isActive: true } });
    if (cfg) {
      const tgl = await prisma.tanggalTaqwim.findFirst({ where: { tanggal: parsedDate } });
      if (tgl) return buatWindow(cfg.jamBuka, cfg.jamTutup, cfg.toleransiMenit, "taqwim");
    }
  }
  if (programId) {
    const tambahan = await prisma.sesiTambahanProgram.findFirst({
      where: { programId, sesi: sesi as any, isActive: true },
    });
    if (tambahan) return buatWindow(tambahan.jamBuka, tambahan.jamTutup, tambahan.toleransiMenit, "tambahan");
  }
  const global = await prisma.jadwalSesi.findUnique({ where: { sesi: sesi as any } });
  if (global) return buatWindow(global.jamBuka, global.jamTutup, global.toleransiMenit, "global");
  return null;
}

// Menit-dalam-hari (0-1439) untuk waktu Asia/Jakarta saat ini.
export function menitWibSekarang(d: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const h = Number(parts.find((x) => x.type === "hour")?.value ?? "0");
  const m = Number(parts.find((x) => x.type === "minute")?.value ?? "0");
  return (h % 24) * 60 + m;
}

export function formatMenit(menit: number): string {
  const h = Math.floor(menit / 60) % 24;
  const m = menit % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
