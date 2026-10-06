"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Keyboard, CheckCircle2, AlertTriangle, XCircle, LogOut, Play } from "lucide-react";

type Kategori = { id: string; nama: string };
type Sesi = {
  id: string;
  kode: string;
  kategori: { nama: string };
  dibukaPada: string;
  ditutupPada: string;
  hadirCount?: number;
};
type Hasil = { tipe: "TERCATAT" | "SUDAH_TERCATAT" | "DITOLAK"; nama?: string; sakan?: string; kelasNama?: string | null; alasan?: string };
type Preview = {
  hadir: number;
  totalAktif: number;
  belumTercatat: { riwayatId: string; nama: string; sakan: string; kelasNama: string | null; usul: string }[];
};

function beep(freq: number, ms = 160) {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
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
  } catch {
    /* abaikan */
  }
}

// Bunyi sukses ala scanner kasir: nyaring, pendek, nembus suara ramai
function beepKasir() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
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
  } catch {
    /* abaikan */
  }
}

export function ScanAbsenClient({ kategoriList }: { kategoriList: Kategori[] }) {
  const [kategoriId, setKategoriId] = useState("");
  const [durasiMenit, setDurasiMenit] = useState(60);
  const [sesiList, setSesiList] = useState<Sesi[]>([]);
  const [sesiAktif, setSesiAktif] = useState<Sesi | null>(null);
  const [mode, setMode] = useState<"scanner" | "kamera">("scanner");
  const [scanValue, setScanValue] = useState("");
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [riwayat, setRiwayat] = useState<{ nama: string; tipe: Hasil["tipe"]; waktu: string }[]>([]);
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
  const [notif, setNotif] = useState<{ tipe: "TERCATAT" | "SUDAH_TERCATAT"; nama: string; sakan?: string; kelasNama?: string | null } | null>(null);
  const notifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tampilkanNotif = useCallback((n: { tipe: "TERCATAT" | "SUDAH_TERCATAT"; nama: string; sakan?: string; kelasNama?: string | null }) => {
    setNotif(n);
    if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
    notifTimerRef.current = setTimeout(() => setNotif(null), 5000);
  }, []);

  const inputRef = useRef<HTMLInputElement>(null);
  const qrRef = useRef<any>(null);
  const lastScanRef = useRef<{ payload: string; at: number }>({ payload: "", at: 0 });
  const submittingRef = useRef(false);

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
    if (mode === "scanner") setTimeout(() => inputRef.current?.focus(), 80);
  }, [mode]);

  useEffect(() => {
    fokusInput();
  }, [fokusInput, sesiAktif]);

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
    return () => {
      stopCamera();
      if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
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
    } catch (e) {
      setHasil({ tipe: "DITOLAK", alasan: "Kamera tidak bisa diakses. Ketuk ikon gembok di address bar lalu izinkan kamera, dan pastikan situs dibuka via HTTPS." });
    } finally {
      setCameraLoading(false);
    }
  };

  const submitScan = useCallback(
    async (payload: string) => {
      const p = payload.trim();
      if (!p || !sesiAktif || submittingRef.current) return;
      // Abaikan scan ganda dari kamera dalam 3 detik
      const now = Date.now();
      if (lastScanRef.current.payload === p && now - lastScanRef.current.at < 3000) return;
      lastScanRef.current = { payload: p, at: now };
      submittingRef.current = true;
      setScanValue("");
      try {
        const res = await fetch("/api/admin/absensi/kegiatan/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sesiId: sesiAktif.id, payload: p }),
        });
        const data = await res.json();
        if (!data.hasil) {
          setHasil({ tipe: "DITOLAK", alasan: "Sesi login berakhir / tidak punya akses" });
          beep(220, 300);
          return;
        }
        const h: Hasil = { tipe: data.hasil, nama: data.namaSantri, sakan: data.sakan, kelasNama: data.kelasNama, alasan: data.alasan };
        setHasil(h);
        if (h.tipe === "TERCATAT") {
          beepKasir();
          if (h.nama) {
            tampilkanNotif({ tipe: "TERCATAT", nama: h.nama, sakan: h.sakan, kelasNama: h.kelasNama });
          }
          setCount((c) => c + 1);
          if (h.nama) {
            setRiwayat((r) => [{ nama: h.nama!, tipe: h.tipe, waktu: new Date().toLocaleTimeString("id-ID") }, ...r].slice(0, 30));
          }
        } else if (h.tipe === "SUDAH_TERCATAT") {
          beep(440);
          if (h.nama) {
            tampilkanNotif({ tipe: "SUDAH_TERCATAT", nama: h.nama, sakan: h.sakan, kelasNama: h.kelasNama });
            try { navigator.vibrate?.([120, 60, 120]); } catch { /* abaikan */ }
          }
        } else {
          beep(220, 300);
          setNotif(null);
        }
      } catch {
        setHasil({ tipe: "DITOLAK", alasan: "Gangguan jaringan" });
        beep(220, 300);
      } finally {
        submittingRef.current = false;
        fokusInput();
      }
    },
    [sesiAktif, fokusInput, tampilkanNotif]
  );

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
    setPreview(null);
    setSelesai(null);
  };

  const tutupSesi = async () => {
    if (!sesiAktif) return;
    if (mode === "kamera") await stopCamera();
    setBusy(true);
    try {
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
      }
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
    setMode(m);
  };

  const hasilWarna =
    hasil?.tipe === "TERCATAT"
      ? "border-green-500 bg-green-50"
      : hasil?.tipe === "SUDAH_TERCATAT"
        ? "border-yellow-500 bg-yellow-50"
        : "border-red-500 bg-red-50";

  // ---- Tampilan: belum ada sesi aktif ----
  if (!sesiAktif && !preview && !selesai) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
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

        {sesiList.length > 0 && (
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
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between rounded-2xl border bg-white p-4">
        <div>
          <p className="text-xs text-gray-500">Sesi aktif</p>
          <p className="text-lg font-black">{sesiAktif.kategori.nama}</p>
          <p className="text-xs text-gray-500">
            Berakhir {new Date(sesiAktif.ditutupPada).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
            {" "}• {count} tercatat di jalur ini
          </p>
        </div>
        <button
          onClick={tutupSesi}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
        >
          <LogOut size={16} /> Tutup Sesi
        </button>
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

      {notif && (
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${notif.tipe === "TERCATAT" ? "border-green-500 bg-green-100" : "border-amber-400 bg-amber-100"}`}>
          {notif.tipe === "TERCATAT"
            ? <CheckCircle2 size={20} className="shrink-0 text-green-600" />
            : <AlertTriangle size={20} className="shrink-0 text-amber-600" />}
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-black ${notif.tipe === "TERCATAT" ? "text-green-900" : "text-amber-900"}`}>
              {notif.tipe === "TERCATAT" ? "TERCATAT" : "SUDAH DIABSEN"} — {notif.nama}
            </p>
            {(notif.sakan || notif.kelasNama) && (
              <p className={`text-xs ${notif.tipe === "TERCATAT" ? "text-green-700" : "text-amber-700"}`}>
                {[notif.sakan, notif.kelasNama].filter(Boolean).join(" • ")}
              </p>
            )}
          </div>
          <button
            onClick={() => setNotif(null)}
            className={`shrink-0 px-1 text-lg font-bold leading-none ${notif.tipe === "TERCATAT" ? "text-green-700" : "text-amber-700"}`}
            aria-label="Tutup notifikasi"
          >
            ×
          </button>
        </div>
      )}

      {mode === "scanner" ? (
        <div className="rounded-2xl border bg-white p-6">
          <label className="text-sm font-semibold">Arahkan scanner ke QR santri</label>
          <input
            ref={inputRef}
            value={scanValue}
            onChange={(e) => setScanValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitScan(scanValue); }}
            onBlur={fokusInput}
            placeholder="Hasil scan akan muncul di sini..."
            autoComplete="off"
            className="mt-2 w-full rounded-xl border-2 px-4 py-3 text-lg"
          />
          <p className="mt-2 text-xs text-gray-400">Kolom ini selalu fokus — cukup scan, tanpa perlu mengetuk layar.</p>
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
          {!cameraOn && !cameraLoading && (
            <p className="mt-2 text-xs text-gray-400">
              Saat diminta browser, pilih Izinkan/Allow akses kamera. Arahkan kamera ke QR santri — otomatis tercatat.
            </p>
          )}
        </div>
      )}

      {hasil && hasil.tipe !== "SUDAH_TERCATAT" && (
        <div className={`rounded-2xl border-2 p-6 text-center ${hasilWarna}`}>
          {hasil.tipe === "TERCATAT" && <CheckCircle2 size={40} className="mx-auto text-green-600" />}
          {hasil.tipe === "SUDAH_TERCATAT" && <AlertTriangle size={40} className="mx-auto text-yellow-600" />}
          {hasil.tipe === "DITOLAK" && <XCircle size={40} className="mx-auto text-red-600" />}
          <p className="mt-2 text-2xl font-black">{hasil.nama || hasil.tipe.replace(/_/g, " ")}</p>
          {hasil.alasan && <p className="mt-1 text-sm opacity-80">{hasil.alasan}</p>}
        </div>
      )}

      {riwayat.length > 0 && (
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-sm font-bold text-gray-500">Baru tercatat ({riwayat.length})</p>
          <div className="mt-2 max-h-48 space-y-1 overflow-auto">
            {riwayat.map((r, i) => (
              <div key={i} className="flex justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
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
