"use client";

import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Delete } from "lucide-react";
import { ARABIC_ROWS, LATIN_ROWS, NUMBER_ROWS, HARAKAT, KEY_VARIANTS, keyLabel, keyDisplay, insertExamText, deleteExamText, moveExamCursor, isArabicDirection, type KeyboardLanguage } from "@/lib/exam-keyboard";
import styles from "./exam-keyboard.module.css";

type Field = HTMLInputElement | HTMLTextAreaElement;
type Binding = { element: Field; read: () => string; write: (value: string) => void; multiline: boolean };
type KeyboardContextValue = { activate: (field: Binding) => void; disabled: boolean };
const KeyboardContext = createContext<KeyboardContextValue | null>(null);

type VariantMenu = { key: string; values: string[]; left: number; top: number };

function CharacterKey({ value, shifted, insert, variants, chooseAt }: {
  value: string; shifted: boolean; insert: (value: string) => void;
  variants: (key: string, rect: DOMRect) => void; chooseAt: (x: number, y: number) => boolean;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const press = useRef<{ id: number; x: number; y: number; held: boolean; cancelled: boolean } | null>(null);
  const clear = useCallback(() => { if (timer.current) clearTimeout(timer.current); timer.current = null; }, []);
  useEffect(() => {
    const cancel = () => { clear(); press.current = null; };
    window.addEventListener("blur", cancel); document.addEventListener("visibilitychange", cancel);
    return () => { cancel(); window.removeEventListener("blur", cancel); document.removeEventListener("visibilitychange", cancel); };
  }, [clear]);
  const output = shifted ? value.toUpperCase() : value;
  return <button type="button" className={styles.key} aria-label={keyLabel(output)} aria-haspopup={KEY_VARIANTS[value] ? "listbox" : undefined}
    onContextMenu={e => e.preventDefault()}
    onPointerDown={e => {
      if (e.button !== 0 || press.current) return;
      e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); clear();
      press.current = { id: e.pointerId, x: e.clientX, y: e.clientY, held: false, cancelled: false };
      const rect = e.currentTarget.getBoundingClientRect();
      if (KEY_VARIANTS[value]) timer.current = setTimeout(() => {
        if (!press.current || press.current.cancelled) return;
        press.current.held = true; variants(value, rect);
      }, 450);
    }}
    onPointerMove={e => {
      const p = press.current;
      if (p && p.id === e.pointerId && !p.held && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 18) { p.cancelled = true; clear(); }
    }}
    onPointerUp={e => {
      const p = press.current; clear(); press.current = null;
      if (!p || p.id !== e.pointerId || p.cancelled) return;
      if (p.held) chooseAt(e.clientX, e.clientY); else insert(output);
    }}
    onPointerCancel={() => { clear(); press.current = null; }}
    onLostPointerCapture={() => { clear(); press.current = null; }}
    onClick={e => { if (e.detail === 0) insert(output); }}
    onKeyDown={e => {
      if (e.key === "ArrowDown" && KEY_VARIANTS[value]) { e.preventDefault(); variants(value, e.currentTarget.getBoundingClientRect()); }
    }}>
    <span>{keyDisplay(output)}</span>{KEY_VARIANTS[value] && <small aria-hidden="true">•</small>}
  </button>;
}

export function ExamKeyboardProvider({ children, disabled = false }: { children: ReactNode; disabled?: boolean }) {
  const [active, setActive] = useState<Field | null>(null);
  const activeRef = useRef<Binding | null>(null);
  const [language, setLanguage] = useState<KeyboardLanguage>("ar");
  const [numbers, setNumbers] = useState(false), [shift, setShift] = useState(false);
  const [menu, setMenu] = useState<VariantMenu | null>(null);
  const [height, setHeight] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const animation = useRef(0);
  const activate = useCallback((field: Binding) => {
    if (disabled) return;
    // Keep activation stable while typing; selection changes must not restart scrolling.
    activeRef.current = field; setActive(field.element); setMenu(null);
  }, [disabled]);
  const close = useCallback(() => {
    const field = activeRef.current;
    activeRef.current = null; setActive(null); setMenu(null); setHeight(0);
    if (document.activeElement === field?.element) field.element.blur();
  }, []);

  function update(operation: "insert" | "delete" | "left" | "right", value = "") {
    const field = activeRef.current;
    if (disabled || !field?.element.isConnected) return;
    const text = field.read(), range = { start: field.element.selectionStart ?? text.length, end: field.element.selectionEnd ?? text.length };
    const result = operation === "insert" ? insertExamText(text, range, value, field.multiline)
      : operation === "delete" ? deleteExamText(text, range)
      : { text, ...moveExamCursor(text, range, operation === "right" ? !isArabicDirection(text) : isArabicDirection(text)) };
    if (result.text !== text) field.write(result.text);
    // Restore the controlled value before setting the selection; never save a DOM-injected value.
    field.element.value = result.text;
    if (document.activeElement !== field.element) field.element.focus({ preventScroll: true });
    field.element.setSelectionRange(result.start, result.end);
    if (result.start === result.text.length) field.element.scrollTop = field.element.scrollHeight;
    setMenu(null);
    if (operation === "insert") setShift(false);
  }

  useEffect(() => {
    if (!active || disabled) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && target !== activeRef.current?.element) close();
    };
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close(); }
    };
    const hidden = () => { if (document.hidden) close(); };
    document.addEventListener("pointerdown", outside, true); document.addEventListener("keydown", keys);
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("blur", close);
    return () => {
      document.removeEventListener("pointerdown", outside, true); document.removeEventListener("keydown", keys);
      document.removeEventListener("visibilitychange", hidden); window.removeEventListener("blur", close);
    };
  }, [active, close, disabled]);

  useEffect(() => {
    if (!active || disabled || !panel.current) return;
    const element = panel.current;
    const measure = () => setHeight(element.getBoundingClientRect().height + 16);
    const observer = new ResizeObserver(measure); observer.observe(element);
    return () => observer.disconnect();
  }, [active, disabled]);

  useEffect(() => {
    if (!active || disabled || !height) return;
    cancelAnimationFrame(animation.current);
    animation.current = requestAnimationFrame(() => {
      const field = active;
      if (!field.isConnected) return;
      let scroller: HTMLElement | null = field.parentElement;
      while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
      const viewport = scroller?.getBoundingClientRect();
      const top = Math.max(0, viewport?.top ?? 0) + 16;
      const bottom = Math.min(viewport?.bottom ?? window.innerHeight, panel.current?.getBoundingClientRect().top ?? window.innerHeight) - 16;
      const rect = field.getBoundingClientRect();
      const delta = rect.top < top || rect.height > bottom - top ? rect.top - top
        : rect.bottom > bottom ? rect.bottom - bottom : 0;
      // One bounded adjustment on open/field change/resize. Override scroll-smooth so
      // it cannot compete with the browser's cursor selection and scroll anchoring.
      if (Math.abs(delta) > 1) (scroller ?? document.scrollingElement)?.scrollBy({ top: delta, behavior: "instant" });
    });
    return () => cancelAnimationFrame(animation.current);
  }, [active, height, disabled]);

  function showVariants(key: string, rect: DOMRect) {
    const bounds = panel.current?.getBoundingClientRect();
    if (!bounds) return;
    const values = KEY_VARIANTS[key];
    const width = Math.min(values.length * 44 + 12, bounds.width - 16);
    setMenu({ key, values, left: Math.max(8, Math.min(rect.left - bounds.left, bounds.width - width - 8)), top: Math.max(0, rect.top - bounds.top - 62) });
  }
  const insert = (value: string) => update("insert", value);
  const rows = numbers ? NUMBER_ROWS : language === "ar" ? ARABIC_ROWS : LATIN_ROWS;
  const arabicLetters = !numbers && language === "ar";
  const multiline = active?.tagName === "TEXTAREA";
  const deleteKey = <button type="button" className={arabicLetters ? styles.deleteKey : undefined} aria-label="Hapus satu karakter" onPointerDown={e => e.preventDefault()} onClick={() => update("delete")}>
    <Delete size={24} strokeWidth={1.8} aria-hidden="true" style={language === "ar" ? { transform: "scaleX(-1)" } : undefined} />
  </button>;
  const destination = typeof document !== "undefined" ? document.fullscreenElement ?? document.body : null;
  return <KeyboardContext.Provider value={{ activate, disabled }}>
    {children}
    {active && !disabled && <div aria-hidden="true" style={{ height }} />}
    {active && !disabled && destination && createPortal(<div ref={panel} className={styles.keyboard} role="region" aria-label="Keyboard ujian" dir="ltr" onContextMenu={e => e.preventDefault()}>
      <div className={styles.heading}><span>Keyboard ujian <small>Tahan tombol bertanda • untuk variasi</small></span><button type="button" onClick={close} aria-label="Tutup keyboard">⌄</button></div>
      <div className={styles.tools}>
        <button type="button" aria-pressed={!numbers && language === "ar"} onClick={() => { setLanguage("ar"); setNumbers(false); setMenu(null); }}>العربية</button>
        <button type="button" aria-pressed={!numbers && language === "id"} onClick={() => { setLanguage("id"); setNumbers(false); setMenu(null); }}>Indonesia</button>
        <button type="button" aria-pressed={numbers} onClick={() => { setNumbers(v => !v); setMenu(null); }}>123</button>
        <button type="button" aria-label="Kursor ke kiri" onPointerDown={e => e.preventDefault()} onClick={() => update("left")}>←</button>
        <button type="button" aria-label="Kursor ke kanan" onPointerDown={e => e.preventDefault()} onClick={() => update("right")}>→</button>
      </div>
      {!numbers && language === "ar" && <div className={styles.harakat}>{HARAKAT.map(value => <CharacterKey key={value} value={value} shifted={false} insert={insert} variants={showVariants} chooseAt={chooseAt} />)}</div>}
      {rows.map((row, index) => <div className={styles.row} key={`${numbers}:${language}:${index}`}>
        {row.map(value => <CharacterKey key={value} value={value} shifted={shift && !numbers && language === "id"} insert={insert} variants={showVariants} chooseAt={chooseAt} />)}
        {arabicLetters && index === rows.length - 1 && deleteKey}
      </div>)}
      <div className={styles.bottom}>
        {!numbers && language === "id" && <button type="button" aria-label="Huruf kapital" aria-pressed={shift} onClick={() => { setShift(v => !v); setMenu(null); }}>⇧</button>}
        <CharacterKey value={language === "ar" ? "؟" : "."} shifted={false} insert={insert} variants={showVariants} chooseAt={chooseAt} />
        <button type="button" className={styles.space} aria-label="Spasi" onPointerDown={e => e.preventDefault()} onClick={() => insert(" ")}>Spasi</button>
        {!arabicLetters && deleteKey}
        <button type="button" className={styles.enter} aria-label={multiline ? "Baris baru" : "Selesai mengetik"} onPointerDown={e => e.preventDefault()} onClick={() => multiline ? insert("\n") : close()}>{multiline ? "↵" : "✓"}</button>
      </div>
      {menu && <div className={styles.variants} role="listbox" aria-label={`Variasi ${keyLabel(menu.key)}`} style={{ left: menu.left, top: menu.top }}>
        {menu.values.map(value => <button type="button" role="option" aria-selected={false} aria-label={keyLabel(value)} data-exam-variant={value} key={value} onPointerDown={e => e.preventDefault()} onClick={() => insert(value)}>{keyDisplay(value)}</button>)}
      </div>}
    </div>, destination)}
  </KeyboardContext.Provider>;

  function chooseAt(x: number, y: number) {
    const item = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-exam-variant]");
    if (!item || !panel.current?.contains(item)) return false;
    insert(item.dataset.examVariant!); return true;
  }
}

export function ExamTextInput({ value, onValueChange, multiline = false, rows = 2, className, placeholder, name, label = "Jawaban", style }: {
  value: string; onValueChange: (value: string) => void; multiline?: boolean; rows?: number;
  className?: string; placeholder?: string; name?: string; label?: string; style?: CSSProperties;
}) {
  const keyboard = useContext(KeyboardContext);
  const id = useId(), field = useRef<Field | null>(null);
  const latest = useRef({ value, onValueChange });
  useLayoutEffect(() => { latest.current = { value, onValueChange }; }, [value, onValueChange]);
  const open = () => {
    if (!field.current || !keyboard) return;
    keyboard.activate({ element: field.current, multiline, read: () => latest.current.value, write: next => {
      latest.current.value = next; latest.current.onValueChange(next);
    } });
  };
  // iOS Safari auto-zoom saat fokus input berfont <16px. text-base (16px) jadi
  // batas minimum SEMUA kolom jawaban ujian; text-lg di pemakaian lain tetap
  // menang karena urutan CSS build (text-lg sesudah text-base).
  const props = {
    id, name, value, placeholder, className: `${className || ""} text-base`.trim(), style, "aria-label": label, "data-exam-input": keyboard ? "true" : undefined,
    dir: "auto" as const, disabled: keyboard?.disabled, readOnly: Boolean(keyboard), inputMode: keyboard ? "none" as const : "text" as const,
    autoComplete: "off", autoCorrect: "off", autoCapitalize: "off", spellCheck: false,
    onFocus: open, onClick: open,
    onBeforeInput: (e: React.FormEvent<Field>) => { if (keyboard) e.preventDefault(); },
    onInput: (e: React.FormEvent<Field>) => { if (keyboard) e.currentTarget.value = latest.current.value; },
    onChange: (e: React.ChangeEvent<Field>) => { if (!keyboard) onValueChange(e.currentTarget.value); },
    onPaste: (e: React.ClipboardEvent<Field>) => e.preventDefault(), onDrop: (e: React.DragEvent<Field>) => e.preventDefault(),
    onCopy: (e: React.ClipboardEvent<Field>) => { if (keyboard) e.preventDefault(); },
    onCut: (e: React.ClipboardEvent<Field>) => { if (keyboard) e.preventDefault(); },
    onContextMenu: (e: React.MouseEvent<Field>) => { if (keyboard) e.preventDefault(); },
    onKeyDown: (e: React.KeyboardEvent<Field>) => { if (keyboard && !["Tab", "Escape"].includes(e.key)) e.preventDefault(); },
  };
  return multiline ? <textarea {...props} ref={el => { field.current = el; }} rows={rows} /> : <input {...props} ref={el => { field.current = el; }} type="text" />;
}
