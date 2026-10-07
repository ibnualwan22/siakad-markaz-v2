"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

type ElectionPhase = "waiting" | "open" | "closed";

interface SceneState {
    phase: ElectionPhase;
    totalVotes: number;
    reducedMotion: boolean;
}

interface BallotSceneProps extends SceneState {
    className?: string;
}

interface SceneController {
    update: (state: SceneState) => void;
    dispose: () => void;
}

const ease = (value: number) => value * value * (3 - 2 * value);

/** Decorative scene: voting status and accessible counts belong to the page. */
export default function BallotScene({
    phase,
    totalVotes,
    reducedMotion,
    className = "",
}: BallotSceneProps) {
    const hostRef = useRef<HTMLDivElement>(null);
    const initialState = useRef({ phase, totalVotes, reducedMotion });
    const controllerRef = useRef<SceneController | null>(null);
    const [suratAntre, setSuratAntre] = useState(0);

    useEffect(() => {
        const host = hostRef.current;
        if (!host) return;

        controllerRef.current = createScene(host, initialState.current, setSuratAntre);
        return () => {
            controllerRef.current?.dispose();
            controllerRef.current = null;
        };
    }, []);

    useEffect(() => {
        controllerRef.current?.update({ phase, totalVotes, reducedMotion });
    }, [phase, totalVotes, reducedMotion]);

    return (
        <div
            ref={hostRef}
            aria-hidden="true"
            className={`group relative isolate h-full min-h-64 w-full ${className}`}
        >
            <div className="absolute inset-0 flex items-center justify-center group-data-[scene-ready=true]:invisible">
            {suratAntre > 1 && (
                <div aria-hidden="true" title="Surat suara menunggu animasi" className="absolute right-3 top-3 z-10 rounded-full bg-[#c7ac6b]/95 px-2.5 py-1 text-xs font-bold tabular-nums text-[#153e37] shadow">+{suratAntre}</div>
            )}
                <svg viewBox="0 0 480 430" className="h-full max-h-full w-full" fill="none">
                    <ellipse cx="240" cy="349" rx="154" ry="28" fill="#042725" opacity=".55" />
                    <path d="M87 324c0-17 68-31 153-31s153 14 153 31v13c0 17-68 31-153 31S87 354 87 337z" fill="#123f3a" />
                    <ellipse cx="240" cy="324" rx="153" ry="31" fill="#9cae99" />
                    <path d="m135 160 145-35 76 51v128l-145 42-76-57z" fill="#34796d" stroke="#80a893" strokeWidth="2" />
                    <path d="m211 214 145-38v128l-145 42z" fill="#235e56" />
                    <path d="m128 150 152-37 83 53v16l-152 43-83-60z" fill="#c4cbb0" />
                    <path d="m128 150 152-37 83 53-152 43z" fill="#e3e4cb" stroke="#f0ebd4" strokeWidth="2" />
                    <path d="m207 154 69-17 18 12-69 18z" fill={phase === "open" ? "#153e37" : "#bdac71"} />
                    <path d="m250 239 53-14v42l-53 15z" fill="#d8d4b4" />
                    <path d="m263 253 9 7 19-24" stroke="#275d51" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="m222 322 120-35" stroke="#c6b57b" strokeWidth="2" opacity=".65" />
                </svg>
            </div>
        </div>
    );
}

function createScene(host: HTMLDivElement, initialState: SceneState, onPending?: (pending: number) => void): SceneController | null {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const shadows = new Set<THREE.LightShadow>();
    let renderer: THREE.WebGLRenderer | null = null;
    let observer: ResizeObserver | null = null;
    let frame: number | null = null;
    let failed = false;
    let disposed = false;
    let onVisibility: (() => void) | null = null;
    let onContextLost: ((event: Event) => void) | null = null;

    const geometry = <T extends THREE.BufferGeometry>(value: T): T => {
        geometries.add(value);
        return value;
    };
    const material = <T extends THREE.Material>(value: T): T => {
        materials.add(value);
        return value;
    };

    function stop() {
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null;
    }

    function showFallback() {
        failed = true;
        stop();
        delete host.dataset.sceneReady;
        if (renderer) renderer.domElement.style.visibility = "hidden";
    }

    function dispose() {
        if (disposed) return;
        disposed = true;
        stop();
        observer?.disconnect();
        if (onVisibility) document.removeEventListener("visibilitychange", onVisibility);
        if (onContextLost) renderer?.domElement.removeEventListener("webglcontextlost", onContextLost);
        geometries.forEach((entry) => entry.dispose());
        materials.forEach((entry) => entry.dispose());
        shadows.forEach((entry) => entry.dispose());
        renderer?.forceContextLoss();
        renderer?.dispose();
        renderer?.domElement.remove();
        delete host.dataset.sceneReady;
    }

    try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
        const webgl = renderer;
        webgl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        webgl.setClearColor(0x073b3a, 0);
        webgl.outputColorSpace = THREE.SRGBColorSpace;
        webgl.toneMapping = THREE.ACESFilmicToneMapping;
        webgl.toneMappingExposure = 1.08;
        webgl.shadowMap.enabled = true;
        webgl.shadowMap.type = THREE.PCFSoftShadowMap;
        Object.assign(webgl.domElement.style, {
            position: "absolute",
            inset: "0",
            width: "100%",
            height: "100%",
            visibility: "hidden",
            pointerEvents: "none",
        });
        webgl.domElement.setAttribute("aria-hidden", "true");
        host.appendChild(webgl.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-3, 3, 2.45, -2.45, 0.1, 60);
        camera.position.set(6, 5.4, 8);
        camera.lookAt(0, 1.64, 0);

        const ceramic = material(new THREE.MeshStandardMaterial({ color: 0x357a70, roughness: 0.35, metalness: 0.07 }));
        const darkCeramic = material(new THREE.MeshStandardMaterial({ color: 0x1c5148, roughness: 0.52 }));
        const ivory = material(new THREE.MeshStandardMaterial({ color: 0xe5e3cd, roughness: 0.46 }));
        const brass = material(new THREE.MeshStandardMaterial({ color: 0xc7ac6b, roughness: 0.34, metalness: 0.65 }));
        const ink = material(new THREE.MeshStandardMaterial({ color: 0x254d3e, roughness: 0.8 }));
        const cavityMaterial = material(new THREE.MeshStandardMaterial({ color: 0x082722, roughness: 1 }));
        const paperMaterial = material(new THREE.MeshStandardMaterial({ color: 0xfff6dc, roughness: 0.85 }));

        const box = new THREE.Group();
        scene.add(box);

        function rounded(
            width: number,
            height: number,
            depth: number,
            radius: number,
            surface: THREE.Material,
            x: number,
            y: number,
            z: number,
            parent: THREE.Object3D = box,
        ) {
            const mesh = new THREE.Mesh(geometry(new RoundedBoxGeometry(width, height, depth, 3, radius)), surface);
            mesh.position.set(x, y, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            parent.add(mesh);
            return mesh;
        }

        const base = new THREE.Mesh(
            geometry(new THREE.CylinderGeometry(2.03, 2.08, 0.15, 96)),
            darkCeramic,
        );
        base.position.y = 0.15;
        base.receiveShadow = true;
        base.castShadow = true;
        scene.add(base);

        const stageTop = new THREE.Mesh(
            geometry(new THREE.CylinderGeometry(2.03, 2.03, 0.05, 96)),
            material(new THREE.MeshStandardMaterial({ color: 0x9eaf97, roughness: 0.75 })),
        );
        stageTop.position.y = 0.25;
        stageTop.receiveShadow = true;
        stageTop.castShadow = true;
        scene.add(stageTop);

        const stageRing = new THREE.Mesh(geometry(new THREE.RingGeometry(1.9, 1.912, 96)), brass);
        stageRing.rotation.x = -Math.PI / 2;
        stageRing.position.y = 0.277;
        scene.add(stageRing);

        const ground = new THREE.Mesh(
            geometry(new THREE.PlaneGeometry(22, 22)),
            material(new THREE.ShadowMaterial({ color: 0x001d18, opacity: 0.3 })),
        );
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        ground.position.y = 0.055;
        scene.add(ground);

        rounded(2.29, 0.12, 1.56, 0.055, darkCeramic, 0, 0.35, 0);
        rounded(2.46, 1.94, 1.74, 0.14, ceramic, 0, 1.36, 0);
        rounded(2.34, 0.022, 1.64, 0.01, brass, 0, 0.475, 0);

        // Four lid pieces surround an actual opening, so the shutter can slide beneath them.
        rounded(2.6, 0.16, 0.82, 0.045, ivory, 0, 2.405, -0.52);
        rounded(2.6, 0.16, 0.82, 0.045, ivory, 0, 2.405, 0.52);
        rounded(0.62, 0.16, 0.24, 0.025, ivory, -0.99, 2.405, 0);
        rounded(0.62, 0.16, 0.24, 0.025, ivory, 0.99, 2.405, 0);
        rounded(1.4, 0.025, 0.255, 0.006, cavityMaterial, 0, 2.365, 0);

        rounded(1.47, 0.028, 0.035, 0.012, brass, 0, 2.487, -0.135);
        rounded(1.47, 0.028, 0.035, 0.012, brass, 0, 2.487, 0.135);
        rounded(0.035, 0.028, 0.25, 0.01, brass, -0.718, 2.487, 0);
        rounded(0.035, 0.028, 0.25, 0.01, brass, 0.718, 2.487, 0);
        const shutter = rounded(1.39, 0.025, 0.258, 0.008, brass, 0, 2.448, 0);

        for (const x of [-1.12, 1.12]) {
            for (const z of [-0.73, 0.73]) {
                const pin = new THREE.Mesh(geometry(new THREE.CylinderGeometry(0.024, 0.024, 0.008, 12)), brass);
                pin.position.set(x, 2.489, z);
                box.add(pin);
            }
        }

        rounded(0.88, 0.48, 0.036, 0.055, brass, 0, 1.38, 0.872);
        rounded(0.83, 0.43, 0.018, 0.045, ivory, 0, 1.38, 0.895);

        function checkMark(parent: THREE.Object3D, scale: number, x: number, y: number, z: number) {
            const path = new THREE.CurvePath<THREE.Vector3>();
            path.add(new THREE.LineCurve3(new THREE.Vector3(-0.13, 0, 0), new THREE.Vector3(-0.025, -0.1, 0)));
            path.add(new THREE.LineCurve3(new THREE.Vector3(-0.025, -0.1, 0), new THREE.Vector3(0.16, 0.13, 0)));
            const mark = new THREE.Mesh(geometry(new THREE.TubeGeometry(path, 12, 0.018, 6, false)), ink);
            mark.scale.setScalar(scale);
            mark.position.set(x, y, z);
            parent.add(mark);
        }

        checkMark(box, 0.85, 0, 1.38, 0.911);

        const indicatorMaterial = material(new THREE.MeshStandardMaterial({
            color: 0xd7c68c,
            emissive: 0xf5dd9d,
            emissiveIntensity: 0.05,
            roughness: 0.4,
        }));
        rounded(0.36, 0.026, 0.019, 0.009, indicatorMaterial, 0, 1.83, 0.875);

        const paperPrototype = new THREE.Group();
        rounded(0.76, 1.02, 0.018, 0.009, paperMaterial, 0, 0, 0, paperPrototype);
        checkMark(paperPrototype, 0.75, 0, 0.13, 0.019);
        rounded(0.35, 0.014, 0.005, 0.002, brass, 0, -0.17, 0.013, paperPrototype);
        rounded(0.24, 0.012, 0.005, 0.002, brass, 0, -0.26, 0.013, paperPrototype);
        // Surat tidak ikut shadow pass: 1 surat = 4 mesh, 20 surat = 80 caster.
        // Bayangannya nyaris tak terlihat saat terbang; mematikannya memangkas
        // biaya render terbesar saat banyak surat bersamaan (anti drop-frame).
        paperPrototype.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
                obj.castShadow = false;
                obj.receiveShadow = false;
            }
        });

        const pulseMaterial = material(new THREE.MeshBasicMaterial({
            color: 0xe6c985,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            side: THREE.DoubleSide,
        }));
        const pulse = new THREE.Mesh(geometry(new THREE.RingGeometry(1.36, 1.38, 80)), pulseMaterial);
        pulse.rotation.x = -Math.PI / 2;
        pulse.position.y = 0.282;
        scene.add(pulse);

        scene.add(new THREE.HemisphereLight(0xfff5d9, 0x163c35, 2.1));
        const key = new THREE.DirectionalLight(0xfff2db, 3.5);
        key.position.set(-3.5, 7, 5);
        key.castShadow = true;
        key.shadow.mapSize.set(1024, 1024);
        key.shadow.camera.left = -5;
        key.shadow.camera.right = 5;
        key.shadow.camera.top = 5;
        key.shadow.camera.bottom = -5;
        key.shadow.camera.near = 0.5;
        key.shadow.camera.far = 20;
        key.shadow.normalBias = 0.035;
        key.shadow.bias = -0.0001;
        shadows.add(key.shadow);
        scene.add(key);

        const rim = new THREE.DirectionalLight(0xb1dfd0, 2.4);
        rim.position.set(4, 4, -5);
        scene.add(rim);

        const slotLight = new THREE.PointLight(0xf0d797, 0, 2.2, 2);
        slotLight.position.set(0, 2.62, 0);
        scene.add(slotLight);

        let state = initialState;
        let lastVoteCount = initialState.totalVotes;
        let openness = initialState.phase === "open" ? 1 : 0;
        let fromOpenness = openness;
        let targetOpenness = openness;
        let openingTime = 1.8;
        let pendingVotes = 0;
        let notifiedPending = -1;
        // Beri tahu React saat antrean animasi berubah, untuk badge "+N".
        function setPendingVotes(value: number) {
            pendingVotes = Math.max(0, Math.min(999, value));
            if (pendingVotes !== notifiedPending) {
                notifiedPending = pendingVotes;
                onPending?.(pendingVotes);
            }
        }
        let nextPaper = 0;
        // 1 suara = 1 surat: tiap vote langsung menjadi surat tanpa throttle.
        // Batas 60 surat bersamaan hanya pengaman untuk ledakan tak wajar;
        // pada tempo acara nyata (1-8 suara/detik, terbang 2,4 dtk) tak akan tersentuh.
        const MAX_PAPERS = 60;
        let pulseTime = 0;
        let ambientTime = 0;
        let lastFrameTime = 0;
        let lastRenderedAt = -Infinity;
        let dirty = true;
        const papers: { mesh: THREE.Group; age: number; offset: number }[] = [];

        const clearPapers = () => {
            papers.forEach((paper) => scene.remove(paper.mesh));
            papers.length = 0;
            setPendingVotes(0);
            pulseTime = 0;
            pulseMaterial.opacity = 0;
        };

        function schedule() {
            if (disposed || failed || document.hidden || frame !== null) return;
            frame = requestAnimationFrame(tick);
        }

        function tick(now: number) {
            frame = null;
            if (disposed || failed || document.hidden) return;

            const delta = lastFrameTime === 0 ? 0 : Math.min((now - lastFrameTime) / 1000, 0.06);
            lastFrameTime = now;
            ambientTime += delta;

            if (state.reducedMotion) {
                openness = targetOpenness;
            } else if (openness !== targetOpenness) {
                openingTime = Math.min(1.8, openingTime + delta);
                openness = THREE.MathUtils.lerp(fromOpenness, targetOpenness, ease(openingTime / 1.8));
            }

            shutter.position.z = -openness * 0.34;
            slotLight.intensity = openness * 0.7;
            indicatorMaterial.emissiveIntensity = 0.04 + openness * 0.42 + pulseTime * 0.4;
            key.intensity = 3.5 + (state.phase !== "closed" && !state.reducedMotion ? Math.sin(ambientTime * 0.55) * (state.phase === "waiting" ? 0.22 : 0.06) : 0);

            if (state.phase === "open" && !state.reducedMotion && openness > 0.98 && pendingVotes > 0) {
                // 1:1 — semua suara yang mengantre langsung diterbangkan detik ini juga.
                while (pendingVotes > 0 && papers.length < MAX_PAPERS) {
                    const mesh = paperPrototype.clone(true);
                    const side = nextPaper++ % 2 === 0 ? -1 : 1;
                    // Sebaran acak kecil agar surat yang lahir bersamaan tidak menumpuk persis.
                    const offset = side * (0.45 + Math.random() * 0.35);
                    scene.add(mesh);
                    papers.push({ mesh, age: 0, offset });
                    setPendingVotes(pendingVotes - 1);
                }
            }

            for (let index = papers.length - 1; index >= 0; index -= 1) {
                const paper = papers[index];
                paper.age += delta;
                const progress = Math.min(1, paper.age / 2.4);
                const approach = ease(Math.min(progress / 0.58, 1));
                const insertion = Math.max(0, (progress - 0.58) / 0.42);
                paper.mesh.position.set(
                    paper.offset * (1 - approach),
                    progress < 0.58 ? THREE.MathUtils.lerp(3.83, 3.04, approach) : THREE.MathUtils.lerp(3.04, 1.7, ease(insertion)),
                    -0.12 * (1 - approach),
                );
                paper.mesh.rotation.set(0.08 * (1 - approach), 0.2 * (1 - approach), -0.17 * (1 - approach));

                if (progress === 1) {
                    scene.remove(paper.mesh);
                    papers.splice(index, 1);
                    pulseTime = 1;
                }
            }

            pulseTime = Math.max(0, pulseTime - delta * 1.05);
            pulse.scale.setScalar(1 + (1 - pulseTime) * 0.4);
            pulseMaterial.opacity = pulseTime * 0.22;

            const moving = openness !== targetOpenness || papers.length > 0 || pendingVotes > 0 || pulseTime > 0;
            const keepAnimating = moving || (state.phase !== "closed" && !state.reducedMotion);
            if (dirty || !keepAnimating || now - lastRenderedAt >= 1000 / 30) {
                try {
                    webgl.render(scene, camera);
                    webgl.domElement.style.visibility = "visible";
                    host.dataset.sceneReady = "true";
                    lastRenderedAt = now;
                    dirty = false;
                } catch {
                    showFallback();
                    return;
                }
            }

            if (keepAnimating) {
                schedule();
            } else {
                lastFrameTime = 0;
            }
        }

        function resize() {
            if (disposed || failed) return;
            const width = Math.max(1, host.clientWidth);
            const height = Math.max(1, host.clientHeight);
            const aspect = width / height;
            const halfHeight = Math.max(2.45, 2.35 / aspect);
            camera.left = -halfHeight * aspect;
            camera.right = halfHeight * aspect;
            camera.top = halfHeight;
            camera.bottom = -halfHeight;
            camera.updateProjectionMatrix();
            webgl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
            webgl.setSize(width, height, false);
            dirty = true;
            schedule();
        }

        onContextLost = (event) => {
            event.preventDefault();
            showFallback();
        };
        webgl.domElement.addEventListener("webglcontextlost", onContextLost);

        onVisibility = () => {
            stop();
            clearPapers();
            openness = targetOpenness;
            lastFrameTime = 0;
            dirty = true;
            schedule();
        };
        document.addEventListener("visibilitychange", onVisibility);
        observer = new ResizeObserver(resize);
        observer.observe(host);
        resize();

        return {
            update(nextState) {
                if (disposed || failed) return;
                const delta = nextState.totalVotes - lastVoteCount;
                const previousPhase = state.phase;
                lastVoteCount = nextState.totalVotes;
                state = nextState;

                const nextOpenness = state.phase === "open" ? 1 : 0;
                if (nextOpenness !== targetOpenness) {
                    fromOpenness = openness;
                    targetOpenness = nextOpenness;
                    openingTime = 0;
                }

                // Closing takes priority over a vote in the same update. Resuming a
                // hidden tab or loading an existing session never replays its votes.
                if (state.phase !== "open" || state.reducedMotion || document.hidden || delta < 0) {
                    clearPapers();
                } else if (previousPhase === "open" && delta > 0) {
                    setPendingVotes(pendingVotes + delta);
                }

                dirty = true;
                schedule();
            },
            dispose,
        };
    } catch {
        showFallback();
        dispose();
        return null;
    }
}
