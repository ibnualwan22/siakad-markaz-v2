"use client";

import dynamic from "next/dynamic";
import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Expand, Loader2, Minimize, Pause, Play, Radio, Trophy, WifiOff } from "lucide-react";
import styles from "./election-display.module.css";
import { presentSession, receiveSession, type PresentationTimeline } from "./election-presentation";

const BallotScene = dynamic(() => import("./ballot-scene"), {
  ssr: false,
  loading: () => <div className={styles.sceneLoading}><Loader2 size={24} className={styles.spinner} /><span>Menyiapkan panggung</span></div>,
});

type Candidate = {
  id: string;
  nomorUrut: number;
  fotoUrl: string | null;
  santri1: { nama: string | null };
  santri2: { nama: string | null };
  _count: { suaraList: number };
};

type Election = {
  id: string;
  judul: string;
  dufahNama: string;
  status: "DRAFT" | "BUKA" | "TUTUP";
  dibukaAt: string | null;
  rencanaTutupAt: string | null;
  ditutupAt: string | null;
  serverNow: string;
  paslonList: Candidate[];
};

type Connection = "loading" | "live" | "retrying" | "unauthorized" | "missing";

function subscribeMotion(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function readMotionPreference() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const formatNumber = (value: number) => new Intl.NumberFormat("id-ID").format(value);

function formatCountdown(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((part) => String(part).padStart(2, "0")).join(":");
}

export default function ElectionDisplay({ sessionId }: { sessionId: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageSlotRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const updateRef = useRef<(() => void) | null>(null);
  const electionRef = useRef<Election | null>(null);
  const [election, setElection] = useState<Election | null>(null);
  const [timeline, setTimeline] = useState<PresentationTimeline | null>(null);
  const [showRecap, setShowRecap] = useState(false);
  const [connection, setConnection] = useState<Connection>("loading");
  const [serverOffset, setServerOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [page, setPage] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [notice, setNotice] = useState("");
  const [motionOverride, setMotionOverride] = useState<boolean | null>(null);
  const systemReducedMotion = useSyncExternalStore(subscribeMotion, readMotionPreference, () => true);
  const reducedMotion = motionOverride ?? systemReducedMotion;

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    let activeRequest: AbortController | null = null;
    let busy = false;
    let terminal = false;
    let pollDelay = 3_000;

    const update = async () => {
      if (disposed || busy || terminal) return;
      clearTimeout(timer);
      busy = true;
      const controller = new AbortController();
      activeRequest = controller;
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const requestedAt = Date.now();
      try {
        const response = await fetch(`/api/admin/pemilihan-lajnah/${encodeURIComponent(sessionId)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (disposed) return;
        if (response.status === 401 || response.status === 403) {
          terminal = true;
          setConnection("unauthorized");
          return;
        }
        if (response.status === 404) {
          terminal = true;
          setConnection("missing");
          return;
        }
        if (!response.ok) throw new Error("Data belum tersedia");
        const data: Election = await response.json();
        if (disposed) return;
        if (!Array.isArray(data.paslonList) || !["DRAFT", "BUKA", "TUTUP"].includes(data.status)) {
          throw new Error("Data sesi tidak lengkap");
        }
        const receivedAt = Date.now();
        const serverTime = Date.parse(data.serverNow);
        const offset = Number.isFinite(serverTime) ? serverTime - (requestedAt + receivedAt) / 2 : 0;
        setServerOffset(offset);
        setTimeline((previous) => receiveSession(previous, data, receivedAt, offset));
        const untilClose = data.rencanaTutupAt ? Date.parse(data.rencanaTutupAt) - receivedAt - offset : Infinity;
        pollDelay = data.status === "BUKA" && untilClose <= 10_000 ? 500 : 3_000;
        setElection(data);
        setLastUpdated(receivedAt);
        setNow(receivedAt);
        setConnection("live");
      } catch {
        if (!disposed) setConnection("retrying");
      } finally {
        clearTimeout(timeout);
        busy = false;
        activeRequest = null;
        if (!disposed && !terminal) timer = setTimeout(update, document.hidden ? 10_000 : pollDelay);
      }
    };

    updateRef.current = update;
    const onVisible = () => { if (!document.hidden) void update(); };
    const onOnline = () => { void update(); };
    // Same-browser admin actions wake the display immediately. The event carries
    // no result data; the screen always fetches the authenticated server result.
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("lajnah-election") : null;
    if (channel) channel.onmessage = (event) => { if (event.data?.sessionId === sessionId) void update(); };
    void update();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      disposed = true;
      updateRef.current = null;
      clearTimeout(timer);
      activeRequest?.abort();
      channel?.close();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [sessionId, refreshKey]);

  // Cerminkan election terbaru untuk handler SSE di bawah.
  useEffect(() => {
    electionRef.current = election;
  });

  // Realtime via SSE (stream admin): hitungan & bar diperbarui seketika tiap
  // ada suara masuk; perubahan status memicu muat ulang penuh. Polling 3 detik
  // di atas tetap berjalan sebagai fallback.
  useEffect(() => {
    let disposed = false;
    let source: EventSource | null = null;
    try {
      source = new EventSource("/api/admin/pemilihan-lajnah/" + encodeURIComponent(sessionId) + "/stream");
    } catch {
      return;
    }
    const es = source;
    es.onmessage = (event) => {
      if (disposed) return;
      let data: { status?: string; totalSuara?: number; suara?: Record<string, number>; serverNow?: string } | null;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!data || typeof data.totalSuara !== "number") return;
      const receivedAt = Date.now();
      const prev = electionRef.current;
      const statusBaru = typeof data.status === "string" ? data.status : null;
      if (prev && statusBaru && statusBaru !== prev.status) {
        // Status berubah (dibuka/ditutup): ambil data otoritatif penuh.
        const refresh = updateRef.current;
        if (refresh) refresh();
        return;
      }
      if (!prev) return;
      const suara = data.suara || {};
      let berubah = false;
      const paslonList = prev.paslonList.map((kandidat) => {
        const jumlah = typeof suara[kandidat.id] === "number" ? suara[kandidat.id] : kandidat._count.suaraList;
        if (jumlah === kandidat._count.suaraList) return kandidat;
        berubah = true;
        return { ...kandidat, _count: { suaraList: jumlah } };
      });
      if (!berubah) return;
      setElection({ ...prev, paslonList: paslonList, serverNow: typeof data.serverNow === "string" ? data.serverNow : prev.serverNow });
      setLastUpdated(receivedAt);
      setNow(receivedAt);
      setConnection("live");
    };
    // EventSource menyambung ulang otomatis bila putus; polling di atas tetap jadi fallback.
    return () => {
      disposed = true;
      es.close();
    };
  }, [sessionId]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 100);
    const onFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      clearInterval(timer);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, []);

  const candidates = election?.paslonList ?? [];
  const pageCount = Math.max(1, Math.ceil(candidates.length / 4));
  const activePage = Math.min(page, pageCount - 1);
  useEffect(() => {
    if (pageCount <= 1 || reducedMotion) return;
    const timer = setInterval(() => setPage((current) => (current + 1) % pageCount), 12_000);
    return () => clearInterval(timer);
  }, [pageCount, reducedMotion]);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await rootRef.current?.requestFullscreen();
      setNotice("");
    } catch {
      setNotice("Layar penuh belum tersedia. Gunakan tombol layar penuh browser.");
    }
  };

  const totalVotes = candidates.reduce((total, candidate) => total + candidate._count.suaraList, 0);
  const deadline = election?.rencanaTutupAt ? Date.parse(election.rencanaTutupAt) : null;
  const remaining = deadline === null ? null : Math.max(0, deadline - now - serverOffset);
  const awaitingClose = election?.status === "BUKA" && remaining === 0;
  const closed = election?.status === "TUTUP";
  const waiting = election?.status === "DRAFT";
  const phase = closed || awaitingClose ? "closed" : waiting ? "waiting" : "open";
  const stale = connection === "retrying" || (lastUpdated !== null && now - lastUpdated > 12_000);
  const winner = closed ? [...candidates].sort((a, b) => b._count.suaraList - a._count.suaraList || a.nomorUrut - b.nomorUrut)[0] : null;
  const shownCandidates = candidates.slice(activePage * 4, activePage * 4 + 4);
  const statusLabel = waiting ? "Menunggu pembukaan" : closed ? "Pemilihan ditutup" : awaitingClose ? "Waktu telah habis" : "Pemilihan berlangsung";

  const blocking = !election || connection === "unauthorized" || connection === "missing";
  const presentation = election ? presentSession(election, timeline, now, serverOffset) : null;
  const ceremony = !blocking && presentation?.mode !== "voting" && !(presentation?.mode === "result" && showRecap);
  const mode = presentation?.mode ?? "waiting";

  useLayoutEffect(() => {
    const slot = stageSlotRef.current;
    const stage = stageRef.current;
    if (!slot || !stage) return;
    const measure = () => {
      const bounds = slot.getBoundingClientRect();
      stage.style.setProperty("--panel-top", `${bounds.top}px`);
      stage.style.setProperty("--panel-left", `${bounds.left}px`);
      stage.style.setProperty("--panel-width", `${bounds.width}px`);
      stage.style.setProperty("--panel-height", `${bounds.height}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(slot);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, [blocking]);

  return (
    <div ref={rootRef} className={styles.screen} data-reduced-motion={reducedMotion} data-ceremony={ceremony} data-presentation={mode}>
      <header className={styles.header}>
        <div className={styles.identity}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/Logo%20Markaz.png" width={52} height={52} alt="Markaz Arabiyah" className={styles.logo} />
          <div>
            <p className={styles.eyebrow}>MARKAZ ARABIYAH <span>/</span> PEMILIHAN LAJNAH</p>
            <h1>{election?.judul ?? "Pemilihan Rois / Roisah Lajnah"}</h1>
          </div>
        </div>
        <nav className={styles.controls} aria-label="Kontrol layar acara">
          <a href="/admin/lajnah/pemilihan" title="Kembali ke admin" aria-label="Kembali ke admin"><ArrowLeft size={18} /></a>
          <button type="button" onClick={() => setMotionOverride(!reducedMotion)} title={reducedMotion ? "Aktifkan animasi" : "Kurangi gerakan"} aria-label={reducedMotion ? "Aktifkan animasi" : "Kurangi gerakan"} aria-pressed={reducedMotion}>{reducedMotion ? <Play size={17} /> : <Pause size={17} />}</button>
          <button type="button" onClick={toggleFullscreen} title={fullscreen ? "Keluar layar penuh" : "Layar penuh"} aria-label={fullscreen ? "Keluar layar penuh" : "Layar penuh"}>{fullscreen ? <Minimize size={18} /> : <Expand size={18} />}</button>
        </nav>
      </header>

      {blocking ? (
        <main className={styles.empty} aria-live="polite">
          {connection === "loading" ? <Loader2 className={styles.spinner} size={34} /> : <WifiOff size={34} />}
          <h2>{connection === "unauthorized" ? "Masuk kembali sebagai panitia" : connection === "missing" ? "Sesi pemilihan tidak ditemukan" : connection === "retrying" ? "Menghubungkan layar acara" : "Menyiapkan layar acara"}</h2>
          <p>{connection === "unauthorized" ? "Akses sesi telah berakhir atau akun tidak memiliki izin mengelola lajnah." : connection === "missing" ? "Sesi ini mungkin sudah dihapus. Pilih sesi dari halaman admin." : "Status pemilihan dan perolehan suara akan tampil di sini."}</p>
          {connection === "unauthorized" ? <a href="/login">Masuk ke akun panitia <ArrowRight size={16} /></a> : connection === "missing" ? <a href="/admin/lajnah/pemilihan">Pilih sesi pemilihan <ArrowRight size={16} /></a> : connection === "retrying" ? <button type="button" onClick={() => setRefreshKey((value) => value + 1)}>Coba hubungkan lagi</button> : null}
        </main>
      ) : (
        <main className={styles.main}>
          <div ref={stageSlotRef} className={styles.stageSlot}>
          <section ref={stageRef} className={styles.stage} data-expanded={ceremony} data-mode={mode} aria-label="Animasi kotak suara">
            <div className={styles.stageTop}>
              <span className={styles.stageLabel}><span className={styles.statusDot} data-active={!waiting && !closed && !awaitingClose} />{statusLabel}</span>
              <span className={styles.edition}>{election.dufahNama}</span>
            </div>
            <div className={styles.scene}><BallotScene key={election.id} phase={phase} totalVotes={totalVotes} reducedMotion={reducedMotion || stale} /></div>
            {ceremony && <>
              <div className={styles.ceremonyHeading}>
                <p>MARKAZ ARABIYAH <span>·</span> {election.dufahNama}</p>
                <h2>{election.judul}</h2>
              </div>
              {(mode === "waiting" || mode === "opening") && <div className={styles.openingCopy} key={mode} role="status">
                <span className={styles.ceremonyEyebrow}>{mode === "waiting" ? "SUARA ANDA, AMANAH BERSAMA" : "SATU SESI · SATU PILIHAN"}</span>
                <h3>{mode === "waiting" ? "Bersiap menentukan amanah." : "Pemilihan dibuka."}</h3>
                <p>{mode === "waiting" ? "Menunggu panitia membuka pemilihan." : "Silakan memilih melalui akun santri masing-masing."}</p>
                {mode === "waiting" && <span className={styles.waitingLine} aria-hidden="true" />}
              </div>}
              {mode === "opening" && <div className={styles.lightSweep} aria-hidden="true" />}
              {mode === "countdown" && <div className={styles.countdownCeremony} data-countdown={presentation?.seconds} role="status" aria-live="polite" aria-atomic="true">
                <p className={styles.ceremonyEyebrow}>{presentation?.manual ? "PEMILIHAN TELAH DITUTUP" : "PEMILIHAN SEGERA BERAKHIR"}</p>
                <div className={styles.countdownDial}>
                  <svg viewBox="0 0 240 240" aria-hidden="true"><circle cx="120" cy="120" r="112" /><circle cx="120" cy="120" r="112" pathLength="5" strokeDasharray={`${presentation?.seconds ?? 0} 5`} /></svg>
                  <strong key={presentation?.seconds}>{presentation?.seconds}</strong>
                </div>
                <h3>{presentation?.manual ? "Menuju pengumuman" : "Detik terakhir untuk memilih"}</h3>
                <p>{presentation?.manual ? "Suara sudah dikunci. Bersiap menyambut pasangan terpilih." : "Sampaikan pilihan Anda sebelum hitungan berakhir."}</p>
              </div>}
              {mode === "sealing" && <div className={styles.openingCopy} role="status">
                <span className={styles.ceremonyEyebrow}>PEMUNGUTAN SUARA BERAKHIR</span>
                <h3>Setiap suara telah berarti.</h3>
                <p>{stale ? "Menghubungkan kembali untuk memastikan hasil akhir." : "Menyiapkan hasil akhir pemilihan…"}</p>
              </div>}
              {mode === "result" && <div className={styles.resultCeremony} data-long-names={(winner?.santri1.nama?.length ?? 0) + (winner?.santri2.nama?.length ?? 0) > 70} role="status" aria-label="Pengumuman pasangan terpilih">
                {presentation?.celebrate && !reducedMotion && <div className={styles.confetti} aria-hidden="true">{Array.from({ length: 36 }, (_, i) => <i key={i} style={{ "--x": `${(i * 29 + 7) % 100}%`, "--delay": `${(i % 9) * 0.11}s`, "--drift": `${((i % 5) - 2) * 45}px`, "--turn": `${(i % 2 ? 1 : -1) * (270 + i * 20)}deg` } as CSSProperties} />)}</div>}
                {winner ? <>
                  <div className={styles.winnerPortrait}>
                    <div className={styles.portraitHalo} aria-hidden="true" />
                    <WinnerPhoto key={winner.fotoUrl} src={winner.fotoUrl} number={winner.nomorUrut} />
                    <span className={styles.winnerSeal}><Trophy size={20} /> PASLON {String(winner.nomorUrut).padStart(2, "0")}</span>
                  </div>
                  <div className={styles.winnerAnnouncement}>
                    <p className={styles.ceremonyEyebrow}>PASANGAN TERPILIH</p>
                    <h3>{winner.santri1.nama ?? "—"}<span>&</span>{winner.santri2.nama ?? "—"}</h3>
                    <p className={styles.winnerMessage}>Selamat mengemban amanah.<br />Bersama, membawa kebaikan untuk lajnah.</p>
                    <div className={styles.winnerStats}><strong>{formatNumber(winner._count.suaraList)} <span>suara</span></strong><span>{(totalVotes ? winner._count.suaraList / totalVotes * 100 : 0).toLocaleString("id-ID", { maximumFractionDigits: 1 })}% dari {formatNumber(totalVotes)} suara masuk</span></div>
                    <button type="button" onClick={() => setShowRecap(true)} className={styles.recapButton}>Lihat rekap suara <ArrowRight size={16} /></button>
                  </div>
                </> : <div className={styles.noWinner}><Check size={44} /><h3>Pemilihan telah selesai.</h3><p>Belum ada pasangan calon yang dapat ditetapkan.</p><button type="button" onClick={() => setShowRecap(true)} className={styles.recapButton}>Lihat rekap suara <ArrowRight size={16} /></button></div>}
              </div>}
              <div className={styles.ceremonyFooter}><span>{mode === "result" ? "TERIMA KASIH ATAS SETIAP SUARA DAN KEPERCAYAAN" : "ROIS / ROISAH LAJNAH"}</span><span>{stale ? <><WifiOff size={14} /> Menghubungkan kembali</> : <><Radio size={13} /> {closed ? "Hasil akhir terkonfirmasi" : "Terhubung"}</>}</span></div>
            </>}
            <div className={styles.stageBottom} aria-hidden={ceremony}>
              <div className={styles.stageCopy}>
                <p className={styles.stageEyebrow}>{waiting ? "SUARA ANDA, AMANAH BERSAMA" : closed ? "TERIMA KASIH ATAS PARTISIPASINYA" : awaitingClose ? "PEMUNGUTAN SUARA BERAKHIR" : "SUARA ANDA, AMANAH BERSAMA"}</p>
                <h2>{waiting ? "Siap untuk dimulai." : closed ? "Amanah telah ditentukan." : awaitingClose ? "Menyelesaikan hasil." : "Setiap suara berarti."}</h2>
                <p>{waiting ? "Menunggu panitia membuka pemilihan." : closed ? "Seluruh suara telah dihitung." : awaitingClose ? "Menunggu konfirmasi penutupan dari server." : "Pilih pasangan calon melalui akun santri masing-masing."}</p>
                {closed && !ceremony && <button className={styles.recapButton} type="button" onClick={() => setShowRecap(false)}>Tampilkan pasangan terpilih <ArrowRight size={14} /></button>}
              </div>
              <div className={styles.total} aria-label={`${totalVotes} suara masuk`}>
                <span key={totalVotes} className={styles.totalNumber}>{formatNumber(totalVotes)}</span>
                <span>suara masuk</span>
              </div>
            </div>
          </section>
          </div>

          <section className={styles.results} aria-labelledby="hasil-title" inert={ceremony} aria-hidden={ceremony}>
            <div className={styles.resultsHeading}>
              <div><p className={styles.eyebrow}>{closed ? "HASIL AKHIR" : "SATU SESI · SATU PILIHAN"}</p><h2 id="hasil-title">Perolehan suara</h2></div>
              <div className={styles.countdown} data-urgent={!closed && !waiting && remaining !== null && remaining < 60_000}>
                <span>{closed ? "SESI SELESAI" : waiting ? "STATUS SESI" : remaining !== null ? "WAKTU TERSISA" : "STATUS SESI"}</span>
                <strong>{closed ? <><Check size={20} /> Ditutup</> : waiting ? "Belum dibuka" : remaining !== null ? formatCountdown(remaining) : "Dibuka"}</strong>
              </div>
            </div>

            {winner && (
              <div className={styles.winner} role="status">
                <div className={styles.winnerIcon}><Trophy size={24} /></div>
                <div><p>PASANGAN TERPILIH · {String(winner.nomorUrut).padStart(2, "0")}</p><strong>{winner.santri1.nama ?? "—"} <span>&</span> {winner.santri2.nama ?? "—"}</strong></div>
              </div>
            )}

            <div className={styles.candidates}>
              {shownCandidates.length === 0 ? <div className={styles.noCandidates}>Pasangan calon akan tampil setelah didaftarkan panitia.</div> : shownCandidates.map((candidate) => {
                const count = candidate._count.suaraList;
                const percentage = totalVotes > 0 ? count / totalVotes * 100 : 0;
                const isWinner = winner?.id === candidate.id;
                return (
                  <article key={candidate.id} className={styles.candidate} data-winner={isWinner}>
                    <div className={styles.candidateTop}>
                      <span className={styles.candidateNumber}>{String(candidate.nomorUrut).padStart(2, "0")}</span>
                      {candidate.fotoUrl && <CandidatePhoto key={candidate.fotoUrl} src={candidate.fotoUrl} number={candidate.nomorUrut} />}
                      <div className={styles.candidateNames}><p>PASANGAN CALON {candidate.nomorUrut}</p><h3>{candidate.santri1.nama ?? "—"}</h3><span>{candidate.santri2.nama ?? "—"}</span></div>
                      <div className={styles.candidateVotes}><strong>{formatNumber(count)}</strong><span>suara</span></div>
                    </div>
                    <div className={styles.candidateBottom}>
                      <div className={styles.track} role="meter" aria-label={`Persentase suara pasangan ${candidate.nomorUrut}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percentage)}><div style={{ width: `${percentage}%` }} /></div>
                      <span>{percentage.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%</span>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className={styles.resultsFoot}>
              <p>{waiting ? "Hasil akan diperbarui setelah pemilihan dibuka." : closed ? `${formatNumber(totalVotes)} suara tercatat dalam sesi ini.` : "Diperbarui otomatis selama pemilihan."}</p>
              {pageCount > 1 && <div className={styles.pagination}><button type="button" aria-label="Pasangan sebelumnya" onClick={() => setPage((activePage + pageCount - 1) % pageCount)}><ChevronLeft size={17} /></button><span>{activePage + 1} / {pageCount}</span><button type="button" aria-label="Pasangan berikutnya" onClick={() => setPage((activePage + 1) % pageCount)}><ChevronRight size={17} /></button></div>}
            </div>
          </section>
        </main>
      )}

      <footer className={styles.footer}>
        <span className={styles.footerBrand}>ROIS / ROISAH LAJNAH <span>·</span> MARKAZ ARABIYAH</span>
        <div role="status" className={styles.connection} data-stale={stale}>
          {notice ? notice : stale ? <><WifiOff size={14} /> Menghubungkan kembali · menampilkan data terakhir</> : connection === "live" ? <><Radio size={14} /> Terhubung · {lastUpdated !== null && new Date(lastUpdated + serverOffset).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Jakarta" })} WIB</> : "Layar acara pemilihan"}
        </div>
      </footer>
    </div>
  );
}

function CandidatePhoto({ src, number }: { src: string; number: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={`Pasangan calon ${number}`} className={styles.candidatePhoto} onError={() => setFailed(true)} />;
}

function WinnerPhoto({ src, number }: { src: string | null; number: number }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <div className={styles.portraitPlaceholder}><Trophy size={56} strokeWidth={1} /><span>PASANGAN CALON</span><strong>{String(number).padStart(2, "0")}</strong></div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={`Pasangan terpilih nomor ${number}`} className={styles.portraitImage} onError={() => setFailed(true)} />;
}
