import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { EMPTY_SCENE, parseScene, validateSceneReferences } from "@/lib/denah-scene";
import { markazArea, readStoredScene, sceneAdmin, sceneAssets, sceneFailure } from "@/lib/denah-scene-server";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const auth = await sceneAdmin(request); if (auth.error) return auth.error;
  try {
    const [row, assets] = await Promise.all([prisma.denahScene3D.findUnique({ where: { id: "markaz" } }), sceneAssets()]);
    return NextResponse.json({ scene: readStoredScene(row?.draft), revision: row?.revision ?? 0, publishedAt: row?.publishedAt ?? null, canRestore: Boolean(row?.previousPublished), assets });
  } catch (error) { return sceneFailure(error); }
}

export async function PUT(request: Request) {
  const auth = await sceneAdmin(request, true); if (auth.error) return auth.error;
  let input: { scene?: unknown; revision?: unknown; action?: unknown };
  try {
    const body = await request.text();
    if (body.length > 300000) throw new Error("Data kawasan terlalu besar.");
    input = JSON.parse(body);
    if (!input || !Number.isInteger(input.revision) || Number(input.revision) < 0 || !["save", "publish", "restore"].includes(String(input.action))) throw new Error("Permintaan editor tidak valid.");
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Data tidak valid." }, { status: 400 }); }
  try {
    const assets = await sceneAssets();
    const row = await prisma.denahScene3D.findUnique({ where: { id: "markaz" } });
    if ((row?.revision ?? 0) !== input.revision) return NextResponse.json({ error: "Draf telah diubah admin lain. Muat ulang sebelum menyimpan agar perubahan tidak tertimpa." }, { status: 409 });
    let scene;
    try {
      if (input.action === "restore" && !row?.previousPublished) throw new Error("Belum ada versi sebelumnya.");
      scene = parseScene(input.action === "restore" ? row!.previousPublished : input.scene);
      validateSceneReferences(scene, markazArea, assets, input.action !== "save");
    } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Kawasan tidak valid." }, { status: 400 }); }
    const json = scene as unknown as Prisma.InputJsonValue;
    const published = input.action !== "save";
    const data = { draft: json, updatedBy: auth.session!.userId, ...(published ? { published: json, previousPublished: row?.published ?? EMPTY_SCENE as unknown as Prisma.InputJsonValue, publishedAt: new Date() } : {}) };
    // Compare-and-swap also guards the race between reading the row and writing it.
    if (row) {
      const result = await prisma.denahScene3D.updateMany({ where: { id: "markaz", revision: Number(input.revision) }, data: { ...data, revision: { increment: 1 } } });
      if (!result.count) return NextResponse.json({ error: "Draf berubah saat disimpan. Muat ulang untuk mendapatkan versi terbaru." }, { status: 409 });
    } else {
      try { await prisma.denahScene3D.create({ data: { id: "markaz", ...data, revision: 1 } }); }
      catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "Draf sudah dibuat admin lain. Muat ulang dahulu." }, { status: 409 }); throw error; }
    }
    return NextResponse.json({ scene, revision: Number(input.revision) + 1, publishedAt: published ? data.publishedAt : row?.publishedAt ?? null, canRestore: published || Boolean(row?.previousPublished) });
  } catch (error) { return sceneFailure(error); }
}
