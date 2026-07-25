/**
 * WhatsApp API integration
 * Utility untuk mengirim laporan absensi ke grup WhatsApp .
 */

const WA_API_URL = "https://wa-multi-session.amtsilatipusat.com/api/v1";

/**
 * Mengirim pesan WhatsApp via WA Multi Session API.
 */
export async function sendWhatsAppMessage(target: string, message: string, forceSessionId?: string | null): Promise<{ success: boolean; detail?: string }> {
  const apiKey = process.env.WA_API_KEY || "024a3190-cfd8-4da6-8e82-7ac0f6c568d0";
  const sessionId = forceSessionId || process.env.WA_SESSION_ID2 || process.env.WA_SESSION_ID || "default";

  if (!apiKey) {
    return { success: false, detail: "WA_API_KEY belum dikonfigurasi" };
  }

  // Handle multiple targets if passed comma-separated targets
  const targets = target.split(",").map(t => t.trim()).filter(t => t.length > 0);
  
  if (targets.length === 0) {
    return { success: false, detail: "Target penerima kosong" };
  }

  try {
    let lastError = null;
    let successCount = 0;

    for (const t of targets) {
      const res = await fetch(`${WA_API_URL}/sessions/${sessionId}/send`, {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: t,
          message: message,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        successCount++;
      } else {
        lastError = data.message || data.error || `HTTP Error ${res.status}`;
      }
    }

    if (successCount > 0) {
      return { success: true, detail: "Pesan terkirim" };
    }

    return { success: false, detail: lastError || "Gagal mengirim pesan" };
  } catch (error: any) {
    return { success: false, detail: error.message || "Network error" };
  }
}

/**
 * Mengirim pesan reminder WhatsApp menggunakan sesi KEDUA (WA_SESSION_ID2).
 * Dipisah dari sesi utama agar tidak mengganggu pengiriman laporan rekap.
 */
export async function sendReminderWhatsApp(
  target: string,
  message: string
): Promise<{ success: boolean; detail?: string }> {
  const apiKey = process.env.WA_API_KEY || "024a3190-cfd8-4da6-8e82-7ac0f6c568d0";
  const sessionId = process.env.WA_SESSION_ID2 || process.env.WA_SESSION_ID || "default";

  if (!target || !target.trim()) {
    return { success: false, detail: "Nomor HP target kosong" };
  }

  try {
    const res = await fetch(`${WA_API_URL}/sessions/${sessionId}/send`, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: target.trim(),
        message,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      return { success: true, detail: "Reminder terkirim" };
    }

    return { success: false, detail: data.message || data.error || `HTTP Error ${res.status}` };
  } catch (error: any) {
    return { success: false, detail: error.message || "Network error" };
  }
}

/**
 * Delay helper untuk jeda antar pengiriman pesan (hindari spam detection).
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Format pesan reminder natural untuk pengajar yang belum mengisi absen kelas.
 *
 * Contoh output:
 * ```
 * Assalamu'alaikum Ustadz Ahmad,
 *
 * Mohon maaf mengganggu waktunya. Ini adalah pengingat bahwa absen kelas
 * berikut belum terisi:
 *
 * 📋 *Detail Sesi*
 * Nama Pengajar: *Ustadz Ahmad*
 * Sesi: *Sesi 2*
 * Kelas: *Nahwu A*
 * Jam Masuk: ________
 * Jam Keluar: ________
 * Santri yang Alpha: ________
 *
 * NB: Yang hadir cukup dikosongkan saja.
 *
 * Jazakumullahu khoiron atas perhatiannya 🙏
 *
 * ℹ️ _Pesan ini dikirim otomatis oleh Sistem Absensi Markaz Arabiyyah sebagai pengingat._
 * ```
 */
export function formatReminderMessage(
  namaPengajar: string,
  sesiLabel: string,
  kelasNama: string,
): string {
  const lines: string[] = [];

  lines.push(`Assalamu'alaikum ${namaPengajar},`);
  lines.push("");
  lines.push("Mohon maaf mengganggu waktunya. Ini adalah pengingat bahwa absen kelas berikut belum terisi:");
  lines.push("");
  lines.push("📋 *Detail Sesi*");
  lines.push(`Nama Pengajar: *${namaPengajar}*`);
  lines.push(`Sesi: *${sesiLabel}*`);
  lines.push(`Kelas: *${kelasNama}*`);
  lines.push("Jam Masuk: ________");
  lines.push("Jam Keluar: ________");
  lines.push("Santri yang Alpha: ________");
  lines.push("");
  lines.push("NB: Yang hadir cukup dikosongkan saja.");
  lines.push("");
  lines.push("Jazakumullahu khoiron atas perhatiannya 🙏");
  lines.push("");
  lines.push("ℹ️ _Pesan ini dikirim otomatis oleh Sistem Absensi Markaz Arabiyyah sebagai pengingat._");

  return lines.join("\n");
}

/**
 * Nama hari dalam bahasa Indonesia.
 */
const HARI_INDO = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/**
 * Nama bulan dalam bahasa Indonesia.
 */
const BULAN_INDO = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/**
 * Format tanggal menjadi "*Selasa, 19 Mei 2026*" (bold WhatsApp).
 * Parameter tanggal dalam format YYYY-MM-DD.
 */
export function formatTanggalWa(tanggalStr: string): string {
  const parts = tanggalStr.split("-");
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const date = new Date(year, month, day);

  const hari = HARI_INDO[date.getDay()];
  const bulan = BULAN_INDO[date.getMonth()];

  return `*${hari}, ${day} ${bulan} ${year}*`;
}

/**
 * Format laporan status absen SEMUA sakan menjadi pesan WhatsApp.
 *
 * Contoh output:
 * ```
 * *Rabu, 20 Mei 2026*
 *
 * • Al Muhdor ✅
 * • Al Jufri ✅
 * • Aidid
 * • Maula kheila ✅
 * • Baharun
 * • Bin Syihab ✅
 * • Turots ✅
 *   📝 Ratu Adilah: izin pulang
 * ```
 *
 * ✅ = sakan sudah mengisi absensi
 * Tanpa centang = sakan belum mengisi absensi
 * 📝 = keterangan santri di bawah sakan terkait
 */
export function formatSakanStatusReport(
  tanggalStr: string,
  allSakan: string[],
  sudahAbsen: string[],
  keteranganPerSakan: Map<string, { nama: string; keterangan: string }[]>,
  unconfirmedPerSakan: Map<string, { nama: string }[]> = new Map()
): string {
  const header = formatTanggalWa(tanggalStr);
  const sudahSet = new Set(sudahAbsen);

  const lines: string[] = [header, ""];

  for (const sakanName of allSakan) {
    const check = sudahSet.has(sakanName) ? " ✅" : "";
    lines.push(`• ${sakanName}${check}`);

    // Tampilkan keterangan santri di bawah sakan ini
    const ketList = keteranganPerSakan.get(sakanName);
    if (ketList && ketList.length > 0) {
      for (const ket of ketList) {
        lines.push(`  📝 ${ket.nama}: _${ket.keterangan}_`);
      }
    }

    const unconfList = unconfirmedPerSakan.get(sakanName);
    if (unconfList && unconfList.length > 0) {
      for (const unconf of unconfList) {
        lines.push(`  ⚠️ ${unconf.nama}: _Belum Konfirmasi Kehadiran Izin_`);
      }
    }
  }

  return lines.join("\n");
}

/**
 * Format laporan santri ALPHA pada kegiatan untuk dikirim ke bagian keamanan/kedisiplinan.
 * 
 * Contoh output:
 * ```
 * يرجي من الأسماء المكتوبة أدناه الاتجاه إلى الرواق التنفيذي في قسم الأمن والانضباط بعد الدراسة
 * 
 * Diharapkan semua nama-nama yang tertulis dibawah ini, untuk menghadap ke ruang pengurus dibagian keamanan dan kedisiplinan setelah pembelajaran
 * 
 * *Daftar Alpha - Halaqoh*
 * *Rabu, 20 Mei 2026*
 * 
 * 1. Ainur Syafiq - Balfaqih
 * 2. Arsil Azim - Ba'alawy
 * ...
 * 
 * سأنتظركم حتى الساعة الواحدة
 * Saya tunggu sampai jam dari jam 11.45- 13.00
 * 
 * NB : *tanda 1x menandakan tidak hadir pemanggilan 1x,...*
 * ```
 */
export function formatKegiatanAlphaReport(
  tanggalStr: string,
  kegiatanNama: string,
  alphaList: { nama: string; sakan: string }[],
): string {
  const lines: string[] = [];

  // Header Arabic
  lines.push("يرجي  من الأسماء المكتوبة أدناه الاتجاه إلى الرواق التنفيذي في قسم الأمن والانضباط بعد الدراسة");
  lines.push("");
  // Header Indonesian
  lines.push("Diharapkan semua nama-nama yang tertulis dibawah ini, untuk menghadap ke ruang pengurus dibagian keamanan dan kedisiplinan setelah pembelajaran");
  lines.push("");

  // Tanggal + nama kegiatan
  lines.push(`*Daftar Alpha - ${kegiatanNama}*`);
  lines.push(formatTanggalWa(tanggalStr));
  lines.push("");

  // Numbered list: Nama - Sakan
  alphaList.forEach((s, i) => {
    lines.push(`${i + 1}. ${s.nama} - ${s.sakan}`);
  });

  lines.push("");
  lines.push("سأنتظركم حتى الساعة الواحدة");
  lines.push("Saya tunggu sampai jam dari jam 11.45- 13.00");
  lines.push("");
  lines.push("NB : *tanda 1x menandakan tidak hadir pemanggilan 1x,tanda 2x menandakan tidak hadir pemanggilan 2x, tanda 3x tidak hadir pemanggilan 3x dan jika sudah sampai 3x maka akan berlaku SP 1 ,tambahan bagi yang telat ataupun tidak hadir*");

  return lines.join("\n");
}

/**
 * Format pesan pemberitahuan checkout ke DPO / Wali Santri.
 */
export function formatCheckoutWaliMessage(data: {
  namaSantri: string;
  tempatLahir: string;
  tanggalLahir: string;
  alamat: string;
  sakan: string;
  kamar: string;
  kategori: string;
  alasan: string;
  tanggalCheckout: string;
}): string {
  const lines: string[] = [];
  
  lines.push(`Assalamu'alaikum Warahmatullahi Wabarakatuh,`);
  lines.push("");
  lines.push(`Pemberitahuan dari SIAKAD Markaz Arabiyah.`);
  lines.push("");
  lines.push(`Alhamdulillah, kami sampaikan bahwa santri atas nama:`);
  lines.push(`*${data.namaSantri}*`);
  lines.push("");
  lines.push(`Dengan data diri:`);
  lines.push(`- Tempat Lahir: *${data.tempatLahir || "-"}*`);
  lines.push(`- Tanggal Lahir: *${data.tanggalLahir || "-"}*`);
  lines.push(`- Sakan / Kamar: *${data.sakan || "-"} / ${data.kamar || "-"}*`);
  lines.push(`- Kategori: *${data.kategori || "-"}*`);
  lines.push(`- Alamat: *${data.alamat || "-"}*`);
  lines.push(`- Alasan: *${data.alasan || "-"}*`);
  lines.push("");
  lines.push(`Telah resmi *Check Out (Keluar)* dari Markaz Arabiyyah pada tanggal *${data.tanggalCheckout}*.`);
  lines.push("");
  lines.push(`Jazakumullahu khoiron atas kepercayaan Bapak/Ibu. Semoga ilmu yang didapat bermanfaat dan berkah.`);
  lines.push("");
  lines.push(`ℹ️ _Pesan ini dikirim otomatis oleh SIAKAD Markaz Arabiyah._`);

  return lines.join("\n");
}

/**
 * Format pesan ke Keamanan untuk santri yang belum konfirmasi kehadiran setelah masa perizinan habis.
 */
export function formatKonfirmasiKeamananMessage(
  santriList: { nama: string; sakan: string; tanggalSelesai: string }[]
): string {
  const lines: string[] = [];

  lines.push(`🚨 *LAPORAN SANTRI BELUM KONFIRMASI KEHADIRAN* 🚨`);
  lines.push(`Berikut adalah daftar santri dengan status izin *Keluar Pare / Berhari-hari* yang sudah melewati batas waktu izin namun *belum konfirmasi kehadiran* (belum kembali):`);
  lines.push("");
  
  santriList.forEach((s, i) => {
    lines.push(`${i + 1}. *${s.nama}*`);
    lines.push(`   • Sakan: ${s.sakan || "-"}`);
    lines.push(`   • Batas Izin: ${formatTanggalWa(s.tanggalSelesai)}`);
  });
  
  lines.push("");
  lines.push(`Mohon kerjasamanya untuk ditindaklanjuti.`);
  lines.push(`ℹ️ _Sistem Pemantauan Perizinan SIAKAD_`);

  return lines.join("\n");
}

/**
 * Format pesan ke Santri (Warning) karena belum konfirmasi kehadiran.
 */
export function formatKonfirmasiSantriMessage(data: {
  namaSantri: string;
  nomorKeamanan: string;
  tanggalSelesai: string;
}): string {
  const lines: string[] = [];

  lines.push(`⚠️ *PERINGATAN KONFIRMASI KEHADIRAN* ⚠️`);
  lines.push("");
  lines.push(`Assalamu'alaikum ${data.namaSantri},`);
  lines.push("");
  lines.push(`Masa perizinan anda telah berakhir pada tanggal *${formatTanggalWa(data.tanggalSelesai)}*, namun anda *belum melakukan konfirmasi kehadiran*.`);
  lines.push("");
  lines.push(`Dimohon untuk *segera konfirmasi* ke nomor keamanan/pengurus di:`);
  lines.push(`*${data.nomorKeamanan}*`);
  lines.push("");
  lines.push(`Anda *diwajibkan* mengirimkan foto konfirmasi (selfie di sakan dengan jam saat ini, bisa menggunakan HP teman) paling lambat *12 jam* dari pesan ini dikirim.`);
  lines.push("");
  lines.push(`_Catatan: Jika Anda merasa sudah konfirmasi secara langsung namun masih mendapatkan pesan ini, harap kirim pesan pengingat ke nomor keamanan di atas agar kehadiran Anda segera di-update di sistem website._`);
  lines.push("");
  lines.push(`Harap segera direspon sebelum dikenakan sanksi indisipliner.`);

  return lines.join("\n");
}
