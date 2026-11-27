import { requirePermission, checkPermission } from "@/lib/permission";
import { Suspense } from "react";
import { Metadata } from "next";
import { RekapFilterClient } from "@/components/admin/rekap-filter-client";
import { RekapPengajarClient } from "@/components/admin/rekap-pengajar-client";
import { ReminderPengajarToggle } from "@/components/admin/reminder-pengajar-toggle";
import { getSession } from "@/lib/auth";

import prisma from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Rekap Absen Pengajar - Admin Panel",
};

export const dynamic = "force-dynamic";

export default async function RekapPengajarPage() {
  await requirePermission("rekap_pengajar");
  const [hasEditPerm, hasReminderTogglePerm] = await Promise.all([
    checkPermission("rekap_pengajar_edit"),
    checkPermission("reminder_pengajar_toggle"),
  ]);
  const session = await getSession();
  const userRole = session?.role || "";

  let reminderConfig: { isActive: boolean; updatedAt: Date; updatedBy: string | null } | null = null;
  if (hasReminderTogglePerm) {
    try {
      reminderConfig = await prisma.pengaturanReminderPengajar.findUnique({
        where: { id: 1 },
        select: { isActive: true, updatedAt: true, updatedBy: true },
      });
    } catch {
      reminderConfig = null;
    }
  }

  // Ambil daftar pengajar untuk dropdown badal
  const pengajarListRaw = await prisma.user.findMany({
    where: { isActive: true, role: { not: "SANTRI" } },
    select: { id: true, nama: true },
    orderBy: { nama: "asc" }
  });
  const pengajarList = pengajarListRaw.map(p => ({ id: p.id, nama: p.nama }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 pb-2">
        <h1 className="text-3xl font-black md:text-4xl ">
          Rekap Absen Pengajar
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] max-w-2xl">
          Laporan kehadiran dan kelengkapan atribut asatidzah (pengajar) berdasarkan Usbu&apos; (Pekan).
        </p>
      </div>

      {hasReminderTogglePerm && (
        <ReminderPengajarToggle
          initialActive={reminderConfig ? reminderConfig.isActive : true}
          initialUpdatedAt={reminderConfig?.updatedAt ? reminderConfig.updatedAt.toISOString() : null}
          initialUpdatedBy={reminderConfig?.updatedBy ?? null}
        />
      )}

      <Suspense fallback={<div className="animate-pulse p-4 text-[var(--color-text-subtle)] font-medium">Memuat Filter...</div>}>
        <RekapFilterClient type="pengajar" title="Rincian Absen Pengajar" useUsbu={true} />
      </Suspense>

      <Suspense fallback={<div className="animate-pulse p-10 text-center text-[var(--color-text-subtle)] font-medium">Memuat Rincian...</div>}>
        <RekapPengajarClient userRole={userRole} pengajarList={pengajarList} hasEditPerm={hasEditPerm} />
      </Suspense>
    </div>
  );
}
