import { syncStatusKelulusanByProgramIds } from "@/lib/app-data";
import { formatDateIndo, translateDateToArabic } from "@/lib/formatters";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export async function PUT(request: Request) {
  try {
    const payload = (await request.json()) as {
      tanggalCetak?: string;
      tanggalMulai?: string;
      tanggalSelesai?: string;
      kelas?: Array<{ id: string; kkm: number }>;
      template?: {
        nama_mudir_indo?: string;
        nama_mudir_arab?: string;
        jabatan_mudir_indo?: string;
        jabatan_mudir_arab?: string;
        teks_dufah_akbarnas_arab?: string;
        teks_dufah_arab?: string;
        nama_mudir_turats?: string;
        nama_mudir_turats_arab?: string;
        jabatan_mudir_turats?: string;
        nama_mudir_hufadz_indo?: string;
        nama_mudir_hufadz_arab?: string;
        ttd_mudir_arabiyah_url?: string | null;
        ttd_mudir_turats_url?: string | null;
        ttd_mudir_hufadz_url?: string | null;
      };
    };

    if (!payload.tanggalCetak) {
      return NextResponse.json({ error: "Tanggal cetak wajib diisi." }, { status: 400 });
    }

    const { tanggalCetak, tanggalMulai, tanggalSelesai } = payload;
    const kelasUpdates = payload.kelas ?? [];
    const invalidKkm = kelasUpdates.find(
      (kelas) => !Number.isInteger(kelas.kkm) || kelas.kkm < 0 || kelas.kkm > 100,
    );

    if (invalidKkm) {
      return NextResponse.json({ error: "KKM harus berupa bilangan bulat 0-100." }, { status: 400 });
    }

    await prisma.$transaction(async (transaction) => {
      for (const program of kelasUpdates) {
        await transaction.program.update({
          where: { id: program.id },
          data: { kkm: program.kkm },
        });
      }

      const existingTemplate = await transaction.syahadahTemplate.findFirst({ orderBy: { id: "asc" } });
      const templateData = {
        tgl_cetak_indo: formatDateIndo(tanggalCetak),
        tgl_cetak_arab: translateDateToArabic(tanggalCetak),
        tgl_mulai_indo: tanggalMulai ? formatDateIndo(tanggalMulai) : null,
        tgl_mulai_arab: tanggalMulai ? translateDateToArabic(tanggalMulai) : null,
        tgl_selesai_indo: tanggalSelesai ? formatDateIndo(tanggalSelesai) : null,
        tgl_selesai_arab: tanggalSelesai ? translateDateToArabic(tanggalSelesai) : null,
        nama_mudir_indo: payload.template?.nama_mudir_indo?.trim() || "Nama Mudir",
        nama_mudir_arab: payload.template?.nama_mudir_arab?.trim() || "اسم المدير",
        jabatan_mudir_indo: payload.template?.jabatan_mudir_indo?.trim() || "Mudir Markaz Arabiyah",
        jabatan_mudir_arab: payload.template?.jabatan_mudir_arab?.trim() || "مدير مركز العربية",
        teks_dufah_akbarnas_arab: payload.template?.teks_dufah_akbarnas_arab?.trim() || null,
        teks_dufah_arab: payload.template?.teks_dufah_arab?.trim() || null,
        nama_mudir_turats: payload.template?.nama_mudir_turats?.trim() || null,
        nama_mudir_turats_arab: payload.template?.nama_mudir_turats_arab?.trim() || null,
        jabatan_mudir_turats: payload.template?.jabatan_mudir_turats?.trim() || null,
        nama_mudir_hufadz_indo: payload.template?.nama_mudir_hufadz_indo?.trim() || null,
        nama_mudir_hufadz_arab: payload.template?.nama_mudir_hufadz_arab?.trim() || null,
        ttd_mudir_arabiyah_url: payload.template?.ttd_mudir_arabiyah_url?.trim() || null,
        ttd_mudir_turats_url: payload.template?.ttd_mudir_turats_url?.trim() || null,
        ttd_mudir_hufadz_url: payload.template?.ttd_mudir_hufadz_url?.trim() || null,
      };

      if (existingTemplate) {
        await transaction.syahadahTemplate.update({
          where: { id: existingTemplate.id },
          data: templateData,
        });
      } else {
        await transaction.syahadahTemplate.create({
          data: templateData,
        });
      }
    });

    await syncStatusKelulusanByProgramIds(kelasUpdates.map((program) => program.id));

    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/master-data");
    revalidatePath("/admin/syahadah");
    revalidatePath("/admin/syahadah-offline");
    revalidatePath("/admin/munaqosah-hufadz");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Gagal memperbarui master data." }, { status: 500 });
  }
}
