import { NextResponse } from "next/server";
import { getSantriSession } from "@/lib/santri-auth";
import { getSession, isMaxAgeExceeded } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { readStoredScene, sceneAssets, sceneFailure } from "@/lib/denah-scene-server";

export const dynamic = "force-dynamic";
export async function GET() {
  const [student, staff] = await Promise.all([getSantriSession(), getSession()]);
  if (!student && (!staff || isMaxAgeExceeded(staff))) return NextResponse.json({ error: "Silakan masuk kembali." }, { status: 401 });
  try {
    const row = await prisma.denahScene3D.findUnique({ where: { id: "markaz" }, select: { published: true, publishedAt: true } });
    const scene = readStoredScene(row?.published);
    const ids = [...new Set(scene.objects.flatMap(o => o.assetId ? [o.assetId] : []))];
    return NextResponse.json({ scene, assets: ids.length ? await sceneAssets(ids) : [], publishedAt: row?.publishedAt ?? null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return sceneFailure(error); }
}
