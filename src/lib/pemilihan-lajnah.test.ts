import assert from "node:assert/strict";
import { test } from "node:test";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  catatSuaraPemilihan,
  parseRencanaTutup,
  PemilihanLajnahError,
  tutupPemilihanKedaluwarsa,
  tutupPemilihanLajnah,
  waktuPemilihanHabis,
} from "./pemilihan-lajnah";

type Vote = { sesiId: string; paslonId: string; santriId: string };
type Sesi = { id: string; dufahNama: string; status: string; rencanaTutupAt: Date | null; ditutupAt: Date | null };

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

// No PrismaClient is instantiated. This harness models the transaction boundary
// and exclusive row lock, so tests exercise the real service orchestration without
// touching a database. PostgreSQL's actual lock behavior needs an integration DB.
function database(options: { status?: string; deadline?: Date | null; votes?: Vote[] } = {}) {
  const state = {
    sesi: {
      id: "sesi", dufahNama: "Dufah", status: options.status ?? "BUKA",
      rencanaTutupAt: options.deadline ?? null, ditutupAt: null,
    } as Sesi,
    votes: options.votes ?? [],
    members: [] as { santriId: string; dufahNama: string }[],
    membershipWrites: 0,
    closureWrites: 0,
    locks: 0,
    active: true,
    voterDufah: "Dufah",
    beforeVote: undefined as (() => Promise<void>) | undefined,
    beforeTally: undefined as (() => Promise<void>) | undefined,
    voteError: undefined as object | undefined,
  };
  const candidates = [1, 2].map((no) => ({
    id: `p${no}`, nomorUrut: no, sesiId: "sesi", santri1Id: `rois${no}`, santri2Id: `wakil${no}`,
    santri1: { id: `rois${no}`, nama: `Rois ${no}` },
    santri2: { id: `wakil${no}`, nama: `Wakil ${no}` },
  }));
  let tail = Promise.resolve();
  const client = {
    sesiPemilihanLajnah: { findUnique: async () => structuredClone(state.sesi) },
    $transaction: async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>, transactionOptions: { isolationLevel: string }) => {
      assert.equal(transactionOptions.isolationLevel, "ReadCommitted");
      let release: (() => void) | undefined;
      let snapshot: { sesi: Sesi; votes: Vote[]; members: typeof state.members; membershipWrites: number; closureWrites: number } | undefined;
      const locked = () => assert.ok(release, "Every mutation/tally must acquire the election row lock first");
      const tx = {
        $queryRaw: async (query: TemplateStringsArray, id: string) => {
          assert.match(query.join("?"), /FROM "SesiPemilihanLajnah" WHERE "id" = \? FOR UPDATE/);
          const prior = tail;
          const next = deferred();
          tail = next.promise;
          await prior;
          release = next.resolve;
          state.locks++;
          snapshot = structuredClone({
            sesi: state.sesi, votes: state.votes, members: state.members,
            membershipWrites: state.membershipWrites, closureWrites: state.closureWrites,
          });
          return id === state.sesi.id ? [structuredClone(state.sesi)] : [];
        },
        santriInternal: {
          findUnique: async ({ where }: { where: { id: string } }) => {
            locked();
            return { id: where.id, isAktif: state.active, dufahNama: state.voterDufah };
          },
        },
        paslonLajnah: {
          findMany: async () => {
            locked();
            await state.beforeTally?.();
            return candidates.map((p) => ({ ...p, _count: { suaraList: state.votes.filter((vote) => vote.paslonId === p.id).length } }));
          },
          findFirst: async ({ where }: { where: { id: string; sesiId: string } }) => {
            locked();
            return candidates.find((p) => p.id === where.id && p.sesiId === where.sesiId) ?? null;
          },
        },
        suaraLajnah: {
          create: async ({ data }: { data: Vote }) => {
            locked();
            await state.beforeVote?.();
            if (state.voteError) throw state.voteError;
            if (state.votes.some((vote) => vote.sesiId === data.sesiId && vote.santriId === data.santriId)) throw { code: "P2002" };
            state.votes.push({ ...data });
          },
        },
        anggotaLajnah: {
          createMany: async ({ data, skipDuplicates }: { data: typeof state.members; skipDuplicates: boolean }) => {
            locked();
            assert.equal(skipDuplicates, true);
            state.members.push(...data);
            state.membershipWrites++;
          },
        },
        sesiPemilihanLajnah: {
          update: async ({ data }: { data: Pick<Sesi, "status" | "ditutupAt"> }) => {
            locked();
            Object.assign(state.sesi, data);
            state.closureWrites++;
          },
        },
      };
      try {
        return await fn(tx as unknown as Prisma.TransactionClient);
      } catch (error) {
        if (snapshot) Object.assign(state, snapshot);
        throw error;
      } finally {
        release?.();
      }
    },
  };
  return { db: client as unknown as PrismaClient, state };
}

const vote = (paslonId = "p1", santriId = "voter"): Vote => ({ sesiId: "sesi", paslonId, santriId });

test("deadline boundary is inclusive, but draft/closed sessions do not expire again", () => {
  const now = new Date("2026-10-03T12:00:00Z");
  assert.equal(waktuPemilihanHabis({ status: "BUKA", rencanaTutupAt: now }, now), true);
  assert.equal(waktuPemilihanHabis({ status: "BUKA", rencanaTutupAt: new Date(now.getTime() + 1) }, now), false);
  assert.equal(waktuPemilihanHabis({ status: "BUKA", rencanaTutupAt: null }, now), false);
  for (const status of ["DRAFT", "TUTUP"]) assert.equal(waktuPemilihanHabis({ status, rencanaTutupAt: now }, now), false);
});

test("optional deadline validation rejects invalid, non-string, current and past values", () => {
  const now = new Date("2026-10-03T12:00:00Z");
  for (const value of [undefined, null, ""]) assert.equal(parseRencanaTutup(value, now), null);
  for (const value of [42, {}, "invalid", "2026-10-03T12:00:00Z", "2026-10-02T12:00:00Z"]) {
    assert.throws(() => parseRencanaTutup(value, now), PemilihanLajnahError);
  }
  assert.equal(parseRencanaTutup("2026-10-03T20:00:00+07:00", now)?.toISOString(), "2026-10-03T13:00:00.000Z");
});

test("a late vote rejects while committing closure and memberships", async () => {
  const deadline = new Date(Date.now() - 1000);
  const { db, state } = database({ deadline, votes: [vote("p2", "earlier")] });
  const result = await catatSuaraPemilihan(db, vote());
  assert.deepEqual(result, { error: "Waktu pemilihan sudah habis", status: 400 });
  assert.equal(state.sesi.status, "TUTUP");
  assert.equal(state.sesi.ditutupAt?.getTime(), deadline.getTime());
  assert.equal(state.votes.length, 1);
  assert.deepEqual(state.members.map((member) => member.santriId), ["rois2", "wakil2"]);
});

test("concurrent automatic/manual/repeated closure is idempotent", async () => {
  const { db, state } = database({ deadline: new Date(Date.now() - 1000), votes: [vote()] });
  const [, first, second] = await Promise.all([
    tutupPemilihanKedaluwarsa(db, "sesi"), tutupPemilihanLajnah(db, "sesi"), tutupPemilihanLajnah(db, "sesi"),
  ]);
  await tutupPemilihanKedaluwarsa(db, "sesi");
  assert.deepEqual(first, second);
  assert.equal(state.membershipWrites, 1);
  assert.equal(state.closureWrites, 1);
  assert.equal(first.totalSuara, 1);
});

test("closing waits for an accepted in-flight vote and includes it in the winner", async () => {
  const entered = deferred();
  const finish = deferred();
  const { db, state } = database();
  state.beforeVote = async () => { entered.resolve(); await finish.promise; };
  const voting = catatSuaraPemilihan(db, vote("p2"));
  await entered.promise;
  const closing = tutupPemilihanLajnah(db, "sesi");
  finish.resolve();
  assert.deepEqual(await voting, { success: true });
  const result = await closing;
  assert.equal(result.pemenang?.id, "p2");
  assert.equal(result.totalSuara, 1);
  assert.equal(state.closureWrites, 1);
});

test("a vote waiting behind closing cannot change the final tally", async () => {
  const entered = deferred();
  const finish = deferred();
  const { db, state } = database({ votes: [vote("p1", "earlier")] });
  state.beforeTally = async () => { entered.resolve(); await finish.promise; };
  const closing = tutupPemilihanLajnah(db, "sesi");
  await entered.promise;
  const voting = catatSuaraPemilihan(db, vote("p2"));
  finish.resolve();
  const result = await closing;
  assert.deepEqual(await voting, { error: "Pemilihan tidak sedang dibuka", status: 400 });
  assert.equal(result.totalSuara, 1);
  assert.equal(state.votes.length, 1);
});

test("ties and zero-vote closure preserve the smaller candidate number policy", async () => {
  for (const votes of [[], [vote("p1", "a"), vote("p2", "b")]]) {
    const { db } = database({ votes });
    assert.equal((await tutupPemilihanLajnah(db, "sesi")).pemenang?.nomorUrut, 1);
  }
});

test("future/no deadline reads do not close; drafts cannot be closed", async () => {
  for (const deadline of [null, new Date(Date.now() + 60_000)]) {
    const { db, state } = database({ deadline });
    await tutupPemilihanKedaluwarsa(db, "sesi");
    assert.equal(state.sesi.status, "BUKA");
    assert.equal(state.locks, 0);
  }
  const { db } = database({ status: "DRAFT" });
  await assert.rejects(tutupPemilihanLajnah(db, "sesi"), PemilihanLajnahError);
  await assert.rejects(tutupPemilihanLajnah(db, "missing"), PemilihanLajnahError);
});

test("duplicate votes are rejected without masking unrelated database failures", async () => {
  const { db, state } = database({ votes: [vote()] });
  assert.deepEqual(await catatSuaraPemilihan(db, vote()), { error: "Kamu sudah memilih pada sesi ini", status: 409 });
  state.voteError = { code: "P2024" };
  await assert.rejects(catatSuaraPemilihan(db, vote("p2", "new")), (error) => error === state.voteError);
  assert.equal(state.votes.length, 1);
});

test("existing active-santri and same-dufah eligibility is preserved", async () => {
  const { db, state } = database();
  state.active = false;
  assert.deepEqual(await catatSuaraPemilihan(db, vote()), { error: "Hanya santri aktif yang boleh memilih", status: 403 });
  state.active = true;
  state.voterDufah = "Other";
  assert.deepEqual(await catatSuaraPemilihan(db, vote()), { error: "Kamu tidak terdaftar sebagai pemilih pada sesi ini", status: 403 });
  assert.equal(state.votes.length, 0);
});
