import { redirect } from "next/navigation";

// Absen Mandiri dihapus dari portal santri (27 Okt 2026): kehadiran kegiatan
// kini hanya lewat scan QR oleh petugas. URL lama dialihkan ke QR Saya.
export default function AbsenKegiatanDialihkan() {
  redirect("/santri/qr-saya");
}
