"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { findHexPath, hexDistance, hexKey, type HexCoord } from "../game/hex/grid";
import { createCloudField } from "../game/systems/clouds";

type HexInfo = { key: string; q: number; r: number; distance: number; title: string; description: string; baseEnergy: number };
type SelectionInfo = HexInfo & { energy: number; waterCost: number; shade: number; steps: number };
type TravelResult = { energySpent: number; waterSpent: number; newHour: number };
type CameraMode = "follow" | "free";
type VisualMode = "classic" | "natural";
type SceneApi = { setHour: (hour: number) => void; setCameraMode: (mode: CameraMode) => void; setVisualMode: (mode: VisualMode) => void; travelSelection: () => Promise<TravelResult | null> };

const HEX_RADIUS = 15;
const HEX_SIZE = 1.08;
const START_HEX: HexCoord = { q: 1, r: 0 };
const toWorld = (q: number, r: number) => new THREE.Vector3(HEX_SIZE * Math.sqrt(3) * (q + r / 2), 0, HEX_SIZE * 1.5 * r);
const seeded = (q: number, r: number, salt = 0) => {
  const value = Math.sin(q * 127.1 + r * 311.7 + salt * 74.7) * 43758.5453;
  return value - Math.floor(value);
};

function terrainColor(range: number, q: number, r: number) {
  const variation = seeded(q, r, 3) * 0.04 - 0.02;
  if (range === 0) return new THREE.Color("#3f916f");
  if (range <= 1) return new THREE.Color("#64965f").offsetHSL(variation, 0, 0);
  if (range <= 2) return new THREE.Color("#78965e").offsetHSL(variation, 0, 0);
  if (range <= 3) return new THREE.Color("#929d62").offsetHSL(variation, 0, 0);
  if (range <= 4) return new THREE.Color("#b69a5e").offsetHSL(variation, 0, 0);
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

function makeShrub(scale = 1) {
  const shrub = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: "#397553", roughness: 0.94, flatShading: true });
  [[0, 0.16, 0], [0.16, 0.1, 0.06], [-0.13, 0.09, -0.05]].forEach(([x, y, z], index) => {
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(index === 0 ? 0.22 : 0.17, 0), material);
    crown.position.set(x, y, z);
    crown.scale.y = 0.72;
    crown.castShadow = true;
    shrub.add(crown);
  });
  shrub.scale.setScalar(scale);
  return shrub;
}

function createNaturalTerrain() {
  const width = 66;
  const depth = 58;
  const columns = 96;
  const rows = 84;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const sand = new THREE.Color();
  const dunes = Array.from({ length: 17 }, (_, index) => ({
    x: (seeded(index, 2, 41) - 0.5) * 52,
    z: (seeded(index, 3, 42) - 0.5) * 44,
    length: 4.6 + seeded(index, 4, 43) * 6.8,
    width: 1.7 + seeded(index, 5, 44) * 2.4,
    height: 0.38 + seeded(index, 6, 45) * 0.82,
    angle: -0.34 + seeded(index, 7, 46) * 0.28,
  })).filter((dune) => Math.hypot(dune.x, dune.z) > 7.5);

  const sampleSurface = (x: number, z: number) => {
    const oasisFade = THREE.MathUtils.smoothstep(Math.hypot(x * 0.88, z), 5.2, 8.4);
    let height = (Math.sin(x * 0.29 + z * 0.13) + Math.sin(z * 0.37 - x * 0.08)) * 0.035;
    let crest = 0;
    for (const dune of dunes) {
      const dx = x - dune.x;
      const dz = z - dune.z;
      const along = dx * Math.cos(dune.angle) + dz * Math.sin(dune.angle);
      const across = -dx * Math.sin(dune.angle) + dz * Math.cos(dune.angle);
      const lengthFade = Math.exp(-Math.pow(along / dune.length, 4));
      const windward = across < 0 ? Math.exp(-Math.pow(across / dune.width, 2)) : Math.exp(-Math.pow(across / (dune.width * 0.48), 2));
      height += dune.height * lengthFade * windward * oasisFade;
      crest = Math.max(crest, lengthFade * Math.exp(-Math.pow(across / (dune.width * 0.18), 2)) * oasisFade);
    }
    return { height: height * oasisFade - 0.2, crest, oasisFade };
  };

  for (let row = 0; row <= rows; row += 1) {
    for (let column = 0; column <= columns; column += 1) {
      const x = (column / columns - 0.5) * width;
      const z = (row / rows - 0.5) * depth;
      const { height, crest, oasisFade } = sampleSurface(x, z);
      positions.push(x, height, z);
      const warmth = 0.53 + height * 0.16 + crest * 0.08 + (seeded(column, row, 47) - 0.5) * 0.035;
      sand.setHSL(0.085, 0.49, THREE.MathUtils.clamp(warmth, 0.38, 0.68));
      if (oasisFade < 0.72) sand.lerp(new THREE.Color("#7e995f"), (1 - oasisFade) * 0.72);
      colors.push(sand.r, sand.g, sand.b);
    }
  }
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = row * (columns + 1) + column;
      const b = a + 1;
      const c = a + columns + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const terrain = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0 }));
  terrain.receiveShadow = true;
  return { terrain, heightAt: (x: number, z: number) => sampleSurface(x, z).height };
}

function setupScene(host: HTMLDivElement, onSelect: (hex: SelectionInfo) => void, onCameraModeChange: (mode: CameraMode) => void, onConfirmSelection: () => void) {
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

  const cameraSize = 18;
  const camera = new THREE.OrthographicCamera(-8, 8, 7.5, -7.5, 0.1, 120);
  const cameraOffset = new THREE.Vector3(12.5, 15.5, 14.5);
  const cameraTarget = new THREE.Vector3();
  camera.position.copy(cameraOffset);
  camera.lookAt(cameraTarget);
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
  const tileByKey = new Map<string, THREE.Mesh>();
  const classicTerrain = new THREE.Group();
  const naturalSurface = createNaturalTerrain();
  const naturalTerrain = naturalSurface.terrain;
  naturalTerrain.visible = false;
  world.add(naturalTerrain, classicTerrain);
  // Tiles overlap very slightly so the logical hex grid stays invisible.
  const tileGeometry = new THREE.CylinderGeometry(HEX_SIZE * 1.012, HEX_SIZE * 1.012, 0.3, 6);
  const titles = ["Tichá duna", "Kamenný hřbet", "Závětrná pánev", "Zlatý přesyp"];

  for (let q = -HEX_RADIUS; q <= HEX_RADIUS; q += 1) {
    for (let r = Math.max(-HEX_RADIUS, -q - HEX_RADIUS); r <= Math.min(HEX_RADIUS, -q + HEX_RADIUS); r += 1) {
      const range = hexDistance({ q, r });
      const position = toWorld(q, r);
      const height = range <= 2 ? 0.15 : 0.16 + seeded(q, r, 1) * 0.1;
      const tile = new THREE.Mesh(tileGeometry, new THREE.MeshStandardMaterial({ color: terrainColor(range, q, r), roughness: 0.96, flatShading: true }));
      tile.position.set(position.x, height * 0.5 - 0.19, position.z);
      tile.scale.y = height / 0.3;
      tile.receiveShadow = true;
      tile.userData.hexKey = `${q},${r}`;
      tile.userData.topY = height - 0.19;
      classicTerrain.add(tile);
      selectable.push(tile);
      tileByKey.set(`${q},${r}`, tile);
      hexData.set(`${q},${r}`, {
        key: `${q},${r}`, q, r, distance: range,
        title: range === 0 ? "Srdce oázy" : titles[Math.floor(seeded(q, r, 16) * titles.length)],
        description: range === 0 ? "Bezpečný pramen, ze kterého vychází magie i všechny výpravy." : "Neprozkoumaný kus pouště. Stín mraků může cestu trochu ulehčit.",
        baseEnergy: range >= 5 && seeded(q, r, 19) > 0.62 ? 2 : 1,
      });
      if (range > 1 && seeded(q, r, 5) > 0.77) {
        const rock = makeRock(range > 4 ? "#654a3d" : "#7c6349");
        rock.position.set(position.x + 0.18, height + 0.18, position.z - 0.12);
        const rockScale = 0.55 + seeded(q, r, 7) * 0.78;
        rock.scale.setScalar(rockScale);
        rock.rotation.y = seeded(q, r, 6) * Math.PI;
        world.add(rock);
      }
      if (range > 0 && range <= 3 && seeded(q, r, 28) > 0.2) {
        const shrub = makeShrub(0.72 + seeded(q, r, 29) * 0.55);
        shrub.position.set(position.x - 0.28 + seeded(q, r, 30) * 0.5, height - 0.15, position.z - 0.25 + seeded(q, r, 31) * 0.46);
        shrub.rotation.y = seeded(q, r, 32) * Math.PI * 2;
        world.add(shrub);
      }
    }
  }

  const water = new THREE.Mesh(new THREE.CylinderGeometry(1.48, 1.58, 0.08, 40), new THREE.MeshPhysicalMaterial({ color: "#32b9a5", roughness: 0.18, transmission: 0.1, transparent: true, opacity: 0.94 }));
  water.position.y = 0.13;
  water.receiveShadow = true;
  world.add(water);
  const naturalWater = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.7, 0.075, 64), new THREE.MeshPhysicalMaterial({ color: "#39bda9", roughness: 0.13, transmission: 0.16, transparent: true, opacity: 0.9 }));
  naturalWater.scale.set(1.38, 1, 0.82);
  naturalWater.position.y = 0.1;
  naturalWater.receiveShadow = true;
  naturalWater.visible = false;
  world.add(naturalWater);
  [[1.42, 0.68], [-1.34, 0.78], [0.74, -1.46], [-1.14, -1.22], [1.86, -0.5], [-1.82, -0.38], [0.2, 1.7], [-0.22, -1.9]].forEach(([x, z], index) => {
    const palm = makePalm();
    palm.position.set(x, 0.12, z);
    palm.rotation.y = index * 1.7;
    palm.scale.setScalar(index % 2 === 0 ? 0.92 : 0.76);
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
  const playerStart = toWorld(START_HEX.q, START_HEX.r);
  player.position.set(playerStart.x, 0.12, playerStart.z);
  world.add(player);

  const portalPosition = toWorld(3, -2);
  const portal = new THREE.Group();
  const portalRing = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.09, 8, 22), new THREE.MeshStandardMaterial({ color: "#75d8c8", emissive: "#174f52", emissiveIntensity: 2.8, roughness: 0.36 }));
  portalRing.castShadow = true;
  portal.add(portalRing, new THREE.PointLight("#5fdac8", 3, 5, 2));
  portal.position.set(portalPosition.x, 0.75, portalPosition.z);
  world.add(portal);

  const cloudField = createCloudField();
  const cloudPlane = new THREE.Mesh(new THREE.PlaneGeometry(112, 112), new THREE.MeshBasicMaterial({ map: cloudField.texture, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
  cloudPlane.rotation.x = -Math.PI / 2;
  cloudPlane.position.y = 0.31;
  cloudPlane.renderOrder = 3;
  world.add(cloudPlane);

  const pathLine = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: "#ffe28b", transparent: true, opacity: 0.9, depthTest: false }),
  );
  pathLine.renderOrder = 5;
  pathLine.visible = false;
  world.add(pathLine);

  const selectionRing = new THREE.Mesh(new THREE.RingGeometry(0.84, 0.94, 6, 1, Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#fff0ae", transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthTest: false }));
  selectionRing.rotation.x = -Math.PI / 2;
  selectionRing.position.y = 0.46;
  selectionRing.visible = false;
  world.add(selectionRing);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let selectedPosition = new THREE.Vector3();
  let currentHex: HexCoord = { ...START_HEX };
  let selectedPath: HexCoord[] = [];
  let selectedPreview: SelectionInfo | null = null;
  let movementQueue: HexCoord[] = [];
  let movementResolve: ((result: TravelResult) => void) | null = null;
  let cameraMode: CameraMode = "follow";
  let visualMode: VisualMode = "classic";
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
    if (scene.fog instanceof THREE.FogExp2) scene.fog.color.copy(new THREE.Color("#253143").lerp(new THREE.Color(visualMode === "natural" ? "#c9ad7f" : "#b6b18f"), daylight));
    renderer.toneMappingExposure = 0.78 + daylight * 0.34;
  };
  lightAt(currentHour);

  const stepEnergy = (coord: HexCoord) => {
    const info = hexData.get(hexKey(coord));
    if (!info) return Number.POSITIVE_INFINITY;
    const position = toWorld(coord.q, coord.r);
    const shade = cloudField.sample(position.x, position.z);
    return info.baseEnergy * (1 - shade * 0.15);
  };

  const previewPath = (info: HexInfo) => {
    const goal = { q: info.q, r: info.r };
    const path = findHexPath(currentHex, goal, (coord) => hexData.has(hexKey(coord)), stepEnergy);
    const steps = path.slice(1);
    const energy = steps.reduce((total, coord) => total + stepEnergy(coord), 0);
    const shade = steps.length === 0 ? cloudField.sample(selectedPosition.x, selectedPosition.z) : steps.reduce((total, coord) => {
      const position = toWorld(coord.q, coord.r);
      return total + cloudField.sample(position.x, position.z);
    }, 0) / steps.length;
    return {
      ...info,
      energy: Number(energy.toFixed(1)),
      waterCost: Math.ceil(energy),
      shade: Math.round(shade * 100),
      steps: steps.length,
      path,
    };
  };

  const showPath = (path: HexCoord[]) => {
    const points = path.map((coord) => {
      const position = toWorld(coord.q, coord.r);
      const tile = tileByKey.get(hexKey(coord));
      position.y = visualMode === "natural" ? naturalSurface.heightAt(position.x, position.z) + 0.09 : Number(tile?.userData.topY ?? 0.08) + 0.08;
      return position;
    });
    pathLine.geometry.dispose();
    pathLine.geometry = new THREE.BufferGeometry().setFromPoints(points);
    pathLine.visible = points.length > 1;
  };

  const changeCameraMode = (mode: CameraMode, notify = false) => {
    cameraMode = mode;
    if (notify) onCameraModeChange(mode);
  };

  const changeVisualMode = (mode: VisualMode) => {
    visualMode = mode;
    classicTerrain.visible = mode === "classic";
    naturalTerrain.visible = mode === "natural";
    water.visible = mode === "classic";
    naturalWater.visible = mode === "natural";
    scene.fog = new THREE.FogExp2(mode === "natural" ? "#c9ad7f" : "#b6b18f", mode === "natural" ? 0.019 : 0.027);
    const playerPosition = toWorld(currentHex.q, currentHex.r);
    player.position.y = mode === "natural" ? naturalSurface.heightAt(playerPosition.x, playerPosition.z) + 0.31 : 0.12;
    if (selectedPath.length > 0) showPath(selectedPath);
    if (selectionRing.visible) selectionRing.position.y = mode === "natural" ? naturalSurface.heightAt(selectedPosition.x, selectedPosition.z) + 0.045 : Number(tileByKey.get(selectedPreview?.key ?? "")?.userData.topY ?? 0.28) + 0.025;
  };

  const panCamera = (horizontal: number, vertical: number) => {
    const forward = new THREE.Vector3(-cameraOffset.x, 0, -cameraOffset.z).normalize();
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
    cameraTarget.addScaledVector(right, horizontal).addScaledVector(forward, vertical);
    cameraTarget.x = THREE.MathUtils.clamp(cameraTarget.x, -28, 28);
    cameraTarget.z = THREE.MathUtils.clamp(cameraTarget.z, -25, 25);
  };

  const selectHex = (event: PointerEvent) => {
    if (movementQueue.length > 0) return;
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(selectable, false)[0];
    if (!hit) return;
    const info = hexData.get(hit.object.userData.hexKey as string);
    if (!info) return;
    if (selectedPreview?.key === info.key && selectedPath.length > 1) {
      onConfirmSelection();
      return;
    }
    selectedPosition = hit.object.position.clone();
    const selectedY = visualMode === "natural" ? naturalSurface.heightAt(selectedPosition.x, selectedPosition.z) + 0.045 : Number(hit.object.userData.topY ?? 0.28) + 0.025;
    selectionRing.position.set(selectedPosition.x, selectedY, selectedPosition.z);
    selectionRing.visible = true;
    const preview = previewPath(info);
    selectedPath = preview.path;
    selectedPreview = preview;
    showPath(selectedPath);
    onSelect(preview);
  };

  const pressedKeys = new Set<string>();
  const activeTouches = new Map<number, THREE.Vector2>();
  let rightDragging = false;
  let lastDrag = new THREE.Vector2();
  let lastTouchCenter: THREE.Vector2 | null = null;
  let lastTouchDistance = 0;
  let suppressSelectionUntil = 0;

  const enterFreeMode = () => {
    if (cameraMode === "free") return;
    changeCameraMode("free", true);
  };

  const keyDown = (event: KeyboardEvent) => {
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    pressedKeys.add(event.key);
    enterFreeMode();
  };
  const keyUp = (event: KeyboardEvent) => { pressedKeys.delete(event.key); };
  window.addEventListener("keydown", keyDown);
  window.addEventListener("keyup", keyUp);

  const pointerDown = (event: PointerEvent) => {
    if (event.button === 2) {
      event.preventDefault();
      rightDragging = true;
      lastDrag.set(event.clientX, event.clientY);
      suppressSelectionUntil = performance.now() + 250;
      enterFreeMode();
      renderer.domElement.setPointerCapture(event.pointerId);
    }
    if (event.pointerType === "touch") {
      activeTouches.set(event.pointerId, new THREE.Vector2(event.clientX, event.clientY));
      renderer.domElement.setPointerCapture(event.pointerId);
      if (activeTouches.size >= 2) {
        suppressSelectionUntil = performance.now() + 300;
        enterFreeMode();
        const points = [...activeTouches.values()];
        lastTouchCenter = points[0].clone().add(points[1]).multiplyScalar(0.5);
        lastTouchDistance = points[0].distanceTo(points[1]);
      }
    }
  };

  const pointerMove = (event: PointerEvent) => {
    if (rightDragging) {
      const dx = event.clientX - lastDrag.x;
      const dy = event.clientY - lastDrag.y;
      panCamera((-dx * 0.014) / camera.zoom, (dy * 0.014) / camera.zoom);
      lastDrag.set(event.clientX, event.clientY);
      suppressSelectionUntil = performance.now() + 250;
    }
    if (event.pointerType !== "touch" || !activeTouches.has(event.pointerId)) return;
    activeTouches.set(event.pointerId, new THREE.Vector2(event.clientX, event.clientY));
    if (activeTouches.size < 2) return;
    const points = [...activeTouches.values()];
    const center = points[0].clone().add(points[1]).multiplyScalar(0.5);
    const distance = points[0].distanceTo(points[1]);
    if (lastTouchCenter) {
      panCamera((-(center.x - lastTouchCenter.x) * 0.018) / camera.zoom, ((center.y - lastTouchCenter.y) * 0.018) / camera.zoom);
    }
    if (lastTouchDistance > 0) {
      camera.zoom = THREE.MathUtils.clamp(camera.zoom * (distance / lastTouchDistance), 0.72, 1.65);
      camera.updateProjectionMatrix();
    }
    lastTouchCenter = center;
    lastTouchDistance = distance;
    suppressSelectionUntil = performance.now() + 300;
  };

  const pointerUp = (event: PointerEvent) => {
    if (event.button === 2) rightDragging = false;
    if (event.pointerType === "touch") {
      activeTouches.delete(event.pointerId);
      if (activeTouches.size < 2) {
        lastTouchCenter = null;
        lastTouchDistance = 0;
      }
    }
    if (event.button === 0 && performance.now() >= suppressSelectionUntil) selectHex(event);
  };
  const contextMenu = (event: MouseEvent) => event.preventDefault();
  renderer.domElement.addEventListener("pointerdown", pointerDown);
  renderer.domElement.addEventListener("pointermove", pointerMove);
  renderer.domElement.addEventListener("pointerup", pointerUp);
  renderer.domElement.addEventListener("pointercancel", pointerUp);
  renderer.domElement.addEventListener("contextmenu", contextMenu);
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
    cloudField.advance(delta);
    portalRing.rotation.z += delta * 0.45;
    portal.position.y = 0.75 + Math.sin(clock.elapsedTime * 1.6) * 0.035;
    water.rotation.y += delta * 0.04;
    naturalWater.rotation.y -= delta * 0.025;
    if (cameraMode === "free") {
      const horizontal = Number(pressedKeys.has("ArrowRight")) - Number(pressedKeys.has("ArrowLeft"));
      const vertical = Number(pressedKeys.has("ArrowUp")) - Number(pressedKeys.has("ArrowDown"));
      if (horizontal || vertical) panCamera((horizontal * delta * 7) / camera.zoom, (vertical * delta * 7) / camera.zoom);
    } else {
      const playerWorld = world.localToWorld(player.position.clone());
      cameraTarget.lerp(new THREE.Vector3(playerWorld.x, 0, playerWorld.z), Math.min(1, delta * 5.5));
    }
    const nextHex = movementQueue[0];
    if (nextHex) {
      const target = toWorld(nextHex.q, nextHex.r);
      target.y = visualMode === "natural" ? naturalSurface.heightAt(target.x, target.z) + 0.31 : 0.12;
      const direction = target.clone().sub(player.position);
      const remaining = direction.length();
      if (remaining > 0.001) player.rotation.y = Math.atan2(direction.x, direction.z);
      player.position.add(direction.normalize().multiplyScalar(Math.min(remaining, delta * 3.2)));
      if (remaining < 0.055) {
        player.position.copy(target);
        currentHex = nextHex;
        movementQueue.shift();
        if (movementQueue.length === 0 && selectedPreview && movementResolve) {
          const result = {
            energySpent: selectedPreview.energy,
            waterSpent: selectedPreview.waterCost,
            newHour: (targetHour + selectedPreview.energy * 0.2) % 24,
          };
          targetHour = result.newHour;
          pathLine.visible = false;
          selectionRing.visible = false;
          movementResolve(result);
          movementResolve = null;
          selectedPreview = null;
          selectedPath = [];
        }
      }
    }
    camera.position.copy(cameraTarget).add(cameraOffset);
    camera.lookAt(cameraTarget);
    renderer.render(scene, camera);
  };
  animate();

  return {
    api: {
      setHour: (hour: number) => { targetHour = hour; },
      setCameraMode: (mode: CameraMode) => { changeCameraMode(mode); },
      setVisualMode: (mode: VisualMode) => { changeVisualMode(mode); },
      travelSelection: () => {
        if (!selectedPreview || selectedPath.length <= 1 || movementQueue.length > 0) return Promise.resolve(null);
        movementQueue = selectedPath.slice(1);
        return new Promise<TravelResult>((resolve) => { movementResolve = resolve; });
      },
    } satisfies SceneApi,
    dispose: () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointermove", pointerMove);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      renderer.domElement.removeEventListener("pointercancel", pointerUp);
      renderer.domElement.removeEventListener("contextmenu", contextMenu);
      renderer.domElement.removeEventListener("wheel", zoom);
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        if (object.geometry !== tileGeometry) object.geometry.dispose();
        (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => material.dispose());
      });
      tileGeometry.dispose();
      pathLine.geometry.dispose();
      (pathLine.material as THREE.Material).dispose();
      cloudField.texture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

function Resource({ label, current, maximum, className }: { label: string; current: number; maximum: number; className: string }) {
  const percentage = `${Math.max(0, Math.min(100, (current / maximum) * 100))}%`;
  return <div className={`resource ${className}`}><div className="resource-label"><span>{label}</span><strong>{Math.round(current)} / {maximum}</strong></div><div className="meter"><span style={{ width: percentage }} /></div></div>;
}

export default function OasisGame() {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<SceneApi | null>(null);
  const [hour, setHour] = useState(9);
  const [selected, setSelected] = useState<SelectionInfo | null>(null);
  const [water, setWater] = useState(12);
  const [moving, setMoving] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>("follow");
  const [visualMode, setVisualMode] = useState<VisualMode>("classic");
  const [webglError, setWebglError] = useState(false);

  const performTravel = async (api: SceneApi | null = scene.current) => {
    if (!api) return;
    setMoving(true);
    const result = await api.travelSelection();
    if (result) {
      setWater((current) => Math.max(0, current - result.waterSpent));
      setHour(Math.round(result.newHour * 10) / 10);
      setSelected(null);
    }
    setMoving(false);
  };

  useEffect(() => {
    if (!host.current) return;
    try {
      let instance: ReturnType<typeof setupScene>;
      instance = setupScene(host.current, setSelected, setCameraMode, () => { void performTravel(instance.api); });
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
  const wholeHour = Math.floor(hour) % 24;
  const minutes = Math.round((hour - Math.floor(hour)) * 60) % 60;
  const hourLabel = `${String(wholeHour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  const toggleCamera = () => {
    const next = cameraMode === "follow" ? "free" : "follow";
    setCameraMode(next);
    scene.current?.setCameraMode(next);
  };
  const toggleVisual = () => {
    const next = visualMode === "classic" ? "natural" : "classic";
    setVisualMode(next);
    scene.current?.setVisualMode(next);
  };

  return (
    <main className="game-shell">
      <div ref={host} className="scene-host" aria-label="3D mapa oázy a okolní pouště" />
      {webglError && <div className="webgl-fallback">3D náhled potřebuje v prohlížeči povolené WebGL.</div>}
      <div className="vignette" />
      <div className="hud">
        <header className="brand"><p className="eyebrow">Výprava začíná</p><h1>Oasis</h1></header>
        <button className="camera-toggle" type="button" onClick={toggleCamera} aria-pressed={cameraMode === "follow"}>
          <span aria-hidden="true">{cameraMode === "follow" ? "◎" : "✥"}</span>
          <span>{cameraMode === "follow" ? "Sledovat hráče" : "Volná kamera"}</span>
        </button>
        <button className="visual-toggle" type="button" onClick={toggleVisual} aria-pressed={visualMode === "natural"}>
          <span aria-hidden="true">◒</span>
          <span>{visualMode === "classic" ? "Přírodní vzhled" : "Klasický vzhled"}</span>
        </button>
        <section className="resource-bar" aria-label="Zdroje hráče">
          <Resource label="Vitalita" current={20} maximum={20} className="vitality" />
          <Resource label="Pramen" current={10} maximum={10} className="spring" />
          <Resource label="Voda" current={water} maximum={12} className="water" />
        </section>
        <section className="time-card" aria-label="Denní doba">
          <div className="time-row"><div className="time-copy"><span>{period}</span><strong>{hourLabel}</strong></div><button className="time-button" type="button" onClick={advanceTime} aria-label="Posunout čas o tři hodiny">›</button></div>
          <div className="time-track" style={{ "--time-progress": hour / 24 } as React.CSSProperties}><div className="time-dot" /></div>
        </section>
        <section className="selection-card" aria-live="polite">
          <p className="eyebrow">{selected ? "Vybraná oblast" : "Průzkum"}</p>
          <h2>{selected?.title ?? "Vyber cíl cesty"}</h2>
          <p>{selected?.description ?? "Klepni na některé místo v poušti a zobrazí se jeho předběžná cena."}</p>
          <div className="cost-row">
            <span className="cost-chip">Energie <strong>{selected?.energy ?? "—"}</strong></span>
            <span className="cost-chip">Voda <strong>{selected?.waterCost ?? "—"}</strong></span>
            <span className="cost-chip">Stín <strong>{selected ? `${selected.shade} %` : "—"}</strong></span>
            <span className="cost-chip">Kroky <strong>{selected?.steps ?? "—"}</strong></span>
          </div>
          {selected && selected.waterCost > water && <p className="warning">Voda cestu nepokryje. Další krok později vyvolá postih vyčerpání.</p>}
          <button className="action-button" type="button" disabled={!selected || selected.steps === 0 || moving} onClick={() => { void performTravel(); }}>{moving ? "Cesta probíhá…" : selected?.steps === 0 ? "Už jsi tady" : selected ? "Vyrazit sem" : "Nejdřív vyber cíl"}</button>
        </section>
        <div className="hint">Pohyb: vyber cíl a klepni znovu · kamera: šipky, pravé tlačítko nebo dva prsty</div>
      </div>
    </main>
  );
}
