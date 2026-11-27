import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import { cloudinary } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

const ALLOWED_LEMBAGA = new Set(["ARABIYAH", "TURATS", "HUFADZ"]);

// POST multipart { file, lembaga } — upload gambar tanda tangan mudir (PNG/JPG/WebP)
// ke Cloudinary untuk masing-masing lembaga.
export async function POST(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("pengaturan_syahadah_edit");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file") as File | null;
    const lembaga = String(form.get("lembaga") || "").toUpperCase();

    if (!ALLOWED_LEMBAGA.has(lembaga)) {
      return NextResponse.json(
        { error: "lembaga harus ARABIYAH, TURATS, atau HUFADZ" },
        { status: 400 },
      );
    }
    if (!file) {
      return NextResponse.json({ error: "File gambar wajib diisi" }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Ukuran maksimal 5MB" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = `data:${file.type || "image/png"};base64,${buffer.toString("base64")}`;

    const result = await cloudinary.uploader.upload(base64, {
      folder: `syahadah-signature/${lembaga.toLowerCase()}`,
      resource_type: "image",
    });

    return NextResponse.json({ url: result.secure_url, publicId: result.public_id });
  } catch (error) {
    console.error("Gagal upload TTD mudir:", error);
    return NextResponse.json({ error: "Gagal mengupload tanda tangan mudir" }, { status: 500 });
  }
}
