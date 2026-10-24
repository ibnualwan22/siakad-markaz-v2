// Notifikasi ke E-Maliyah bahwa data absensi pengajar berubah, agar
// payroll (Jam Mengajar & Denda Terlambat) dihitung ulang otomatis
// berdasarkan pemetaan periode. Kegagalan kirim TIDAK mengganggu
// penyimpanan absensi — rekonsiliasi malam E-Maliyah adalah pengamannya.
export async function notifyEmaliyahAbsenChanged(tanggal: Date | string): Promise<void> {
  const url = process.env.EMALIYAH_WEBHOOK_URL;
  const secret = process.env.EMALIYAH_WEBHOOK_SECRET;
  if (!url || !secret) return;
  const tanggalStr = typeof tanggal === "string" ? tanggal : tanggal.toISOString().split("T")[0];
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-webhook-secret": secret },
      body: JSON.stringify({ tanggal: tanggalStr }),
      signal: AbortSignal.timeout(2500),
    });
  } catch (err) {
    console.error("[emaliyah-webhook] gagal mengirim notifikasi:", err);
  }
}
