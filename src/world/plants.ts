import { BufferGeometry, CylinderGeometry, Float32BufferAttribute, IcosahedronGeometry, LatheGeometry, Matrix4, Mesh, Vector2, Vector3, type Material } from "three";
import type { Kit } from "./kit.ts";

export interface TreeSpec { x: number; z: number; height: number; crown: number; seed: number }

function rng(seed: number): () => number {
  let s = (seed * 2654435761) % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/** Trunks go through the Kit; crowns are alpha-cut leaf cards with normals bent outward from the crown (cheap and soft). */
export function buildTrees(kit: Kit, trees: readonly TreeSpec[], material: Material): Mesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const corners: readonly (readonly [number, number])[] = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
  for (const t of trees) {
    const r = rng(t.seed);
    const crownY = t.height * 0.7;
    const crownH = t.height * 0.3;
    const trunkTop = t.height * 0.5;
    const trunkR = 0.14 + t.height * 0.022;
    kit.add("bark", new CylinderGeometry(trunkR * 0.72, trunkR * 1.15, trunkTop, 9).translate(t.x, trunkTop / 2, t.z), undefined, 1.5);
    kit.block(t.x - trunkR, t.x + trunkR, t.z - trunkR, t.z + trunkR);
    const crownCenter = new Vector3(t.x, crownY, t.z);
    for (let b = 0; b < 7; b++) {
      const a = (b / 7) * Math.PI * 2 + r();
      const end = new Vector3(t.x + Math.cos(a) * t.crown * 0.55, crownY + (r() - 0.25) * crownH, t.z + Math.sin(a) * t.crown * 0.55);
      kit.beam("bark", new Vector3(t.x, trunkTop - 0.3, t.z), end, trunkR * 0.42, trunkR * 0.42, undefined, 1.5);
    }
    const clusters = Math.round(7 + t.crown * 0.7);
    for (let c = 0; c < clusters; c++) {
      const a = r() * Math.PI * 2;
      const rad = 0.28 + r() * 0.62;
      const center = new Vector3(t.x + Math.cos(a) * rad * t.crown, crownY + (r() - 0.42) * crownH * 1.3, t.z + Math.sin(a) * rad * t.crown);
      const spread = t.crown * 0.42;
      for (let i = 0; i < 74; i++) {
        const p = new Vector3(r() - 0.5, (r() - 0.5) * 0.7, r() - 0.5).normalize().multiplyScalar(spread * Math.cbrt(r())).add(center);
        const size = 0.5 + r() * 0.34;
        const ax = new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
        const ay = new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).cross(ax).normalize();
        const n = p.clone().sub(crownCenter).add(new Vector3(0, crownH * 0.75, 0)).normalize();
        const shade = (0.72 + r() * 0.45) * (0.72 + 0.38 * Math.min(1, Math.max(0, (p.y - t.height * 0.45) / (t.height * 0.5))));
        for (const [u, v] of corners) {
          positions.push(p.x + (ax.x * u + ay.x * v) * size, p.y + (ax.y * u + ay.y * v) * size, p.z + (ax.z * u + ay.z * v) * size);
          normals.push(n.x, n.y, n.z);
          uvs.push((u + 1) / 2, (v + 1) / 2);
          colors.push(shade, shade, shade);
        }
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(positions, 3));
  g.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  g.setAttribute("color", new Float32BufferAttribute(colors, 3));
  const mesh = new Mesh(g, material);
  mesh.name = "foliage";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  return mesh;
}

/** Clipped shrub in a terracotta pot, the ones lining the entrance. */
export function pottedShrub(kit: Kit, x: number, z: number, scale = 1): void {
  const profile = [[0.0, 0], [0.22, 0], [0.3, 0.12], [0.36, 0.42], [0.33, 0.62], [0.37, 0.66], [0.3, 0.68]].map(([a, b]) => new Vector2(a! * scale, b! * scale));
  kit.add("terracotta", new LatheGeometry(profile, 12).translate(x, 0, z));
  const y0 = 0.68 * scale;
  for (const [dy, r, dx] of [[0.3, 0.46, 0], [0.62, 0.3, 0.2], [0.72, 0.26, -0.22], [1.0, 0.2, 0.02]] as const) {
    const g = new IcosahedronGeometry(r * scale, 2).translate(x + dx * scale, y0 + dy * scale, z);
    kit.add("hedge", g, undefined, 1.1);
  }
  kit.block(x - 0.3 * scale, x + 0.3 * scale, z - 0.3 * scale, z + 0.3 * scale);
}

export function matrixAt(x: number, z: number, theta: number): Matrix4 {
  return new Matrix4().makeRotationY(theta).setPosition(x, 0, z);
}
