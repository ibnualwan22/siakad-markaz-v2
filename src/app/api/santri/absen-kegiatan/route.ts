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

    const { kode, latitude, longitude, accuracy } = await request.json();

    if (!kode) {
      return NextResponse.json({ error: "Kode akses wajib diisi" }, { status: 400 });
    }

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json({ error: "Lokasi GPS wajib diisi. Harap pastikan GPS aktif." }, { status: 400 });
    }

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

    // 3. Validasi Lokasi (selalu cek GPS dulu sebelum apapun)
    let isLocationValid = false;
    let closestDistance = Infinity;
    let closestLokasiNama = "";

    // DEBUG: Log semua data untuk diagnosis
    console.log(`[GEOFENCE] Santri ${session.santriId} | Sesi: ${sesi.kode} | Koordinat santri: (${latitude}, ${longitude}) accuracy: ${accuracy}m`);
    console.log(`[GEOFENCE] Jumlah lokasi terkait sesi: ${sesi.lokasiList.length}`);

    if (sesi.lokasiList.length === 0) {
      console.warn(`[GEOFENCE] ⚠️ SESI ${sesi.kode} TIDAK PUNYA LOKASI! Geofencing ter-bypass.`);
      // Jika sesi tidak punya lokasi (admin lupa assign), tetap izinkan absen
      // Tapi catat sebagai warning
    }

    for (const locRel of sesi.lokasiList) {
      const { lokasi } = locRel;
      const distance = haversineDistance(latitude, longitude, lokasi.latitude, lokasi.longitude);
      
      console.log(`[GEOFENCE]   → Lokasi "${lokasi.nama}" (${lokasi.latitude}, ${lokasi.longitude}) radius: ${lokasi.radius}m | Jarak: ${Math.round(distance)}m | ${distance <= lokasi.radius ? '✅ DALAM RADIUS' : '❌ DI LUAR'}`);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestLokasiNama = lokasi.nama;
      }
      
      if (distance <= lokasi.radius) {
        isLocationValid = true;
        break;
      }
    }

    // Jika ada lokasi tapi santri di luar semua radius
    if (!isLocationValid && sesi.lokasiList.length > 0) {
      console.log(`[GEOFENCE] ❌ DITOLAK: Jarak terdekat ${Math.round(closestDistance)}m dari "${closestLokasiNama}"`);
      return NextResponse.json({ 
        error: "Lokasi tidak valid", 
        detail: `Anda terdeteksi berada ~${Math.round(closestDistance)} meter dari lokasi ${closestLokasiNama}. Mohon mendekat ke pusat letak kegiatan.` 
      }, { status: 400 });
    }

    console.log(`[GEOFENCE] ✅ LOLOS: ${sesi.lokasiList.length === 0 ? 'Sesi tanpa lokasi' : `Dalam radius ${closestLokasiNama}`}`);

    // 4. Cek absen existing
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
          keterangan: (existingAbsen.keterangan ? existingAbsen.keterangan + " | " : "") + "Self-Attendance (Dari " + existingAbsen.status + ")",
          latitude: latitude,
          longitude: longitude,
          gpsAccuracy: accuracy
        }
      });

      return NextResponse.json({ success: true, message: `Berhasil mengubah status ${existingAbsen.status} menjadi HADIR untuk kegiatan ${sesi.kategori.nama}` });
    }

    // 5. Success! Insert HADIR
    await prisma.absenKegiatan.create({
      data: {
        riwayatId: riwayatSantri.riwayatId,
        kategoriId: sesi.kategoriId,
        tanggal: today,
        status: "HADIR",
        keterangan: "Self-Attendance",
        latitude: latitude,
        longitude: longitude,
        gpsAccuracy: accuracy
      }
    });

    return NextResponse.json({ success: true, message: `Berhasil absen HADIR untuk kegiatan ${sesi.kategori.nama}` });

  } catch (error) {
    console.error('API Santri Absen error', error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
