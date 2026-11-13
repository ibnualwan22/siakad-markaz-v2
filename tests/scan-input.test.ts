import assert from "node:assert/strict";
import { test } from "node:test";
import { consumeScannerInput, isCompleteSantriQr, ScanDeduplicator } from "../src/lib/scan-input";

const a = `SKA.santriA.${"a".repeat(32)}`;
const b = `SKA.santriB.${"b".repeat(32)}`;

test("duplicate A followed by B consumes every buffer and submits each student once", () => {
  const gate = new ScanDeduplicator();
  const accepted: string[] = [];
  let buffer = "";
  for (const scan of [a, a, b]) {
    for (const char of scan) {
      buffer += char;
      const result = consumeScannerInput(buffer);
      buffer = result.remainder;
      for (const payload of result.payloads) {
        if (gate.accept("sesi", payload, 100)) accepted.push(payload);
      }
    }
    assert.equal(buffer, "", "even an ignored duplicate must leave an empty input");
    assert.equal(consumeScannerInput(buffer, true).incomplete, false);
  }
  assert.deepEqual(accepted, [a, b]);
});

test("a pasted burst preserves all complete codes and an unfinished next code", () => {
  const result = consumeScannerInput(a + b + "SKA.next.");
  assert.deepEqual(result, { payloads: [a, b], remainder: "SKA.next.", incomplete: false });
  assert.deepEqual(consumeScannerInput(result.remainder + "f".repeat(32)), {
    payloads: [`SKA.next.${"f".repeat(32)}`], remainder: "", incomplete: false,
  });
});

test("Enter clears incomplete input instead of submitting a malformed QR", () => {
  assert.deepEqual(consumeScannerInput("SKA.partial.abc", true), { payloads: [], remainder: "", incomplete: true });
  assert.deepEqual(consumeScannerInput(a + "\r\n" + b + "\r\n", true), { payloads: [a, b], remainder: "", incomplete: false });
  assert.equal(isCompleteSantriQr(a + b), false);
  assert.equal(isCompleteSantriQr("SKA.partial.abc"), false);
  assert.equal(isCompleteSantriQr(a), true);
});

test("a broken scan before a fresh prefix does not hide the next valid QR", () => {
  assert.deepEqual(consumeScannerInput("SKA.partial.abcd" + b).payloads, [b]);
  assert.ok(consumeScannerInput("x".repeat(2000)).remainder.length <= 512);
});

test("slow pending requests never accumulate duplicate jobs", () => {
  const gate = new ScanDeduplicator();
  assert.equal(gate.accept("sesi", a, 0), true);
  assert.equal(gate.accept("sesi", a, 10_000), false);
  assert.equal(gate.accept("sesi", b, 10_000), true);
  assert.equal(gate.pendingCount, 2);
  gate.finish("sesi", a, true, 11_000);
  assert.equal(gate.accept("sesi", a, 13_999), false);
  assert.equal(gate.accept("sesi", a, 14_000), true);
});

test("uncertain results can be retried and separate sessions do not suppress each other", () => {
  const gate = new ScanDeduplicator();
  assert.equal(gate.accept("sesi", a, 100), true);
  gate.finish("sesi", a, false, 101);
  assert.equal(gate.pendingCount, 0);
  assert.equal(gate.accept("sesi", a, 102), true);
  assert.equal(gate.accept("other", a, 102), true);
});
