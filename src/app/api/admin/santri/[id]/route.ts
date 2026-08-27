import { calculateStatus } from "@/lib/kelulusan";
import prisma from "@/lib/prisma";
import { getMasterSantriById } from "@/lib/santri-api";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { checkPermission } from "@/lib/permission";
import { getSession } from "@/lib/auth";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    const hasPermission = await checkPermission("input_nilai");
    if (!session || !hasPermission) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const payload = (await request.json()) as {
      kelasId?: string;
      is_tasmi?: boolean;
      jumlah_kolom_usbu?: number | null;
      nilaiList: Array<{
        mapelId: string;
        nilaiUsbu1: number | null;
        nilaiUsbu2: number | null;
        nilaiNihai: number | null;
        nilaiAkhir: number | null;
      }>;
    };

    const existingRiwayat = await prisma.riwayatSantri.findUnique({
      where: { id },
    });

    const santriId = existingRiwayat ? existingRiwayat.santriId : id;
    const masterSantri = await getMasterSantriById(santriId);

    if (!masterSantri) {
      return NextResponse.json({ error: "Santri tidak ditemukan di master API." }, { status: 404 });
    }

    const targetDufah = existingRiwayat ? existingRiwayat.dufahNama : masterSantri.dufahNama;

    if (!payload.kelasId) {
      return NextResponse.json({ error: "Ruangan kelas wajib dipilih." }, { status: 400 });
    }

    const kelas = await prisma.kelas.findUnique({
      where: { id: payload.kelasId },
    });

    if (!kelas) {
      return NextResponse.json({ error: "Ruang kelas tidak ditemukan." }, { status: 404 });
    }

    const program = await prisma.program.findUnique({
      where: { id: kelas.programId },
      include: {
        programMapels: true,
      },
    });

    if (!program) {
      return NextResponse.json({ error: "Program tidak ditemukan." }, { status: 404 });
    }

    const nilaiList = payload.nilaiList ?? [];
    const expectedMapelIds = program.programMapels.map((programMapel) => programMapel.mapelId);

    const invalidMapel = nilaiList.find(n => !expectedMapelIds.includes(n.mapelId));
    if (invalidMapel) {
      return NextResponse.json(
        { error: "Terdapat mapel yang tidak valid untuk kelas yang dipilih." },
        { status: 400 },
      );
    }

    const invalidNilai = nilaiList.find(
      (nilai) => 
        (nilai.nilaiUsbu1 !== null && (!Number.isFinite(nilai.nilaiUsbu1) || nilai.nilaiUsbu1! < 0 || nilai.nilaiUsbu1! > 100)) ||
        (nilai.nilaiUsbu2 !== null && (!Number.isFinite(nilai.nilaiUsbu2) || nilai.nilaiUsbu2! < 0 || nilai.nilaiUsbu2! > 100)) ||
        (nilai.nilaiNihai !== null && (!Number.isFinite(nilai.nilaiNihai) || nilai.nilaiNihai! < 0 || nilai.nilaiNihai! > 100))
    );

    if (invalidNilai) {
      return NextResponse.json({ error: "Nilai harus berupa bilangan 0-100." }, { status: 400 });
    }

    // Fetch TasmiConfig to auto-check is_tasmi
    const tasmiConfigs = await prisma.tasmiConfig.findMany({
      where: { programId: program.id }
    });

    let autoTasmi = payload.is_tasmi ?? false;
    if (tasmiConfigs.length > 0) {
      let allFilled = true;
      for (const config of tasmiConfigs) {
        const item = nilaiList.find(n => n.mapelId === config.mapelId);
        if (!item) {
          allFilled = false;
          break;
        }
        if (config.kolom === 'u1' && (item.nilaiUsbu1 === null)) allFilled = false;
        if (config.kolom === 'u2' && (item.nilaiUsbu2 === null)) allFilled = false;
        if (config.kolom === 'n' && (item.nilaiNihai === null)) allFilled = false;
      }
      // Strictly enforce auto check
      autoTasmi = allFilled;
    }

    const statusKelulusan = calculateStatus(
      {
        is_tasmi: autoTasmi,
      },
      nilaiList.map(n => ({ skor: n.nilaiAkhir || 0 })),
      program,
    );

    await prisma.$transaction(async (transaction) => {
      // 0. Auto-sync Dufah record 
      await transaction.dufah.upsert({
        where: { nama: targetDufah },
        update: {},
        create: { nama: targetDufah }
      });

      // Format data sebelum disimpan ke database agar lebih efisien
      const tempatLahirFormatted = masterSantri.tempatLahir?.trim() ?? "";
      const tanggalLahirFormatted = masterSantri.tanggalLahir 
        ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(masterSantri.tanggalLahir)) 
        : "";

      // 1. Upsert Profil Dasar Santri
      await transaction.santriInternal.upsert({
        where: { id: santriId },
        create: {
          id: santriId,
          nama: masterSantri.nama,
          tempat_lahir: tempatLahirFormatted,
          tanggal_lahir: tanggalLahirFormatted,
          alamat: masterSantri.alamat,
        },
        update: {
          nama: masterSantri.nama,
          tempat_lahir: tempatLahirFormatted,
          tanggal_lahir: tanggalLahirFormatted,
          alamat: masterSantri.alamat,
        },
      });

      // 2. Upsert Riwayat Akademik untuk Duf'ah ter-target
      let riwayat;
      if (existingRiwayat) {
        riwayat = await transaction.riwayatSantri.update({
          where: { id: existingRiwayat.id },
          data: {
            programId: program.id,
            kelasId: kelas.id,
            is_tasmi: autoTasmi,
            status_kelulusan: statusKelulusan,
            jumlah_kolom_usbu: payload.jumlah_kolom_usbu,
          },
        });
      } else {
        riwayat = await transaction.riwayatSantri.upsert({
          where: {
            santriId_dufahNama: {
              santriId: santriId,
              dufahNama: targetDufah,
            },
          },
          update: {
            programId: program.id,
            kelasId: kelas.id,
            is_tasmi: autoTasmi,
            status_kelulusan: statusKelulusan,
            jumlah_kolom_usbu: payload.jumlah_kolom_usbu,
          },
          create: {
            santriId: santriId,
            dufahNama: targetDufah,
            programId: program.id,
            kelasId: kelas.id,
            is_tasmi: autoTasmi,
            status_kelulusan: statusKelulusan,
            jumlah_kolom_usbu: payload.jumlah_kolom_usbu,
          },
        });
      }

      // 3. Reset dan Simpan Nilai untuk Riwayat ini
      await transaction.nilai.deleteMany({
        where: { riwayatId: riwayat.id },
      });

      for (const nilai of nilaiList) {
        await transaction.nilai.create({
          data: {
            riwayatId: riwayat.id,
            mapelId: nilai.mapelId,
            nilaiUsbu1: nilai.nilaiUsbu1,
            nilaiUsbu2: nilai.nilaiUsbu2,
            nilaiNihai: nilai.nilaiNihai,
            nilaiAkhir: nilai.nilaiAkhir,
          },
        });
      }
    });

    revalidatePath("/admin/syahadah");
    revalidatePath(`/admin/input-nilai/${id}`);
    revalidatePath(`/ijazah/${id}`);
    revalidatePath(`/cetak/${id}`);

    return NextResponse.json({ success: true, status_kelulusan: statusKelulusan });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Gagal menyimpan nilai santri." }, { status: 500 });
  }
}

