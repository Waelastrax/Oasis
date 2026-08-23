"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

type HexInfo = { key: string; q: number; r: number; distance: number; title: string; description: string; energy: number; shade: number };
type SceneApi = { setHour: (hour: number) => void; focusSelection: () => void };

const HEX_RADIUS = 7;
const HEX_SIZE = 1.08;
const distance = (q: number, r: number) => (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
const toWorld = (q: number, r: number) => new THREE.Vector3(HEX_SIZE * Math.sqrt(3) * (q + r / 2), 0, HEX_SIZE * 1.5 * r);
const seeded = (q: number, r: number, salt = 0) => {
  const value = Math.sin(q * 127.1 + r * 311.7 + salt * 74.7) * 43758.5453;
  return value - Math.floor(value);
};

function terrainColor(range: number, q: number, r: number) {
  const variation = seeded(q, r, 3) * 0.12 - 0.06;
  if (range === 0) return new THREE.Color("#4a9d85");
  if (range <= 1) return new THREE.Color("#8c9d6c").offsetHSL(variation, 0, 0);
  if (range <= 3) return new THREE.Color("#c89d5e").offsetHSL(variation, 0, 0);
  return new THREE.Color("#b77c46").offsetHSL(variation, 0, -range * 0.006);
}

function makePalm() {
  const palm = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.11, 1.15, 6),
    new THREE.MeshStandardMaterial({ color: "#795337", roughness: 0.92 }),
  );
  trunk.position.y = 0.74;
  trunk.rotation.z = 0.08;
  trunk.castShadow = true;
  palm.add(trunk);
  const leafMaterial = new THREE.MeshStandardMaterial({ color: "#36765d", roughness: 0.82 });
  for (let index = 0; index < 6; index += 1) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.96, 4), leafMaterial);
    leaf.position.set(0, 1.34, 0);
    leaf.rotation.order = "YXZ";
    leaf.rotation.y = (Math.PI * 2 * index) / 6;
    leaf.rotation.x = Math.PI / 2.7;
    leaf.translateY(0.36);
    leaf.castShadow = true;
    palm.add(leaf);
  }
  return palm;
}

function makeRock(color = "#715c48") {
  const geometry = new THREE.IcosahedronGeometry(0.35, 0);
  const positions = geometry.attributes.position;
  for (let index = 0; index < positions.count; index += 1) {
    const scale = 0.82 + seeded(index, index * 2, 8) * 0.36;
    positions.setXYZ(index, positions.getX(index) * scale, positions.getY(index) * (0.7 + scale * 0.18), positions.getZ(index) * scale);
  }
  geometry.computeVertexNormals();
  const rock = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }));
  rock.castShadow = true;
  rock.receiveShadow = true;
  return rock;
}

function cloudTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.Texture();
  context.fillStyle = "black";
  context.fillRect(0, 0, size, size);
  context.filter = "blur(18px)";
  for (let index = 0; index < 52; index += 1) {
    const x = seeded(index, 2, 11) * size;
    const y = seeded(index, 3, 12) * size;
    const radius = 12 + seeded(index, 4, 13) * 34;
    const strength = 0.12 + seeded(index, 5, 14) * 0.22;
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(255,255,255,${strength})`);
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  context.filter = "none";
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.2, 2.2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function setupScene(host: HTMLDivElement, onSelect: (hex: HexInfo) => void) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#9bc0be");
  scene.fog = new THREE.FogExp2("#b6b18f", 0.027);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  host.appendChild(renderer.domElement);

  const cameraSize = 15;
  const camera = new THREE.OrthographicCamera(-8, 8, 7.5, -7.5, 0.1, 120);
  camera.position.set(12.5, 15.5, 14.5);
  camera.lookAt(0, 0, 0);
  const hemisphere = new THREE.HemisphereLight("#bfe4df", "#725139", 2.15);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight("#ffd493", 4.2);
  sun.position.set(-9, 15, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 50 });
  sun.shadow.bias = -0.0006;
  scene.add(sun);

  const world = new THREE.Group();
  world.rotation.y = -0.08;
  scene.add(world);
  const selectable: THREE.Mesh[] = [];
  const hexData = new Map<string, HexInfo>();
  const tileGeometry = new THREE.CylinderGeometry(HEX_SIZE * 0.98, HEX_SIZE * 0.98, 0.3, 6);
  const titles = ["Tichá duna", "Kamenný hřbet", "Závětrná pánev", "Zlatý přesyp"];

  for (let q = -HEX_RADIUS; q <= HEX_RADIUS; q += 1) {
    for (let r = Math.max(-HEX_RADIUS, -q - HEX_RADIUS); r <= Math.min(HEX_RADIUS, -q + HEX_RADIUS); r += 1) {
      const range = distance(q, r);
      const position = toWorld(q, r);
      const height = range === 0 ? 0.14 : 0.15 + seeded(q, r, 1) * 0.26;
      const tile = new THREE.Mesh(tileGeometry, new THREE.MeshStandardMaterial({ color: terrainColor(range, q, r), roughness: 0.96, flatShading: true }));
      tile.position.set(position.x, height * 0.5 - 0.19, position.z);
      tile.scale.y = height / 0.3;
      tile.receiveShadow = true;
      tile.userData.hexKey = `${q},${r}`;
      world.add(tile);
      selectable.push(tile);
      hexData.set(`${q},${r}`, {
        key: `${q},${r}`, q, r, distance: range,
        title: range === 0 ? "Srdce oázy" : titles[Math.floor(seeded(q, r, 16) * titles.length)],
        description: range === 0 ? "Bezpečný pramen, ze kterého vychází magie i všechny výpravy." : "Neprozkoumaný kus pouště. Stín mraků může cestu trochu ulehčit.",
        energy: Math.max(1, range + Math.round(seeded(q, r, 19) * 2)),
        shade: Math.round(seeded(q, r, 22) * 32 + 8),
      });
      if (range > 1 && seeded(q, r, 5) > 0.77) {
        const rock = makeRock(range > 4 ? "#654a3d" : "#7c6349");
        rock.position.set(position.x + 0.18, height + 0.18, position.z - 0.12);
        const rockScale = 0.55 + seeded(q, r, 7) * 0.78;
        rock.scale.setScalar(rockScale);
        rock.rotation.y = seeded(q, r, 6) * Math.PI;
        world.add(rock);
      }
    }
  }

  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.9, 0.08, 32), new THREE.MeshPhysicalMaterial({ color: "#39b8aa", roughness: 0.2, transmission: 0.08, transparent: true, opacity: 0.93 }));
  water.position.y = 0.13;
  water.receiveShadow = true;
  world.add(water);
  [[0.72, 0.4], [-0.65, 0.44], [0.42, -0.74], [-0.58, -0.62]].forEach(([x, z], index) => {
    const palm = makePalm();
    palm.position.set(x, 0.12, z);
    palm.rotation.y = index * 1.7;
    palm.scale.setScalar(index % 2 === 0 ? 0.85 : 0.72);
    world.add(palm);
  });

  const player = new THREE.Group();
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.7, 7), new THREE.MeshStandardMaterial({ color: "#355f5c", roughness: 0.8 }));
  robe.position.y = 0.55;
  robe.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), new THREE.MeshStandardMaterial({ color: "#9d6646", roughness: 0.9 }));
  head.position.y = 1;
  head.castShadow = true;
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.06, 6, 12), new THREE.MeshStandardMaterial({ color: "#d3a04d", roughness: 0.84 }));
  scarf.position.y = 0.87;
  scarf.rotation.x = Math.PI / 2;
  scarf.castShadow = true;
  player.add(robe, head, scarf);
  player.position.set(0.2, 0.12, 0.1);
  world.add(player);

  const portalPosition = toWorld(3, -2);
  const portal = new THREE.Group();
  const portalRing = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.09, 8, 22), new THREE.MeshStandardMaterial({ color: "#75d8c8", emissive: "#174f52", emissiveIntensity: 2.8, roughness: 0.36 }));
  portalRing.castShadow = true;
  portal.add(portalRing, new THREE.PointLight("#5fdac8", 3, 5, 2));
  portal.position.set(portalPosition.x, 0.75, portalPosition.z);
  world.add(portal);

  const clouds = cloudTexture();
  const cloudPlane = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), new THREE.MeshBasicMaterial({ map: clouds, color: "#294b4b", transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.MultiplyBlending }));
  cloudPlane.rotation.x = -Math.PI / 2;
  cloudPlane.position.y = 0.43;
  cloudPlane.renderOrder = 3;
  world.add(cloudPlane);

  const selectionRing = new THREE.Mesh(new THREE.RingGeometry(0.82, 0.93, 6), new THREE.MeshBasicMaterial({ color: "#fff0ae", transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  selectionRing.rotation.x = -Math.PI / 2;
  selectionRing.position.y = 0.46;
  selectionRing.visible = false;
  world.add(selectionRing);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let selectedPosition = new THREE.Vector3();
  let currentHour = 9;
  let targetHour = 9;
  let frame = 0;

  const lightAt = (hour: number) => {
    const angle = ((hour - 6) / 24) * Math.PI * 2;
    const daylight = THREE.MathUtils.smoothstep(Math.sin(angle), -0.2, 0.55);
    const sunset = Math.max(0, 1 - Math.abs(Math.sin(angle)) * 3.2) * daylight;
    sun.position.set(Math.cos(angle) * 14, Math.max(2.2, Math.sin(angle) * 16), 8);
    sun.intensity = 0.45 + daylight * 3.8;
    sun.color.set(daylight > 0.35 ? "#ffd493" : "#7797b8").lerp(new THREE.Color("#f28a5d"), sunset * 0.42);
    hemisphere.intensity = 0.55 + daylight * 1.65;
    hemisphere.color.set(daylight > 0.3 ? "#bfe4df" : "#435775");
    hemisphere.groundColor.set(daylight > 0.3 ? "#725139" : "#171b2b");
    scene.background = new THREE.Color("#1a253a").lerp(new THREE.Color("#9bc0be"), daylight);
    if (scene.fog instanceof THREE.FogExp2) scene.fog.color.copy(new THREE.Color("#253143").lerp(new THREE.Color("#b6b18f"), daylight));
    renderer.toneMappingExposure = 0.78 + daylight * 0.34;
  };
  lightAt(currentHour);

  const selectHex = (event: PointerEvent) => {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(selectable, false)[0];
    if (!hit) return;
    const info = hexData.get(hit.object.userData.hexKey as string);
    if (!info) return;
    selectedPosition = hit.object.position.clone();
    selectionRing.position.set(selectedPosition.x, 0.47, selectedPosition.z);
    selectionRing.visible = true;
    onSelect(info);
  };
  renderer.domElement.addEventListener("pointerup", selectHex);
  const zoom = (event: WheelEvent) => {
    event.preventDefault();
    camera.zoom = THREE.MathUtils.clamp(camera.zoom * (event.deltaY > 0 ? 0.9 : 1.1), 0.72, 1.65);
    camera.updateProjectionMatrix();
  };
  renderer.domElement.addEventListener("wheel", zoom, { passive: false });

  const resize = () => {
    const aspect = host.clientWidth / Math.max(host.clientHeight, 1);
    camera.left = (-cameraSize * aspect) / 2;
    camera.right = (cameraSize * aspect) / 2;
    camera.top = cameraSize / 2;
    camera.bottom = -cameraSize / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(host.clientWidth, host.clientHeight);
  };
  window.addEventListener("resize", resize);
  resize();

  const clock = new THREE.Clock();
  const animate = () => {
    frame = requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.04);
    const hourDelta = ((targetHour - currentHour + 36) % 24) - 12;
    currentHour = (currentHour + hourDelta * Math.min(1, delta * 1.7) + 24) % 24;
    lightAt(currentHour);
    clouds.offset.set((currentHour / 24) * 0.42, (currentHour / 24) * 0.16);
    portalRing.rotation.z += delta * 0.45;
    portal.position.y = 0.75 + Math.sin(clock.elapsedTime * 1.6) * 0.035;
    water.rotation.y += delta * 0.04;
    renderer.render(scene, camera);
  };
  animate();

  return {
    api: {
      setHour: (hour: number) => { targetHour = hour; },
      focusSelection: () => {
        if (!selectionRing.visible) return;
        camera.position.lerp(new THREE.Vector3(selectedPosition.x + 12.5, 15.5, selectedPosition.z + 14.5), 0.34);
        camera.lookAt(selectedPosition.x, 0, selectedPosition.z);
      },
    } satisfies SceneApi,
    dispose: () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("pointerup", selectHex);
      renderer.domElement.removeEventListener("wheel", zoom);
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        if (object.geometry !== tileGeometry) object.geometry.dispose();
        (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => material.dispose());
      });
      tileGeometry.dispose();
      clouds.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

function Resource({ label, value, className }: { label: string; value: string; className: string }) {
  return <div className={`resource ${className}`}><div className="resource-label"><span>{label}</span><strong>{value}</strong></div><div className="meter"><span /></div></div>;
}

export default function OasisGame() {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<SceneApi | null>(null);
  const [hour, setHour] = useState(9);
  const [selected, setSelected] = useState<HexInfo | null>(null);
  const [webglError, setWebglError] = useState(false);

  useEffect(() => {
    if (!host.current) return;
    try {
      const instance = setupScene(host.current, setSelected);
      scene.current = instance.api;
      return () => { scene.current = null; instance.dispose(); };
    } catch {
      setWebglError(true);
    }
  }, []);

  const advanceTime = () => {
    const next = (hour + 3) % 24;
    setHour(next);
    scene.current?.setHour(next);
  };
  const period = hour >= 6 && hour < 11 ? "Ráno" : hour < 17 ? "Den" : hour < 21 ? "Soumrak" : "Noc";

  return (
    <main className="game-shell">
      <div ref={host} className="scene-host" aria-label="3D mapa oázy a okolní pouště" />
      {webglError && <div className="webgl-fallback">3D náhled potřebuje v prohlížeči povolené WebGL.</div>}
      <div className="vignette" />
      <div className="hud">
        <header className="brand"><p className="eyebrow">Výprava začíná</p><h1>Oasis</h1></header>
        <section className="resource-bar" aria-label="Zdroje hráče">
          <Resource label="Vitalita" value="20 / 20" className="vitality" />
          <Resource label="Pramen" value="10 / 10" className="spring" />
          <Resource label="Voda" value="12 / 12" className="water" />
        </section>
        <section className="time-card" aria-label="Denní doba">
          <div className="time-row"><div className="time-copy"><span>{period}</span><strong>{String(hour).padStart(2, "0")}:00</strong></div><button className="time-button" type="button" onClick={advanceTime} aria-label="Posunout čas o tři hodiny">›</button></div>
          <div className="time-track" style={{ "--time-progress": hour / 24 } as React.CSSProperties}><div className="time-dot" /></div>
        </section>
        <section className="selection-card" aria-live="polite">
          <p className="eyebrow">{selected ? `Hex ${selected.q}, ${selected.r}` : "Průzkum"}</p>
          <h2>{selected?.title ?? "Vyber cíl cesty"}</h2>
          <p>{selected?.description ?? "Klepni na některé místo v poušti a zobrazí se jeho předběžná cena."}</p>
          <div className="cost-row">
            <span className="cost-chip">Energie <strong>{selected?.energy ?? "—"}</strong></span>
            <span className="cost-chip">Stín <strong>{selected ? `${selected.shade} %` : "—"}</strong></span>
            <span className="cost-chip">Vzdálenost <strong>{selected?.distance ?? "—"}</strong></span>
          </div>
          <button className="action-button" type="button" disabled={!selected} onClick={() => scene.current?.focusSelection()}>{selected ? "Zaměřit lokaci" : "Nejdřív vyber hex"}</button>
        </section>
        <div className="hint">Klikni na mapu · kolečkem přibliž · šipkou změň denní dobu</div>
      </div>
    </main>
  );
}
