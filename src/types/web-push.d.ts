// Deklarasi minimal untuk pustaka web-push (tidak membawa tipe bawaan).
// Hanya API yang dipakai push-server.ts.
declare module "web-push" {
  export interface PushSubscriptionKeys {
    p256dh: string;
    auth: string;
  }
  export interface PushSubscription {
    endpoint: string;
    keys: PushSubscriptionKeys;
  }
  export function setVapidDetails(
    subject: string,
    publicKey: string,
    privateKey: string
  ): void;
  export function sendNotification(
    subscription: PushSubscription,
    payload?: string | Buffer
  ): Promise<unknown>;
  export function generateVAPIDKeys(): {
    publicKey: string;
    privateKey: string;
  };
}
