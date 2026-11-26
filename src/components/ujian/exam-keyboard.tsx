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
  PEGON_ROWS,
  PEGON_HAROKAT_ROWS,
  LATIN_ROWS,
  ARABIC_SYMBOL_PAGES,
  LATIN_SYMBOL_PAGES,
  HARAKAT,
  KEY_VARIANTS,
  keyLabel,
  keyDisplay,
  pegonHarokatDisplay,
  insertExamText,
  deleteExamText,
  moveExamCursor,
  isArabicDirection,
  type KeyboardLanguage,
  type PegonSpecialKey,
  type TextSelection,
} from "@/lib/exam-keyboard";
import styles from "./exam-keyboard.module.css";

type Field = HTMLInputElement | HTMLTextAreaElement;
type Binding = {
  element: Field;
  read: () => string;
  write: (value: string) => void;
  setPendingSelection: (range: TextSelection) => void;
  multiline: boolean;
};
type KeyboardContextValue = {
  activate: (field: Binding) => void;
  syncSelection: (element: Field) => void;
  getLastSelection: (element: Field) => TextSelection | null;
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
  displayText,
  subLabel,
  ariaLabelOverride,
  extraClassName,
}: {
  value: string;
  shifted: boolean;
  insert: (value: string) => void;
  variants: (key: string, rect: DOMRect) => void;
  chooseAt: (x: number, y: number) => boolean;
  displayText?: string;
  subLabel?: string;
  ariaLabelOverride?: string;
  extraClassName?: string;
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
  const hasVariants = !subLabel && Boolean(KEY_VARIANTS[value]);

  return (
    <button
      type="button"
      className={[
        styles.key,
        subLabel ? styles.pegonDiacriticKey : "",
        extraClassName || "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={ariaLabelOverride ?? keyLabel(output)}
      aria-haspopup={hasVariants ? "listbox" : undefined}
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
        if (hasVariants) {
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
        if (e.key === "ArrowDown" && hasVariants) {
          e.preventDefault();
          variants(value, e.currentTarget.getBoundingClientRect());
        }
      }}
    >
      <span className={subLabel || extraClassName ? styles.pegonMainGlyph : undefined}>
        {displayText ?? keyDisplay(output)}
      </span>
      {subLabel && <span className={styles.pegonSubLabel}>{subLabel}</span>}
      {hasVariants && <small aria-hidden="true">•</small>}
    </button>
  );
}

/**
 * Tombol aksi cepat yang andal di iOS Safari & Android Chrome
 * (Spasi, Hapus, Enter, Shift, Harokat, Bahasa, Kursor, Tutup).
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
  // Simpan posisi kursor terakhir per elemen aktif agar tidak pernah reset ke 0
  // saat browser HP kehilangan fokus sesaat atau React me-render ulang controlled value.
  const selectionMapRef = useRef<WeakMap<Field, TextSelection>>(new WeakMap());

  const [language, setLanguage] = useState<KeyboardLanguage>("ar");
  const [numbers, setNumbers] = useState(false);
  const [symbolPage, setSymbolPage] = useState<0 | 1>(0);
  const [shift, setShift] = useState(false);
  const [pegonHarokat, setPegonHarokat] = useState(false);
  const [menu, setMenu] = useState<VariantMenu | null>(null);
  const [height, setHeight] = useState(0);
  const [viewportStyle, setViewportStyle] = useState<CSSProperties | undefined>(
    undefined,
  );
  const panel = useRef<HTMLDivElement>(null);
  const animation = useRef(0);

  const syncSelection = useCallback((element: Field) => {
    if (!element.isConnected) return;
    const s = element.selectionStart;
    const e = element.selectionEnd;
    if (s !== null && e !== null) {
      selectionMapRef.current.set(element, { start: s, end: e });
    }
  }, []);

  const getLastSelection = useCallback((element: Field): TextSelection | null => {
    return selectionMapRef.current.get(element) ?? null;
  }, []);

  const activate = useCallback(
    (field: Binding) => {
      if (disabled) return;
      activeRef.current = field;
      setActive(field.element);
      setActiveId(field.element.id || null);
      setMenu(null);
      syncSelection(field.element);
      // Di beberapa HP Android/iOS, selectionStart baru ter-update ke titik tap
      // pada frame berikutnya setelah focus/touchend.
      requestAnimationFrame(() => {
        if (activeRef.current?.element === field.element) {
          syncSelection(field.element);
        }
      });
    },
    [disabled, syncSelection],
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

  // Pantau selectionchange di dokumen agar geser kursor lewat sentuhan jari
  // di tengah kalimat pada essay panjang/singkat/matriks selalu tersinkronisasi.
  useEffect(() => {
    if (!active || disabled) return;
    const onSelectionChange = () => {
      const el = activeRef.current?.element;
      if (el && document.activeElement === el) {
        syncSelection(el);
      }
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
    };
  }, [active, disabled, syncSelection]);

  function update(
    operation: "insert" | "delete" | "left" | "right",
    value = "",
  ) {
    const field = activeRef.current;
    if (disabled || !field?.element.isConnected) return;
    const el = field.element;
    const text = field.read();

    // Ambil posisi kursor paling akurat:
    // Jika elemen sedang fokus di DOM, pakai selectionStart/End langsung dari DOM;
    // jika fokus sempat lepas (kasus klasik di HP), pakai posisi tersimpan terakhir — JANGAN jatuh ke 0!
    const isFocused = document.activeElement === el;
    const saved = selectionMapRef.current.get(el);
    let start: number;
    let end: number;
    if (isFocused && el.selectionStart !== null && el.selectionEnd !== null) {
      start = el.selectionStart;
      end = el.selectionEnd;
    } else if (saved) {
      start = saved.start;
      end = saved.end;
    } else {
      start = el.selectionStart ?? text.length;
      end = el.selectionEnd ?? text.length;
    }

    const range = {
      start: Math.max(0, Math.min(text.length, start)),
      end: Math.max(0, Math.min(text.length, end)),
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

    const nextRange = { start: result.start, end: result.end };
    selectionMapRef.current.set(el, nextRange);
    field.setPendingSelection(nextRange);

    if (result.text !== text) {
      field.write(result.text);
    }

    // Pastikan fokus & posisi kursor segera terpasang (sebelum maupun sesudah commit React)
    if (document.activeElement !== el) {
      el.focus({ preventScroll: true });
    }
    if (el.value !== result.text) {
      el.value = result.text;
    }
    try {
      el.setSelectionRange(nextRange.start, nextRange.end);
    } catch {
      /* abaikan bila input tidak mendukung selectionRange */
    }
    requestAnimationFrame(() => {
      if (activeRef.current?.element === el && el.isConnected) {
        if (document.activeElement !== el) {
          el.focus({ preventScroll: true });
        }
        try {
          el.setSelectionRange(nextRange.start, nextRange.end);
        } catch {
          /* abaikan */
        }
        selectionMapRef.current.set(el, nextRange);
      }
    });

    if (result.start === result.text.length && field.multiline) {
      el.scrollTop = el.scrollHeight;
    }
    setMenu(null);
    if (operation === "insert" && language === "id") setShift(false);
  }

  // Sinkronisasi posisi & lebar keyboard ke VisualViewport (khusus iOS Safari non-fullscreen).
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
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (panel.current?.contains(target)) return;
      if (target === activeRef.current?.element) return;
      // Jangan tutup keyboard saat berpindah ke input ujian lain (mis. sel tabel matriks lain)
      // agar tidak terjadi flicker/lompatan scroll yang mengacaukan posisi kursor.
      if (target.closest?.('[data-exam-input="true"]')) return;
      close();
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
    if (!values) return;
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

  const selectLanguage = (nextLang: KeyboardLanguage) => {
    setLanguage(nextLang);
    setNumbers(false);
    setSymbolPage(0);
    setPegonHarokat(false);
    setShift(false);
    setMenu(null);
  };

  const toggleLanguage = () => {
    const next: KeyboardLanguage =
      language === "ar" ? "pegon" : language === "pegon" ? "id" : "ar";
    selectLanguage(next);
  };

  const isArabicScript = language === "ar" || language === "pegon";
  const arabicLetters = !numbers && language === "ar";
  const pegonMode = !numbers && language === "pegon";
  const latinLetters = !numbers && language === "id";
  const multiline = active?.tagName === "TEXTAREA";

  const standardRows = numbers
    ? (isArabicScript ? ARABIC_SYMBOL_PAGES : LATIN_SYMBOL_PAGES)[symbolPage]
    : language === "ar"
      ? ARABIC_ROWS
      : LATIN_ROWS;

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
        style={isArabicScript ? { transform: "scaleX(-1)" } : undefined}
      />
    </FastActionButton>
  );

  const pegonHarokatButton = (
    <FastActionButton
      className={`${styles.actionKey} ${styles.pegonHarokatToggle}`}
      ariaLabel={
        pegonHarokat ? "Kembali ke huruf Pegon" : "Buka tombol harokat Pegon"
      }
      ariaPressed={pegonHarokat}
      onAction={() => {
        setPegonHarokat((v) => !v);
        setMenu(null);
      }}
    >
      Harokat
    </FastActionButton>
  );

  const destination =
    typeof document !== "undefined"
      ? (document.fullscreenElement ?? document.body)
      : null;

  const spaceLabel =
    language === "ar"
      ? "العربية"
      : language === "pegon"
        ? "Pegon"
        : "Indonesia";

  return (
    <KeyboardContext.Provider
      value={{ activate, syncSelection, getLastSelection, disabled, activeId }}
    >
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
                  onAction={() => selectLanguage("ar")}
                >
                  العربية
                </FastActionButton>
                <FastActionButton
                  className={styles.toolBtn}
                  ariaPressed={!numbers && language === "pegon"}
                  onAction={() => selectLanguage("pegon")}
                >
                  Pegon
                </FastActionButton>
                <FastActionButton
                  className={styles.toolBtn}
                  ariaPressed={!numbers && language === "id"}
                  onAction={() => selectLanguage("id")}
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

            {/* Harakat di atas huruf Arab (khusus mode العربية) */}
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

            {/* MODE PEGON: 4 baris × 10 kolom (Base huruf atau Lapisan Harokat) */}
            {pegonMode ? (
              pegonHarokat ? (
                PEGON_HAROKAT_ROWS.map((row: PegonSpecialKey[], index: number) => {
                  const isLastRow = index === PEGON_HAROKAT_ROWS.length - 1;
                  return (
                    <div
                      className={`${styles.row} ${styles.pegonRow}`}
                      key={`pegon-harokat:${index}`}
                    >
                      {isLastRow && pegonHarokatButton}

                      {row.map((item, kIdx) => {
                        const extraCls = [
                          item.isPhrase ? styles.pegonPhraseKey : "",
                          item.span === 2 ? styles.pegonSpan2 : "",
                        ]
                          .filter(Boolean)
                          .join(" ");
                        return (
                          <CharacterKey
                            key={`${index}-${kIdx}-${item.value}`}
                            value={item.value}
                            shifted={false}
                            insert={insert}
                            variants={showVariants}
                            chooseAt={chooseAt}
                            displayText={
                              item.display ?? pegonHarokatDisplay(item.value)
                            }
                            subLabel={item.subLabel}
                            ariaLabelOverride={item.label ?? keyLabel(item.value)}
                            extraClassName={extraCls || undefined}
                          />
                        );
                      })}

                      {isLastRow && deleteButton(styles.deleteKeyPegon)}
                    </div>
                  );
                })
              ) : (
                PEGON_ROWS.map((row, index) => {
                  const isLastRow = index === PEGON_ROWS.length - 1;
                  return (
                    <div
                      className={`${styles.row} ${styles.pegonRow}`}
                      key={`pegon-base:${index}`}
                    >
                      {isLastRow && pegonHarokatButton}

                      {row.map((value) => (
                        <CharacterKey
                          key={value}
                          value={value}
                          shifted={false}
                          insert={insert}
                          variants={showVariants}
                          chooseAt={chooseAt}
                        />
                      ))}

                      {isLastRow && deleteButton(styles.deleteKeyPegon)}
                    </div>
                  );
                })
              )
            ) : (
              /* MODE ARAB / INDONESIA / ANGKA & SIMBOL */
              standardRows.map((row, index) => {
                const isLastRow = index === standardRows.length - 1;
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
              })
            )}

            {/* Baris bawah Gboard: [?123 / ؟٣٢١] [, / ، / ؛] [🌐] [Spasi] [. / ؟] [↵ / ✓] */}
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
                  ? isArabicScript
                    ? "أبج"
                    : "ABC"
                  : isArabicScript
                    ? "؟٣٢١"
                    : "?123"}
              </FastActionButton>

              <CharacterKey
                value={
                  numbers
                    ? "/"
                    : pegonMode && pegonHarokat
                      ? "؛"
                      : isArabicScript
                        ? "،"
                        : ","
                }
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
                {spaceLabel}
              </FastActionButton>

              <CharacterKey
                value={
                  language === "ar" || (pegonMode && pegonHarokat) ? "؟" : "."
                }
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
  const pendingSelectionRef = useRef<TextSelection | null>(null);

  useLayoutEffect(() => {
    latest.current = { value, onValueChange };
  }, [value, onValueChange]);

  const isActive =
    !!keyboard && !keyboard.disabled && keyboard.activeId === id;

  // Setelah React meng-commit controlled `value`, pulihkan posisi kursor yang tepat
  // agar browser HP tidak me-reset kursor ke index 0 (awal kalimat) atau akhir teks.
  useLayoutEffect(() => {
    const el = field.current;
    const pending = pendingSelectionRef.current;
    if (!el || !pending || !isActive) return;
    pendingSelectionRef.current = null;
    const clampedStart = Math.max(0, Math.min(el.value.length, pending.start));
    const clampedEnd = Math.max(clampedStart, Math.min(el.value.length, pending.end));
    try {
      el.setSelectionRange(clampedStart, clampedEnd);
    } catch {
      /* abaikan */
    }
    keyboard?.syncSelection(el);
  }, [value, isActive, keyboard]);

  const openAndSync = () => {
    const el = field.current;
    if (!el || !keyboard) return;
    keyboard.activate({
      element: el,
      multiline,
      read: () => latest.current.value,
      write: (next) => {
        latest.current.value = next;
        latest.current.onValueChange(next);
      },
      setPendingSelection: (range) => {
        pendingSelectionRef.current = range;
      },
    });
    keyboard.syncSelection(el);
  };

  const syncAfterTap = () => {
    const el = field.current;
    if (!el || !keyboard) return;
    keyboard.syncSelection(el);
    requestAnimationFrame(() => {
      if (field.current) keyboard.syncSelection(field.current);
    });
  };

  // iOS Safari auto-zoom bila font input efektif < 16px.
  // Tanpa `readOnly` (cukup `inputMode="none"` + blokir onBeforeInput/onKeyDown),
  // kursor ketap-ketip asli tampil di semua HP (Android & iPhone) pada essay panjang,
  // singkat, maupun matriks, dan sentuhan di tengah kalimat menempatkan kursor akurat.
  const mergedStyle: CSSProperties = {
    fontSize: "max(16px, 1rem)",
    touchAction: "manipulation",
    caretColor: "#2563eb",
    fontFamily:
      style?.fontFamily ??
      '"Scheherazade New", "Amiri", "Inter", -apple-system, BlinkMacSystemFont, sans-serif',
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
    // PENTING: JANGAN pasang readOnly di sini! readOnly menyembunyikan kursor ketap-ketip
    // dan membuat sentuhan di tengah kalimat melompat ke awal (index 0) di banyak HP Android/iOS.
    // Keyboard bawaan HP tetap terkunci oleh inputMode="none" + blokir onBeforeInput/onInput/onKeyDown.
    inputMode: keyboard ? ("none" as const) : ("text" as const),
    autoComplete: "off",
    autoCorrect: "off",
    autoCapitalize: "off",
    spellCheck: false,
    onFocus: openAndSync,
    onClick: () => {
      openAndSync();
      syncAfterTap();
    },
    onPointerUp: syncAfterTap,
    onTouchEnd: syncAfterTap,
    onSelect: (e: React.SyntheticEvent<Field>) => {
      keyboard?.syncSelection(e.currentTarget);
    },
    onBeforeInput: (e: React.FormEvent<Field>) => {
      if (keyboard) e.preventDefault();
    },
    onInput: (e: React.FormEvent<Field>) => {
      if (!keyboard) return;
      const el = e.currentTarget;
      const expected = latest.current.value;
      if (el.value !== expected) {
        const saved = keyboard.getLastSelection(el);
        el.value = expected;
        if (saved) {
          const pos = Math.max(0, Math.min(expected.length, saved.start));
          try {
            el.setSelectionRange(pos, pos);
          } catch {
            /* abaikan */
          }
        }
      }
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
