"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, CornerDownLeft, Delete, Globe } from "lucide-react";
import {
  ARABIC_ROWS,
  LATIN_ROWS,
  ARABIC_SYMBOL_PAGES,
  LATIN_SYMBOL_PAGES,
  HARAKAT,
  KEY_VARIANTS,
  keyLabel,
  keyDisplay,
  insertExamText,
  deleteExamText,
  moveExamCursor,
  isArabicDirection,
  type KeyboardLanguage,
} from "@/lib/exam-keyboard";
import styles from "./exam-keyboard.module.css";

type Field = HTMLInputElement | HTMLTextAreaElement;
type Binding = {
  element: Field;
  read: () => string;
  write: (value: string) => void;
  multiline: boolean;
};
type KeyboardContextValue = {
  activate: (field: Binding) => void;
  disabled: boolean;
  activeId: string | null;
};
const KeyboardContext = createContext<KeyboardContextValue | null>(null);

type VariantMenu = { key: string; values: string[]; left: number; top: number };

/** Tombol karakter (huruf / harakat / tanda baca) dengan dukungan tekan lama 450ms untuk variasi. */
function CharacterKey({
  value,
  shifted,
  insert,
  variants,
  chooseAt,
}: {
  value: string;
  shifted: boolean;
  insert: (value: string) => void;
  variants: (key: string, rect: DOMRect) => void;
  chooseAt: (x: number, y: number) => boolean;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const press = useRef<{
    id: number;
    x: number;
    y: number;
    held: boolean;
    cancelled: boolean;
  } | null>(null);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => {
    const cancel = () => {
      clear();
      press.current = null;
    };
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", cancel);
    return () => {
      cancel();
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", cancel);
    };
  }, [clear]);

  const output = shifted ? value.toUpperCase() : value;

  return (
    <button
      type="button"
      className={styles.key}
      aria-label={keyLabel(output)}
      aria-haspopup={KEY_VARIANTS[value] ? "listbox" : undefined}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (e.button !== 0 || press.current) return;
        e.preventDefault();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* abaikan bila pointerCapture tidak tersedia */
        }
        clear();
        press.current = {
          id: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          held: false,
          cancelled: false,
        };
        const rect = e.currentTarget.getBoundingClientRect();
        if (KEY_VARIANTS[value]) {
          timer.current = setTimeout(() => {
            if (!press.current || press.current.cancelled) return;
            press.current.held = true;
            variants(value, rect);
          }, 450);
        }
      }}
      onPointerMove={(e) => {
        const p = press.current;
        if (
          p &&
          p.id === e.pointerId &&
          !p.held &&
          Math.hypot(e.clientX - p.x, e.clientY - p.y) > 18
        ) {
          p.cancelled = true;
          clear();
        }
      }}
      onPointerUp={(e) => {
        const p = press.current;
        clear();
        press.current = null;
        if (!p || p.id !== e.pointerId || p.cancelled) return;
        if (p.held) chooseAt(e.clientX, e.clientY);
        else insert(output);
      }}
      onPointerCancel={() => {
        clear();
        press.current = null;
      }}
      onLostPointerCapture={() => {
        clear();
        press.current = null;
      }}
      onClick={(e) => {
        if (e.detail === 0) insert(output);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown" && KEY_VARIANTS[value]) {
          e.preventDefault();
          variants(value, e.currentTarget.getBoundingClientRect());
        }
      }}
    >
      <span>{keyDisplay(output)}</span>
      {KEY_VARIANTS[value] && <small aria-hidden="true">•</small>}
    </button>
  );
}

/**
 * Tombol aksi cepat yang andal di iOS Safari (Spasi, Hapus, Enter, Shift, Bahasa, Kursor, Tutup).
 * Menggunakan pointer events agar tidak tertelan oleh delay/batalnya event click saat
 * `pointerdown` memanggil `preventDefault()`, serta menjaga fokus input tidak lepas.
 */
function FastActionButton({
  className,
  ariaLabel,
  ariaPressed,
  dataExamVariant,
  onAction,
  repeat = false,
  children,
}: {
  className?: string;
  ariaLabel?: string;
  ariaPressed?: boolean;
  dataExamVariant?: string;
  onAction: () => void;
  repeat?: boolean;
  children: ReactNode;
}) {
  const actionRef = useRef(onAction);
  useLayoutEffect(() => {
    actionRef.current = onAction;
  }, [onAction]);
  const press = useRef<{
    id: number;
    x: number;
    y: number;
    cancelled: boolean;
    repeated: boolean;
  } | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (repeatTimer.current) clearInterval(repeatTimer.current);
    holdTimer.current = null;
    repeatTimer.current = null;
  }, []);

  useEffect(() => {
    const cancel = () => {
      clearTimers();
      press.current = null;
    };
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", cancel);
    return () => {
      cancel();
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", cancel);
    };
  }, [clearTimers]);

  return (
    <button
      type="button"
      className={className}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      data-exam-variant={dataExamVariant}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (e.button !== 0 || press.current) return;
        e.preventDefault();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* abaikan */
        }
        clearTimers();
        press.current = {
          id: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          cancelled: false,
          repeated: false,
        };
        if (repeat) {
          holdTimer.current = setTimeout(() => {
            if (!press.current || press.current.cancelled) return;
            press.current.repeated = true;
            actionRef.current();
            repeatTimer.current = setInterval(() => {
              if (!press.current || press.current.cancelled) {
                clearTimers();
                return;
              }
              actionRef.current();
            }, 75);
          }, 400);
        }
      }}
      onPointerMove={(e) => {
        const p = press.current;
        if (
          p &&
          p.id === e.pointerId &&
          Math.hypot(e.clientX - p.x, e.clientY - p.y) > 22
        ) {
          p.cancelled = true;
          clearTimers();
        }
      }}
      onPointerUp={(e) => {
        const p = press.current;
        clearTimers();
        press.current = null;
        if (!p || p.id !== e.pointerId || p.cancelled) return;
        if (!p.repeated) actionRef.current();
      }}
      onPointerCancel={() => {
        clearTimers();
        press.current = null;
      }}
      onLostPointerCapture={() => {
        clearTimers();
        press.current = null;
      }}
      onClick={(e) => {
        if (e.detail === 0) actionRef.current();
      }}
    >
      {children}
    </button>
  );
}

export function ExamKeyboardProvider({
  children,
  disabled = false,
}: {
  children: ReactNode;
  disabled?: boolean;
}) {
  const [active, setActive] = useState<Field | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeRef = useRef<Binding | null>(null);
  const [language, setLanguage] = useState<KeyboardLanguage>("ar");
  const [numbers, setNumbers] = useState(false);
  const [symbolPage, setSymbolPage] = useState<0 | 1>(0);
  const [shift, setShift] = useState(false);
  const [menu, setMenu] = useState<VariantMenu | null>(null);
  const [height, setHeight] = useState(0);
  const [viewportStyle, setViewportStyle] = useState<CSSProperties | undefined>(
    undefined,
  );
  const panel = useRef<HTMLDivElement>(null);
  const animation = useRef(0);

  const activate = useCallback(
    (field: Binding) => {
      if (disabled) return;
      // Keep activation stable while typing; selection changes must not restart scrolling.
      activeRef.current = field;
      setActive(field.element);
      setActiveId(field.element.id || null);
      setMenu(null);
    },
    [disabled],
  );

  const close = useCallback(() => {
    const field = activeRef.current;
    activeRef.current = null;
    setActive(null);
    setActiveId(null);
    setMenu(null);
    setHeight(0);
    if (document.activeElement === field?.element) field.element.blur();
  }, []);

  function update(
    operation: "insert" | "delete" | "left" | "right",
    value = "",
  ) {
    const field = activeRef.current;
    if (disabled || !field?.element.isConnected) return;
    const text = field.read();
    const range = {
      start: field.element.selectionStart ?? text.length,
      end: field.element.selectionEnd ?? text.length,
    };
    const result =
      operation === "insert"
        ? insertExamText(text, range, value, field.multiline)
        : operation === "delete"
          ? deleteExamText(text, range)
          : {
              text,
              ...moveExamCursor(
                text,
                range,
                operation === "right"
                  ? !isArabicDirection(text)
                  : isArabicDirection(text),
              ),
            };
    if (result.text !== text) field.write(result.text);
    // Restore the controlled value before setting the selection; never save a DOM-injected value.
    field.element.value = result.text;
    if (document.activeElement !== field.element) {
      field.element.focus({ preventScroll: true });
    }
    try {
      field.element.setSelectionRange(result.start, result.end);
    } catch {
      /* abaikan bila input tidak mendukung selectionRange */
    }
    if (result.start === result.text.length) {
      field.element.scrollTop = field.element.scrollHeight;
    }
    setMenu(null);
    if (operation === "insert") setShift(false);
  }

  // Sinkronisasi posisi & lebar keyboard ke VisualViewport (khusus iOS Safari non-fullscreen).
  // Mencegah keyboard terpotong kiri/kanan/bawah saat toolbar Safari naik-turun atau terjadi zoom.
  useEffect(() => {
    if (!active || disabled || typeof window === "undefined") {
      setViewportStyle(undefined);
      return;
    }
    const syncViewport = () => {
      const vv = window.visualViewport;
      if (!vv || document.fullscreenElement) {
        setViewportStyle(undefined);
        return;
      }
      const isAdjusted =
        vv.scale !== 1 ||
        Math.abs(vv.offsetTop) > 0.5 ||
        Math.abs(vv.offsetLeft) > 0.5 ||
        Math.abs(vv.height - window.innerHeight) > 1.5 ||
        Math.abs(vv.width - window.innerWidth) > 1.5;

      if (!isAdjusted) {
        setViewportStyle(undefined);
        return;
      }

      const panelW = Math.min(vv.width, 720);
      const panelLeft = vv.offsetLeft + Math.max(0, (vv.width - panelW) / 2);
      const bottomY = vv.offsetTop + vv.height;
      setViewportStyle({
        left: `${panelLeft}px`,
        right: "auto",
        width: `${panelW}px`,
        top: `${bottomY}px`,
        bottom: "auto",
        transform: "translateY(-100%)",
        marginInline: 0,
      });
    };

    syncViewport();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", syncViewport);
    vv?.addEventListener("scroll", syncViewport);
    window.addEventListener("resize", syncViewport);
    window.addEventListener("orientationchange", syncViewport);
    return () => {
      vv?.removeEventListener("resize", syncViewport);
      vv?.removeEventListener("scroll", syncViewport);
      window.removeEventListener("resize", syncViewport);
      window.removeEventListener("orientationchange", syncViewport);
    };
  }, [active, disabled]);

  useEffect(() => {
    if (!active || disabled) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && target !== activeRef.current?.element) {
        close();
      }
    };
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    const hidden = () => {
      if (document.hidden) close();
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", keys);
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("blur", close);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", keys);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("blur", close);
    };
  }, [active, close, disabled]);

  useEffect(() => {
    if (!active || disabled || !panel.current) return;
    const element = panel.current;
    // Tambah ruang ekstra (+72px) agar baris terbawah tabel matrix / soal panjang
    // bisa di-scroll nyaman ke atas keyboard dan tidak pernah ketutupan keyboard.
    const measure = () => setHeight(element.getBoundingClientRect().height + 72);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [active, disabled]);

  useEffect(() => {
    if (!active || disabled || !height) return;
    cancelAnimationFrame(animation.current);
    animation.current = requestAnimationFrame(() => {
      const field = active;
      if (!field.isConnected) return;
      // Cari kontainer yang BENAR-BENAR bisa scroll vertikal (lewati wrapper
      // overflow-x-auto pada tabel matrix yang secara CSS ikut memiliki overflowY="auto"
      // tetapi scrollHeight === clientHeight sehingga tidak bisa menggulir vertikal).
      let scroller: HTMLElement | null = field.parentElement;
      while (scroller) {
        if (scroller.dataset.horizontalScroll !== "true") {
          const oy = getComputedStyle(scroller).overflowY;
          if (
            /(auto|scroll)/.test(oy) &&
            scroller.scrollHeight > scroller.clientHeight + 8
          ) {
            break;
          }
        }
        scroller = scroller.parentElement;
      }
      const viewport = scroller?.getBoundingClientRect();
      const vvHeight = window.visualViewport?.height ?? window.innerHeight;
      const top = Math.max(0, viewport?.top ?? 0) + 16;
      const panelTop = panel.current?.getBoundingClientRect().top ?? vvHeight;
      const bottom = Math.min(viewport?.bottom ?? vvHeight, panelTop) - 20;
      const rect = field.getBoundingClientRect();
      const delta =
        rect.top < top || rect.height > bottom - top
          ? rect.top - top
          : rect.bottom > bottom
            ? rect.bottom - bottom
            : 0;
      // One bounded adjustment on open/field change/resize. Override scroll-smooth so
      // it cannot compete with the browser's cursor selection and scroll anchoring.
      if (Math.abs(delta) > 1) {
        (scroller ?? document.scrollingElement)?.scrollBy({
          top: delta,
          behavior: "instant",
        });
      }
    });
    return () => cancelAnimationFrame(animation.current);
  }, [active, height, disabled]);

  function showVariants(key: string, rect: DOMRect) {
    const bounds = panel.current?.getBoundingClientRect();
    if (!bounds) return;
    const values = KEY_VARIANTS[key];
    const width = Math.min(values.length * 43 + 10, bounds.width - 12);
    setMenu({
      key,
      values,
      left: Math.max(
        6,
        Math.min(rect.left - bounds.left, bounds.width - width - 6),
      ),
      top: Math.max(0, rect.top - bounds.top - 58),
    });
  }

  const insert = (value: string) => update("insert", value);
  const toggleLanguage = () => {
    setLanguage((prev) => (prev === "ar" ? "id" : "ar"));
    setNumbers(false);
    setSymbolPage(0);
    setMenu(null);
  };

  const rows = numbers
    ? (language === "ar" ? ARABIC_SYMBOL_PAGES : LATIN_SYMBOL_PAGES)[symbolPage]
    : language === "ar"
      ? ARABIC_ROWS
      : LATIN_ROWS;
  const arabicLetters = !numbers && language === "ar";
  const latinLetters = !numbers && language === "id";
  const multiline = active?.tagName === "TEXTAREA";

  const deleteButton = (cls: string) => (
    <FastActionButton
      className={`${styles.actionKey} ${cls}`}
      ariaLabel="Hapus satu karakter"
      repeat
      onAction={() => update("delete")}
    >
      <Delete
        size={19}
        strokeWidth={2}
        aria-hidden="true"
        style={language === "ar" ? { transform: "scaleX(-1)" } : undefined}
      />
    </FastActionButton>
  );

  const destination =
    typeof document !== "undefined"
      ? (document.fullscreenElement ?? document.body)
      : null;

  return (
    <KeyboardContext.Provider value={{ activate, disabled, activeId }}>
      {children}
      {active && !disabled && <div aria-hidden="true" style={{ height }} />}
      {active &&
        !disabled &&
        destination &&
        createPortal(
          <div
            ref={panel}
            className={styles.keyboard}
            style={viewportStyle}
            role="region"
            aria-label="Keyboard ujian"
            dir="ltr"
            onContextMenu={(e) => e.preventDefault()}
          >
            {/* Strip utilitas atas ringkas ala Gboard */}
            <div className={styles.toolbar}>
              <div className={styles.langGroup}>
                <FastActionButton
                  className={styles.toolBtn}
                  ariaPressed={!numbers && language === "ar"}
                  onAction={() => {
                    setLanguage("ar");
                    setNumbers(false);
                    setSymbolPage(0);
                    setMenu(null);
                  }}
                >
                  العربية
                </FastActionButton>
                <FastActionButton
                  className={styles.toolBtn}
                  ariaPressed={!numbers && language === "id"}
                  onAction={() => {
                    setLanguage("id");
                    setNumbers(false);
                    setSymbolPage(0);
                    setMenu(null);
                  }}
                >
                  Indonesia
                </FastActionButton>
                <span className={styles.hint}>
                  Tahan tombol • untuk variasi
                </span>
              </div>

              <div className={styles.toolbarRight}>
                <FastActionButton
                  className={styles.iconToolBtn}
                  ariaLabel="Kursor ke kiri"
                  repeat
                  onAction={() => update("left")}
                >
                  ←
                </FastActionButton>
                <FastActionButton
                  className={styles.iconToolBtn}
                  ariaLabel="Kursor ke kanan"
                  repeat
                  onAction={() => update("right")}
                >
                  →
                </FastActionButton>
                <FastActionButton
                  className={`${styles.iconToolBtn} ${styles.closeBtn}`}
                  ariaLabel="Tutup keyboard"
                  onAction={close}
                >
                  <ChevronDown size={20} strokeWidth={2.2} aria-hidden="true" />
                </FastActionButton>
              </div>
            </div>

            {/* Harakat di atas huruf Arab */}
            {arabicLetters && (
              <div className={styles.harakat}>
                {HARAKAT.map((value) => (
                  <CharacterKey
                    key={value}
                    value={value}
                    shifted={false}
                    insert={insert}
                    variants={showVariants}
                    chooseAt={chooseAt}
                  />
                ))}
              </div>
            )}

            {/* Baris huruf / angka mengikuti tata letak Gboard */}
            {rows.map((row, index) => {
              const isLastRow = index === rows.length - 1;
              const rowClass = [
                styles.row,
                arabicLetters ? styles.arabicRow : "",
                latinLetters && index === 1 ? styles.latinRow2 : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <div
                  className={rowClass}
                  key={`${numbers}:${symbolPage}:${language}:${index}`}
                >
                  {latinLetters && isLastRow && (
                    <FastActionButton
                      className={`${styles.actionKey} ${styles.shiftKey}`}
                      ariaLabel="Huruf kapital"
                      ariaPressed={shift}
                      onAction={() => {
                        setShift((v) => !v);
                        setMenu(null);
                      }}
                    >
                      ⇧
                    </FastActionButton>
                  )}

                  {numbers && isLastRow && (
                    <FastActionButton
                      className={`${styles.actionKey} ${styles.pageToggleKey}`}
                      ariaLabel={
                        symbolPage === 0
                          ? "Halaman simbol 2 dari 2"
                          : "Kembali ke halaman simbol 1 dari 2"
                      }
                      ariaPressed={symbolPage === 1}
                      onAction={() => {
                        setSymbolPage((p) => (p === 0 ? 1 : 0));
                        setMenu(null);
                      }}
                    >
                      {symbolPage === 0 ? "1/2" : "2/2"}
                    </FastActionButton>
                  )}

                  {row.map((value) => (
                    <CharacterKey
                      key={value}
                      value={value}
                      shifted={shift && latinLetters}
                      insert={insert}
                      variants={showVariants}
                      chooseAt={chooseAt}
                    />
                  ))}

                  {isLastRow &&
                    deleteButton(
                      arabicLetters
                        ? styles.deleteKeyArabic
                        : styles.deleteKeyLatin,
                    )}
                </div>
              );
            })}

            {/* Baris bawah Gboard: [?123 / ؟٣٢١] [, / ،] [🌐] [Spasi] [. / ؟] [↵ / ✓] */}
            <div className={styles.bottom}>
              <FastActionButton
                className={styles.pillKey}
                ariaLabel={numbers ? "Kembali ke huruf" : "Angka dan simbol"}
                ariaPressed={numbers}
                onAction={() => {
                  setNumbers((v) => !v);
                  setSymbolPage(0);
                  setMenu(null);
                }}
              >
                {numbers
                  ? language === "ar"
                    ? "أبج"
                    : "ABC"
                  : language === "ar"
                    ? "؟٣٢١"
                    : "?123"}
              </FastActionButton>

              <CharacterKey
                value={numbers ? "/" : language === "ar" ? "،" : ","}
                shifted={false}
                insert={insert}
                variants={showVariants}
                chooseAt={chooseAt}
              />

              <FastActionButton
                className={styles.globeKey}
                ariaLabel="Ganti bahasa keyboard"
                onAction={toggleLanguage}
              >
                <Globe size={18} strokeWidth={2} aria-hidden="true" />
              </FastActionButton>

              <FastActionButton
                className={styles.space}
                ariaLabel="Spasi"
                onAction={() => insert(" ")}
              >
                {language === "ar" ? "العربية" : "Indonesia"}
              </FastActionButton>

              <CharacterKey
                value={language === "ar" ? "؟" : "."}
                shifted={false}
                insert={insert}
                variants={showVariants}
                chooseAt={chooseAt}
              />

              <FastActionButton
                className={styles.enter}
                ariaLabel={multiline ? "Baris baru" : "Selesai mengetik"}
                onAction={() => (multiline ? insert("\n") : close())}
              >
                {multiline ? (
                  <CornerDownLeft
                    size={18}
                    strokeWidth={2.4}
                    aria-hidden="true"
                  />
                ) : (
                  "✓"
                )}
              </FastActionButton>
            </div>

            {menu && (
              <div
                className={styles.variants}
                role="listbox"
                aria-label={`Variasi ${keyLabel(menu.key)}`}
                style={{ left: menu.left, top: menu.top }}
              >
                {menu.values.map((value) => (
                  <FastActionButton
                    key={value}
                    ariaLabel={keyLabel(value)}
                    dataExamVariant={value}
                    onAction={() => insert(value)}
                  >
                    {keyDisplay(value)}
                  </FastActionButton>
                ))}
              </div>
            )}
          </div>,
          destination,
        )}
    </KeyboardContext.Provider>
  );

  function chooseAt(x: number, y: number) {
    const item = document
      .elementFromPoint(x, y)
      ?.closest<HTMLElement>("[data-exam-variant]");
    if (!item || !panel.current?.contains(item)) return false;
    insert(item.dataset.examVariant!);
    return true;
  }
}

export function ExamTextInput({
  value,
  onValueChange,
  multiline = false,
  rows = 2,
  className,
  placeholder,
  name,
  label = "Jawaban",
  style,
}: {
  value: string;
  onValueChange: (value: string) => void;
  multiline?: boolean;
  rows?: number;
  className?: string;
  placeholder?: string;
  name?: string;
  label?: string;
  style?: CSSProperties;
}) {
  const keyboard = useContext(KeyboardContext);
  const id = useId();
  const field = useRef<Field | null>(null);
  const latest = useRef({ value, onValueChange });
  useLayoutEffect(() => {
    latest.current = { value, onValueChange };
  }, [value, onValueChange]);

  // Kursor palsu: input readOnly di iOS tidak menampilkan kursor ketap-ketip,
  // padahal provider sudah menjaga selection-nya. Overlay cermin ini menggambar
  // garis kursor sendiri (hanya input satu baris yang aktif) mengikuti posisi
  // kursor DOM, supaya santri melihat posisi ketiknya.
  const mirror = useRef<HTMLSpanElement | null>(null);
  const [cursor, setCursor] = useState(0);
  const [mirrorStyle, setMirrorStyle] = useState<CSSProperties | null>(null);
  const isActive =
    !!keyboard && !keyboard.disabled && keyboard.activeId === id;

  useLayoutEffect(() => {
    const el = field.current;
    if (!el || !isActive) return;
    const cs = getComputedStyle(el);
    setMirrorStyle({
      font: cs.font,
      letterSpacing: cs.letterSpacing,
      lineHeight: cs.lineHeight,
      textAlign: cs.textAlign as CSSProperties["textAlign"],
      color: cs.color,
      direction: cs.direction as CSSProperties["direction"],
      paddingTop: cs.paddingTop,
      paddingRight: cs.paddingRight,
      paddingBottom: cs.paddingBottom,
      paddingLeft: cs.paddingLeft,
    });
    setCursor(el.selectionStart ?? value.length);
    if (mirror.current) mirror.current.scrollLeft = el.scrollLeft;
  }, [isActive, value]);

  const open = () => {
    if (!field.current || !keyboard) return;
    keyboard.activate({
      element: field.current,
      multiline,
      read: () => latest.current.value,
      write: (next) => {
        latest.current.value = next;
        latest.current.onValueChange(next);
      },
    });
  };

  // iOS Safari auto-zoom bila font input efektif < 16px.
  // Paksa minimal 16px (inline + touch-action: manipulation) agar aman dari auto-zoom & double-tap zoom.
  const mergedStyle: CSSProperties = {
    fontSize: "max(16px, 1rem)",
    touchAction: "manipulation",
    ...style,
  };

  const props = {
    id,
    name,
    value,
    placeholder,
    className: `${className || ""} text-base`.trim(),
    style: mergedStyle,
    "aria-label": label,
    "data-exam-input": keyboard ? "true" : undefined,
    dir: "auto" as const,
    disabled: keyboard?.disabled,
    readOnly: Boolean(keyboard),
    inputMode: keyboard ? ("none" as const) : ("text" as const),
    autoComplete: "off",
    autoCorrect: "off",
    autoCapitalize: "off",
    spellCheck: false,
    onFocus: open,
    onClick: open,
    onSelect: (e: React.SyntheticEvent<Field>) => {
      setCursor(e.currentTarget.selectionStart ?? value.length);
    },
    onScroll: () => {
      if (mirror.current && field.current) {
        mirror.current.scrollLeft = field.current.scrollLeft;
      }
    },
    onBeforeInput: (e: React.FormEvent<Field>) => {
      if (keyboard) e.preventDefault();
    },
    onInput: (e: React.FormEvent<Field>) => {
      if (keyboard) e.currentTarget.value = latest.current.value;
    },
    onChange: (e: React.ChangeEvent<Field>) => {
      if (!keyboard) onValueChange(e.currentTarget.value);
    },
    onPaste: (e: React.ClipboardEvent<Field>) => e.preventDefault(),
    onDrop: (e: React.DragEvent<Field>) => e.preventDefault(),
    onCopy: (e: React.ClipboardEvent<Field>) => {
      if (keyboard) e.preventDefault();
    },
    onCut: (e: React.ClipboardEvent<Field>) => {
      if (keyboard) e.preventDefault();
    },
    onContextMenu: (e: React.MouseEvent<Field>) => {
      if (keyboard) e.preventDefault();
    },
    onKeyDown: (e: React.KeyboardEvent<Field>) => {
      if (keyboard && !["Tab", "Escape"].includes(e.key)) e.preventDefault();
    },
  };

  if (multiline) {
    return (
      <textarea
        {...props}
        ref={(el) => {
          field.current = el;
        }}
        rows={rows}
      />
    );
  }
  if (!keyboard) {
    return (
      <input
        {...props}
        ref={(el) => {
          field.current = el;
        }}
        type="text"
      />
    );
  }

  const inputEl = (
    <input
      {...props}
      ref={(el) => {
        field.current = el;
      }}
      type="text"
    />
  );
  const wide = (className || "").includes("w-full");
  return (
    <span className={wide ? "relative block w-full" : "relative inline-block max-w-full"}>
      {inputEl}
      {isActive && mirrorStyle && (
        <span
          ref={mirror}
          aria-hidden="true"
          dir="auto"
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            pointerEvents: "none",
            whiteSpace: "pre",
            ...mirrorStyle,
          }}
        >
          <span style={{ visibility: "hidden" }}>{value.slice(0, cursor)}</span>
          <span className={styles.fakeCaret} />
          <span style={{ visibility: "hidden" }}>{value.slice(cursor)}</span>
        </span>
      )}
    </span>
  );
}
