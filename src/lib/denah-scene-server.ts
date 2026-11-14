import { NextResponse } from "next/server";
import { getSession, isMaxAgeExceeded } from "./auth";
import prisma from "./prisma";
import { EMPTY_SCENE, parseScene, type SceneDocument } from "./denah-scene";
import areaData from "../../public/maps/markaz-area.json";
import { isDenahRequestSameOrigin } from "./denah-request-origin";

export const markazArea = areaData;
export async function sceneAdmin(request: Request, mutation = false) {
  const session = await getSession();
  if (!session || isMaxAgeExceeded(session)) return { error: NextResponse.json({ error: "Sesi login berakhir. Silakan masuk kembali." }, { status: 401 }) };
  if (session.role !== "ADMIN") return { error: NextResponse.json({ error: "Editor kawasan hanya tersedia untuk admin." }, { status: 403 }) };
  if (mutation) {
    if (!isDenahRequestSameOrigin(request)) return { error: NextResponse.json({ error: "Asal permintaan tidak diizinkan. Pastikan editor dibuka dari alamat utama aplikasi." }, { status: 403 }) };
  }
  return { session };
}
export async function sceneAssets(ids?: string[]) {
  return prisma.denahAsset3D.findMany({ where: ids ? { id: { in: ids } } : undefined, select: { id: true, name: true, url: true, bytes: true, vertices: true }, orderBy: { createdAt: "desc" } });
}
export function readStoredScene(value: unknown): SceneDocument { return value ? parseScene(value) : structuredClone(EMPTY_SCENE); }
export function sceneFailure(error: unknown) {
  console.error("Denah 3D:", error instanceof Error ? error.message : "Unknown failure");
  const missing = typeof error === "object" && error && "code" in error && error.code === "P2021";
  return NextResponse.json({ error: missing ? "Penyimpanan editor belum siap. Jalankan migrasi denah_editor_3d terlebih dahulu." : "Kawasan belum berhasil disimpan atau dimuat. Coba lagi." }, { status: 503 });
}
