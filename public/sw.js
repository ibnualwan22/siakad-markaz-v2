// Service worker notifikasi Siakad (pilot: laporan absen sakan).
// File ini disajikan apa adanya dari /public — tidak diproses Next.js.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Siakad";
  const options = {
    body: data.body || "",
    icon: "/images/logo-siakad-icon.png",
    badge: "/images/logo-siakad-icon.png",
    data: { url: data.url || "/admin/absensi/rekap/sakan" },
    tag: data.tag,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url =
    (event.notification.data && event.notification.data.url) ||
    "/admin/absensi/rekap/sakan";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
