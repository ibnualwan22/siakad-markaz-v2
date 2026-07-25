import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSantriSession } from '@/lib/santri-auth';
import { haversineDistance } from '@/lib/geolocation';
import { getActiveRiwayatListForAbsen } from '@/lib/absensi';

export async function GET() {
  const session = await getSantriSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Return active (open, not expired) sessions with their locations
  const now = new Date();
  const sesiAktif = await prisma.sesiAbsenKegiatan.findMany({
    where: {
      isClosed: false,
      ditutupPada: { gt: now }
    },
    include: {
      kategori: true,
      lokasiList: {
        include: {
          lokasi: { select: { id: true, nama: true, latitude: true, longitude: true, radius: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Flatten all unique locations from active sessions
  const lokasiMap = new Map<string, { id: string; nama: string; latitude: number; longitude: number; radius: number }>();
  for (const sesi of sesiAktif) {
    for (const sl of sesi.lokasiList) {
      lokasiMap.set(sl.lokasi.id, sl.lokasi);
    }
  }

  return NextResponse.json({
    success: true,
    hasSesiAktif: sesiAktif.length > 0,
    lokasiAktif: Array.from(lokasiMap.values()),
    sesiCount: sesiAktif.length
  });
}

export async function POST(request: Request) {
  try {
    const session = await getSantriSession();
    if (!session || !session.isAktif) {
      return NextResponse.json({ error: 'Unauthorized / Santri Tidak Aktif' }, { status: 401 });
    }

    const { kode, latitude, longitude } = await request.json();

    if (!kode) {
      return NextResponse.json({ error: "Kode akses wajib diisi" }, { status: 400 });
    }

    // [GEOFENCING DISABLED] — Validasi koordinat dinonaktifkan sementara.
    // Untuk mengaktifkan kembali, uncomment baris berikut:
    // if (latitude === undefined || longitude === undefined) {
    //   return NextResponse.json({ error: "Kode akses dan Lokasi GPS wajib diisi" }, { status: 400 });
    // }

    const upperKode = kode.trim().toUpperCase();

    // 1. Cari sesi aktif
    const sesi = await prisma.sesiAbsenKegiatan.findUnique({
      where: { kode: upperKode },
      include: {
        lokasiList: { include: { lokasi: true } },
        kategori: true
      }
    });

    if (!sesi || sesi.isClosed) {
      return NextResponse.json({ error: "Kode absensi tidak valid atau sesi sudah ditutup." }, { status: 404 });
    }

    if (new Date(sesi.ditutupPada) <= new Date()) {
      return NextResponse.json({ error: "Sesi absensi sudah kadaluarsa (waktu habis)." }, { status: 400 });
    }

    // 2. Cek apakah santri diperbolehkan absen (riwayat aktif ada)
    const santriAktif = await getActiveRiwayatListForAbsen();
    const riwayatSantri = santriAktif.find(s => s.santriId === session.santriId);
    
    if (!riwayatSantri) {
      return NextResponse.json({ error: "Tidak ditemukan riwayat aktif (dufah saat ini) untuk santri ini." }, { status: 400 });
    }

    const today = new Date(sesi.createdAt);
    today.setHours(0,0,0,0);

    // 3. Cek absen existing
    const existingAbsen = await prisma.absenKegiatan.findUnique({
      where: {
        riwayatId_kategoriId_tanggal: {
          riwayatId: riwayatSantri.riwayatId,
          kategoriId: sesi.kategoriId,
          tanggal: today
        }
      }
    });

    if (existingAbsen) {
      if (existingAbsen.status === "HADIR") {
        return NextResponse.json({ error: `Anda sudah tercatat HADIR pada absen ini.` }, { status: 400 });
      }

      // Update status if it was ALPA/IZIN/SAKIT etc.
      await prisma.absenKegiatan.update({
        where: {
          riwayatId_kategoriId_tanggal: {
            riwayatId: riwayatSantri.riwayatId,
            kategoriId: sesi.kategoriId,
            tanggal: today
          }
        },
        data: {
          status: "HADIR",
          keterangan: (existingAbsen.keterangan ? existingAbsen.keterangan + " | " : "") + "Self-Attendance (Dari " + existingAbsen.status + ")"
        }
      });

      return NextResponse.json({ success: true, message: `Berhasil mengubah status ${existingAbsen.status} menjadi HADIR untuk kegiatan ${sesi.kategori.nama}` });
    }

    // ===================================================================
    // [GEOFENCING DISABLED] — Validasi Lokasi (Haversine)
    // Dinonaktifkan sementara karena masih tahap awal. Untuk mengaktifkan
    // kembali, uncomment blok di bawah ini.
    // ===================================================================
    // let isLocationValid = false;
    // let closestDistance = Infinity;
    //
    // for (const locRel of sesi.lokasiList) {
    //   const { lokasi } = locRel;
    //   const distance = haversineDistance(latitude, longitude, lokasi.latitude, lokasi.longitude);
    //   
    //   if (distance < closestDistance) closestDistance = distance;
    //   
    //   if (distance <= lokasi.radius) {
    //     isLocationValid = true;
    //     break; // Within at least one location radius
    //   }
    // }
    //
    // if (!isLocationValid) {
    //   return NextResponse.json({ 
    //     error: "Lokasi tidak valid", 
    //     detail: `Anda terdeteksi berada ~${Math.round(closestDistance)} meter dari titik pusat yang terdekat. Mohon mendekat ke lokasi kegiatan.` 
    //   }, { status: 400 });
    // }

    // 5. Success! Insert HADIR
    await prisma.absenKegiatan.create({
      data: {
        riwayatId: riwayatSantri.riwayatId,
        kategoriId: sesi.kategoriId,
        tanggal: today,
        status: "HADIR",
        keterangan: "Self-Attendance"
      }
    });

    return NextResponse.json({ success: true, message: `Berhasil absen HADIR untuk kegiatan ${sesi.kategori.nama}` });

  } catch (error) {
    console.error('API Santri Absen error', error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
