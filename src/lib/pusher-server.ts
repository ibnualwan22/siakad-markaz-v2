import crypto from "crypto";

// Pusher via REST API (tanpa dependensi server tambahan).
// Kredensial HANYA dibaca dari env runtime server — tidak pernah ke klien,
// tidak pernah ditulis ke file staging/repo.
function pusherEnv() {
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER;
  if (!appId || !key || !secret || !cluster) return null;
  return { appId, key, secret, cluster };
}

// Kirim event scan-berhasil ke channel private santri. Fire-and-forget:
// gagal kirim tidak pernah menggagalkan scan (hanya dicatat ke log server).
export async function triggerScanBerhasil(
  santriId: string,
  data: { kategoriNama: string; waktu: string }
) {
  const cfg = pusherEnv();
  if (!cfg) return;
  try {
    const body = JSON.stringify({
      name: "scan-berhasil",
      channels: [`private-santri-${santriId}`],
      data: JSON.stringify(data),
    });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyMd5 = crypto.createHash("md5").update(body).digest("hex");
    const params: Record<string, string> = {
      auth_key: cfg.key,
      auth_timestamp: timestamp,
      auth_version: "1.0",
      body_md5: bodyMd5,
    };
    const query = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join("&");
    const stringToSign = `POST\n/apps/${cfg.appId}/events\n${query}`;
    const signature = crypto
      .createHmac("sha256", cfg.secret)
      .update(stringToSign)
      .digest("hex");
    const url = `https://api-${cfg.cluster}.pusher.com/apps/${cfg.appId}/events?${query}&auth_signature=${signature}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (!res.ok) console.warn("Pusher trigger gagal:", res.status);
  } catch (e) {
    console.warn("Pusher trigger error:", (e as Error)?.message);
  }
}

// Tanda tangan auth channel private: "key:hmac(socketId:channel)".
export function authorizePrivateChannel(
  socketId: string,
  channel: string
): string | null {
  const cfg = pusherEnv();
  if (!cfg) return null;
  const signature = crypto
    .createHmac("sha256", cfg.secret)
    .update(`${socketId}:${channel}`)
    .digest("hex");
  return `${cfg.key}:${signature}`;
}
