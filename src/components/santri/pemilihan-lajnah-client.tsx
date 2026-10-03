"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Timer, Users, CheckCircle2, Trophy, ChevronDown, Sparkles } from "lucide-react";
import toast from "react-hot-toast";

type Paslon = {
  id: string;
  nomorUrut: number;
  fotoUrl: string | null;
  visiMisi: string | null;
  santri1: { id: string; nama: string };
  santri2: { id: string; nama: string };
  suara: number;
};

type Sesi = {
  id: string;
  judul: string;
  status: "DRAFT" | "BUKA" | "TUTUP";
  rencanaTutupAt: string | null;
};

type DataPemilihan = {
  sesi: Sesi | null;
  paslon?: Paslon[];
  totalSuara?: number;
  sudahMemilih?: boolean;
  pilihanSaya?: string | null;
  bolehMemilih?: boolean;
  serverNow?: string;
  error?: string;
};

type UpdatePemilihan = {
  status?: Sesi["status"];
  rencanaTutupAt?: string | null;
  totalSuara?: number;
  suara?: Record<string, number>;
  serverNow?: string;
};

// ---------- confetti mini (tanpa library) ----------
function fireConfetti() {
  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "9999";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const colors = ["#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#a855f7", "#ffffff"];
  const parts = Array.from({ length: 130 }, () => ({
    x: window.innerWidth / 2 + (Math.random() - 0.5) * 120,
    y: window.innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 11,
    vy: Math.random() * -9 - 3,
    s: Math.random() * 7 + 4,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    c: colors[Math.floor(Math.random() * colors.length)],
  }));
  let frames = 0;
  const tick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.28; p.r += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
      ctx.restore();
    }
    if (++frames < 110) requestAnimationFrame(tick);
    else canvas.remove();
  };
  tick();
}

// ---------- partikel ambient ----------
function AmbientParticles() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const dots = Array.from({ length: 28 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 2.4 + 1,
      vy: -(Math.random() * 0.35 + 0.1),
      vx: (Math.random() - 0.5) * 0.2,
      a: Math.random() * 0.25 + 0.08,
    }));
    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const d of dots) {
        d.x += d.vx; d.y += d.vy;
        if (d.y < -5) { d.y = canvas.height + 5; d.x = Math.random() * canvas.width; }
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(16,185,129,${d.a})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }} />;
}

// ---------- angka count-up ----------
function CountUp({ value }: { value: number }) {
  const [disp, setDisp] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    const to = value;
    prev.current = value;
    if (from === to) return;
    const t0 = performance.now();
    const dur = 700;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      setDisp(Math.round(from + (to - from) * e));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{disp}</>;
}

// ---------- countdown ----------
function useCountdown(iso: string | null, serverOffset: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);
  return iso ? Math.max(0, new Date(iso).getTime() - now - serverOffset) : null;
}

function formatSisa(ms: number) {
  const s = Math.floor(ms / 1000);
  const j = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const d = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return j > 0 ? `${j}:${pad(m)}:${pad(d)}` : `${pad(m)}:${pad(d)}`;
}

export function PemilihanLajnahClient() {
  const [loading, setLoading] = useState(true);
  const [sesi, setSesi] = useState<Sesi | null>(null);
  const [paslon, setPaslon] = useState<Paslon[]>([]);
  const [totalSuara, setTotalSuara] = useState(0);
  const [sudahMemilih, setSudahMemilih] = useState(false);
  const [pilihanSaya, setPilihanSaya] = useState<string | null>(null);
  const [bolehMemilih, setBolehMemilih] = useState(false);
  const [confirm, setConfirm] = useState<Paslon | null>(null);
  const [voting, setVoting] = useState(false);
  const [bukaVisi, setBukaVisi] = useState<string | null>(null);
  const [serverOffset, setServerOffset] = useState(0);
  const statusRef = useRef<string>("");
  const sesiRef = useRef<string | null>(null);
  const requestRef = useRef(0);
  const activeLoadRef = useRef<Promise<void> | null>(null);
  const queuedRefreshRef = useRef(false);

  const muat = useCallback(async (silent = true) => {
    if (activeLoadRef.current) {
      queuedRefreshRef.current = true;
      await activeLoadRef.current;
      return;
    }

    const request = ++requestRef.current;
    const load = (async () => {
      try {
        const res = await fetch("/api/santri/pemilihan-lajnah", { cache: "no-store" });
        const j: DataPemilihan = await res.json();
        if (!res.ok) throw new Error(j.error || "Gagal memuat data pemilihan");
        if (request !== requestRef.current) return;
        if (j.serverNow && Number.isFinite(Date.parse(j.serverNow))) {
          setServerOffset(Date.parse(j.serverNow) - Date.now());
        }
        if (sesiRef.current !== j.sesi?.id || j.sesi?.status !== "BUKA" || !j.bolehMemilih || j.sudahMemilih) {
          setConfirm(null);
        }
        sesiRef.current = j.sesi?.id || null;
        if (j.sesi) {
          setSesi(j.sesi);
          statusRef.current = j.sesi.status;
          setPaslon(j.paslon || []);
          setTotalSuara(j.totalSuara || 0);
          setSudahMemilih(!!j.sudahMemilih);
          setPilihanSaya(j.pilihanSaya || null);
          setBolehMemilih(!!j.bolehMemilih);
        } else {
          setSesi(null);
          setPaslon([]);
          setTotalSuara(0);
          setSudahMemilih(false);
          setPilihanSaya(null);
          setBolehMemilih(false);
          statusRef.current = "";
        }
      } catch {
        if (!silent && request === requestRef.current) toast.error("Gagal memuat data pemilihan");
      } finally {
        if (request === requestRef.current) setLoading(false);
      }
    })();
    activeLoadRef.current = load;
    try {
      await load;
    } finally {
      if (activeLoadRef.current === load) {
        activeLoadRef.current = null;
        if (queuedRefreshRef.current) {
          queuedRefreshRef.current = false;
          queueMicrotask(() => { void muat(); });
        }
      }
    }
  }, []);

  // Polling longgar (30 dtk) sebagai jaring pengaman SSE; juga menemukan sesi baru.
  useEffect(() => {
    void muat(false);
    const interval = setInterval(() => { void muat(); }, 30000); // fallback longgar: SSE yang utama
    const onVisible = () => {
      if (document.visibilityState === "visible") void muat();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      requestRef.current += 1;
    };
  }, [muat]);

  // Realtime via SSE
  useEffect(() => {
    if (!sesi?.id) return;
    const sesiId = sesi.id;
    const es = new EventSource(`/api/santri/pemilihan-lajnah/stream?sesiId=${encodeURIComponent(sesiId)}`);
    es.onmessage = (ev) => {
      try {
        if (sesiRef.current !== sesiId) return;
        const d: UpdatePemilihan = JSON.parse(ev.data);
        if (typeof d.totalSuara === "number") setTotalSuara(d.totalSuara);
        setPaslon((prev) => prev.map((p) => ({ ...p, suara: d.suara?.[p.id] ?? p.suara })));
        if (d.serverNow && Number.isFinite(Date.parse(d.serverNow))) {
          setServerOffset(Date.parse(d.serverNow) - Date.now());
        }
        setSesi((prev) => prev?.id === sesiId ? {
          ...prev,
          status: d.status ?? prev.status,
          rencanaTutupAt: d.rencanaTutupAt === undefined ? prev.rencanaTutupAt : d.rencanaTutupAt,
        } : prev);
        if (d.status && d.status !== "BUKA") setConfirm(null);
        if (d.status && d.status !== statusRef.current) {
          statusRef.current = d.status;
          void muat(); // status berubah (dibuka/ditutup) → muat ulang penuh
        }
      } catch { /* abaikan */ }
    };
    // EventSource reconnects after transient failures; the polling above remains a fallback.
    return () => es.close();
  }, [sesi?.id, muat]);

  const sisa = useCountdown(sesi?.status === "BUKA" ? sesi.rencanaTutupAt : null, serverOffset);
  const waktuHabis = sisa === 0;
  const dapatMemilih = sesi?.status === "BUKA" && !waktuHabis && bolehMemilih && !sudahMemilih;
  const mendesak = sisa != null && sisa < 10 * 60 * 1000;

  const vote = async () => {
    if (!confirm || !sesi || voting) return;
    if (!dapatMemilih || (sesi.rencanaTutupAt && Date.parse(sesi.rencanaTutupAt) <= Date.now() + serverOffset)) {
      setConfirm(null);
      toast.error("Pemilihan sudah ditutup");
      void muat();
      return;
    }
    setVoting(true);
    try {
      const res = await fetch("/api/santri/pemilihan-lajnah/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sesiId: sesi.id, paslonId: confirm.id }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Gagal memilih");
      setSudahMemilih(true);
      setPilihanSaya(confirm.id);
      setConfirm(null);
      fireConfetti();
      toast.success("Suara kamu sudah tercatat!");
      await muat();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal memilih");
      await muat();
    } finally {
      setVoting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-700" />
      </div>
    );
  }

  if (!sesi) {
    return (
      <div className="p-6 max-w-md mx-auto text-center py-20 text-gray-500">
        <Sparkles className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p className="font-semibold">Belum ada pemilihan</p>
        <p className="text-sm">Saat ini tidak ada sesi pemilihan rois lajnah yang dibuka.</p>
      </div>
    );
  }

  const maxSuara = Math.max(1, ...paslon.map((p) => p.suara));
  const pemenang = sesi.status === "TUTUP" && paslon.length > 0
    ? [...paslon].sort((a, b) => b.suara - a.suara || a.nomorUrut - b.nomorUrut)[0]
    : null;

  return (
    <div className="relative min-h-screen">
      <AmbientParticles />
      <div className="relative p-4 max-w-2xl mx-auto" style={{ zIndex: 1 }}>
        {/* Header */}
        <div className="text-center mb-4">
          <p className="text-xs font-semibold tracking-widest text-emerald-700 uppercase">Pemilihan Rois Lajnah</p>
          <h1 className="text-xl font-bold mt-1">{sesi.judul}</h1>
          <div className="flex items-center justify-center gap-3 mt-2 text-sm">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${sesi.status === "BUKA" && !waktuHabis ? "bg-emerald-100 text-emerald-800" : "bg-gray-200 text-gray-700"}`}>
              {waktuHabis ? "WAKTU HABIS" : sesi.status === "BUKA" ? "SEDANG DIBUKA" : "DITUTUP"}
            </span>
            <span key={totalSuara} className="inline-flex items-center gap-1 text-gray-600 animate-pulse">
              <Users className="w-4 h-4" /> <CountUp value={totalSuara} /> suara
            </span>
          </div>
          {sesi.status === "BUKA" && sisa != null && (
            <div className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${mendesak ? "bg-red-100 text-red-700 animate-pulse" : "bg-amber-50 text-amber-800"}`}>
              <Timer className="w-4 h-4" /> {formatSisa(sisa)}
            </div>
          )}
        </div>

        {/* Banner pemenang */}
        {pemenang && (
          <div className="mb-4 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 p-4 text-center shadow-lg">
            <Trophy className="w-10 h-10 mx-auto text-white drop-shadow" />
            <p className="text-white/90 text-xs font-semibold mt-1 uppercase tracking-widest">Pemenang</p>
            <p className="text-white text-lg font-bold">Paslon {pemenang.nomorUrut}</p>
            <p className="text-white text-sm">{pemenang.santri1.nama} & {pemenang.santri2.nama}</p>
          </div>
        )}

        {/* Banner sudah memilih */}
        {sudahMemilih && sesi.status === "BUKA" && (
          <div className="mb-4 rounded-2xl bg-emerald-50 border border-emerald-200 p-3 flex items-center gap-2 text-emerald-800 text-sm">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>Suara kamu sudah tercatat. Terima kasih telah berpartisipasi!</span>
          </div>
        )}

        {/* Kartu paslon */}
        <div className="grid gap-3">
          {paslon.map((p) => {
            const persen = Math.round((p.suara / maxSuara) * 100);
            const milikSaya = pilihanSaya === p.id;
            return (
              <div
                key={p.id}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${milikSaya ? "border-emerald-500 ring-2 ring-emerald-200" : "border-gray-200"}`}
              >
                <div className="p-4 flex gap-3">
                  <div className="shrink-0">
                    {p.fotoUrl ? (
                      <img src={p.fotoUrl} alt={`Paslon ${p.nomorUrut}`} className="w-16 h-16 rounded-xl object-cover" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center text-white text-2xl font-bold">
                        {p.nomorUrut}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-emerald-700">PASLON {p.nomorUrut}</p>
                    <p className="font-semibold text-[15px] leading-tight">{p.santri1.nama}</p>
                    <p className="text-sm text-gray-600 leading-tight">{p.santri2.nama}</p>
                    {p.visiMisi && (
                      <button
                        onClick={() => setBukaVisi(bukaVisi === p.id ? null : p.id)}
                        className="text-xs text-blue-600 mt-1 inline-flex items-center gap-0.5"
                      >
                        Visi & Misi <ChevronDown className={`w-3 h-3 transition-transform ${bukaVisi === p.id ? "rotate-180" : ""}`} />
                      </button>
                    )}
                  </div>
                  {dapatMemilih && (
                    <div className="shrink-0 self-center">
                      <button
                        onClick={() => setConfirm(p)}
                        className="bg-emerald-700 hover:bg-emerald-800 active:scale-95 transition text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow"
                      >
                        Pilih
                      </button>
                    </div>
                  )}
                  {milikSaya && (
                    <div className="shrink-0 self-center">
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Pilihanmu
                      </span>
                    </div>
                  )}
                </div>
                {bukaVisi === p.id && p.visiMisi && (
                  <div className="px-4 pb-3 text-sm text-gray-700 bg-gray-50 border-t border-gray-100 pt-2 whitespace-pre-wrap">
                    {p.visiMisi}
                  </div>
                )}
                {/* Bar perolehan suara */}
                <div className="px-4 pb-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Perolehan suara</span>
                    <span className="font-bold text-gray-700"><CountUp value={p.suara} /></span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${milikSaya ? "bg-emerald-600" : "bg-emerald-400"}`}
                      style={{ width: `${persen}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Satu santri satu suara • Hasil diperbarui otomatis
        </p>
      </div>

      {/* Dialog konfirmasi */}
      {confirm && dapatMemilih && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setConfirm(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-lg mb-1">Konfirmasi Pilihan</h2>
            <p className="text-sm text-gray-600 mb-1">
              Kamu memilih <b>Paslon {confirm.nomorUrut}</b>:
            </p>
            <p className="text-sm font-semibold">{confirm.santri1.nama}</p>
            <p className="text-sm text-gray-600 mb-3">{confirm.santri2.nama}</p>
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2 mb-4">
              Pilihan tidak bisa diubah setelah dikirim.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirm(null)}
                className="flex-1 py-2.5 rounded-xl border text-sm font-medium"
              >
                Batal
              </button>
              <button
                onClick={vote}
                disabled={voting}
                className="flex-1 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-sm font-bold"
              >
                {voting ? "Mengirim..." : "Ya, Pilih!"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
