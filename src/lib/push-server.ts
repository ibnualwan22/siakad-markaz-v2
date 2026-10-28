import * as webPush from "web-push";
import prisma from "@/lib/prisma";
import { filterPerhatian } from "./sakan-perhatian";

// Web Push via pustaka web-push (VAPID + enkripsi payload).
// Kredensial HANYA dibaca dari env runtime server — tidak pernah ke klien,
// tidak pernah ditulis ke file staging/repo.
function vapidEnv() {
  const publicKey = process.env.PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.PUSH_VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey };
}

let vapidConfigured = false;
function ensureVapid(): boolean {
  const cfg = vapidEnv();
  if (!cfg) return false;
  if (!vapidConfigured) {
    webPush.setVapidDetails(
      "https://markazarabiyah.site",
      cfg.publicKey,
      cfg.privateKey
    );
    vapidConfigured = true;
  }
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
};

// Kirim ke semua langganan staf, kecuali userId yang dikecualikan (pelaku
// submit tidak perlu menerima push atas aksinya sendiri).
// Gagal kirim tidak pernah menggagalkan pemicu (hanya dicatat ke log);
// langganan mati (410/404 dari push service) dihapus dari tabel.
export async function sendPushToStaff(
  payload: PushPayload,
  excludeUserId?: string | null
): Promise<{ sent: number; pruned: number }> {
  if (!ensureVapid()) return { sent: 0, pruned: 0 };
  const subs = await prisma.pushSubscription.findMany({
    where: excludeUserId ? { userId: { not: excludeUserId } } : undefined,
  });
  if (subs.length === 0) return { sent: 0, pruned: 0 };

  const results = await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webPush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload)
        );
        return "sent" as const;
      } catch (e: unknown) {
        const statusCode = (e as { statusCode?: number })?.statusCode;
        if (statusCode === 410 || statusCode === 404) {
          await prisma.pushSubscription
            .delete({ where: { id: s.id } })
            .catch(() => {});
          return "pruned" as const;
        }
        console.warn(
          "Push gagal:",
          statusCode ?? (e as Error)?.message ?? "unknown"
        );
        return "failed" as const;
      }
    })
  );

  let sent = 0;
  let pruned = 0;
  for (const r of results) {
    if (r.status === "fulfilled" && r.value === "sent") sent++;
    if (r.status === "fulfilled" && r.value === "pruned") pruned++;
  }
  return { sent, pruned };
}

// Susun payload laporan absen sakan untuk sakan-sakan yang BARU lapor.
// Satu push per aksi simpan (bukan per sakan) agar tidak membanjiri.
export async function buildSakanLaporanPush(
  tanggal: string,
  sakanList: string[],
  rows: { sakan: string; status: string; keterangan: string | null }[]
): Promise<PushPayload> {
  const url = "/admin/absensi/rekap/sakan";
  if (sakanList.length === 1) {
    const sakan = sakanList[0];
    const { izinSakit, bercatatan } = await filterPerhatian(
      rows.filter((r) => r.sakan === sakan)
    );
    const izin = izinSakit.filter((r) => r.status === "IZIN").length;
    const sakit = izinSakit.filter((r) => r.status === "SAKIT").length;
    const parts: string[] = [];
    if (izin > 0) parts.push(`${izin} izin`);
    if (sakit > 0) parts.push(`${sakit} sakit`);
    if (bercatatan.length > 0) parts.push(`${bercatatan.length} bercatatan`);
    const ringkas = parts.length > 0 ? parts.join(", ") : "semua hadir";
    return {
      title: "Laporan Absen Sakan",
      body: `Sakan ${sakan} sudah lapor • ${ringkas}`,
      url,
      tag: `sakan-${tanggal}-${sakan}`,
    };
  }
  return {
    title: "Laporan Absen Sakan",
    body: `${sakanList.length} sakan sudah lapor: ${sakanList.join(", ")}`,
    url,
  };
}
