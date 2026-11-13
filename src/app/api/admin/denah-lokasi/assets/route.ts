import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import prisma from "@/lib/prisma";
import { ASSET_MAX_BYTES } from "@/lib/denah-scene";
import { validateGlb } from "@/lib/denah-glb";
import { sceneAdmin } from "@/lib/denah-scene-server";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const auth = await sceneAdmin(request, true); if (auth.error) return auth.error;
  if (Number(request.headers.get("content-length")) > ASSET_MAX_BYTES + 65536) return NextResponse.json({ error: "Berkas maksimal 3 MiB." }, { status: 413 });
  let file: File, buffer: Buffer, vertices: number;
  try {
    const form = await request.formData();
    const value = form.get("file");
    if (!(value instanceof File) || !/\.glb$/i.test(value.name)) throw new Error("Pilih berkas .glb.");
    file = value;
    if (file.size > ASSET_MAX_BYTES) throw new Error("Berkas maksimal 3 MiB.");
    buffer = Buffer.from(await file.arrayBuffer()); vertices = validateGlb(buffer).vertices;
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Berkas tidak valid." }, { status: 400 }); }
  if (!process.env.CLOUDE_NAME || !process.env.CLOUDE_API_KEY || !process.env.CLOUDE_API_SECRET) return NextResponse.json({ error: "Penyimpanan aset belum dikonfigurasi. Aset bawaan tetap dapat digunakan." }, { status: 503 });
  let uploaded: UploadApiResponse | null = null;
  try {
    cloudinary.config({ cloud_name: process.env.CLOUDE_NAME, api_key: process.env.CLOUDE_API_KEY, api_secret: process.env.CLOUDE_API_SECRET });
    uploaded = await new Promise<UploadApiResponse>((resolve, reject) => {
      cloudinary.uploader.upload_stream({ resource_type: "raw", public_id: `denah-models/${randomUUID()}.glb`, overwrite: false }, (error, result) => error || !result ? reject(error ?? new Error("Upload gagal")) : resolve(result)).end(buffer);
    });
    const asset = await prisma.denahAsset3D.create({ data: { name: file.name.replace(/\.glb$/i, "").slice(0, 80), url: uploaded.secure_url, publicId: uploaded.public_id, bytes: file.size, vertices, createdBy: auth.session!.userId }, select: { id: true, name: true, url: true, bytes: true, vertices: true } });
    return NextResponse.json({ asset }, { status: 201 });
  } catch {
    if (uploaded) await cloudinary.uploader.destroy(uploaded.public_id, { resource_type: "raw" }).catch(() => {});
    return NextResponse.json({ error: "Aset belum berhasil diunggah. Periksa koneksi dan konfigurasi penyimpanan, lalu coba lagi." }, { status: 503 });
  }
}
