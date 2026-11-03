import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import { cloudinary } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

// POST multipart { file, programKey } — upload background template MC
// ke Cloudinary. Background ini HANYA untuk template MC (akbarnas-mc),
// tidak menyentuh background syahadah biasa maupun template lain.
export async function POST(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("data_syahadah");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file") as File | null;
  const programKey = (form.get("programKey") as string) || "akbarnas-mc";

  if (!file) return NextResponse.json({ error: "file wajib diisi" }, { status: 400 });
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
