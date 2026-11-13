"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowUp, Footprints, List, MapPin, RotateCcw, TriangleAlert, X } from "lucide-react";
import { EXPLORE_RADIUS, toLocal, type ExploreArea } from "@/lib/markaz-explore";
import { createExploreScene, type ExploreController, type ExploreLocation, type ExploreStatus } from "./markaz-explore-scene";
import { parseScene, type SceneAsset, type SceneDocument } from "@/lib/denah-scene";
import styles from "./markaz-explore.module.css";

export type Denah3DItem = ExploreLocation;

export default function DenahLokasi3D({ destinations, paused, onSelect, onShowList, onExit, preview }: {
  destinations: ExploreLocation[];
  paused: boolean;
  onSelect: (id: string) => void;
  onShowList: () => void;
  onExit: () => void;
  preview?: { scene: SceneDocument; assets: SceneAsset[] };
}) {
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<ExploreController | null>(null);
  const latest = useRef({ destinations, paused });
  const [area, setArea] = useState<ExploreArea | null>(null);
  const [status, setStatus] = useState<ExploreStatus | null>(null);
  const [error, setError] = useState("");
  const [assetError, setAssetError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [running, setRunning] = useState(false);
  const [help, setHelp] = useState(true);
  const [stick, setStick] = useState({ x: 0, y: 0 });
  const joystick = useRef<{ id: number; x: number; y: number } | null>(null);

  useEffect(() => {
    latest.current.destinations = destinations;
    controller.current?.locations(destinations);
  }, [destinations]);

  useEffect(() => {
    latest.current.paused = paused;
    controller.current?.pause(paused);
    // A modal or lost focus must never leave a held joystick moving the character.
    if (paused) joystick.current = null;
  }, [paused]);

  useEffect(() => {
    const abort = new AbortController();
    let scene: ExploreController | null = null;
    let cancelled = false;
    const timeout = window.setTimeout(() => abort.abort(), 15000);
    async function init() {
      try {
        const [response, saved] = await Promise.all([
          fetch("/maps/markaz-area.json", { signal: abort.signal }),
          preview ? Promise.resolve(null) : fetch("/api/santri/denah-lokasi/scene", { signal: abort.signal }),
        ]);
        if (saved && !saved.ok) throw new Error("Data kawasan belum bisa dimuat. Periksa koneksi dan sesi login, lalu coba lagi.");
        const published: { scene: SceneDocument; assets: SceneAsset[] } = preview ?? await saved!.json();
        const layout = parseScene(published.scene);
        if (!response.ok) throw new Error("Data jalan belum berhasil dimuat. Periksa koneksi lalu coba lagi.");
        const data: ExploreArea = await response.json();
        clearTimeout(timeout);
        if (!data.roads?.length || !Array.isArray(data.buildings)) throw new Error("Data kawasan belum tersedia.");
        if (cancelled || !host.current) return;
        setArea(data);
        scene = createExploreScene(host.current, data, setStatus, () => {
          setError("Tampilan 3D terhenti. Coba muat ulang atau gunakan peta 2D.");
        }, layout, published.assets, name => setAssetError(`Model ${name} belum berhasil dimuat. Muat ulang untuk mencoba lagi.`));
        controller.current = scene;
        scene.locations(latest.current.destinations);
        scene.pause(latest.current.paused);
      } catch (e) {
        if (cancelled) return;
        setError(abort.signal.aborted ? "Data jalan belum berhasil dimuat. Periksa koneksi lalu coba lagi." : e instanceof Error && /Data/.test(e.message) ? e.message : "Tampilan 3D belum bisa dibuka di perangkat ini. Coba lagi atau gunakan peta 2D.");
      } finally {
        clearTimeout(timeout);
      }
    }
    void init();
    const release = () => {
      joystick.current = null; setStick({ x: 0, y: 0 }); controller.current?.motion(0, 0);
    };
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", release);
    return () => {
      cancelled = true; clearTimeout(timeout); abort.abort(); scene?.dispose(); controller.current = null;
      window.removeEventListener("blur", release); document.removeEventListener("visibilitychange", release);
    };
  }, [attempt, preview]);

  function updateStick(e: ReactPointerEvent<HTMLDivElement>) {
    const held = joystick.current;
    if (!held || held.id !== e.pointerId) return;
    const dx = e.clientX - held.x, dy = e.clientY - held.y;
    const scale = Math.max(1, Math.hypot(dx, dy) / 34);
    const x = dx / scale, y = dy / scale;
    setStick({ x, y }); controller.current?.motion(x / 34, -y / 34);
  }
  function releaseStick(e: ReactPointerEvent<HTMLDivElement>) {
    if (joystick.current?.id !== e.pointerId) return;
    joystick.current = null; setStick({ x: 0, y: 0 }); controller.current?.motion(0, 0);
  }
  function reset() {
    joystick.current = null; setStick({ x: 0, y: 0 }); setRunning(false);
    controller.current?.run(false); controller.current?.reset();
  }

  const NearbyTag = preview ? "div" : "button";
  return (
    <section className={styles.explorer} aria-label="Jelajah 3D Markaz Arabiyah">
      <div ref={host} className={styles.scene} />
      <div className={styles.identity}>
        <span className={styles.eyebrow}>JELAJAH JALAN</span>
        <h1>Markaz Arabiyah</h1>
        <span className={styles.virtual}><i /> {preview ? "Pratinjau draf" : "Karakter virtual"}</span>
      </div>

      {!error && status && area && <>
        <aside className={styles.mapPanel} aria-label="Peta kecil kawasan">
          <div className={styles.mapHeading}><span>SEKITAR MARKAZ</span><span>U ↑</span></div>
          <svg className={styles.minimap} viewBox="-320 -320 640 640" role="img" aria-label="Posisi karakter di peta, utara di atas">
            <circle r={EXPLORE_RADIUS} fill="#e2e5d5" stroke="#c1c7b5" strokeWidth="4" />
            <defs><clipPath id="markaz-minimap-clip"><circle r={EXPLORE_RADIUS} /></clipPath></defs>
            <g clipPath="url(#markaz-minimap-clip)">
              {area.roads.map((road, index) => <polyline key={index} points={road.points.map(p => `${p.x},${p.z}`).join(" ")} fill="none" stroke="#adb6a4" strokeWidth={road.width + 5} strokeLinecap="round" strokeLinejoin="round" />)}
              {destinations.map(p => {
                const point = toLocal(p.latitude, p.longitude);
                return <circle key={p.id} cx={point.x} cy={point.z} r="8" fill="#356b56" />;
              })}
            </g>
            <circle cx={status.x} cy={status.z} r="23" fill="white" />
            <path data-player-marker d="M0 -18 L12 13 L0 8 L-12 13 Z" fill="#164d3c" transform={`translate(${status.x} ${status.z}) rotate(${180 - status.heading * 180 / Math.PI})`} />
          </svg>
          <div className={styles.mapActions}>
            <button type="button" onClick={reset} title="Kembali ke titik awal" aria-label="Kembali ke titik awal"><RotateCcw size={16} /> Awal</button>
            {!preview && <button type="button" onClick={onShowList} title="Daftar lokasi"><List size={16} /><span>Lokasi</span></button>}
          </div>
        </aside>

        {help && <div className={styles.help}>
          <span><strong>Jalan-jalan di sekitar Markaz</strong><br /><span className={styles.touchHelp}>Gerakkan joystick untuk berjalan. Geser layar untuk melihat sekeliling.</span><span className={styles.keyboardHelp}>WASD / panah untuk berjalan · Shift untuk berlari · Geser untuk melihat sekeliling</span></span>
          <button type="button" onClick={() => setHelp(false)} aria-label="Tutup petunjuk"><X size={16} /></button>
        </div>}

        <div className={styles.movement} aria-hidden={paused || undefined} inert={paused || undefined}>
          <div className={styles.joystickWrap}>
            <div className={styles.joystick} data-joystick role="group" aria-label="Joystick gerakan. Alternatif keyboard: WASD atau tombol panah."
              onPointerDown={e => {
                if (joystick.current || (e.pointerType === "mouse" && e.button !== 0)) return;
                const bounds = e.currentTarget.getBoundingClientRect();
                joystick.current = { id: e.pointerId, x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
                e.currentTarget.setPointerCapture(e.pointerId); updateStick(e);
              }} onPointerMove={updateStick} onPointerUp={releaseStick} onPointerCancel={releaseStick} onLostPointerCapture={releaseStick}>
              <ArrowUp size={15} className={styles.joystickArrow} />
              <div className={styles.knob} style={{ transform: `translate(${paused ? 0 : stick.x}px, ${paused ? 0 : stick.y}px)` }} />
            </div>
            <span>JALAN</span>
          </div>
          <div className={styles.walkingInfo}>
            <span className={styles.street}>{status.atEdge ? "Batas area jelajah · kembali ke arah Markaz" : status.road}</span>
            {status.nearby && <NearbyTag onClick={preview ? undefined : () => onSelect(status.nearby!.id)} className={styles.nearby}><MapPin size={14} /><span>{status.nearby.name}</span><small>{status.nearby.distance} m</small></NearbyTag>}
          </div>
          <button type="button" className={`${styles.run} ${running ? styles.running : ""}`} aria-label="Berlari" aria-pressed={running} onClick={() => {
            const value = !running; setRunning(value); controller.current?.run(value);
          }}><Footprints size={23} /><span>{running ? "Lari aktif" : "Lari"}</span></button>
        </div>
      </>}

      {!status && !error && <div className={styles.loading} role="status"><span className={styles.spinner} /><strong>Menyiapkan kawasan…</strong><span>Jalan, bangunan, dan karakter</span></div>}
      {error && <div className={styles.error} role="alert"><TriangleAlert size={28} /><h2>Jelajah 3D belum tersedia</h2><p>{error}</p><div><button type="button" onClick={() => { setError(""); setStatus(null); setRunning(false); setStick({ x: 0, y: 0 }); setAttempt(a => a + 1); }}>Coba lagi</button><button type="button" onClick={onExit}>Buka peta 2D</button></div></div>}
      {assetError && !error && <div className={styles.assetError} role="status">{assetError}</div>}
      <div className={styles.credit}>Bangunan ilustrasi · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a></div>
    </section>
  );
}
