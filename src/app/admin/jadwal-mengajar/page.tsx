import { requirePermission, checkPermission } from "@/lib/permission";
import { getSession } from "@/lib/auth";
import { Metadata } from "next";
import prisma from "@/lib/prisma";
import { JadwalMengajarClient } from "@/components/admin/jadwal-mengajar-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Jadwal Mengajar - Admin Panel",
};

export default async function JadwalMengajarPage() {
  await requirePermission("jadwal_mengajar");
  const [canEdit, session] = await Promise.all([
    checkPermission("jadwal_mengajar_edit"),
    getSession(),
  ]);
  const isSuperAdmin = session?.role === "ADMIN";

  const [
    programs,
    pengajarSesi,
    sesiTambahan,
    pengajarSesiProgram,
    jadwalSesiList,
    plottingRolesPerm,
    slotMetas,
    pengaturanJadwal,
  ] = await Promise.all([
    prisma.program.findMany({
      include: {
        kelasList: {
          orderBy: { nama: "asc" },
          select: {
            id: true,
            nama: true,
            waliKelas: { select: { id: true, nama: true } },
          },
        },
        programMapels: {
          orderBy: { urutan: "asc" },
          include: {
            mapel: { select: { id: true, nama_indo: true, nama_arab: true } },
          },
        },
      },
      orderBy: { nama_indo: "asc" },
    }),
    prisma.pengajarSesi.findMany({
      include: {
        user: { select: { id: true, nama: true, role: true } },
      },
    }),
    prisma.sesiTambahanProgram.findMany({
      where: { isActive: true },
      select: { programId: true, sesi: true, jamBuka: true, jamTutup: true },
    }),
    prisma.pengajarSesiProgram.findMany({
      include: {
        user: { select: { id: true, nama: true, role: true } },
        program: { select: { id: true, nama_indo: true } },
      },
    }),
    prisma.jadwalSesi.findMany({
      orderBy: { sesi: "asc" },
      select: { sesi: true, label: true, jamBuka: true, jamTutup: true, isActive: true },
    }),
    prisma.rolePermission.findMany({
      where: {
        permission: { in: ["absen_kelas", "manajemen_sesi", "rekap_kelas"] },
      },
      select: { role: true },
    }),
    prisma.jadwalSlotMeta
      .findMany({
        select: {
          targetKey: true,
          sesi: true,
          mapelId: true,
          keterangan: true,
        },
      })
      .catch(() => []),
    prisma.pengaturanJadwalMengajar
      .findUnique({
        where: { id: 1 },
        select: { columnOrder: true },
      })
      .catch(() => null),
  ]);

  const plottingRoles = Array.from(
    new Set(["PENGAJAR", "WALI_KELAS", ...plottingRolesPerm.map((p) => p.role)])
  );

  // Sertakan juga user yang sudah telanjur masuk jadwal agar tidak hilang dari tampilan
  const assignedUserIds = Array.from(
    new Set([
      ...pengajarSesi.map((p) => p.userId),
      ...pengajarSesiProgram.map((p) => p.userId),
    ])
  );

  const availableTeachers = await prisma.user.findMany({
    where: {
      OR: [
        { role: { in: plottingRoles }, isActive: true },
        ...(assignedUserIds.length > 0 ? [{ id: { in: assignedUserIds } }] : []),
      ],
    },
    orderBy: { nama: "asc" },
    select: { id: true, nama: true, role: true, kelasId: true },
  });

  const savedColumnOrder = Array.isArray(pengaturanJadwal?.columnOrder)
    ? (pengaturanJadwal.columnOrder as unknown[]).filter(
        (x): x is string => typeof x === "string"
      )
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-black md:text-4xl">Jadwal Mengajar</h1>
        <p className="text-sm text-[var(--color-text-muted)] max-w-3xl">
          Matriks plotting jadwal pengajar &amp; mapel ala Excel dengan deteksi bentrok otomatis, sinkronisasi wali kelas (Sesi 6), dan ringkasan beban mengajar per pengajar.
        </p>
      </div>

      <JadwalMengajarClient
        canEdit={canEdit}
        isSuperAdmin={isSuperAdmin}
        programs={programs.map((p) => ({
          id: p.id,
          nama_indo: p.nama_indo,
          kategori: p.kategori,
          kelasList: p.kelasList.map((k) => ({
            id: k.id,
            nama: k.nama,
            waliKelasId: k.waliKelas?.id ?? null,
            waliKelasNama: k.waliKelas?.nama ?? null,
          })),
          mapelList: p.programMapels.map((pm) => ({
            id: pm.mapel.id,
            nama_indo: pm.mapel.nama_indo,
            nama_arab: pm.mapel.nama_arab,
          })),
        }))}
        initialPengajarSesi={pengajarSesi.map((ps) => ({
          kelasId: ps.kelasId,
          sesi: ps.sesi,
          userId: ps.userId,
        }))}
        initialPengajarSesiProgram={pengajarSesiProgram.map((psp) => ({
          programId: psp.programId,
          sesi: psp.sesi,
          userId: psp.userId,
        }))}
        initialSlotMetas={slotMetas.map((m) => ({
          targetKey: m.targetKey,
          sesi: m.sesi,
          mapelId: m.mapelId,
          keterangan: m.keterangan,
        }))}
        initialColumnOrder={savedColumnOrder}
        jadwalSesiList={jadwalSesiList}
        sesiTambahan={sesiTambahan}
        teachers={availableTeachers}
      />
    </div>
  );
}
