import { normalisasiTargetLembaga } from "@/lib/notifikasi-target";
import type { LembagaId } from "@/lib/lembaga";

// Validasi payload jadwal (dipakai POST buat-baru dan PUT ubah).
// Mengembalikan data yang sudah dinormalisasi, siap simpan ke Prisma:
// targetLembaga = array LembagaId atau null (global); field hari/tanggal
// yang tidak relevan dengan jenisJadwal dikosongkan (null).

export type JadwalData = IsiPengumumanData & {
  jenisJadwal: "HARIAN" | "MINGGUAN" | "TANGGAL";
  hari: number | null;
  tanggal: Date | null;
  waktu: string;
  isActive: boolean;
};

const LEMBAGA_VALID = ["ARABIYAH", "TURATS", "HUFADZ"];
const WAKTU_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Validasi isi pengumuman (dipakai jadwal DAN kirim-sekali): template
// pengirim, judul, isi, tautan, target. Tanpa unsur jadwal.
export type IsiPengumumanData = {
  templateId: string;
  judul: string;
  isi: string;
  tautan: string | null;
  targetLembaga: LembagaId[] | null;
};

export function validasiIsiPengumuman(
  body: any
): { ok: true; data: IsiPengumumanData } | { ok: false; error: string } {
  const templateId =
    typeof body?.templateId === "string" ? body.templateId.trim() : "";
  if (!templateId) return { ok: false, error: "Template pengirim wajib dipilih" };

  const judul = typeof body?.judul === "string" ? body.judul.trim() : "";
  if (!judul) return { ok: false, error: "Judul wajib diisi" };

  const isi = typeof body?.isi === "string" ? body.isi.trim() : "";
  if (!isi) return { ok: false, error: "Isi pengumuman wajib diisi" };

  const tautan =
    typeof body?.tautan === "string" && body.tautan.trim()
      ? body.tautan.trim()
      : null;

  // targetLembaga: array subset dari 3 lembaga, atau null/kosong = global.
  let targetRaw: unknown = body?.targetLembaga ?? null;
  if (targetRaw !== null && !Array.isArray(targetRaw)) {
    return { ok: false, error: "Target lembaga tidak valid" };
  }
  if (Array.isArray(targetRaw)) {
    const asing = targetRaw.filter((t) => !LEMBAGA_VALID.includes(t));
    if (asing.length > 0) {
      return { ok: false, error: `Target lembaga tidak dikenal: ${asing.join(", ")}` };
    }
  }
  const targetLembaga = normalisasiTargetLembaga(targetRaw);

  return { ok: true, data: { templateId, judul, isi, tautan, targetLembaga } };
}

export function validasiJadwal(
  body: any
): { ok: true; data: JadwalData } | { ok: false; error: string } {
  const isi = validasiIsiPengumuman(body);
  if (!isi.ok) return isi;
  const data = isi.data;

  const jenisJadwal = body?.jenisJadwal;
  if (!["HARIAN", "MINGGUAN", "TANGGAL"].includes(jenisJadwal)) {
    return { ok: false, error: "Jenis jadwal harus HARIAN, MINGGUAN, atau TANGGAL" };
  }

  const waktu = typeof body?.waktu === "string" ? body.waktu.trim() : "";
  if (!WAKTU_RE.test(waktu)) {
    return { ok: false, error: "Waktu harus format HH:mm (00:00–23:59) WIB" };
  }

  let hari: number | null = null;
  let tanggal: Date | null = null;

  if (jenisJadwal === "MINGGUAN") {
    const h = body?.hari;
    if (typeof h !== "number" || !Number.isInteger(h) || h < 0 || h > 6) {
      return { ok: false, error: "Jadwal mingguan wajib memilih hari (0=Ahad .. 6=Sabtu)" };
    }
    hari = h;
  }

  if (jenisJadwal === "TANGGAL") {
    const t = body?.tanggal;
    if (typeof t !== "string" || !t.trim()) {
      return { ok: false, error: "Jadwal tanggal wajib memilih tanggal" };
    }
    const d = new Date(t);
    if (Number.isNaN(d.getTime())) {
      return { ok: false, error: "Tanggal tidak valid" };
    }
    tanggal = d;
  }

  return {
    ok: true,
    data: {
      ...data,
      jenisJadwal,
      hari,
      tanggal,
      waktu,
      isActive: body?.isActive === undefined ? true : !!body.isActive,
    },
  };
}
