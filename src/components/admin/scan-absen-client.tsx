"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Html5Qrcode } from "html5-qrcode";
import { Camera, Keyboard, CheckCircle2, AlertTriangle, XCircle, LogOut, Play, Maximize, Minimize, Loader2 } from "lucide-react";
import { consumeScannerInput, isCompleteSantriQr, ScanDeduplicator } from "@/lib/scan-input";

type Kategori = { id: string; nama: string };
type Sesi = {
  id: string;
  kode: string;
  kategori: { nama: string };
  dibukaPada: string;
  ditutupPada: string;
  hadirCount?: number;
};
type Hasil = { tipe: "TERCATAT" | "SUDAH_TERCATAT" | "DITOLAK" | "BELUM_PASTI"; nama?: string; sakan?: string; kelasNama?: string | null; alasan?: string };
type Preview = {
  hadir: number;
  totalAktif: number;
  belumTercatat: { riwayatId: string; nama: string; sakan: string; kelasNama: string | null; usul: string }[];
};

function beep(freq: number, ms = 160) {
  try {
    const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + ms / 1000);
    o.start();
    o.stop(ctx.currentTime + ms / 1000 + 0.05);
    o.onended = () => { void ctx.close(); };
  } catch {
    /* abaikan */
  }
}

// Bunyi sukses ala scanner kasir: nyaring, pendek, nembus suara ramai
function beepKasir() {
  try {
    const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "square";
    o.frequency.value = 2200;
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.01);
    g.gain.setValueAtTime(0.5, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.start(t);
    o.stop(t + 0.16);
    o.onended = () => { void ctx.close(); };
  } catch {
    /* abaikan */
  }
}

export function ScanAbsenClient({ kategoriList, bisaBuatSesi = true }: { kategoriList: Kategori[]; bisaBuatSesi?: boolean }) {
  const [kategoriId, setKategoriId] = useState("");
  const [durasiMenit, setDurasiMenit] = useState(60);
  const [sesiList, setSesiList] = useState<Sesi[]>([]);
  const [sesiAktif, setSesiAktif] = useState<Sesi | null>(null);
  const [mode, setMode] = useState<"scanner" | "kamera">("scanner");
  const [hasil, setHasil] = useState<Hasil | null>(null);
  // Penghitung hasil: kunci remount kartu/notif supaya animasi terulang tiap hasil baru
  const [hasilKey, setHasilKey] = useState(0);
  const [riwayat, setRiwayat] = useState<{ id: number; nama: string; tipe: Hasil["tipe"]; waktu: string }[]>([]);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selesai, setSelesai] = useState<string | null>(null);
  const [filterSakan, setFilterSakan] = useState("");
  const [filterKelas, setFilterKelas] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [showExcluded, setShowExcluded] = useState(false);
  const [notif, setNotif] = useState<Hasil | null>(null);
  const notifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tampilkanNotif = useCallback((n: Hasil) => {
    setHasil(n);
    setHasilKey((k) => k + 1);
    setNotif(n);
    if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
    if (n.tipe === "TERCATAT" || n.tipe === "SUDAH_TERCATAT") {
      notifTimerRef.current = setTimeout(() => setNotif(null), 3000);
    }
  }, []);

  const inputRef = useRef<HTMLInputElement>(null);
  const qrRef = useRef<Html5Qrcode | null>(null);
  const dedupeRef = useRef(new ScanDeduplicator());
  const [jumlahAntrean, setJumlahAntrean] = useState(0);
  const scanSessionRef = useRef<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const partialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Antrean FIFO: scan beruntun diproses berurutan, tidak ada yang dibuang diam-diam
  const antreanRef = useRef<{ payload: string; sesiId: string }[]>([]);
  const memprosesRef = useRef(false);

  // Fullscreen khusus mode kamera (tombol disembunyikan bila browser tidak mendukung)
  const [isFullscreen, setIsFullscreen] = useState(false);
  const bisaFullscreen = typeof document !== "undefined" && !!document.fullscreenEnabled;

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      /* abaikan */
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const loadSesi = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/absensi/kegiatan/sesi");
      const data = await res.json();
      if (data.success) setSesiList(data.sesiList);
    } catch {
      /* abaikan */
    }
  }, []);

  useEffect(() => {
    loadSesi();
  }, [loadSesi]);

  const fokusInput = useCallback(() => {
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    if (mode === "scanner") {
      focusTimerRef.current = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0);
    }
  }, [mode]);

  useEffect(() => {
    scanSessionRef.current = sesiAktif && !preview && !selesai ? sesiAktif.id : null;
    fokusInput();
  }, [fokusInput, sesiAktif, preview, selesai]);

  // Jaga fokus input saat petugas kembali ke halaman (mis. setelah pindah aplikasi).
  // Penting untuk scanner Bluetooth: hasil scan hanya masuk jika input sedang fokus.
  useEffect(() => {
    const onWindowFocus = () => fokusInput();
    const onVisible = () => { if (!document.hidden) fokusInput(); };
    window.addEventListener("focus", onWindowFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onWindowFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fokusInput]);

  // Layar tetap hidup selama sesi scan aktif (Wake Lock API): diminta saat sesi
  // dibuka, diminta ulang saat petugas kembali ke halaman (kunci lepas begitu tab
  // disembunyikan), dilepas saat sesi berakhir. Browser yang tak mendukung atau
  // menolak diam-diam dibiarkan — halaman tetap jalan normal tanpa kunci.
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const [layarHidup, setLayarHidup] = useState(false);
  const mintaWakeLock = useCallback(async () => {
    try {
      if (!("wakeLock" in navigator)) return;
      if (document.visibilityState !== "visible") return;
      if (wakeLockRef.current) return;
      wakeLockRef.current = await navigator.wakeLock.request("screen");
      setLayarHidup(true);
      wakeLockRef.current.addEventListener("release", () => {
        wakeLockRef.current = null;
        setLayarHidup(false);
      });
    } catch {
      /* abaikan: tanpa kunci, layar mengikuti penguncian normal perangkat */
    }
  }, []);
  useEffect(() => {
    if (!sesiAktif) return;
    void mintaWakeLock();
    const onVis = () => {
      if (document.visibilityState === "visible") void mintaWakeLock();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      try {
        void wakeLockRef.current?.release();
      } catch {
        /* abaikan */
      }
      wakeLockRef.current = null;
    };
  }, [sesiAktif, mintaWakeLock]);

  const stopCamera = useCallback(async () => {
    try {
      if (qrRef.current) {
        await qrRef.current.stop();
        qrRef.current.clear();
      }
    } catch {
      /* abaikan */
    }
    qrRef.current = null;
    setCameraOn(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      scanSessionRef.current = null;
      antreanRef.current = [];
      requestRef.current?.abort();
      stopCamera();
      if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
      if (partialTimerRef.current) clearTimeout(partialTimerRef.current);
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    };
  }, [stopCamera]);

  const startCamera = async () => {
    if (cameraOn || cameraLoading) return;
    setCameraLoading(true);
    setHasil(null);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const qr = new Html5Qrcode("qr-reader");
      qrRef.current = qr;
      await qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decoded: string) => submitScan(decoded),
        () => {}
      );
      setCameraOn(true);
    } catch {
      tampilkanNotif({ tipe: "DITOLAK", alasan: "Kamera tidak bisa diakses. Ketuk ikon gembok di address bar lalu izinkan kamera, dan pastikan situs dibuka via HTTPS." });
    } finally {
      setCameraLoading(false);
    }
  };

  // A successful hardware decode is not attendance confirmation. Each request
  // gets a timeout so one broken connection cannot hold the whole queue forever.
  const kirimScan = useCallback(async (p: string, sesiId: string): Promise<boolean> => {
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch("/api/admin/absensi/kegiatan/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sesiId, payload: p }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => null);
      if (!mountedRef.current) return false;
      if (res.status === 401 || res.status === 403) {
        tampilkanNotif({ tipe: "DITOLAK", alasan: res.status === 401
          ? "Sesi login berakhir. Masuk kembali sebelum melanjutkan scan."
          : "Akun ini tidak memiliki izin melakukan scan absensi." });
        beep(220, 300);
        return false;
      }
      if (!res.ok || !data || !["TERCATAT", "SUDAH_TERCATAT", "DITOLAK"].includes(data.hasil)) {
        tampilkanNotif({ tipe: "BELUM_PASTI", alasan: "Server belum memberikan konfirmasi. Scan ulang QR yang sama untuk memastikan; absensi tidak akan dicatat ganda." });
        beep(220, 300);
        return false;
      }
      const h: Hasil = {
        tipe: data.hasil, nama: data.namaSantri, sakan: data.sakan,
        kelasNama: data.kelasNama,
        alasan: data.alasan || (data.hasil === "DITOLAK" ? "QR ditolak. Pastikan memakai QR Absensi santri dan sesi masih terbuka." : undefined),
      };
      tampilkanNotif(h);
      if (h.tipe === "TERCATAT") {
        beepKasir();
        setCount((c) => c + 1);
        if (h.nama) setRiwayat((r) => [{ id: Date.now(), nama: h.nama!, tipe: h.tipe, waktu: new Date().toLocaleTimeString("id-ID") }, ...r].slice(0, 30));
      } else if (h.tipe === "SUDAH_TERCATAT") {
        beep(440);
        try { navigator.vibrate?.([120, 60, 120]); } catch { /* abaikan */ }
      } else {
        beep(220, 300);
      }
      return h.tipe !== "DITOLAK";
    } catch {
      if (mountedRef.current) {
        tampilkanNotif({ tipe: "BELUM_PASTI", alasan: controller.signal.aborted
          ? "Respons melebihi 15 detik. Status absensi belum pasti; scan ulang QR yang sama setelah koneksi membaik."
          : "Koneksi terputus. Status absensi belum pasti; scan ulang QR yang sama untuk memastikan." });
        beep(220, 300);
      }
      return false;
    } finally {
      clearTimeout(timeout);
      requestRef.current = null;
    }
  }, [tampilkanNotif]);

  const prosesAntrean = useCallback(async () => {
    if (memprosesRef.current) return;
    memprosesRef.current = true;
    try {
      while (antreanRef.current.length > 0 && mountedRef.current) {
        const item = antreanRef.current.shift()!;
        const confirmed = await kirimScan(item.payload, item.sesiId);
        dedupeRef.current.finish(item.sesiId, item.payload, confirmed);
        if (mountedRef.current) setJumlahAntrean(dedupeRef.current.pendingCount);
      }
    } finally {
      memprosesRef.current = false;
    }
  }, [kirimScan]);

  // The camera and scanner share validation and queuing, never an input buffer.
  const submitScan = useCallback((payload: string) => {
    const p = payload.trim();
    const sesiId = scanSessionRef.current;
    if (!p || !sesiId) return;
    if (!isCompleteSantriQr(p)) {
      tampilkanNotif({ tipe: "DITOLAK", alasan: "QR tidak lengkap atau formatnya tidak sesuai. Arahkan alat ke QR Absensi santri lalu scan ulang." });
      return;
    }
    if (!dedupeRef.current.accept(sesiId, p)) return;
    antreanRef.current.push({ payload: p, sesiId });
    setJumlahAntrean(dedupeRef.current.pendingCount);
    void prosesAntrean();
  }, [prosesAntrean, tampilkanNotif]);

  const bacaInputScanner = useCallback((value: string, terminated = false) => {
    if (partialTimerRef.current) clearTimeout(partialTimerRef.current);
    const parsed = consumeScannerInput(value, terminated);
    // Consume synchronously BEFORE duplicate suppression, including pasted batches.
    if (inputRef.current) inputRef.current.value = parsed.remainder;
    parsed.payloads.forEach(submitScan);
    if (parsed.incomplete) {
      tampilkanNotif({ tipe: "DITOLAK", alasan: "Kode scanner belum lengkap. Scan ulang QR santri; jangan berpindah aplikasi saat membaca QR." });
    } else if (parsed.remainder) {
      partialTimerRef.current = setTimeout(() => {
        if (!inputRef.current?.value) return;
        inputRef.current.value = "";
        tampilkanNotif({ tipe: "DITOLAK", alasan: "Pembacaan scanner terputus sebelum kode lengkap. Scan ulang QR santri." });
      }, 2_000);
    }
  }, [submitScan, tampilkanNotif]);

  // Catch hardware keystrokes while focus is on a button or the page, without
  // stealing typing from an actual editable field or processing input twice.
  useEffect(() => {
    if (mode !== "scanner" || !sesiAktif || preview || selesai) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.target === inputRef.current || event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return;
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable='true']")) return;
      const input = inputRef.current;
      if (!input || !scanSessionRef.current) return;
      if (event.key === " " && !input.value) return;
      if (event.key.length === 1) {
        event.preventDefault();
        input.focus({ preventScroll: true });
        bacaInputScanner(input.value + event.key);
      } else if ((event.key === "Enter" || event.key === "Tab") && input.value) {
        event.preventDefault();
        bacaInputScanner(input.value, true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mode, sesiAktif, preview, selesai, bacaInputScanner]);

  const bukaSesi = async () => {
    if (!kategoriId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/absensi/kegiatan/sesi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kategoriId, durasiMenit }),
      });
      const data = await res.json();
      if (data.success) {
        setSesiAktif(data.sesi);
        setCount(0);
        setRiwayat([]);
        setHasil(null);
        setPreview(null);
        setSelesai(null);
        loadSesi();
      } else {
        setHasil({ tipe: "DITOLAK", alasan: data.error });
      }
    } finally {
      setBusy(false);
    }
  };

  const gabungSesi = (s: Sesi) => {
    setSesiAktif(s);
    setCount(s.hadirCount ?? 0);
    setRiwayat([]);
    setHasil(null);
    setNotif(null);
    setPreview(null);
    setSelesai(null);
  };

  const tutupSesi = async () => {
    if (!sesiAktif) return;
    if (dedupeRef.current.pendingCount > 0) {
      tampilkanNotif({ tipe: "BELUM_PASTI", alasan: "Tunggu antrean scan selesai sebelum menutup sesi." });
      return;
    }
    scanSessionRef.current = null;
    setBusy(true);
    try {
      if (mode === "kamera") await stopCamera();
      const res = await fetch(`/api/admin/absensi/kegiatan/sesi/${sesiAktif.id}`, { method: "PATCH" });
      const data = await res.json();
      if (data.success) {
        const pv = await fetch(`/api/admin/absensi/kegiatan/sesi/${sesiAktif.id}/finalisasi`);
        const pdata = await pv.json();
        if (pdata.success) {
          setPreview(pdata);
          setFilterSakan("");
          setFilterKelas("");
          setSelected(new Set());
          setExcluded(new Set());
          setShowExcluded(false);
        }
        loadSesi();
      } else {
        scanSessionRef.current = sesiAktif.id;
        tampilkanNotif({ tipe: "DITOLAK", alasan: data.error || "Sesi belum bisa ditutup." });
      }
    } catch {
      tampilkanNotif({ tipe: "BELUM_PASTI", alasan: "Penutupan sesi belum terkonfirmasi. Periksa koneksi lalu coba tutup kembali." });
    } finally {
      setBusy(false);
    }
  };

  const finalisasi = async (m: "TANDAI_ALPHA" | "BIARKAN") => {
    if (!sesiAktif) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/absensi/kegiatan/sesi/${sesiAktif.id}/finalisasi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: m, kecualikan: [...excluded] }),
      });
      const data = await res.json();
      if (data.success) {
        const jmlKecuali = excluded.size;
        setSelesai(
          m === "TANDAI_ALPHA"
            ? `Selesai. ${data.ditandai} santri ditandai sesuai usulan (ALPHA/IZIN)${jmlKecuali > 0 ? `, ${jmlKecuali} dikecualikan` : ""}.`
            : "Selesai. Sesi ditutup tanpa menandai yang belum tercatat."
        );
        setPreview(null);
        setSesiAktif(null);
        setCount(0);
        setSelected(new Set());
        setExcluded(new Set());
        setFilterSakan("");
        setFilterKelas("");
      }
    } finally {
      setBusy(false);
    }
  };

  // ---- Finalisasi: filter + pilih + kecualikan ----
  const belumSemua = preview?.belumTercatat ?? [];
  const belumAktif = belumSemua.filter((s) => !excluded.has(s.riwayatId));
  const sakanOptions = [...new Set(belumAktif.map((s) => s.sakan))].sort();
  const kelasOptions = [...new Set(belumAktif.map((s) => s.kelasNama).filter(Boolean) as string[])].sort();
  const belumTampil = belumAktif.filter(
    (s) => (!filterSakan || s.sakan === filterSakan) && (!filterKelas || s.kelasNama === filterKelas)
  );
  const excludedList = belumSemua.filter((s) => excluded.has(s.riwayatId));

  const togglePilih = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };
  const pilihSemuaTampil = () => {
    const ids = belumTampil.map((s) => s.riwayatId);
    setSelected((prev) => {
      const semuaSudah = ids.length > 0 && ids.every((id) => prev.has(id));
      const n = new Set(prev);
      if (semuaSudah) ids.forEach((id) => n.delete(id));
      else ids.forEach((id) => n.add(id));
      return n;
    });
  };
  const kecualikanTerpilih = () => {
    const aktifIds = new Set(belumAktif.map((s) => s.riwayatId));
    const mau = [...selected].filter((id) => aktifIds.has(id));
    if (mau.length === 0) return;
    setExcluded((prev) => new Set([...prev, ...mau]));
    setSelected(new Set());
  };
  const kembalikanSatu = (id: string) => {
    setExcluded((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
  };

  const gantiMode = async (m: "scanner" | "kamera") => {
    if (m === mode) return;
    if (mode === "kamera") await stopCamera();
    if (partialTimerRef.current) clearTimeout(partialTimerRef.current);
    if (inputRef.current) inputRef.current.value = "";
    setMode(m);
  };

  // ---- Tampilan: belum ada sesi aktif ----
  if (!sesiAktif && !preview && !selesai) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        {bisaBuatSesi ? (
        <div className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-bold">Buka Sesi Scan</h2>
          <p className="mt-1 text-sm text-gray-500">Pilih kegiatan, atur durasi, lalu mulai scan di gerbang.</p>
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-sm font-semibold">Kegiatan</label>
              <select
                value={kategoriId}
                onChange={(e) => setKategoriId(e.target.value)}
                className="mt-1 w-full rounded-xl border px-3 py-2"
              >
                <option value="">-- Pilih kegiatan --</option>
                {kategoriList.map((k) => (
                  <option key={k.id} value={k.id}>{k.nama}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold">Durasi sesi (menit)</label>
              <input
                type="number"
                min={5}
                max={480}
                value={durasiMenit}
                onChange={(e) => setDurasiMenit(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border px-3 py-2"
              />
            </div>
            <button
              onClick={bukaSesi}
              disabled={!kategoriId || busy}
              className="w-full rounded-xl bg-gray-900 px-4 py-3 font-bold text-white disabled:opacity-40"
            >
              {busy ? "Membuka..." : "Buka Sesi & Mulai Scan"}
            </button>
            {hasil?.tipe === "DITOLAK" && (
              <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">{hasil.alasan}</p>
            )}
          </div>
        </div>
        ) : null}

        {sesiList.length > 0 ? (
          <div className="rounded-2xl border bg-white p-6">
            <h2 className="text-lg font-bold">Sesi Terbuka (gabung jalur lain)</h2>
            <div className="mt-3 space-y-2">
              {sesiList.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-xl border px-4 py-3">
                  <div>
                    <p className="font-semibold">{s.kategori.nama}</p>
                    <p className="text-xs text-gray-500">
                      Berakhir {new Date(s.ditutupPada).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                      {typeof s.hadirCount === "number" && ` • ${s.hadirCount} hadir`}
                    </p>
                  </div>
                  <button
                    onClick={() => gabungSesi(s)}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white"
                  >
                    Gabung
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          !bisaBuatSesi && (
            <div className="rounded-2xl border bg-white p-6 text-center">
              <p className="text-sm text-gray-500">Belum ada sesi terbuka. Minta admin membuka sesi terlebih dahulu.</p>
            </div>
          )
        )}
      </div>
    );
  }

  // ---- Tampilan: finalisasi ----
  if (preview || selesai) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-bold">Finalisasi Sesi</h2>
          {selesai ? (
            <div className="mt-3 rounded-xl border border-green-300 bg-green-50 p-4">
              <p className="flex items-center gap-2 font-semibold text-green-800">
                <CheckCircle2 size={18} /> {selesai}
              </p>
              <button
                onClick={() => { setSelesai(null); loadSesi(); }}
                className="mt-4 w-full rounded-xl bg-gray-900 px-4 py-3 font-bold text-white"
              >
                Kembali
              </button>
            </div>
          ) : preview ? (
            <div className="mt-3 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-green-50 p-4 text-center">
                  <p className="text-3xl font-black text-green-700">{preview.hadir}</p>
                  <p className="text-xs text-green-600">Tercatat hadir</p>
                </div>
                <div className="rounded-xl bg-yellow-50 p-4 text-center">
                  <p className="text-3xl font-black text-yellow-700">{preview.belumTercatat.length}</p>
                  <p className="text-xs text-yellow-600">Belum tercatat</p>
                </div>
              </div>
              <p className="text-sm text-gray-500">
                Yang belum tercatat akan diusulkan: <b>IZIN</b> bila punya tasrih aktif, selain itu <b>ALPHA</b>.
                Masih bisa susulkan yang telat via Absen Kegiatan manual sebelum menekan tombol di bawah.
              </p>
              {belumAktif.length > 0 && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-gray-500">Filter Asrama</label>
                      <select
                        value={filterSakan}
                        onChange={(e) => setFilterSakan(e.target.value)}
                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                      >
                        <option value="">Semua asrama</option>
                        {sakanOptions.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500">Filter Kelas</label>
                      <select
                        value={filterKelas}
                        onChange={(e) => setFilterKelas(e.target.value)}
                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                      >
                        <option value="">Semua kelas</option>
                        {kelasOptions.map((k) => (
                          <option key={k} value={k}>{k}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      onClick={pilihSemuaTampil}
                      className="text-sm font-bold text-blue-600"
                    >
                      {belumTampil.length > 0 && belumTampil.every((s) => selected.has(s.riwayatId))
                        ? "Batalkan semua"
                        : `Pilih semua (${belumTampil.length})`}
                    </button>
                    {selected.size > 0 && (
                      <button
                        onClick={kecualikanTerpilih}
                        className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white"
                      >
                        Kecualikan dari ALPHA ({selected.size})
                      </button>
                    )}
                  </div>

                  <div className="max-h-64 overflow-auto rounded-xl border">
                    {belumTampil.length === 0 && (
                      <p className="px-4 py-6 text-center text-sm text-gray-400">
                        Tidak ada nama pada filter ini.
                      </p>
                    )}
                    {belumTampil.map((s) => (
                      <label
                        key={s.riwayatId}
                        className="flex cursor-pointer items-center gap-3 border-b px-4 py-2 text-sm last:border-0 hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(s.riwayatId)}
                          onChange={() => togglePilih(s.riwayatId)}
                          className="h-4 w-4"
                        />
                        <span className="flex-1">
                          {s.nama}
                          <span className="text-gray-400"> ({s.sakan}{s.kelasNama ? ` • ${s.kelasNama}` : ""})</span>
                        </span>
                        <span className={`font-bold ${s.usul === "ALPHA" ? "text-red-600" : "text-blue-600"}`}>{s.usul}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}

              {excludedList.length > 0 && (
                <div className="rounded-xl border border-amber-300 bg-amber-50">
                  <button
                    onClick={() => setShowExcluded((v) => !v)}
                    className="flex w-full items-center justify-between px-4 py-3 text-sm font-bold text-amber-800"
                  >
                    <span>Dikecualikan dari ALPHA ({excludedList.length})</span>
                    <span>{showExcluded ? "▾" : "▸"}</span>
                  </button>
                  {showExcluded && (
                    <div className="max-h-40 overflow-auto border-t border-amber-200">
                      {excludedList.map((s) => (
                        <div key={s.riwayatId} className="flex items-center justify-between px-4 py-2 text-sm">
                          <span>{s.nama} <span className="text-gray-400">({s.sakan})</span></span>
                          <button onClick={() => kembalikanSatu(s.riwayatId)} className="font-bold text-blue-600">
                            Kembalikan
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => finalisasi("TANDAI_ALPHA")}
                  disabled={busy || belumAktif.length === 0}
                  className="rounded-xl bg-red-600 px-4 py-3 font-bold text-white disabled:opacity-40"
                >
                  {busy ? "..." : `Tandai ALPHA/IZIN (${belumAktif.length})`}
                </button>
                <button
                  onClick={() => finalisasi("BIARKAN")}
                  disabled={busy}
                  className="rounded-xl border px-4 py-3 font-bold disabled:opacity-40"
                >
                  Biarkan Saja
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // ---- Tampilan: sesi aktif, mode scan ----
  if (!sesiAktif) return null;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Animasi umpan balik scan: pop singkat kartu/banner, sorot hijau memudar di baris terbaru */}
      <style>{`
        @keyframes scan-pop { 0% { transform: scale(0.96); opacity: 0.4; } 100% { transform: scale(1); opacity: 1; } }
        .animasi-scan-pop { animation: scan-pop 0.3s ease-out; }
        @keyframes scan-sorot { 0% { background: #dcfce7; } 100% { background: #f9fafb; } }
        .animasi-scan-sorot { animation: scan-sorot 1.2s ease-out; }
        @media (prefers-reduced-motion: reduce) { .animasi-scan-pop, .animasi-scan-sorot { animation: none; } }
      `}</style>
      <div className="flex items-center justify-between rounded-2xl border bg-white p-4">
        <div>
          <p className="text-xs text-gray-500">Sesi aktif</p>
          <p className="text-lg font-black">{sesiAktif.kategori.nama}</p>
          <p className="text-xs text-gray-500">
            Berakhir {new Date(sesiAktif.ditutupPada).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
            {" "}• {count} tercatat di jalur ini
          </p>
          {layarHidup && (
            <p className="mt-1 text-xs font-bold text-green-700">
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-green-500" /> Layar tetap hidup
            </p>
          )}
        </div>
        {bisaBuatSesi && (
        <button
          onClick={tutupSesi}
          disabled={busy || jumlahAntrean > 0}
          className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
        >
          <LogOut size={16} /> Tutup Sesi
        </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => gantiMode("scanner")}
          className={`flex items-center justify-center gap-2 rounded-xl border p-3 font-bold ${mode === "scanner" ? "border-gray-900 bg-gray-900 text-white" : "bg-white"}`}
        >
          <Keyboard size={18} /> Scanner BT
        </button>
        <button
          onClick={() => gantiMode("kamera")}
          className={`flex items-center justify-center gap-2 rounded-xl border p-3 font-bold ${mode === "kamera" ? "border-gray-900 bg-gray-900 text-white" : "bg-white"}`}
        >
          <Camera size={18} /> Kamera HP
        </button>
      </div>

      <div className="flex h-14 items-center gap-2 rounded-xl border bg-white px-4 text-sm" role="status" aria-live="polite" aria-label="Status antrean scan">
        {jumlahAntrean > 0 ? <Loader2 size={18} className="shrink-0 animate-spin text-blue-600" /> : <CheckCircle2 size={18} className="shrink-0 text-gray-400" />}
        <div className="min-w-0">
          <p className="font-semibold">{jumlahAntrean > 0 ? "QR diterima · Sedang mencatat" : "Siap menerima scan"}</p>
          <p className="text-xs text-gray-500">{jumlahAntrean > 0 ? `${jumlahAntrean} scan menunggu konfirmasi` : "Hasil pencatatan muncul setelah server mengonfirmasi."}</p>
        </div>
      </div>

      {notif && createPortal(
        <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex justify-center sm:justify-end" style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          <div key={hasilKey} role={notif.tipe === "DITOLAK" || notif.tipe === "BELUM_PASTI" ? "alert" : "status"} aria-atomic="true" data-scan-notification={notif.tipe}
            className={`pointer-events-auto animasi-scan-pop flex w-full max-w-sm items-start gap-3 rounded-xl border p-3 shadow-lg ${notif.tipe === "TERCATAT" ? "border-green-300 bg-green-50 text-green-950" : notif.tipe === "DITOLAK" ? "border-red-300 bg-red-50 text-red-950" : "border-amber-300 bg-amber-50 text-amber-950"}`}>
            {notif.tipe === "TERCATAT" ? <CheckCircle2 size={22} className="shrink-0 text-green-600" /> : notif.tipe === "DITOLAK" ? <XCircle size={22} className="shrink-0 text-red-600" /> : <AlertTriangle size={22} className="shrink-0 text-amber-600" />}
            <div className="min-w-0 flex-1 break-words">
              <p className="text-sm font-bold">{notif.tipe === "TERCATAT" ? "Absensi berhasil" : notif.tipe === "SUDAH_TERCATAT" ? "Sudah tercatat hadir" : notif.tipe === "BELUM_PASTI" ? "Belum terkonfirmasi" : "Scan ditolak"}</p>
              {notif.nama && <p className="mt-0.5 text-sm font-semibold">{notif.nama}</p>}
              {(notif.sakan || notif.kelasNama) && <p className="mt-0.5 text-xs opacity-80">{[notif.sakan, notif.kelasNama].filter(Boolean).join(" • ")}</p>}
              {notif.alasan && notif.tipe !== "SUDAH_TERCATAT" && <p className="mt-1 text-xs leading-relaxed">{notif.alasan}</p>}
            </div>
            <button type="button" onClick={() => setNotif(null)} className="shrink-0 px-1 text-lg leading-none" aria-label="Tutup notifikasi">×</button>
          </div>
        </div>, document.body
      )}

      {mode === "scanner" ? (
        <div className="rounded-2xl border bg-white p-6 text-center">
          <p className="text-sm font-semibold">Arahkan scanner ke QR santri</p>
          <p className="mt-1 text-xs text-gray-400">Cukup scan — otomatis tercatat, tanpa perlu mengetuk layar.</p>
          {/* Input disembunyikan demi tampilan minimalis, tapi tetap fokus & menerima ketikan scanner */}
          <input
            ref={inputRef}
            onChange={(e) => bacaInputScanner(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                bacaInputScanner(e.currentTarget.value, true);
              }
            }}
            inputMode="none"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onBlur={fokusInput}
            autoComplete="off"
            aria-hidden={true}
            tabIndex={-1}
            className="absolute h-0 w-0 opacity-0"
          />
        </div>
      ) : (
        <div className="rounded-2xl border bg-white p-6">
          <div id="qr-reader" className="overflow-hidden rounded-xl" />
          {!cameraOn ? (
            <button
              onClick={startCamera}
              disabled={cameraLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 font-bold text-white disabled:opacity-50"
            >
              <Play size={18} /> {cameraLoading ? "Menyiapkan kamera..." : "Nyalakan Kamera"}
            </button>
          ) : (
            <button
              onClick={stopCamera}
              className="mt-3 w-full rounded-xl border px-4 py-2 text-sm font-bold"
            >
              Matikan Kamera
            </button>
          )}
          {bisaFullscreen && (
            <button
              onClick={toggleFullscreen}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold"
            >
              {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
              {isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}
            </button>
          )}
          {!cameraOn && !cameraLoading && (
            <p className="mt-2 text-xs text-gray-400">
              Saat diminta browser, pilih Izinkan/Allow akses kamera. Arahkan kamera ke QR santri — otomatis tercatat.
            </p>
          )}
        </div>
      )}

      {riwayat.length > 0 && (
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-sm font-bold text-gray-500">Baru tercatat ({riwayat.length})</p>
          <div className="mt-2 max-h-48 space-y-1 overflow-auto">
            {riwayat.map((r, i) => (
              <div key={r.id} className={`flex justify-between rounded-lg px-3 py-2 text-sm ${i === 0 ? "animasi-scan-sorot" : "bg-gray-50"}`}>
                <span className="font-semibold">{r.nama}</span>
                <span className="text-gray-400">{r.waktu}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
