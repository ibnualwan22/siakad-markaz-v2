import assert from "node:assert/strict";
import { test } from "node:test";
import { buildProgramMaps, resolveProgramSiakad } from "./program-resolve";

const programs = [
  { id: "hufadz", nama_indo: "Hufadz", kategori: "HUFADZ" },
  { id: "ula1", nama_indo: "Ula 1", kategori: "TURATS" },
  { id: "ula2", nama_indo: "Ula 2", kategori: "TURATS" },
  { id: "akbarnas", nama_indo: "Akbarnas", kategori: "REGULER" },
  { id: "shifr", nama_indo: "Shifr", kategori: "REGULER" },
];

test("name match wins; unknown name falls back to a unique kategori", () => {
  const maps = buildProgramMaps(programs);
  assert.equal(resolveProgramSiakad(maps, "Hufadz", "HUFADZ"), "hufadz");
  // Kasus Anisa (Nov 2026): PPDB "Markaz Huffadz" tidak ada di Siakad.
  assert.equal(resolveProgramSiakad(maps, "Markaz Huffadz", "HUFADZ"), "hufadz");
  assert.equal(resolveProgramSiakad(maps, "Ula 1", "TURATS"), "ula1");
});

test("ambiguous kategori is never guessed", () => {
  const maps = buildProgramMaps(programs);
  assert.equal(resolveProgramSiakad(maps, "Program Baru", "TURATS"), undefined);
  assert.equal(resolveProgramSiakad(maps, "Program Baru", "REGULER"), undefined);
  assert.equal(resolveProgramSiakad(maps, null, null), undefined);
  assert.equal(resolveProgramSiakad(maps, "  ", "HUFADZ"), "hufadz");
});
