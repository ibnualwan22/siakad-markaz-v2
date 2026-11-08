import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getTargetSantriIds } from "./notifikasi-target";
import { sendFcmToTokens, isFcmEnabled } from "./fcm-server";
import { sendPushToSantriDevices } from "./push-server";
import type { LembagaId } from "./lembaga";

// Orkestrasi pengiriman satu pengumuman (dipakai cron + kirim-sekarang):
// 1) tentukan santri target, 2) tulis arsip Pengumuman (inbox),
// 3) kirim FCM (aplikasi; dilewati bila service account belum ada),
// 4) kirim Web Push VAPID (portal web), 5) tulis NotifikasiLog,
// 6) perbarui lastSentAt jadwal (jadwal TANGGAL sekaligus dinonaktifkan).
// Kegagalan satu jalur tidak menggagalkan jalur lain.

// Jam WIB eksplisit (UTC+7) — tidak tergantung zona waktu server.
export function nowWib(): Date {
  return new Date(Date.now() + 7 * 60 * 60 * 1000);
}

// "YYYY-MM-DD" dalam WIB.
export function wibHariIni(t: Date = nowWib()): string {
  return t.toISOString().slice(0, 10);
}

// "HH:mm" dalam WIB.
export function wibJamMenit(t: Date = nowWib()): string {
  return t.toISOString().slice(11, 16);
}

// 0=Ahad .. 6=Sabtu (konvensi JS getDay) dalam WIB.
export function wibHariKe(t: Date = nowWib()): number {
  return t.getUTCDay();
}

export type JadwalDueInput = {
  jenisJadwal: "HARIAN" | "MINGGUAN" | "TANGGAL";
  hari: number | null;
  tanggal: Date | null;
  waktu: string;
  lastSentAt: Date | null;
};

// Apakah jadwal jatuh tempo pada saat ini (WIB)?
// - Sudah terkirim hari ini → tidak.
// - Waktu jadwal sudah lewat 0–4 menit terakhir (toleransi keterlambatan
//   tick cron 1 menit). Belum waktunya / sudah lewat >4 menit → tidak
//   (terlewat sampai jadwal berikutnya — tidak ada kirim susulan).
// - MINGGUAN: hari harus cocok. TANGGAL: tanggal harus hari ini.
export function isJadwalDue(j: JadwalDueInput, now: Date = nowWib()): boolean {
  if (j.lastSentAt) {
    const lastWib = new Date(j.lastSentAt.getTime() + 7 * 60 * 60 * 1000);
    if (wibHariIni(lastWib) === wibHariIni(now)) return false;
  }
  const [wh, wm] = j.waktu.split(":").map(Number);
  if (Number.isNaN(wh) || Number.isNaN(wm)) return false;
  const selisih =
    now.getUTCHours() * 60 + now.getUTCMinutes() - (wh * 60 + wm);
  if (selisih < 0 || selisih >= 5) return false;
  if (j.jenisJadwal === "MINGGUAN") {
    if (j.hari === null || j.hari === undefined) return false;
    if (j.hari !== wibHariKe(now)) return false;
  }
  if (j.jenisJadwal === "TANGGAL") {
    if (!j.tanggal) return false;
    if (new Date(j.tanggal).toISOString().slice(0, 10) !== wibHariIni(now)) {
      return false;
    }
  }
  return true;
}

// Tautan untuk payload push: hanya path web / URL penuh yang dipakai;
// deep link aplikasi (mis. siakad://...) tidak bisa dibuka browser, jadi
// push web mengarah ke inbox pengumuman.
export function pushUrl(tautan: string | null | undefined): string {
  if (tautan && (tautan.startsWith("/") || tautan.startsWith("http"))) {
    return tautan;
  }
  return "/santri/pengumuman";
}

export type KirimHasil = {
  pengumumanId: string;
  totalTarget: number;
  suksesFCM: number;
  gagalFCM: number;
  suksesWebPush: number;
  gagalWebPush: number;
  fcmEnabled: boolean;
  error?: string;
};

export async function kirimPengumuman(input: {
  jadwalId?: string | null;
  templateLabel: string;
  judul: string;
  isi: string;
  tautan?: string | null;
  targetLembaga: LembagaId[] | null;
}): Promise<KirimHasil> {
  const targetIds = await getTargetSantriIds(input.targetLembaga);

  const pengumuman = await prisma.pengumuman.create({
    data: {
      judul: input.judul,
      isi: input.isi,
      tautan: input.tautan ?? null,
      pengirimLabel: input.templateLabel,
      lembaga: (input.targetLembaga ?? undefined) as unknown as
        | Prisma.InputJsonValue
        | undefined,
      jadwalId: input.jadwalId ?? null,
    },
  });

  const url = pushUrl(input.tautan);
  let suksesFCM = 0;
  let gagalFCM = 0;
  let suksesWebPush = 0;
  let gagalWebPush = 0;
  let error: string | undefined;
  const fcmEnabled = isFcmEnabled();

  try {
    // Jalur 1 — FCM (aplikasi). Dilewati bila service account belum ada.
    if (fcmEnabled && targetIds.length > 0) {
      const tokens = await prisma.perangkatSantri.findMany({
        where: { santriId: { in: targetIds } },
        select: { id: true, token: true },
      });
      const r = await sendFcmToTokens(tokens, {
        title: input.judul,
        body: input.isi,
        url,
        pengumumanId: pengumuman.id,
      });
      suksesFCM = r.sent;
      gagalFCM = r.failed;
    }

    // Jalur 2 — Web Push VAPID (portal web, termasuk iOS PWA).
    if (targetIds.length > 0) {
      const r = await sendPushToSantriDevices(
        { title: input.judul, body: input.isi, url },
        targetIds
      );
      suksesWebPush = r.sent;
      gagalWebPush = r.failed;
    }
  } catch (e) {
    error = (e as Error)?.message ?? "unknown";
    console.error("kirimPengumuman gagal:", error);
  }

  await prisma.notifikasiLog.create({
    data: {
      jadwalId: input.jadwalId ?? null,
      pengumumanId: pengumuman.id,
      targetLembaga: (input.targetLembaga ?? undefined) as unknown as
        | Prisma.InputJsonValue
        | undefined,
      totalTarget: targetIds.length,
      suksesFCM,
      gagalFCM,
      suksesWebPush,
      gagalWebPush,
      fcmEnabled,
      error: error ?? null,
    },
  });

  // Tandai jadwal sudah terkirim (jadwal TANGGAL sekali kirim lalu nonaktif).
  if (input.jadwalId) {
    const jadwal = await prisma.notifikasiJadwal.findUnique({
      where: { id: input.jadwalId },
      select: { jenisJadwal: true },
    });
    if (jadwal) {
      await prisma.notifikasiJadwal.update({
        where: { id: input.jadwalId },
        data: {
          lastSentAt: new Date(),
          ...(jadwal.jenisJadwal === "TANGGAL" ? { isActive: false } : {}),
        },
      });
    }
  }

  return {
    pengumumanId: pengumuman.id,
    totalTarget: targetIds.length,
    suksesFCM,
    gagalFCM,
    suksesWebPush,
    gagalWebPush,
    fcmEnabled,
    error,
  };
}
