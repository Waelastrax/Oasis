import * as THREE from "three";

const TEXTURE_SIZE = 256;
const PLANE_SIZE = 112;
const REPEAT = 4.8;

const seeded = (x: number, y: number, salt = 0) => {
  const value = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return value - Math.floor(value);
};

export type CloudField = {
  texture: THREE.CanvasTexture;
  offset: THREE.Vector2;
  advance: (seconds: number) => void;
  sample: (worldX: number, worldZ: number) => number;
};

export function createCloudField(): CloudField {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Cloud canvas is unavailable");
  context.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

  for (let index = 0; index < 34; index += 1) {
    const x = seeded(index, 2, 11) * TEXTURE_SIZE;
    const y = seeded(index, 3, 12) * TEXTURE_SIZE;
    const radiusX = 20 + seeded(index, 4, 13) * 43;
    const radiusY = radiusX * (0.48 + seeded(index, 5, 14) * 0.38);
    const strength = 0.54 + seeded(index, 6, 15) * 0.4;
    for (const offsetX of [-TEXTURE_SIZE, 0, TEXTURE_SIZE]) {
      for (const offsetY of [-TEXTURE_SIZE, 0, TEXTURE_SIZE]) {
        context.save();
        context.translate(x + offsetX, y + offsetY);
        context.scale(1, radiusY / radiusX);
        const gradient = context.createRadialGradient(0, 0, radiusX * 0.08, 0, 0, radiusX);
        gradient.addColorStop(0, `rgba(50,52,57,${strength})`);
        gradient.addColorStop(0.5, `rgba(61,62,65,${strength * 0.72})`);
        gradient.addColorStop(1, "rgba(72,70,68,0)");
        context.fillStyle = gradient;
        context.fillRect(-radiusX, -radiusX, radiusX * 2, radiusX * 2);
        context.restore();
      }
    }
  }

  const pixels = context.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE).data;
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(REPEAT, REPEAT);
  texture.colorSpace = THREE.SRGBColorSpace;
  const offset = new THREE.Vector2(0.08, 0.16);
  texture.offset.copy(offset);

  const sample = (worldX: number, worldZ: number) => {
    const u = ((((worldX / PLANE_SIZE + 0.5) * REPEAT + offset.x) % 1) + 1) % 1;
    const v = ((((0.5 - worldZ / PLANE_SIZE) * REPEAT + offset.y) % 1) + 1) % 1;
    const x = Math.min(TEXTURE_SIZE - 1, Math.floor(u * TEXTURE_SIZE));
    const y = Math.min(TEXTURE_SIZE - 1, Math.floor((1 - v) * TEXTURE_SIZE));
    return pixels[(y * TEXTURE_SIZE + x) * 4 + 3] / 255;
  };

  return {
    texture,
    offset,
    advance: (seconds: number) => {
      offset.x = (offset.x + seconds * 0.009) % 1;
      offset.y = (offset.y + seconds * 0.0035) % 1;
      texture.offset.copy(offset);
    },
    sample,
  };
}
