import { PrismaClient } from "@prisma/client";
import { PDF_REGULASI_BLUEPRINT } from "../src/lib/regulasi-soal-usbu";

const prisma = new PrismaClient();

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function main() {
  const programs = await prisma.program.findMany({
    include: {
      programMapels: {
        include: { mapel: { select: { id: true, nama_indo: true } } },
      },
    },
  });

  let insertedOrUpdated = 0;
  const skipped: string[] = [];

  for (const entry of PDF_REGULASI_BLUEPRINT) {
    const targetProgNames = entry.programMatch.map(norm);
    const prog = programs.find((p) => targetProgNames.includes(norm(p.nama_indo)));
    if (!prog) {
      skipped.push(`Program tidak ditemukan: ${entry.programMatch.join("/")}`);
      continue;
    }

    const targetMapelNames = entry.mapelMatch.map(norm);
    const pm = prog.programMapels.find((x) =>
      targetMapelNames.includes(norm(x.mapel.nama_indo)),
    );
    if (!pm) {
      skipped.push(
        `Mapel tidak ditemukan di ${prog.nama_indo}: ${entry.mapelMatch.join("/")}`,
      );
      continue;
    }

    for (const q of entry.qisms) {
      await prisma.regulasiSoalUsbu.upsert({
        where: {
          programId_mapelId_bulanKe_urutanQism: {
            programId: prog.id,
            mapelId: pm.mapel.id,
            bulanKe: entry.bulanKe,
            urutanQism: q.urutanQism,
          },
        },
        update: {
          tipeSoal: q.tipeSoal,
          targetJumlah: q.targetJumlah,
          targetBobot: q.targetBobot,
          catatan: q.catatan,
          usbuBerlaku: "1,2",
        },
        create: {
          programId: prog.id,
          mapelId: pm.mapel.id,
          bulanKe: entry.bulanKe,
          urutanQism: q.urutanQism,
          tipeSoal: q.tipeSoal,
          targetJumlah: q.targetJumlah,
          targetBobot: q.targetBobot,
          catatan: q.catatan,
          usbuBerlaku: "1,2",
        },
      });
      insertedOrUpdated++;
    }
  }

  console.log(
    JSON.stringify({
      success: true,
      insertedOrUpdated,
      skipped,
    }),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
