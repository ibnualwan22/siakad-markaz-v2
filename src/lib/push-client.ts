// Helper klien untuk langganan Web Push (dipakai komponen prompt izin).
// Berjalan penuh di browser; tidak pernah menyentuh kunci privat.

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type PushState = {
  supported: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
};

// Baca status tanpa meminta apa pun ke pengguna (tidak memicu prompt).
export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) {
    return { supported: false, permission: "denied", subscribed: false };
  }
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription =
      await registration?.pushManager.getSubscription();
    return {
      supported: true,
      permission: Notification.permission,
      subscribed: !!subscription,
    };
  } catch {
    return { supported: true, permission: Notification.permission, subscribed: false };
  }
}

// Minta izin (prompt browser) lalu berlangganan. Kembalikan hasil akhir.
// Jalur staf (default) memakai /api/push/*; jalur santri memakai
// /api/santri/push/* — logika sama, hanya endpoint server yang berbeda.
export async function subscribePush(): Promise<
  "subscribed" | "denied" | "error"
> {
  return subscribePushInternal(
    "/api/push/vapid-config",
    "/api/push/subscribe"
  );
}

export async function subscribePushSantri(): Promise<
  "subscribed" | "denied" | "error"
> {
  return subscribePushInternal(
    "/api/santri/push/vapid-config",
    "/api/santri/push/subscribe"
  );
}

async function subscribePushInternal(
  vapidConfigUrl: string,
  subscribeUrl: string
): Promise<"subscribed" | "denied" | "error"> {
  if (!pushSupported()) return "error";
  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      await sendSubscriptionToServer(existing, subscribeUrl);
      return "subscribed";
    }
    const cfgRes = await fetch(vapidConfigUrl);
    if (!cfgRes.ok) return "error";
    const cfg = await cfgRes.json();
    if (!cfg.publicKey) return "error";
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(cfg.publicKey),
    });
    await sendSubscriptionToServer(subscription, subscribeUrl);
    return "subscribed";
  } catch {
    return "error";
  }
}

async function sendSubscriptionToServer(
  subscription: PushSubscription,
  subscribeUrl: string
): Promise<void> {
  const json = subscription.toJSON();
  if (!json.keys) throw new Error("kunci langganan kosong");
  const res = await fetch(subscribeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      keys: json.keys,
    }),
  });
  // Langganan dianggap berhasil hanya bila server menyimpannya; bila tidak,
  // subscribePush melaporkan error (bukan "subscribed" palsu).
  if (!res.ok) throw new Error("gagal simpan langganan");
}

// Berhenti berlangganan di perangkat ini + hapus barisnya di server.
export async function unsubscribePush(): Promise<boolean> {
  return unsubscribePushInternal("/api/push/subscribe");
}

export async function unsubscribePushSantri(): Promise<boolean> {
  return unsubscribePushInternal("/api/santri/push/subscribe");
}

async function unsubscribePushInternal(
  subscribeUrl: string
): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription =
      await registration?.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await fetch(subscribeUrl, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
    }
    return true;
  } catch {
    return false;
  }
}
