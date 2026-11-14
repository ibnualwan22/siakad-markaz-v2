"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Box, Building2, Trees, Fence, DoorOpen, Armchair, Lamp, Signpost, Copy, Flag, Move, Redo2, RotateCcw, RotateCw, Save, Scaling, Trash2, Undo2, Upload, X, Play, Send, MapPin } from "lucide-react";
import { EMPTY_SCENE, MAX_SCENE_OBJECTS, PRESETS, newSceneObject, parseScene, sceneSpawn, type SceneAsset, type SceneDocument, type SceneKind, type SceneObject } from "@/lib/denah-scene";
import { toLocal, type ExploreArea } from "@/lib/markaz-explore";
import { createEditorScene, type EditorMode, type EditorSelection } from "./denah-editor-scene";
import type { ExploreLocation } from "../santri/markaz-explore-scene";
import styles from "./denah-editor.module.css";

const Explorer = dynamic(() => import("../santri/denah-lokasi-3d"), { ssr: false });
type History = { past: SceneDocument[]; present: SceneDocument; future: SceneDocument[] };
type Loaded = { scene: SceneDocument; assets: SceneAsset[]; revision: number; publishedAt: string | null; canRestore: boolean };
const presetIcons = { building: Building2, tree: Trees, gate: DoorOpen, wall: Fence, bench: Armchair, lamp: Lamp, sign: Signpost };

export default function DenahEditor({ locations, onClose }: { locations: ExploreLocation[]; onClose: () => void }) {
  const [area, setArea] = useState<ExploreArea | null>(null);
  const [assets, setAssets] = useState<SceneAsset[]>([]);
  const [history, setHistory] = useState<History>({ past: [], present: EMPTY_SCENE, future: [] });
  const doc = history.present;
  const [saved, setSaved] = useState(JSON.stringify(EMPTY_SCENE));
  const [revision, setRevision] = useState(0);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [canRestore, setCanRestore] = useState(false);
  const [selection, setSelection] = useState<EditorSelection>(null);
  const [mode, setMode] = useState<EditorMode>("translate");
  const [spawnPicking, setSpawnPicking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState<{ scene: SceneDocument; assets: SceneAsset[] } | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const controller = useRef<ReturnType<typeof createEditorScene> | null>(null);
  const callbacks = useRef<{ commit: (doc: SceneDocument) => void; doc: SceneDocument }>({ commit: () => {}, doc });
  const dirty = JSON.stringify(doc) !== saved;
  const object = selection?.type === "object" ? doc.objects.find(o => o.id === selection.id) : undefined;
  const building = selection?.type === "building" ? area?.buildings.find(b => b.id === selection.id) : undefined;

  function commit(next: SceneDocument) {
    setHistory(h => JSON.stringify(h.present) === JSON.stringify(next) ? h : { past: [...h.past, h.present].slice(-40), present: next, future: [] });
    setMessage("");
  }
  function undo() { setHistory(h => h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h); }
  function redo() { setHistory(h => h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h); }
  function accept(data: Loaded) {
    const scene = parseScene(data.scene);
    setHistory({ past: [], present: scene, future: [] }); setSaved(JSON.stringify(scene));
    setRevision(data.revision); setPublishedAt(data.publishedAt); setCanRestore(data.canRestore);
    if (data.assets) setAssets(data.assets);
  }
  useEffect(() => { callbacks.current = { commit, doc }; });
  useEffect(() => {
    const abort = new AbortController();
    let cancelled = false;
    const timeout = setTimeout(() => abort.abort(), 20000);
    async function load() {
      try {
        const [mapResponse, sceneResponse] = await Promise.all([fetch("/maps/markaz-area.json", { signal: abort.signal }), fetch("/api/admin/denah-lokasi/scene", { signal: abort.signal })]);
        const data = await sceneResponse.json();
        if (!sceneResponse.ok) throw new Error(data.error ?? "Editor belum dapat dimuat.");
        if (!mapResponse.ok) throw new Error("Peta kawasan belum dapat dimuat.");
        const map: ExploreArea = await mapResponse.json();
        if (abort.signal.aborted) return;
        accept(data); setArea(map); setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error && e.name !== "AbortError" ? e.message : "Permintaan terlalu lama. Coba muat ulang."); setLoading(false);
      } finally { clearTimeout(timeout); }
    }
    void load();
    return () => { cancelled = true; clearTimeout(timeout); abort.abort(); };
  }, [attempt]);

  useEffect(() => {
    if (!area || !host.current) return;
    let scene: ReturnType<typeof createEditorScene> | null = null;
    try {
      scene = createEditorScene(host.current, area, {
        select: setSelection,
        transform: (id, patch) => { const { doc, commit } = callbacks.current; commit({ ...doc, objects: doc.objects.map(o => o.id === id ? { ...o, ...patch } : o) }); },
        spawn: point => { const { doc, commit } = callbacks.current; commit({ ...doc, spawn: { ...point, heading: 0 } }); setSpawnPicking(false); },
        error: setError,
      });
      controller.current = scene;
    } catch { setTimeout(() => setError("WebGL belum dapat digunakan. Muat ulang atau gunakan browser yang mendukung 3D."), 0); }
    return () => { scene?.dispose(); controller.current = null; };
  }, [area]);
  useEffect(() => { controller.current?.sync(doc, assets); }, [doc, assets, area]);
  useEffect(() => { controller.current?.select(selection); }, [selection, doc]);
  useEffect(() => { controller.current?.mode(mode); }, [mode, area]);
  useEffect(() => { controller.current?.spawnPicking(spawnPicking); }, [spawnPicking, area]);
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        const container = preview ? dialog.current?.querySelector("[data-preview-panel]") : dialog.current;
        const controls = Array.from(container?.querySelectorAll<HTMLElement>("button:not(:disabled),input:not([hidden]),select,canvas,[href]") ?? []).filter(el => el.offsetParent !== null && !el.closest("[inert]"));
        const first = controls[0], last = controls[controls.length - 1];
        if (!container?.contains(document.activeElement) || (e.shiftKey && document.activeElement === first)) { e.preventDefault(); (e.shiftKey ? last : first)?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
      if (e.key === "Escape" && !busy) { e.preventDefault(); if (preview) setPreview(null); else if (!dirty || window.confirm("Keluar dan buang perubahan yang belum disimpan?")) onClose(); return; }
      if (busy || preview || (e.target as HTMLElement)?.closest("input,textarea,select,[contenteditable=true]")) return;
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
    };
    window.addEventListener("beforeunload", unload); window.addEventListener("keydown", keys);
    return () => { window.removeEventListener("beforeunload", unload); window.removeEventListener("keydown", keys); };
  }, [dirty, busy, preview, onClose]);

  function close() { if (!dirty || window.confirm("Ada perubahan yang belum disimpan. Keluar dan buang perubahan tersebut?")) onClose(); }
  function reload() {
    if (dirty && !window.confirm("Muat draf dari server dan buang perubahan yang belum disimpan?")) return;
    setLoading(true); setArea(null); setError(""); setSelection(null); setAttempt(a => a + 1);
  }
  function add(kind: SceneKind, asset?: SceneAsset) {
    if (doc.objects.length >= MAX_SCENE_OBJECTS) { setError("Maksimal 150 objek tambahan dalam kawasan."); return; }
    const next = newSceneObject(kind, controller.current?.center() ?? { x: 0, z: 0 }, asset?.id ?? null);
    if (asset) next.name = asset.name;
    if (building) {
      const xs = building.points.map(p => p.x), zs = building.points.map(p => p.z);
      next.x = (Math.min(...xs) + Math.max(...xs)) / 2; next.z = (Math.min(...zs) + Math.max(...zs)) / 2;
      next.width = Math.min(80, Math.max(0.1, Math.max(...xs) - Math.min(...xs)));
      next.depth = Math.min(80, Math.max(0.1, Math.max(...zs) - Math.min(...zs)));
      next.height = Math.min(40, building.height + (kind === "building" ? 1 : 0)); next.replacesBuildingId = building.id;
    }
    commit({ ...doc, objects: [...doc.objects, next] }); setSelection({ type: "object", id: next.id }); setError("");
  }
  function patch(values: Partial<SceneObject>) { if (object) commit({ ...doc, objects: doc.objects.map(o => o.id === object.id ? { ...o, ...values } : o) }); }
  function remove() { if (object) { commit({ ...doc, objects: doc.objects.filter(o => o.id !== object.id) }); setSelection(null); } }
  function duplicate() {
    if (!object || doc.objects.length >= MAX_SCENE_OBJECTS) return;
    const copy = { ...object, id: crypto.randomUUID(), name: `${object.name.slice(0, 70)} salinan`, x: Math.min(290, object.x + 3), z: Math.min(290, object.z + 3), replacesBuildingId: null };
    commit({ ...doc, objects: [...doc.objects, copy] }); setSelection({ type: "object", id: copy.id });
  }
  async function save(action: "save" | "publish" | "restore") {
    if (action === "restore" && !window.confirm("Kembalikan kawasan dan draf ke versi terbit sebelumnya?")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/denah-lokasi/scene", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, revision, scene: doc }), signal: AbortSignal.timeout(20000) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Perubahan belum berhasil disimpan.");
      accept(data); setMessage(action === "save" ? "Draf tersimpan. Tampilan santri belum berubah." : action === "publish" ? "Kawasan diterbitkan. Santri akan melihatnya saat membuka Jelajah 3D." : "Versi sebelumnya dipulihkan.");
    } catch (e) { setError(e instanceof Error && !["TimeoutError", "AbortError"].includes(e.name) ? e.message : "Server belum mengonfirmasi penyimpanan. Muat ulang untuk memeriksa status sebelum mencoba lagi."); }
    finally { setBusy(false); }
  }
  async function upload(file: File) {
    setBusy(true); setError("");
    try {
      const form = new FormData(); form.append("file", file);
      const response = await fetch("/api/admin/denah-lokasi/assets", { method: "POST", body: form, signal: AbortSignal.timeout(60000) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Unggahan belum berhasil.");
      setAssets(a => [data.asset, ...a]); setMessage("Aset tersimpan di koleksi. Pilih aset untuk menaruhnya di kawasan.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unggahan belum berhasil."); }
    finally { setBusy(false); if (uploadInput.current) uploadInput.current.value = ""; }
  }
  function startPreview() {
    if (!area) return;
    if (!sceneSpawn(area, doc)) { setError("Titik awal terhalang. Pilih titik awal di tempat kosong terlebih dahulu."); return; }
    setPreview({ scene: doc, assets });
  }
  function numeric(field: "x" | "z" | "rotation" | "width" | "height" | "depth" | "floors", label: string, min: number, max: number) {
    if (!object) return null;
    return <label>{label}<input key={`${object.id}:${field}:${object[field]}`} type="number" defaultValue={Math.round(object[field] * 100) / 100} min={min} max={max} step={field === "floors" ? 1 : 0.1} onBlur={e => {
      const value = e.currentTarget.valueAsNumber;
      if (!Number.isFinite(value) || value < min || value > max || (field === "floors" && !Number.isInteger(value))) { e.currentTarget.value = String(object[field]); setError(`${label}: masukkan nilai ${min}–${max}.`); return; }
      patch({ [field]: value, ...(field === "floors" ? { height: value * 3.2 + (object.roof === "gable" ? 1.2 : 0) } : {}) });
    }} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }} /></label>;
  }

  return <div ref={dialog} className={styles.editor} role="dialog" aria-modal="true" aria-label="Editor kawasan 3D">
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>DENAH LOKASI SAKAN</span><h1>Editor kawasan <span>3D</span></h1></div>
      <div className={styles.headerActions}>
        <span className={styles.draftState}>{loading ? "Memuat…" : dirty ? "Perubahan belum disimpan" : revision ? "Draf tersimpan" : "Kawasan awal"}</span>
        <button type="button" onClick={startPreview} disabled={loading || busy || !area}><Play size={16} /> Coba jelajah</button>
        <button type="button" onClick={() => save("save")} disabled={loading || busy || !area}><Save size={16} /> Simpan draf</button>
        <button type="button" className={styles.primary} onClick={() => save("publish")} disabled={loading || busy || !area}><Send size={16} /> Terbitkan</button>
        <button type="button" onClick={close} aria-label="Tutup editor" disabled={busy}><X size={20} /></button>
      </div>
    </header>
    <div className={styles.toolbar}>
      <div className={styles.toolGroup}>
        {([["translate", "Geser", Move], ["rotate", "Putar", RotateCw], ["scale", "Ukuran", Scaling]] as const).map(([value, label, Icon]) => <button type="button" key={value} aria-pressed={mode === value && !spawnPicking} onClick={() => { setMode(value); setSpawnPicking(false); }} disabled={busy}><Icon size={16} />{label}</button>)}
        <span className={styles.separator} />
        <button type="button" aria-label="Urungkan" title="Urungkan (Ctrl+Z)" onClick={undo} disabled={!history.past.length || busy}><Undo2 size={17} /></button>
        <button type="button" aria-label="Ulangi" title="Ulangi (Ctrl+Shift+Z)" onClick={redo} disabled={!history.future.length || busy}><Redo2 size={17} /></button>
      </div>
      <div className={styles.toolGroup}>
        <select aria-label="Fokus lokasi" defaultValue="" onChange={e => { const p = locations.find(p => p.id === e.target.value); if (p) controller.current?.focus(toLocal(p.latitude, p.longitude)); }}><option value="">Fokus ke lokasi…</option>{locations.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}</select>
        <button type="button" aria-pressed={spawnPicking} onClick={() => setSpawnPicking(v => !v)} disabled={busy}><Flag size={16} /> Titik awal</button>
        <button type="button" onClick={reload} disabled={busy}><RotateCcw size={15} /> Muat ulang</button>
      </div>
    </div>
    {error && <div className={styles.error} role="alert"><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Tutup pesan"><X size={16} /></button></div>}
    {message && <div className={styles.notice} role="status">{message}</div>}
    <div className={styles.body} inert={busy || Boolean(preview) || undefined}>
      <aside className={styles.library}>
        <h2>Koleksi aset</h2><p>{building ? "Pilih aset untuk mengganti bangunan yang ditandai." : "Pilih aset untuk menambahkannya di tengah pandangan."}</p>
        <div className={styles.presets}>{PRESETS.map(p => { const Icon = presetIcons[p.kind]; return <button type="button" key={p.kind} onClick={() => add(p.kind)} disabled={loading || !area}><span className={styles.assetIcon} data-kind={p.kind}><Icon size={23} /></span><span><strong>{p.name}</strong><small>{p.description}</small></span></button>; })}</div>
        <div className={styles.sectionTitle}><h2>Model sendiri</h2><button type="button" onClick={() => uploadInput.current?.click()} disabled={loading}><Upload size={14} /> Unggah</button></div>
        <input ref={uploadInput} type="file" accept=".glb,model/gltf-binary" hidden onChange={e => { const file = e.currentTarget.files?.[0]; if (file) void upload(file); }} />
        <p className={styles.hint}>GLB · maks. 3 MiB · tekstur tertanam PNG/JPEG, maks. 2048 px.</p>
        {!assets.length && <p className={styles.empty}>Belum ada model unggahan.</p>}
        {assets.map(asset => <button type="button" className={styles.assetRow} key={asset.id} onClick={() => add("model", asset)}><Box size={18} /><span>{asset.name}<small>{(asset.bytes / 1024 / 1024).toFixed(1)} MiB</small></span></button>)}
        <div className={styles.sectionTitle}><h2>Objek kawasan</h2><span>{doc.objects.length}/{MAX_SCENE_OBJECTS}</span></div>
        {!doc.objects.length && <p className={styles.empty}>Klik bangunan di peta untuk mulai menggantinya.</p>}
        {doc.objects.map(o => <button type="button" className={styles.objectRow} aria-pressed={object?.id === o.id} key={o.id} onClick={() => { setSelection({ type: "object", id: o.id }); controller.current?.focus(o); }}><Box size={14} /><span>{o.name}</span></button>)}
      </aside>
      <div className={styles.viewport}>
        <div ref={host} className={styles.canvas} />
        {loading && <div className={styles.loading} role="status">Menyiapkan editor kawasan…</div>}
        {!loading && !area && <div className={styles.loading}><p>Editor belum dapat dimuat.</p><button type="button" onClick={reload}>Coba lagi</button></div>}
        <div className={styles.canvasHint}>{spawnPicking ? "Klik tempat kosong untuk menentukan titik awal karakter." : "Klik untuk memilih · geser untuk memutar · klik kanan untuk menggeser peta · gulir untuk zoom"}</div>
        <a className={styles.attribution} href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
      </div>
      <aside className={styles.properties}>
        <h2>{object ? "Pengaturan objek" : building ? "Bangunan referensi" : "Pilih objek"}</h2>
        {object ? <>
          <label>Nama<input key={`${object.id}:${object.name}`} defaultValue={object.name} maxLength={80} onBlur={e => { if (e.currentTarget.value.trim()) patch({ name: e.currentTarget.value.trim() }); else e.currentTarget.value = object.name; }} /></label>
          <label>Jenis<select value={object.kind} onChange={e => patch({ kind: e.target.value as SceneKind, assetId: null })}>{PRESETS.map(p => <option key={p.kind} value={p.kind}>{p.name}</option>)}{object.kind === "model" && <option value="model">Model unggahan</option>}</select></label>
          {object.kind === "model" && <label>Aset<select value={object.assetId ?? ""} onChange={e => patch({ assetId: e.target.value })}>{assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
          <h3>Posisi · meter</h3><div className={styles.fields}>{numeric("x", "Timur / barat", -300, 300)}{numeric("z", "Selatan / utara", -300, 300)}</div>
          {numeric("rotation", "Putaran · derajat", -360, 360)}
          <h3>Ukuran · meter</h3><div className={styles.fields}>{numeric("width", "Lebar", 0.1, 80)}{numeric("depth", "Panjang", 0.1, 80)}{numeric("height", "Tinggi", 0.1, 40)}</div>
          {object.kind === "building" && <div className={styles.fields}>{numeric("floors", "Jumlah lantai", 1, 8)}<label>Atap<select value={object.roof} onChange={e => patch({ roof: e.target.value as "flat" | "gable" })}><option value="gable">Pelana</option><option value="flat">Datar</option></select></label></div>}
          {object.kind !== "model" && <label className={styles.color}>Warna utama<input type="color" value={object.color} onChange={e => patch({ color: e.target.value })} /></label>}
          <label className={styles.check}><input type="checkbox" checked={object.solid} onChange={e => patch({ solid: e.target.checked })} /> Menghalangi karakter</label>
          {object.kind === "model" && <p className={styles.hint}>Penghalang mengikuti lebar dan panjang model. Matikan jika area ini harus bisa dilewati.</p>}
          {object.replacesBuildingId && <p className={styles.hint}>Menggantikan bangunan peta. Menghapus objek ini akan memunculkan bangunan semula.</p>}
          <div className={styles.row}><button type="button" onClick={duplicate}><Copy size={15} /> Salin</button><button type="button" className={styles.danger} onClick={remove}><Trash2 size={15} /> Hapus</button></div>
        </> : building ? <>
          <p>Bangunan dari peta dasar sedang dipilih. Pilih gedung atau model dari koleksi untuk menggantinya.</p>
          <button type="button" className={styles.wideButton} onClick={() => add("building")}><Box size={16} /> Ganti dengan gedung</button>
          <button type="button" className={styles.wideButton} onClick={() => { commit({ ...doc, hiddenBuildingIds: [...new Set([...doc.hiddenBuildingIds, building.id])] }); setSelection(null); }}>Sembunyikan bangunan</button>
        </> : <p>Klik objek di peta atau pilih dari daftar. Bangunan abu-abu dapat diganti dengan aset sendiri.</p>}
        <div className={styles.publishInfo}><h3>Titik awal karakter</h3><p>{doc.spawn ? `${doc.spawn.x.toFixed(1)}, ${doc.spawn.z.toFixed(1)} meter dari Maktab` : "Otomatis di jalan dekat Maktab"}</p>{doc.spawn && <button type="button" onClick={() => commit({ ...doc, spawn: null })}>Gunakan titik otomatis</button>}</div>
        {doc.hiddenBuildingIds.length > 0 && <button type="button" className={styles.wideButton} onClick={() => commit({ ...doc, hiddenBuildingIds: [] })}>Pulihkan {doc.hiddenBuildingIds.length} bangunan tersembunyi</button>}
        <div className={styles.publishInfo}><h3>Versi santri</h3><p>{publishedAt ? `Terakhir terbit ${new Date(publishedAt).toLocaleString("id-ID")}` : "Masih memakai kawasan awal."}</p><p>Draf baru terlihat oleh santri setelah diterbitkan.</p>{canRestore && <button type="button" onClick={() => save("restore")}>Pulihkan versi terbit sebelumnya</button>}</div>
      </aside>
    </div>
    <footer className={styles.footer}><span><MapPin size={13} /> Markaz Arabiyah · radius 300 m</span><span>{busy ? "Memproses…" : dirty ? "Ada perubahan lokal" : `Revisi ${revision}`}</span></footer>
    {preview && <div className={styles.preview} data-preview-panel><Explorer destinations={locations} paused={false} onSelect={() => {}} onShowList={() => {}} onExit={() => setPreview(null)} preview={preview} /><button type="button" className={styles.backEditor} onClick={() => setPreview(null)}><X size={17} /> Kembali ke editor</button></div>}
  </div>;
}
