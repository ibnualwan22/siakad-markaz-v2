import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function isValidKey(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 1000;
}

// Simpan (atau pindahkan) langganan perangkat ini ke akun staf yang login.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const endpoint = body?.endpoint;
    const p256dh = body?.keys?.p256dh;
    const auth = body?.keys?.auth;
    if (!isValidKey(endpoint) || !isValidKey(p256dh) || !isValidKey(auth)) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId: session.userId, p256dh, auth },
      create: { userId: session.userId, endpoint, p256dh, auth },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Terjadi kesalahan sistem" },
      { status: 500 }
    );
  }
}

// Hapus langganan perangkat ini dari akun staf yang login.
export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const endpoint = body?.endpoint;
    if (!isValidKey(endpoint)) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }
    await prisma.pushSubscription.deleteMany({
      where: { endpoint, userId: session.userId },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Terjadi kesalahan sistem" },
      { status: 500 }
    );
  }
}
