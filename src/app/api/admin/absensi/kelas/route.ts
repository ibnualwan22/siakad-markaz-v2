import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parseWibDateString, getActiveRiwayatListForAbsen, getTodayWibString } from "@/lib/absensi";
import { getSession } from "@/lib/auth";
import { notifyEmaliyahAbsenChanged } from "@/lib/emaliyah-webhook";
import { resolveSesiWindowServer, menitWibSekarang, formatMenit } from "@/lib/sesi-window";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tanggal = searchParams.get("tanggal");
  const sesi = searchParams.get("sesi");
  const kelasId = searchParams.get("kelasId") || "ALL";

  if (!tanggal || !sesi) {
    return NextResponse.json({ error: "Tanggal dan Sesi harus diisi" }, { status: 400 });
  }

  const parsedDate = parseWibDateString(tanggal);
  const santriList = await getActiveRiwayatListForAbsen(kelasId);
  const santriIds = santriList.map((s) => s.riwayatId);

  const existingAbsen = await prisma.absenKelas.findMany({
    where: {
      tanggal: parsedDate,
      sesi: sesi as any,
      riwayatId: { in: santriIds },
    },
  });

  const userSession = (await getSession()) as any;
  let absenPengajarData = null;
  if (userSession && userSession.role !== "ADMIN") {
     let actualKelasId = kelasId;
     if (actualKelasId && actualKelasId.startsWith("PROGRAM_")) {
        const programId = actualKelasId.replace("PROGRAM_", "");
        const firstClass = await prisma.kelas.findFirst({ where: { programId } });
        if (firstClass) actualKelasId = firstClass.id;
     }

     const whereCondition: any = {
       userId: userSession.userId,
       tanggal: parsedDate,
       sesi: sesi as any
     };

     if (actualKelasId && actualKelasId !== "ALL" && actualKelasId !== "UNASSIGNED") {
        whereCondition.kelasId = actualKelasId;
     }

     absenPengajarData = await prisma.absenPengajar.findFirst({
       where: whereCondition
     });
  }

  const today = new Date();
  today.setHours(0,0,0,0);
  
  const unconfirmedIzin = await prisma.perizinan.findMany({
    where: {
      riwayatId: { in: santriIds },
      statusIzin: "AKTIF",
      tipeIzin: { not: "HARIAN" },
      OR: [
        { tanggalSelesai: { lt: today } },
        { tipeIzin: "KELUAR_PARE", tanggalMulai: { lt: today } }
      ]
    }
  });

  const unconfirmedIds = unconfirmedIzin.map((u: any) => u.riwayatId);

  const hariLibur = await prisma.hariLibur.findUnique({ where: { tanggal: parsedDate } });

  return NextResponse.json({
    santriList,
    absenData: existingAbsen,
    absenPengajarData,
    unconfirmedIds,
    hariLibur,
  });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { tanggal, sesi, kelasId, absenList, absenPengajar } = payload as any;

    if (!tanggal || !sesi || !absenList || !Array.isArray(absenList)) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }

    const parsedDate = parseWibDateString(tanggal);
    const userSession = (await getSession()) as any;

    // GUARD: Jika frontend mengirim data absenPengajar tapi session null/expired,
    // kembalikan 401 agar frontend bisa mengarahkan ke login (mencegah silent failure)
    if (absenPengajar && !userSession) {
      return NextResponse.json(
        { error: "Sesi login telah berakhir. Silakan login ulang untuk menyimpan data pengajar." },
        { status: 401 }
      );
    }

    // === Fase 2: validasi jendela waktu simpan ===
    // Pemanggil tanpa sesi login tidak boleh menulis apa pun.
    if (!userSession) {
      return NextResponse.json(
        { error: "Sesi login telah berakhir. Silakan login ulang." },
        { status: 401 }
      );
    }
    // simpanSusulan=true bila simpan non-admin lolos lewat jatah susulan (2d).
    let simpanSusulan = false;
    // Izin koreksi khusus (absen_kelas_koreksi): pemegangnya boleh menyimpan
    // susulan/koreksi di luar hari ini & di luar jendela sesi, seperti ADMIN.
    // Dibaca segar dari RolePermission tiap request — tanpa login ulang.
    let punyaIzinKoreksi = false;
    if (userSession.role !== "ADMIN") {
      const row = await prisma.rolePermission.findUnique({
        where: { role_permission: { role: userSession.role as any, permission: "absen_kelas_koreksi" } },
      });
      punyaIzinKoreksi = !!row;
    }
    if (userSession.role !== "ADMIN" && !punyaIzinKoreksi) {
      // ADMIN & pemegang absen_kelas_koreksi dikecualikan: susulan & koreksi
      // manual adalah alur resmi.
      if (tanggal !== getTodayWibString()) {
        return NextResponse.json(
          { error: "Absensi hanya dapat disimpan untuk tanggal hari ini." },
          { status: 403 }
        );
      }
      // Resolusi program dari kelasId payload (untuk override sesi program)
      let programIdValidasi: string | null = null;
      if (kelasId && kelasId.startsWith("PROGRAM_")) {
        programIdValidasi = kelasId.replace("PROGRAM_", "");
      } else if (kelasId && kelasId !== "ALL" && kelasId !== "UNASSIGNED") {
        const kls = await prisma.kelas.findUnique({ where: { id: kelasId }, select: { programId: true } });
        programIdValidasi = kls?.programId ?? null;
      }
      const jendela = await resolveSesiWindowServer(sesi, programIdValidasi, parsedDate);
      if (jendela) {
        const kini = menitWibSekarang();
        const akhirJendela = jendela.tutupMenit + jendela.toleransiMenit;
        if (kini < jendela.bukaMenit || kini > akhirJendela) {
          // Jatah simpan susulan: khusus payload bertanda susulan (jalur
          // pemulihan draf Fase 1), paling lambat 60 menit setelah jendela
          // berakhir, tetap di hari yang sama.
          if (payload.susulan === true && kini > akhirJendela && kini <= akhirJendela + 60) {
            simpanSusulan = true;
          } else {
            return NextResponse.json(
              { error: `Di luar jendela sesi. Simpan absen ${(sesi as string).replace("_", " ")} hanya dapat dilakukan pukul ${formatMenit(jendela.bukaMenit)}\u2013${formatMenit(akhirJendela)}.` },
              { status: 403 }
            );
          }
        }
      }
      // Jendela tidak ter-resolve (sesi tak terkonfigurasi) -> simpan diizinkan:
      // validasi tidak boleh memblokir sesi yang memang tidak punya konfigurasi.
    }

    // --- AUTO-JIT IZIN LOGIC ---
    const santriIds = absenList.map((a: any) => a.riwayatId);
    const dateZero = new Date(parsedDate);
    dateZero.setHours(0,0,0,0);
    
    const activeIzinRecords = await prisma.perizinan.findMany({
      where: {
        riwayatId: { in: santriIds },
        statusIzin: "AKTIF",
        OR: [
          { tipeIzin: "HARIAN", tanggalMulai: dateZero },
          { tipeIzin: { notIn: ["HARIAN", "KELUAR_PARE"] }, tanggalMulai: { lte: dateZero }, tanggalSelesai: { gte: dateZero } },
          { tipeIzin: "KELUAR_PARE", tanggalMulai: { lte: dateZero } }
        ]
      },
      select: { riwayatId: true, statusAbsen: true, nomorTasrih: true }
    });

    const izinMap = new Map<string, any>();
    for (const i of activeIzinRecords) {
      izinMap.set(i.riwayatId, { status: i.statusAbsen || "IZIN", tasrih: i.nomorTasrih });
    }

    const hariLibur = await prisma.hariLibur.findUnique({ where: { tanggal: dateZero } });

    const modifiedAbsenList = absenList.map((absen: any) => {
      // Jika sesi ini libur, maka inputannya dibaikkan (KOSONG), bahkan di frontend sudah di block
      if (hariLibur) {
        const sesiIsLibur = hariLibur.isSemuaSesi || hariLibur.sesiLibur.includes(sesi);
        if (sesiIsLibur) return { ...absen, status: "KOSONG" };
      }

      if (absen.status === "KOSONG") return absen; // Langsung pass jika admin eksplisit minta KOSONG

      const activeIzin = izinMap.get(absen.riwayatId);
      // Jika disubmit sebagai ALPHA/kosong, tapi dia punya Izin aktif, otomatis inject IZIN
      if ((absen.status === "ALPHA" || !absen.status) && activeIzin) {
        return {
          ...absen,
          status: activeIzin.status,
          keterangan: (absen.keterangan ? absen.keterangan + " | " : "") + `Auto ${activeIzin.status} [${activeIzin.tasrih}]`
        };
      }
      return absen;
    });
    // ---------------------------

    // === Fase 3: muat keadaan server terkini untuk sesi ini ===
    // Dipakai cek basis (kunci optimistis) & jejak audit penimpaan.
    const basisMarks: any = (payload as any).basisMarks;
    const idUntukDimuat = new Set<string>(modifiedAbsenList.map((a: any) => a.riwayatId));
    if (basisMarks && typeof basisMarks === "object") {
      Object.keys(basisMarks).forEach((k) => idUntukDimuat.add(k));
    }
    const barisKini = idUntukDimuat.size > 0
      ? await prisma.absenKelas.findMany({
          where: { tanggal: parsedDate, sesi: sesi as any, riwayatId: { in: Array.from(idUntukDimuat) } },
          select: { riwayatId: true, status: true, keterangan: true },
        })
      : [];
    const marksKini = new Map<string, { status: string; keterangan: string }>();
    barisKini.forEach((b) => marksKini.set(b.riwayatId, { status: b.status, keterangan: b.keterangan || "" }));
    const normMark = (m: any) => ({ status: m?.status || "", keterangan: m?.keterangan || "" });
    const markBeda = (a: any, b: any) => {
      const x = normMark(a), y = normMark(b);
      return x.status !== y.status || x.keterangan !== y.keterangan;
    };

    // === Fase 3: kunci optimistis berbasis basis (non-admin, bila klien mengirim basis) ===
    // Bila data server sudah berubah dari basis yang dilihat pengirim, tolak 409:
    // pengirim wajib memuat ulang data terbaru sebelum menyimpan.
    if (userSession.role !== "ADMIN" && basisMarks && typeof basisMarks === "object") {
      const semuaId = new Set<string>([...Object.keys(basisMarks), ...marksKini.keys()]);
      let jumlahBerubah = 0;
      semuaId.forEach((rid) => {
        const basis = basisMarks[rid];
        const kini = marksKini.get(rid);
        if (basis === undefined && kini !== undefined) jumlahBerubah++;
        else if (basis !== undefined && kini === undefined) jumlahBerubah++;
        else if (basis !== undefined && kini !== undefined && markBeda(basis, kini)) jumlahBerubah++;
      });
      if (jumlahBerubah > 0) {
        return NextResponse.json(
          {
            error: `Data sesi ini telah diperbarui dari tempat lain (${jumlahBerubah} santri berubah). Muat ulang untuk melihat data terbaru sebelum menyimpan.`,
            konflik: true,
            jumlahBerubah,
          },
          { status: 409 }
        );
      }
    }

    const toUpsert = modifiedAbsenList.filter((a: any) => a.status !== "KOSONG");
    const toDelete = modifiedAbsenList.filter((a: any) => a.status === "KOSONG");

    const operations: any[] = toUpsert.map((absen: any) =>
      prisma.absenKelas.upsert({
        where: {
          riwayatId_tanggal_sesi: {
            riwayatId: absen.riwayatId,
            tanggal: parsedDate,
            sesi: sesi,
          },
        },
        update: {
          status: absen.status,
          keterangan: absen.keterangan || null,
        },
        create: {
          riwayatId: absen.riwayatId,
          tanggal: parsedDate,
          sesi: sesi,
          status: absen.status,
          keterangan: absen.keterangan || null,
        },
      })
    );

    if (toDelete.length > 0) {
      operations.push(
        prisma.absenKelas.deleteMany({
          where: {
            tanggal: parsedDate,
            sesi: sesi,
            riwayatId: { in: toDelete.map((d: any) => d.riwayatId) }
          }
        })
      );
    }

    // === Fase 3: jejak audit — catat setiap penimpaan baris yang sudah ada ===
    {
      const logData: any[] = [];
      modifiedAbsenList.forEach((a: any) => {
        const lama = marksKini.get(a.riwayatId);
        if (!lama) return; // baris baru bukan penimpaan
        if (a.status === "KOSONG") {
          logData.push({
            tanggal: parsedDate, sesi: sesi as any, kelasId: kelasId || null, riwayatId: a.riwayatId,
            penulisUserId: userSession.userId, targetUserId: null, jenis: "SANTRI", field: "status",
            nilaiLama: lama.status, nilaiBaru: "DIHAPUS",
          });
          return;
        }
        if (lama.status !== a.status) {
          logData.push({
            tanggal: parsedDate, sesi: sesi as any, kelasId: kelasId || null, riwayatId: a.riwayatId,
            penulisUserId: userSession.userId, targetUserId: null, jenis: "SANTRI", field: "status",
            nilaiLama: lama.status, nilaiBaru: a.status,
          });
        }
        if (lama.keterangan !== (a.keterangan || "")) {
          logData.push({
            tanggal: parsedDate, sesi: sesi as any, kelasId: kelasId || null, riwayatId: a.riwayatId,
            penulisUserId: userSession.userId, targetUserId: null, jenis: "SANTRI", field: "keterangan",
            nilaiLama: lama.keterangan || null, nilaiBaru: a.keterangan || null,
          });
        }
      });
      if (logData.length > 0) {
        operations.push(prisma.absenKelasLog.createMany({ data: logData }));
      }
    }

    const isTeacherSubmit = userSession && userSession.role !== "ADMIN";
    const isAdminBackupSubmit = userSession && userSession.role === "ADMIN" && payload.targetUserId;

    if ((isTeacherSubmit || isAdminBackupSubmit) && absenPengajar) {
      const targetUserId = isTeacherSubmit ? userSession.userId : payload.targetUserId;
      let actualKelasId = kelasId;

      // Jika kelasId tidak valid (ALL, UNASSIGNED, atau kosong), cari kelasId yang valid
      // berdasarkan assignment pengajar target di sesi yang sedang diabsen
      if (!actualKelasId || actualKelasId === "ALL" || actualKelasId === "UNASSIGNED") {
        // Cari dari PengajarSesiProgram dulu (sesi 7+)
        const psp = await prisma.pengajarSesiProgram.findFirst({
          where: { userId: targetUserId, sesi: sesi as any },
          include: { program: { include: { kelasList: { select: { id: true }, take: 1 } } } }
        });
        if (psp && psp.program.kelasList.length > 0) {
          actualKelasId = psp.program.kelasList[0].id;
        } else {
          // Fallback: cari dari PengajarSesi biasa
          const ps = await prisma.pengajarSesi.findFirst({
            where: { userId: targetUserId, sesi: sesi as any }
          });
          if (ps) actualKelasId = ps.kelasId;
        }
      }

      // Konversi PROGRAM_xxx ke kelas pertama program tersebut
      if (actualKelasId && actualKelasId.startsWith("PROGRAM_")) {
        const programId = actualKelasId.replace("PROGRAM_", "");
        const firstClass = await prisma.kelas.findFirst({
          where: { programId: programId }
        });
        if (firstClass) {
          actualKelasId = firstClass.id;
        } else {
          return NextResponse.json({ error: "Program tidak memiliki kelas satupun" }, { status: 400 });
        }
      }

      // Jika masih tidak ada kelasId yang valid, skip tanpa error
      if (!actualKelasId) {
        await prisma.$transaction(operations);
        return NextResponse.json({ success: true, count: operations.length, note: "Absen santri tersimpan, absen pengajar dilewati (tidak ada kelas yang terdeteksi)" });
      }

      // === Fase 3: cek basis & audit untuk baris absenPengajar ===
      const barisPengajarKini = await prisma.absenPengajar.findUnique({
        where: {
          userId_tanggal_sesi_kelasId: {
            userId: targetUserId,
            tanggal: parsedDate,
            sesi: sesi,
            kelasId: actualKelasId,
          }
        }
      });
      const basisPengajar: any = (payload as any).basisPengajar;
      const bentukPengajar = (r: any) => r ? {
        materi: r.materi || "",
        waktuMulai: r.waktuMulai || "",
        waktuSelesai: r.waktuSelesai || "",
        atributKopiah: !!r.atributKopiah,
        atributNametag: !!r.atributNametag,
        atributBros: !!r.atributBros,
        kecerdasan: r.kecerdasan || null,
      } : null;
      if (userSession.role !== "ADMIN" && basisPengajar !== undefined) {
        const basisB = bentukPengajar(basisPengajar);
        const kiniB = bentukPengajar(barisPengajarKini);
        let konflikPengajar = false;
        if (basisB === null && kiniB !== null) konflikPengajar = true;
        else if (basisB !== null && kiniB !== null) {
          konflikPengajar = ["materi", "waktuMulai", "waktuSelesai", "atributKopiah", "atributNametag", "atributBros", "kecerdasan"]
            .some((f) => (basisB as any)[f] !== (kiniB as any)[f]);
        }
        if (konflikPengajar) {
          return NextResponse.json(
            {
              error: "Data pengajar sesi ini telah diperbarui dari tempat lain. Muat ulang untuk melihat data terbaru sebelum menyimpan.",
              konflik: true,
              jumlahBerubah: 0,
              konflikPengajar: true,
            },
            { status: 409 }
          );
        }
      }
      if (barisPengajarKini) {
        const lamaB = bentukPengajar(barisPengajarKini)!;
        const baruB = bentukPengajar({
          materi: absenPengajar.materi,
          waktuMulai: absenPengajar.waktuMulai,
          waktuSelesai: absenPengajar.waktuSelesai,
          atributKopiah: absenPengajar.atributKopiah,
          atributNametag: absenPengajar.atributNametag,
          atributBros: absenPengajar.atributBros,
          kecerdasan: absenPengajar.kecerdasan || null,
        })!;
        const logPengajar: any[] = [];
        ["materi", "waktuMulai", "waktuSelesai", "atributKopiah", "atributNametag", "atributBros", "kecerdasan"].forEach((f) => {
          if ((lamaB as any)[f] !== (baruB as any)[f]) {
            logPengajar.push({
              tanggal: parsedDate, sesi: sesi as any, kelasId: actualKelasId, riwayatId: null,
              penulisUserId: userSession.userId, targetUserId, jenis: "PENGAJAR", field: f,
              nilaiLama: (lamaB as any)[f] === null ? null : String((lamaB as any)[f]),
              nilaiBaru: (baruB as any)[f] === null ? null : String((baruB as any)[f]),
            });
          }
        });
        if (logPengajar.length > 0) {
          operations.push(prisma.absenKelasLog.createMany({ data: logPengajar }));
        }
      }

      // === Hitung terlambatMenit server-side ===
      let terlambatMenit: number | null = null;
      if (!absenPengajar.isBadal && !absenPengajar.isAsisten && absenPengajar.waktuMulai && absenPengajar.waktuMulai !== "-") {
        let jadwalBuka: string | null = null;
        let graceMenit = 5;

        // Prioritas 1: Hari taqwim -> pakai jam & toleransi taqwim global.
        // (Bug sebelumnya: taqwim dibandingkan dengan jam sesi biasa sehingga wali kelas
        //  selalu tercatat telat saat mengisi di jam taqwim.)
        const taqwimConfig = await prisma.sesiTaqwim.findFirst({ where: { isActive: true } });
        if (taqwimConfig && (sesi as string) === "SESI_1") {
          const taqwimDate = await prisma.tanggalTaqwim.findFirst({ where: { tanggal: parsedDate } });
          if (taqwimDate) {
            jadwalBuka = taqwimConfig.jamBuka;
            graceMenit = taqwimConfig.toleransiMenit ?? 15;
          }
        }

        // Prioritas 2: Resolve jadwal buka dari JadwalSesi / SesiTambahanProgram
        if (!jadwalBuka) {
          const jadwalSesi = await prisma.jadwalSesi.findUnique({ where: { sesi: sesi as any } });
          jadwalBuka = jadwalSesi?.jamBuka ?? null;

          // Fallback: SesiTambahanProgram
          if (!jadwalBuka && actualKelasId) {
            const kelas = await prisma.kelas.findUnique({ where: { id: actualKelasId }, select: { programId: true } });
            if (kelas?.programId) {
              const tambahan = await prisma.sesiTambahanProgram.findFirst({
                where: { programId: kelas.programId, sesi: sesi as any, isActive: true }
              });
              if (tambahan) jadwalBuka = tambahan.jamBuka;
            }
          }
        }

        if (jadwalBuka) {
          const [hM, mM] = absenPengajar.waktuMulai.split(":").map(Number);
          const [hB, mB] = jadwalBuka.split(":").map(Number);
          const diff = (hM * 60 + mM) - (hB * 60 + mB);
          if (diff > graceMenit) terlambatMenit = diff - graceMenit;
        }
      }

      operations.push(
        prisma.absenPengajar.upsert({
          where: {
            userId_tanggal_sesi_kelasId: {
              userId: targetUserId,
              tanggal: parsedDate,
              sesi: sesi,
              kelasId: actualKelasId,
            }
          },
          update: {
            waktuMulai: absenPengajar.waktuMulai,
            waktuSelesai: absenPengajar.waktuSelesai,
            materi: absenPengajar.materi,
            terlambatMenit,
            atributNametag: absenPengajar.atributNametag,
            atributKopiah: absenPengajar.atributKopiah,
            atributBros: absenPengajar.atributBros,
            kecerdasan: absenPengajar.kecerdasan || null,
            isBadal: absenPengajar.isBadal ?? false,
            isAsisten: absenPengajar.isAsisten ?? false,
            pengajarDigantikanId: absenPengajar.pengajarDigantikanId || null,
            disimpanSusulan: simpanSusulan,
          },
          create: {
            userId: targetUserId,
            kelasId: actualKelasId,
            tanggal: parsedDate,
            sesi: sesi,
            waktuMulai: absenPengajar.waktuMulai,
            waktuSelesai: absenPengajar.waktuSelesai,
            materi: absenPengajar.materi,
            terlambatMenit,
            atributNametag: absenPengajar.atributNametag,
            atributKopiah: absenPengajar.atributKopiah,
            atributBros: absenPengajar.atributBros,
            kecerdasan: absenPengajar.kecerdasan || null,
            isBadal: absenPengajar.isBadal ?? false,
            isAsisten: absenPengajar.isAsisten ?? false,
            pengajarDigantikanId: absenPengajar.pengajarDigantikanId || null,
            disimpanSusulan: simpanSusulan,
          }
        })
      );
    }

    await prisma.$transaction(operations);

    // Beri tahu E-Maliyah: KBM tanggal ini berubah (payroll otomatis).
    await notifyEmaliyahAbsenChanged(tanggal);

    return NextResponse.json({ success: true, count: operations.length });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Gagal menyimpan absensi" }, { status: 500 });
  }
}
