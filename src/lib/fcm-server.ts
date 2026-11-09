import fs from "fs";
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import prisma from "@/lib/prisma";

// Pengiriman FCM ke aplikasi Flutter via firebase-admin (API modular v14).
// Service account TIDAK ada di repo: dibaca dari file di VPS
// (FIREBASE_SERVICE_ACCOUNT_PATH) atau JSON mentah
// (FIREBASE_SERVICE_ACCOUNT_JSON). Bila keduanya tidak ada / tidak valid,
// FCM NONAKTIF dan pengiriman lain (web-push + inbox) tetap jalan —
// fungsi di bawah mengembalikan nol tanpa melempar error.
// (Per 8 Nov 2026: proyek Firebase baru "Siakad" sedang dibuat — user
// memutuskan hapus 3 proyek lama tak terpakai lalu buat baru. Sampai
// service account tersedia, FCM tetap nonaktif dengan anggun.)

let app: App | null = null;
let initTried = false;

function getFcmApp(): App | null {
  if (app) return app;
  if (initTried) return null;
  initTried = true;
  try {
    const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (path && fs.existsSync(path)) {
      app =
        getApps().length > 0
          ? getApps()[0]!
          : initializeApp({ credential: cert(path) });
      return app;
    }
    if (raw) {
      app =
        getApps().length > 0
          ? getApps()[0]!
          : initializeApp({ credential: cert(JSON.parse(raw)) });
      return app;
    }
    return null;
  } catch (e) {
    console.warn(
      "FCM tidak aktif (service account tidak valid):",
      (e as Error)?.message ?? "unknown"
    );
    return null;
  }
}

export function isFcmEnabled(): boolean {
  return getFcmApp() !== null;
}

export type FcmSendResult = { sent: number; failed: number; pruned: number };

// Kirim ke token-token perangkat (maks 500 per panggilan FCM).
// Pesan DATA-ONLY (tanpa payload notification): aplikasi yang membangun
// notifikasi sendiri (flutter_local_notifications, channel "pengumuman"
// importance HIGH) supaya tampil sebagai heads-up di layar, judul
// notifikasi = pengirim, dan judul pengumuman tampil tebal di tampilan
// besar. Bila aplikasi belum diperbarui, pesan data tetap sampai ke
// background handler tanpa tampil — santri tetap melihatnya di inbox.
// Token yang ditolak FCM sebagai tidak terdaftar / tidak valid dihapus
// dari PerangkatSantri supaya tidak terus dicoba.
export async function sendFcmToTokens(
  tokens: { id: string; token: string }[],
  payload: {
    pengirimLabel: string;
    judul: string;
    isi: string;
    url?: string;
    pengumumanId?: string;
  }
): Promise<FcmSendResult> {
  const fcmApp = getFcmApp();
  if (!fcmApp || tokens.length === 0) {
    return { sent: 0, failed: 0, pruned: 0 };
  }
  const messaging = getMessaging(fcmApp);

  let sent = 0;
  let failed = 0;
  const invalidTokens: string[] = [];

  for (let i = 0; i < tokens.length; i += 500) {
    const chunk = tokens.slice(i, i + 500);
    try {
      const res = await messaging.sendEachForMulticast({
        tokens: chunk.map((t) => t.token),
        data: {
          pengirim: payload.pengirimLabel,
          judul: payload.judul,
          isi: payload.isi,
          url: payload.url ?? "/santri/pengumuman",
          pengumumanId: payload.pengumumanId ?? "",
        },
        android: { priority: "high" },
      });
      sent += res.successCount;
      failed += res.failureCount;
      res.responses.forEach((r, idx) => {
        if (!r.success) {
          const code = r.error?.code ?? "";
          if (
            code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-registration-token"
          ) {
            invalidTokens.push(chunk[idx].token);
          }
        }
      });
    } catch (e) {
      console.warn("FCM multicast gagal:", (e as Error)?.message ?? "unknown");
      failed += chunk.length;
    }
  }

  let pruned = 0;
  if (invalidTokens.length > 0) {
    const hapus = await prisma.perangkatSantri
      .deleteMany({ where: { token: { in: invalidTokens } } })
      .catch(() => null);
    pruned = hapus?.count ?? 0;
  }

  return { sent, failed, pruned };
}
