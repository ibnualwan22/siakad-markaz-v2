import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const PERMISSION = "lajnah_manage";
const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// POST /api/admin/pemilihan-lajnah/upload — upload foto paslon (disimpan di volume /uploads)
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
    const dir = path.join(process.cwd(), "public", "uploads", "pemilihan");
    await mkdir(dir, { recursive: true });
    const nama = `${randomUUID()}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, nama), buf);
    return NextResponse.json({ url: `/uploads/pemilihan/${nama}` });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Upload gagal" }, { status: 500 });
  }
}
