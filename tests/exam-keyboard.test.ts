import test from "node:test";
import assert from "node:assert/strict";
import { ARABIC_ROWS, HARAKAT, KEY_VARIANTS, deleteExamText, insertExamText, isArabicDirection, moveExamCursor } from "../src/lib/exam-keyboard";

test("Arabic letters, hamzah and required harakat are reachable", () => {
  const available = new Set([...ARABIC_ROWS.flat(), ...HARAKAT, ...Object.values(KEY_VARIANTS).flat()]);
  for (const letter of Array.from("ابتثجحخدذرزسشصضطظعغفقكلمنهويءأإآؤئىةًٌٍَُِّْٰ")) assert.ok(available.has(letter), letter);
  assert.deepEqual(KEY_VARIANTS["ا"], ["ا", "أ", "إ", "آ", "ٱ"]);
});
test("insertion preserves Arabic combining marks and selected text replacement", () => {
  let result = insertExamText("", { start: 0, end: 0 }, "أ");
  result = insertExamText(result.text, result, "َ");
  result = insertExamText(result.text, result, "ب");
  assert.equal(result.text, "أَب");
  assert.equal(insertExamText(result.text, { start: 0, end: 1 }, "إ").text, "إَب");
  assert.equal(insertExamText("عربي Indonesia", { start: 5, end: 14 }, "indonesia").text, "عربي indonesia");
  assert.equal(insertExamText("ab", { start: 1, end: 1 }, "\n", false).text, "ab");
  assert.equal(insertExamText("ab", { start: 1, end: 1 }, "\n").text, "a\nb");
});
test("backspace removes harakat one by one and never splits a surrogate pair", () => {
  let text = "بُّ";
  for (const expected of ["بّ", "ب", ""]) {
    text = deleteExamText(text, { start: text.length, end: text.length }).text;
    assert.equal(text, expected);
  }
  assert.equal(deleteExamText("a😀", { start: 3, end: 3 }).text, "a");
  assert.equal(deleteExamText("abc", { start: 1, end: 2 }).text, "ac");
  assert.deepEqual(deleteExamText("", { start: 0, end: 0 }), { text: "", start: 0, end: 0 });
});
test("cursor respects Unicode boundaries, selections and text direction", () => {
  assert.deepEqual(moveExamCursor("a😀b", { start: 1, end: 1 }, true), { start: 3, end: 3 });
  assert.deepEqual(moveExamCursor("a😀b", { start: 3, end: 3 }, false), { start: 1, end: 1 });
  assert.deepEqual(moveExamCursor("abc", { start: 0, end: 3 }, false), { start: 0, end: 0 });
  assert.equal(isArabicDirection("123 العربية"), true);
  assert.equal(isArabicDirection("123 Indonesia العربية"), false);
});
