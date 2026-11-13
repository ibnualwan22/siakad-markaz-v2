import assert from "node:assert/strict";
import { test } from "node:test";
import { getSantriScanTarget } from "../src/lib/absensi-scan";

type ScanDb = Parameters<typeof getSantriScanTarget>[0];
type Student = { id: string; nama: string | null; sakan: string | null; dufahNama: string | null; isAktif: boolean };
const active: Student = { id: "santriA", nama: "Santri Uji", sakan: "A", dufahNama: "Dufah aktif", isAktif: true };

function database(student: Student | null, hasHistory = true) {
  const queries: { model: string; args: unknown }[] = [];
  const db = {
    santriInternal: { findUnique: async (args: unknown) => { queries.push({ model: "santri", args }); return student; } },
    riwayatSantri: { findUnique: async (args: unknown) => { queries.push({ model: "riwayat", args }); return hasHistory ? { id: "active-history", kelas: { nama: "Kelas A" } } : null; } },
  } as unknown as ScanDb;
  return { db, queries };
}

test("scan uses the student's ID and exact active dufah, without list queries", async () => {
  const { db, queries } = database(active);
  assert.deepEqual(await getSantriScanTarget(db, active.id), {
    riwayatId: "active-history", nama: "Santri Uji", sakan: "A", kelasNama: "Kelas A",
  });
  assert.equal(queries.length, 2);
  assert.deepEqual((queries[0].args as { where: unknown }).where, { id: active.id });
  assert.deepEqual((queries[1].args as { where: unknown }).where, { santriId_dufahNama: { santriId: active.id, dufahNama: active.dufahNama } });
});

test("single-student lookup preserves all previous eligibility exclusions", async () => {
  const cases = [null, { ...active, isAktif: false }, { ...active, dufahNama: null },
    { ...active, dufahNama: "-" }, { ...active, dufahNama: "" }, { ...active, sakan: null }, { ...active, sakan: "-" }];
  for (const student of cases) {
    const { db, queries } = database(student);
    assert.equal(await getSantriScanTarget(db, active.id), null);
    assert.equal(queries.length, 1, "ineligible students must never proceed to attendance history");
  }
});

test("no active-dufah history is rejected; missing names retain the previous fallback", async () => {
  assert.equal(await getSantriScanTarget(database(active, false).db, active.id), null);
  assert.equal((await getSantriScanTarget(database({ ...active, nama: null }).db, active.id))?.nama, "Tanpa Nama");
});
