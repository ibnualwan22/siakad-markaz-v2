import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasAnyPermission } from "@/lib/permission";
import { cloudinary } from "@/lib/cloudinary";
import { isValidNonKelasProgramKey } from "@/lib/syahadah-non-kelas";

export const dynamic = "force-dynamic";

// POST multipart { file, programKey } — upload background F4 Landscape untuk Syahadah Non-Kelas
export async function POST(request: Request) {
  const session = await getSession();
  const hasPerm = await hasAnyPermission(
    "data_syahadah",
    "layout_syahadah",
    "nadi_hufadz",
    "lajnah_syahadah",
    "osim_syahadah",
    "tadrib_funun",
    "martabah_ula",
  );
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file") as File | null;
  const programKey = String(form.get("programKey") || "");

  if (!isValidNonKelasProgramKey(programKey)) {
    return NextResponse.json(
      { error: "programKey syahadah non-kelas tidak valid" },
      { status: 400 },
    );
  }
  if (!file) {
    return NextResponse.json({ error: "file wajib diisi" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Ukuran maksimal 10MB" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = `data:${file.type || "image/jpeg"};base64,${buffer.toString("base64")}`;

  const result = await cloudinary.uploader.upload(base64, {
    folder: `syahadah-template/${programKey}`,
    resource_type: "image",
  });

  return NextResponse.json({ url: result.secure_url, publicId: result.public_id });
}
