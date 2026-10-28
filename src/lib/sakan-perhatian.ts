import prisma from "@/lib/prisma";
import { extractNomorTasrih, humanKeterangan } from "./sakan-perhatian-pure";

export { extractNomorTasrih, humanKeterangan };

export type PerhatianRow = {
  status: string;
  keterangan: string | null;
};

// Tipe izin yang dianggap RUTIN dan tidak masuk daftar perhatian
// (keputusan user 28 Okt 2026): izin harian dan ta'birot.
const ROUTINE_TIPE = ["HARIAN", "TABIROT"] as const;

// Pisahkan baris absen sakan menjadi:
// - izinSakit: status IZIN (kecuali yang tasrihnya HARIAN/TABIROT) + SAKIT
// - bercatatan: status HADIR/ALPHA yang punya catatan manusia
// Baris IZIN tanpa tasrih (catatan manual) tetap tampil.
export async function filterPerhatian<T extends PerhatianRow>(rows: T[]): Promise<{
  izinSakit: T[];
  bercatatan: T[];
}> {
  const tasrihSet = new Set<string>();
  for (const r of rows) {
    if (r.status === "IZIN") {
      const t = extractNomorTasrih(r.keterangan);
      if (t) tasrihSet.add(t);
    }
  }

  const routine = new Set<string>();
  if (tasrihSet.size > 0) {
    const found = await prisma.perizinan.findMany({
      where: {
        nomorTasrih: { in: Array.from(tasrihSet) },
        tipeIzin: { in: [...ROUTINE_TIPE] },
      },
      select: { nomorTasrih: true },
    });
    for (const f of found) routine.add(f.nomorTasrih);
  }

  const izinSakit: T[] = [];
  const bercatatan: T[] = [];
  for (const r of rows) {
    if (r.status === "IZIN") {
      const t = extractNomorTasrih(r.keterangan);
      if (t && routine.has(t)) continue;
      izinSakit.push(r);
    } else if (r.status === "SAKIT") {
      izinSakit.push(r);
    } else if (
      (r.status === "HADIR" || r.status === "ALPHA") &&
      humanKeterangan(r.keterangan)
    ) {
      bercatatan.push(r);
    }
  }
  return { izinSakit, bercatatan };
}
