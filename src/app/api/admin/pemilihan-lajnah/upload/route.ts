import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDE_NAME,
  api_key: process.env.CLOUDE_API_KEY,
  api_secret: process.env.CLOUDE_API_SECRET,
});

const PERMISSION = "lajnah_manage";
const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// POST /api/admin/pemilihan-lajnah/upload — upload foto paslon ke Cloudinary
// (server-side upload: browser kirim multipart/form-data, server teruskan ke Cloudinary)
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") {
    const p = await prisma.rolePermission.findUnique({
      where: { role_permission: { role: session.role, permission: PERMISSION } },
    });
    if (!p) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file || file.size === 0) {
      return NextResponse.json({ error: "File tidak ditemukan" }, { status: 400 });
    }
    const ext = ALLOWED[file.type];
    if (!ext) {
      return NextResponse.json({ error: "Hanya JPG, PNG, atau WebP" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Ukuran foto maksimal 2MB" }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const base64 = `data:${file.type};base64,${buf.toString("base64")}`;
    const result = await cloudinary.uploader.upload(base64, {
      folder: "pemilihan-lajnah",
      resource_type: "image",
      transformation: [{ quality: "auto:low", fetch_format: "auto" }],
    });
    return NextResponse.json({ url: result.secure_url });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Upload gagal" }, { status: 500 });
  }
}
