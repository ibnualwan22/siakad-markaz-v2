"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// Mode 3D denah sakan: balok gedung bergaya (bukan model gedung asli).
// Posisi balok dari koordinat asli, tinggi dari jumlah lantai. Sengaja
// ringan untuk HP: geometri kotak, tanpa tekstur, tanpa bayangan.
// Pemandu tetap realtime: posisi GPS + rute OSRM yang sama dengan mode 2D.

export interface Denah3DItem {
  id: string;
  nama: string;
  latitude: number;
  longitude: number;
  sakan?: string | null;
  lantai?: number;
}

interface Props {
  destinations: Denah3DItem[];
  currentPosition: [number, number] | null;
  routeCoordinates: [number, number][]; // [lat, lng], sama seperti Leaflet
  selectedDestId: string | null;
  onNavigate: (dest: Denah3DItem) => void;
  followKey: number; // tiap naik: kamera pindah ke posisi user + mode ikuti aktif
}

const WARNA_SAKAN = 0x0d9488;
const WARNA_UMUM = 0x64748b;
const WARNA_PILIH = 0xf59e0b;
const TINGGI_LANTAI_M = 4;

function buatLabel(nama: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const font = "700 44px system-ui, sans-serif";
  ctx.font = font;
  const wTeks = ctx.measureText(nama).width;
  canvas.width = Math.ceil(wTeks) + 48;
  canvas.height = 72;
  const c2 = canvas.getContext("2d")!;
  c2.font = font;
  c2.fillStyle = "rgba(255,255,255,0.95)";
  c2.beginPath();
  if (typeof c2.roundRect === "function") c2.roundRect(0, 0, canvas.width, canvas.height, 18);
  else c2.rect(0, 0, canvas.width, canvas.height);
  c2.fill();
  c2.fillStyle = "#111827";
  c2.textBaseline = "middle";
  c2.fillText(nama, 24, canvas.height / 2 + 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
  );
  // 1px canvas ≈ 0,07 meter supaya label terbaca dari ketinggian kamera.
  sprite.scale.set(canvas.width * 0.07, canvas.height * 0.07, 1);
  sprite.renderOrder = 10;
  return sprite;
}

export default function DenahLokasi3D({
  destinations,
  currentPosition,
  routeCoordinates,
  selectedDestId,
  onNavigate,
  followKey,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [mengikuti, setMengikuti] = useState(false);

  const stateRef = useRef<{
    scene: THREE.Scene | null;
    camera: THREE.PerspectiveCamera | null;
    renderer: THREE.WebGLRenderer | null;
    controls: OrbitControls | null;
    blok: Map<string, THREE.Mesh>;
    label: Map<string, THREE.Sprite>;
    cincinPilih: THREE.Mesh | null;
    penandaUser: THREE.Group | null;
    rute: THREE.Mesh | null;
    pusat: { lat: number; lng: number };
    ikuti: boolean;
    userTerakhir: THREE.Vector3 | null;
    raf: number;
  }>({
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    blok: new Map(),
    label: new Map(),
    cincinPilih: null,
    penandaUser: null,
    rute: null,
    pusat: { lat: -7.747, lng: 112.183 },
    ikuti: false,
    userTerakhir: null,
    raf: 0,
  });
  const destRef = useRef(destinations);
  destRef.current = destinations;
  const navRef = useRef(onNavigate);
  navRef.current = onNavigate;

  const keXY = (lat: number, lng: number, pusat: { lat: number; lng: number }) => {
    const kx = 111320 * Math.cos((pusat.lat * Math.PI) / 180);
    return new THREE.Vector3((lng - pusat.lng) * kx, 0, -(lat - pusat.lat) * 110540);
  };

  // Bangun scene sekali.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const S = stateRef.current;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdbeafe);
    scene.fog = new THREE.Fog(0xdbeafe, 700, 2200);

    const camera = new THREE.PerspectiveCamera(
      55,
      host.clientWidth / Math.max(1, host.clientHeight),
      1,
      5000
    );
    camera.position.set(0, 260, 260);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minDistance = 30;
    controls.maxDistance = 900;
    controls.target.set(0, 0, 0);
    // Geser manual mematikan mode ikuti (ketuk peta = berhenti mengikuti).
    controls.addEventListener("start", () => {
      if (S.ikuti) {
        S.ikuti = false;
        setMengikuti(false);
      }
    });

    scene.add(new THREE.HemisphereLight(0xffffff, 0x94a3b8, 1.1));
    const matahari = new THREE.DirectionalLight(0xffffff, 1.4);
    matahari.position.set(200, 400, 100);
    scene.add(matahari);

    S.scene = scene;
    S.camera = camera;
    S.renderer = renderer;
    S.controls = controls;

    const loop = () => {
      // Mode ikuti: geser kamera + target mengikuti pergerakan user,
      // sudut dan jarak zoom dipertahankan.
      if (S.ikuti && S.userTerakhir && S.penandaUser) {
        const pos = S.penandaUser.position;
        const delta = new THREE.Vector3().subVectors(pos, S.userTerakhir);
        if (delta.lengthSq() > 0.01) {
          camera.position.add(delta);
          controls.target.add(delta);
          S.userTerakhir.copy(pos);
        }
      }
      controls.update();
      renderer.render(scene, camera);
      S.raf = requestAnimationFrame(loop);
    };
    S.raf = requestAnimationFrame(loop);

    const ro = new ResizeObserver(() => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(host);

    // Klik balok = pilih tujuan (geser = orbit, bukan klik).
    let downX = 0;
    let downY = 0;
    const el = renderer.domElement;
    const onDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
      const rect = el.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      const ray = new THREE.Raycaster();
      ray.setFromCamera(mouse, camera);
      const kena = ray.intersectObjects([...S.blok.values()], false);
      if (kena.length > 0) {
        const id = kena[0].object.userData.destId as string;
        const dest = destRef.current.find((d) => d.id === id);
        if (dest) navRef.current(dest);
      }
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);

    return () => {
      cancelAnimationFrame(S.raf);
      ro.disconnect();
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      controls.dispose();
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) mat.dispose();
      });
      renderer.dispose();
      el.remove();
      S.scene = null;
      S.camera = null;
      S.renderer = null;
      S.controls = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // (Re)bangun tanah + balok saat daftar tujuan berubah.
  useEffect(() => {
    const S = stateRef.current;
    if (!S.scene) return;
    const pusat =
      destinations.length > 0
        ? {
            lat: destinations.reduce((a, d) => a + d.latitude, 0) / destinations.length,
            lng: destinations.reduce((a, d) => a + d.longitude, 0) / destinations.length,
          }
        : { lat: -7.747, lng: 112.183 };
    S.pusat = pusat;

    // Bersihkan tanah + balok lama.
    S.scene.children
      .filter((o) => o.userData.ekstra3d)
      .forEach((o) => S.scene!.remove(o));
    S.blok.clear();
    S.label.clear();
    S.cincinPilih = null;

    const titik = destinations.map((d) => keXY(d.latitude, d.longitude, pusat));
    const jangkau =
      Math.max(400, ...titik.map((p) => Math.max(Math.abs(p.x), Math.abs(p.z)) + 250));
    const tanah = new THREE.Mesh(
      new THREE.PlaneGeometry(jangkau * 2, jangkau * 2),
      new THREE.MeshLambertMaterial({ color: 0xe2e8f0 })
    );
    tanah.rotation.x = -Math.PI / 2;
    tanah.userData.ekstra3d = true;
    S.scene.add(tanah);

    // Garis grid tipis tiap 100 m sebagai acuan skala.
    const grid = new THREE.GridHelper(jangkau * 2, Math.floor(jangkau / 50), 0xcbd5e1, 0xe2e8f0);
    grid.position.y = 0.1;
    grid.userData.ekstra3d = true;
    S.scene.add(grid);

    destinations.forEach((d, i) => {
      const p = titik[i];
      const tinggi = Math.max(1, d.lantai ?? 1) * TINGGI_LANTAI_M;
      const blok = new THREE.Mesh(
        new THREE.BoxGeometry(16, tinggi, 12),
        new THREE.MeshLambertMaterial({ color: d.sakan ? WARNA_SAKAN : WARNA_UMUM })
      );
      blok.position.set(p.x, tinggi / 2, p.z);
      blok.userData.destId = d.id;
      blok.userData.ekstra3d = true;
      S.scene!.add(blok);
      S.blok.set(d.id, blok);

      const label = buatLabel(d.nama);
      label.position.set(p.x, tinggi + 8, p.z);
      label.userData.ekstra3d = true;
      S.scene!.add(label);
      S.label.set(d.id, label);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destinations]);

  // Sorot tujuan yang dipilih.
  useEffect(() => {
    const S = stateRef.current;
    if (!S.scene) return;
    if (S.cincinPilih) {
      S.scene.remove(S.cincinPilih);
      S.cincinPilih = null;
    }
    S.blok.forEach((blok, id) => {
      const mat = blok.material as THREE.MeshLambertMaterial;
      const dest = destinations.find((d) => d.id === id);
      mat.color.setHex(id === selectedDestId ? WARNA_PILIH : dest?.sakan ? WARNA_SAKAN : WARNA_UMUM);
    });
    if (selectedDestId) {
      const blok = S.blok.get(selectedDestId);
      if (blok) {
        const cincin = new THREE.Mesh(
          new THREE.RingGeometry(14, 18, 40),
          new THREE.MeshBasicMaterial({ color: WARNA_PILIH, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
        );
        cincin.rotation.x = -Math.PI / 2;
        cincin.position.set(blok.position.x, 0.3, blok.position.z);
        cincin.userData.ekstra3d = true;
        S.scene.add(cincin);
        S.cincinPilih = cincin;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDestId, destinations]);

  // Penanda posisi user (realtime dari GPS parent).
  useEffect(() => {
    const S = stateRef.current;
    if (!S.scene) return;
    if (S.penandaUser) {
      S.scene.remove(S.penandaUser);
      S.penandaUser = null;
    }
    if (!currentPosition) {
      S.userTerakhir = null;
      return;
    }
    const p = keXY(currentPosition[0], currentPosition[1], S.pusat);
    const grup = new THREE.Group();
    const bola = new THREE.Mesh(
      new THREE.SphereGeometry(3, 20, 20),
      new THREE.MeshBasicMaterial({ color: 0x2563eb })
    );
    bola.position.y = 3;
    const alas = new THREE.Mesh(
      new THREE.RingGeometry(4, 6, 32),
      new THREE.MeshBasicMaterial({ color: 0x2563eb, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
    );
    alas.rotation.x = -Math.PI / 2;
    alas.position.y = 0.3;
    grup.add(bola, alas);
    grup.position.copy(p);
    grup.userData.ekstra3d = true;
    S.scene.add(grup);
    S.penandaUser = grup;
    if (S.ikuti) S.userTerakhir = p.clone();
    // destinations ikut jadi dep: pusat proyeksi berasal dari sana, jadi
    // penanda harus dihitung ulang bila pusat berubah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPosition, destinations]);

  // Rute OSRM sebagai pipa di atas tanah.
  useEffect(() => {
    const S = stateRef.current;
    if (!S.scene) return;
    if (S.rute) {
      S.scene.remove(S.rute);
      S.rute = null;
    }
    if (routeCoordinates.length < 2) return;
    const pts = routeCoordinates.map(([lat, lng]) => {
      const p = keXY(lat, lng, S.pusat);
      p.y = 1;
      return p;
    });
    const kurva = new THREE.CatmullRomCurve3(pts);
    const pipa = new THREE.Mesh(
      new THREE.TubeGeometry(kurva, Math.min(400, pts.length * 2), 1.1, 8, false),
      new THREE.MeshBasicMaterial({ color: 0x2563eb })
    );
    pipa.userData.ekstra3d = true;
    S.scene.add(pipa);
    S.rute = pipa;
    // destinations ikut jadi dep: alasan sama seperti penanda user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeCoordinates, destinations]);

  // Tombol Posisi Saya di mode 3D: pindah kamera ke user + aktifkan ikuti.
  useEffect(() => {
    if (followKey === 0) return;
    const S = stateRef.current;
    if (!S.scene || !S.camera || !S.controls || !S.penandaUser) return;
    const pos = S.penandaUser.position;
    S.camera.position.set(pos.x, 130, pos.z + 130);
    S.controls.target.set(pos.x, 0, pos.z);
    S.ikuti = true;
    S.userTerakhir = pos.clone();
    setMengikuti(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followKey]);

  return (
    <div ref={hostRef} className="relative h-full w-full">
      {mengikuti && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-blue-600/90 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow">
          Mengikuti posisi • geser peta untuk berhenti
        </div>
      )}
    </div>
  );
}
