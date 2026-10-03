import assert from "node:assert/strict";
import test from "node:test";
import { presentSession, receiveSession, type SessionTiming } from "./election-presentation";

const start = Date.parse("2026-10-03T12:00:00Z");
const open: SessionTiming = { id: "session", status: "BUKA", rencanaTutupAt: null, ditutupAt: null };
const iso = (time: number) => new Date(time).toISOString();

test("manual closure announces only after five seconds, without restarting on polling", () => {
  const live = receiveSession(null, open, start, 0);
  const closed = { ...open, status: "TUTUP" as const, ditutupAt: iso(start) };
  const timeline = receiveSession(live, closed, start, 0);
  for (let seconds = 0; seconds < 5; seconds++) {
    const polled = receiveSession(timeline, closed, start + seconds * 1000, 0);
    assert.equal(polled, timeline);
    assert.deepEqual(presentSession(closed, polled, start + seconds * 1000, 0), {
      mode: "countdown", seconds: 5 - seconds, manual: true, celebrate: false,
    });
  }
  assert.equal(presentSession(closed, timeline, start + 5000, 0).mode, "result");
});

test("automatic countdown starts exactly in the last five server seconds", () => {
  const timed = { ...open, rencanaTutupAt: iso(start + 10_000) };
  const timeline = receiveSession(null, timed, start, 2_000);
  assert.equal(presentSession(timed, timeline, start + 2_999, 2_000).mode, "voting");
  assert.equal(presentSession(timed, timeline, start + 3_000, 2_000).seconds, 5);
  assert.equal(presentSession(timed, timeline, start + 7_000, 2_000).seconds, 1);
  assert.equal(presentSession(timed, timeline, start + 8_000, 2_000).mode, "sealing");
  // Expiry alone is insufficient to announce a winner, even after a long outage.
  assert.equal(presentSession(timed, timeline, start + 60_000, 2_000).mode, "sealing");
});

test("automatic closure seals the box then reveals, without a second countdown", () => {
  const timed = { ...open, rencanaTutupAt: iso(start + 10_000) };
  const closed = { ...timed, status: "TUTUP" as const, ditutupAt: timed.rencanaTutupAt };
  const live = receiveSession(null, timed, start, 0);
  const timeline = receiveSession(live, closed, start + 10_100, 0);
  assert.equal(presentSession(closed, timeline, start + 10_500, 0).mode, "sealing");
  assert.equal(presentSession(closed, timeline, start + 11_800, 0).mode, "result");
});

test("early administrative closure uses announcement countdown even with a deadline", () => {
  const timed = { ...open, rencanaTutupAt: iso(start + 3_000) };
  const live = receiveSession(null, timed, start, 0);
  const closed = { ...timed, status: "TUTUP" as const, ditutupAt: iso(start) };
  const timeline = receiveSession(live, closed, start + 500, 0);
  assert.equal(presentSession(closed, timeline, start + 500, 0).seconds, 5);
  assert.equal(presentSession(closed, timeline, start + 4_500, 0).manual, true);
});

test("loading a finished session shows results without replaying a countdown or confetti", () => {
  const closed = { ...open, status: "TUTUP" as const, ditutupAt: iso(start) };
  const timeline = receiveSession(null, closed, start + 1000, 0);
  assert.deepEqual(presentSession(closed, timeline, start + 1000, 0), {
    mode: "result", seconds: null, manual: false, celebrate: false,
  });
});

test("opening ceremony runs once, and an imminent deadline takes precedence", () => {
  const draft = { ...open, status: "DRAFT" as const };
  const ready = receiveSession(null, draft, start, 0);
  assert.equal(presentSession(draft, ready, start, 0).mode, "waiting");
  const opening = receiveSession(ready, open, start, 0);
  assert.equal(presentSession(open, opening, start + 1000, 0).mode, "opening");
  assert.equal(presentSession(open, opening, start + 2800, 0).mode, "voting");
  const timed = { ...open, rencanaTutupAt: iso(start + 2_000) };
  assert.equal(presentSession(timed, opening, start + 1000, 0).mode, "countdown");
});

test("changing sessions clears the prior ceremony and prolonged polling ends celebration", () => {
  const live = receiveSession(null, open, start, 0);
  const closed = { ...open, status: "TUTUP" as const, ditutupAt: iso(start) };
  const timeline = receiveSession(live, closed, start, 0);
  assert.equal(presentSession(closed, timeline, start + 5000, 0).celebrate, true);
  assert.equal(presentSession(closed, timeline, start + 10_000, 0).celebrate, false);
  const next = { ...open, id: "another-session" };
  assert.equal(presentSession(next, receiveSession(timeline, next, start + 6000, 0), start + 6000, 0).mode, "voting");
});
