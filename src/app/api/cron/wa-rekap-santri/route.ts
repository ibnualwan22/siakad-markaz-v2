import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import prisma from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  let dari = searchParams.get("dari");
  let sampai = searchParams.get("sampai");
  let usbuLabel = "USBU";

  try {
    // Jika tidak ada parameter dari/sampai (berarti dari cron otomatis)
    // Cari usbu yang sedang aktif (berjalan)
    if (!dari || !sampai) {
      const dufahs = await prisma.dufah.findMany();
      // Asumsikan hanya satu usbu yang aktif pada satu waktu
      let activeUsbu: { start: Date; end: Date; label: string } | null = null;
      
      const today = new Date();
      // Gunakan timezone Jakarta untuk hari ini
      const formatter = new Intl.DateTimeFormat('en-CA', { 
        timeZone: 'Asia/Jakarta', 
        year: 'numeric', month: '2-digit', day: '2-digit' 
      });
      const todayStr = formatter.format(today);
      const todayDate = new Date(`${todayStr}T00:00:00Z`);

      // Kumpulkan semua Usbu yang berstatus aktif
      const allActiveUsbus: { start: Date; end: Date; label: string }[] = [];

      for (const d of dufahs) {
        if (d.usbu1Active && d.usbu1StartDate && d.usbu1EndDate) {
          allActiveUsbus.push({ start: d.usbu1StartDate, end: d.usbu1EndDate, label: "Usbu' 1" });
        }
        if (d.usbu2Active && d.usbu2StartDate && d.usbu2EndDate) {
          allActiveUsbus.push({ start: d.usbu2StartDate, end: d.usbu2EndDate, label: "Usbu' 2" });
        }
        if (d.usbu3Active && d.usbu3StartDate && d.usbu3EndDate) {
          allActiveUsbus.push({ start: d.usbu3StartDate, end: d.usbu3EndDate, label: "Nihai" });
        }
      }

      if (allActiveUsbus.length === 0) {
        return NextResponse.json({ success: false, message: "Tidak ada Usbu' yang aktif saat ini." });
      }

      // Jika ada lebih dari satu yang diaktifkan di web, kecerdasan buatan mencari mana yang paling tepat:
      // Prioritas 1: Usbu yang HARI INI adalah hari terakhirnya (Sangat penting untuk pengiriman Cron)
      // Prioritas 2: Usbu yang sedang berjalan hari ini (hari ini berada di antara start dan end)
      // Prioritas 3: Jika tidak ada yang cocok dengan hari ini, ambil yang paling terakhir
      activeUsbu = allActiveUsbus.find(u => u.end.toISOString().split("T")[0] === todayStr) || null;
      if (!activeUsbu) {
        activeUsbu = allActiveUsbus.find(u => todayDate >= u.start && todayDate <= u.end) || allActiveUsbus[allActiveUsbus.length - 1];
      }
      const endDateStr = activeUsbu.end.toISOString().split("T")[0];
      
      // Validasi: Jika dipicu otomatis, PASTIKAN hari ini adalah tanggal berakhirnya Usbu'
      if (todayStr !== endDateStr) {
        return NextResponse.json({ 
          success: false, 
          message: `Hari ini (${todayStr}) bukan hari terakhir dari ${activeUsbu.label} (${endDateStr}). Laporan otomatis diabaikan.` 
        });
      }

      dari = activeUsbu.start.toISOString().split("T")[0];
      sampai = endDateStr;
      usbuLabel = activeUsbu.label;
    }

    // Gunakan localhost untuk self-fetch agar tidak SSL error di dalam Docker container
    // request.nextUrl.origin bisa mengembalikan URL publik HTTPS yang tidak bisa di-reach dari dalam container
    const internalOrigin = `http://localhost:${process.env.PORT || 3000}`;
    const fetchUrl = `${internalOrigin}/api/admin/absensi/rekap/detail?type=kelas&dari=${dari}&sampai=${sampai}`;

    const res = await fetch(fetchUrl, {
      headers: {
        cookie: request.headers.get("cookie") || "",
        "x-cron-secret": process.env.CRON_SECRET || "",
        "x-forwarded-host": request.headers.get("host") || "",
      }
    });
    
    if (!res.ok) {
      return NextResponse.json({ error: "Gagal memuat data rekap santri" }, { status: 500 });
    }
    
    const records = await res.json();
    const alphaRecords = records.filter((r: any) => r.status === "ALPHA");
    
    if (alphaRecords.length === 0) {
      return NextResponse.json({ success: true, message: "Tidak ada santri yang ALPHA pada periode ini." });
    }

    // Format the message (sama seperti copy web)
    const usbuLabelsFromData = Array.from(new Set(alphaRecords.map((r: any) => r.usbu)));
    const rawTitle = usbuLabelsFromData.length === 1 ? usbuLabelsFromData[0] : (usbuLabelsFromData.length > 1 ? usbuLabelsFromData.join(" & ") : usbuLabel);
    
    let usbuTitle = String(rawTitle).toUpperCase();
    if (String(rawTitle).toLowerCase().includes("usbu")) {
      const num = String(rawTitle).replace(/\D/g, "");
      usbuTitle = `PEKAN KE-${num}`;
    } else if (String(rawTitle).toLowerCase() === "nihai") {
      usbuTitle = "PEKAN NIHAI";
    }
    
    let message = `REKAP ALPA ${usbuTitle}\n`;

    // Group alpha by kelas
    const byKelas: Record<string, any[]> = {};
    alphaRecords.forEach((r: any) => {
      if (!byKelas[r.kelas]) byKelas[r.kelas] = [];
      byKelas[r.kelas].push(r);
    });

    Object.keys(byKelas).sort().forEach((kelas) => {
      message += ` ${kelas.toUpperCase()}\n`;
      // Group by tanggal
      const byTanggal: Record<string, any[]> = {};
      byKelas[kelas].forEach((r: any) => {
        if (!byTanggal[r.tanggal]) byTanggal[r.tanggal] = [];
        byTanggal[r.tanggal].push(r);
      });
      
      Object.keys(byTanggal).sort().forEach((tgl) => {
        const dateFormatted = format(new Date(tgl), "EEEE, dd MMMM yyyy", { locale: id });
        message += `📚${dateFormatted}\n`;
        
        // Group by namaSantri to combine sessions
        const bySantri: Record<string, string[]> = {};
        byTanggal[tgl].forEach((r: any) => {
          if (!bySantri[r.namaSantri]) bySantri[r.namaSantri] = [];
          if (r.sesi) bySantri[r.namaSantri].push(r.sesi);
        });

        Object.keys(bySantri).sort().forEach((nama) => {
          const sessions = Array.from(new Set(bySantri[nama]));
          if (sessions.length > 0) {
            const nums = sessions
              .map(s => parseInt(s.replace("SESI_", "")))
              .filter(n => !isNaN(n))
              .sort((a, b) => a - b);
            
            let sesiStr = "";
            if (nums.length > 0) {
              let res = [];
              let start = nums[0];
              let end = nums[0];
              for (let i = 1; i < nums.length; i++) {
                if (nums[i] === end + 1) {
                  end = nums[i];
                } else {
                  res.push(start === end ? `${start}` : `${start}-${end}`);
                  start = nums[i];
                  end = nums[i];
                }
              }
              res.push(start === end ? `${start}` : `${start}-${end}`);
              sesiStr = res.join(", ");
            }
            message += `* ${nama}, sesi ${sesiStr}\n`;
          } else {
            message += `* ${nama}\n`;
          }
        });
        message += "\n";
      });
    });

    const targetWa = "6282132289500"; // Sesuai permintaan
    const result = await sendWhatsAppMessage(targetWa, message.trim());
    
    return NextResponse.json({ 
      success: result.success, 
      message: result.success ? "Laporan berhasil dikirim" : "Gagal mengirim laporan",
      detail: result.detail,
      data_count: alphaRecords.length
    });
  } catch (error: any) {
    console.error("Error wa-rekap-santri:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
