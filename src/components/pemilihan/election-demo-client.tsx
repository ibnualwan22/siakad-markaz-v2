"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ElectionDisplay, { type Election, type ElectionFeed } from "./election-display";
import styles from "./election-demo-client.module.css";

type Status = "DRAFT" | "BUKA" | "TUTUP";

function buatAwal(): Election {
  const now = new Date().toISOString();
  return {
    id: "demo",
    judul: "Demo Pemilihan Rois / Roisah Lajnah",
    dufahNama: "DEMO",
    status: "DRAFT",
    dibukaAt: null,
    rencanaTutupAt: null,
    ditutupAt: null,
    serverNow: now,
    paslonList: [
      { id: "demo-p1", nomorUrut: 1, fotoUrl: null, santri1: { nama: "Rois Demo 01" }, santri2: { nama: "Wakil Demo 01" }, _count: { suaraList: 0 } },
      { id: "demo-p2", nomorUrut: 2, fotoUrl: null, santri1: { nama: "Rois Demo 02" }, santri2: { nama: "Wakil Demo 02" }, _count: { suaraList: 0 } },
    ],
  };
}

const totalSuara = (e: Election) => e.paslonList.reduce((t, p) => t + p._count.suaraList, 0);

export default function ElectionDemoClient() {
  const electionRef = useRef<Election>(buatAwal());
  const subsRef = useRef(new Set<(e: Election) => void>());
  const carryRef = useRef(0);
  const [running, setRunning] = useState(false);
  const [rate, setRate] = useState(8);
  const [target, setTarget] = useState(500);
  const [bias, setBias] = useState(50);
  const [panelOpen, setPanelOpen] = useState(true);
  const [, setTick] = useState(0);
  const paramsRef = useRef({ rate, target, bias });
  useEffect(() => {
    paramsRef.current = { rate, target, bias };
  }, [rate, target, bias]);

  const push = (election: Election) => {
    subsRef.current.forEach((cb) => cb(election));
  };

  // Feed injeksi: satu-satunya sumber data ElectionDisplay dalam mode demo.
  // Tidak ada fetch, tidak ada SSE, tidak ada database.
  const feed = useMemo<ElectionFeed>(() => ({
    subscribe: (cb) => {
      subsRef.current.add(cb);
      cb(electionRef.current);
      return () => {
        subsRef.current.delete(cb);
      };
    },
  }), []);

  const refreshPanel = () => setTick((t) => t + 1);

  const bukaSesi = () => {
    const now = new Date().toISOString();
    electionRef.current = electionRef.current.status === "DRAFT"
      ? { ...electionRef.current, status: "BUKA", dibukaAt: now, serverNow: now }
      : electionRef.current;
    push(electionRef.current);
    refreshPanel();
  };

  const tutupSesi = () => {
    setRunning(false);
    const now = new Date().toISOString();
    electionRef.current = electionRef.current.status === "BUKA"
      ? { ...electionRef.current, status: "TUTUP", ditutupAt: now, serverNow: now }
      : electionRef.current;
    push(electionRef.current);
    refreshPanel();
  };

  const reset = () => {
    setRunning(false);
    carryRef.current = 0;
    electionRef.current = buatAwal();
    push(electionRef.current);
    refreshPanel();
  };

  const tambahSuara = (idx: number, jumlah: number) => {
    const cur = electionRef.current;
    if (cur.status !== "BUKA" || jumlah <= 0) return;
    const now = new Date().toISOString();
    electionRef.current = {
      ...cur,
      serverNow: now,
      paslonList: cur.paslonList.map((p, i) => (i === idx
        ? { ...p, _count: { suaraList: p._count.suaraList + jumlah } }
        : p)),
    };
    push(electionRef.current);
    refreshPanel();
  };

  // Simulator: suara mengalir sesuai kecepatan & bias porsi paslon 1.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const { rate: r, target: t, bias: b } = paramsRef.current;
      const cur = electionRef.current;
      if (cur.status !== "BUKA") return;
      const sisa = t - totalSuara(cur);
      if (sisa <= 0) {
        setRunning(false);
        return;
      }
      carryRef.current += r / 4;
      const n = Math.min(Math.floor(carryRef.current), sisa);
      if (n <= 0) return;
      carryRef.current -= n;
      let untukP1 = 0;
      for (let i = 0; i < n; i++) if (Math.random() * 100 < b) untukP1++;
      electionRef.current = {
        ...cur,
        serverNow: new Date().toISOString(),
        paslonList: cur.paslonList.map((p, i) => ({
          ...p,
          _count: { suaraList: p._count.suaraList + (i === 0 ? untukP1 : n - untukP1) },
        })),
      };
      push(electionRef.current);
      refreshPanel();
    }, 250);
    return () => clearInterval(id);
  }, [running]);

  // Heartbeat: cegah status "stale" saat simulator dijeda.
  useEffect(() => {
    const id = setInterval(() => {
      electionRef.current = { ...electionRef.current, serverNow: new Date().toISOString() };
      push(electionRef.current);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const cur = electionRef.current;
  const status: Status = cur.status;
  const total = totalSuara(cur);

  return (
    <div className={styles.demoRoot}>
      <div className={styles.demoBadge} role="note">
        MODE DEMO — bukan pemilihan asli · tanpa database
      </div>

      <ElectionDisplay feed={feed} />

      <div className={styles.dock} data-open={panelOpen}>
        <button type="button" className={styles.dockToggle} onClick={() => setPanelOpen((v) => !v)} aria-expanded={panelOpen}>
          {panelOpen ? "Sembunyikan panel demo" : "Panel demo"}
        </button>
        {panelOpen && (
          <div className={styles.panel}>
            <div className={styles.row}>
              <span className={styles.status} data-status={status}>
                {status === "DRAFT" ? "Menunggu dibuka" : status === "BUKA" ? "Pemilihan dibuka" : "Ditutup"} · {total}/{target} suara
              </span>
            </div>
            <div className={styles.row}>
              {status === "DRAFT" && <button type="button" onClick={bukaSesi}>Buka sesi</button>}
              {status === "BUKA" && (
                <>
                  <button type="button" onClick={() => setRunning((v) => !v)}>{running ? "Jeda" : "Mulai"}</button>
                  <button type="button" onClick={tutupSesi}>Tutup sesi</button>
                </>
              )}
              <button type="button" onClick={reset}>Reset</button>
            </div>
            <div className={styles.row}>
              <label>Target <input type="number" min={10} max={2000} step={10} value={target} onChange={(e) => setTarget(Math.max(10, Number(e.target.value) || 10))} disabled={running} /></label>
              <label>Kecepatan <input type="range" min={1} max={20} value={rate} onChange={(e) => setRate(Number(e.target.value))} /> {rate}/dtk</label>
              <label>Porsi P1 <input type="range" min={10} max={90} value={bias} onChange={(e) => setBias(Number(e.target.value))} /> {bias}%</label>
            </div>
            <div className={styles.row}>
              {cur.paslonList.map((p, i) => (
                <span key={p.id} className={styles.manual}>
                  P{i + 1} ({p._count.suaraList}):
                  <button type="button" onClick={() => tambahSuara(i, 1)} disabled={status !== "BUKA"}>+1</button>
                  <button type="button" onClick={() => tambahSuara(i, 10)} disabled={status !== "BUKA"}>+10</button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
