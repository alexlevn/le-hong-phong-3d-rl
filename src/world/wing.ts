import { PlaneGeometry, Vector3, type Matrix4 } from "three";
import type { Hole, Kit } from "./kit.ts";

export interface WingSpec {
  frame: Matrix4;
  length: number;
  width: number;
  /** Depth of the arcaded gallery behind the court-side face. */
  gallery: number;
  storeys: number;
  storeyH: number;
  bays: number;
  /** Bays with steps instead of a balustrade. */
  openBays?: readonly number[];
  /** Ground-floor bays left open at floor level where a neighbouring wing's corridor runs in (no balustrade, no steps). */
  passBays?: readonly number[];
  /** Open hall arcaded on both long sides under exposed trusses (the clock wing). */
  twoFaced?: boolean;
}

export const PLINTH = 0.45;
const FRONT_THICK = 0.42;
const OVERHANG = 0.95;
const PITCH = 0.6;

function balustrade(kit: Kit, m: Matrix4, x0: number, x1: number, y: number, z: number): void {
  kit.box("trim", x0, x1, y, y + 0.14, z, z + 0.3, m, 2);
  kit.box("trim", x0, x1, y + 0.82, y + 0.96, z - 0.03, z + 0.33, m, 2);
  const span = x1 - x0;
  const n = Math.max(3, Math.round(span / 0.27));
  for (let i = 0; i < n; i++) {
    const cx = x0 + ((i + 0.5) / n) * span;
    kit.box("trim", cx - 0.055, cx + 0.055, y + 0.14, y + 0.82, z + 0.09, z + 0.21, m, 2);
  }
}

function steps(kit: Kit, m: Matrix4, cx: number, hw: number, zFace: number, dir: 1 | -1): void {
  const zAt = (d: number): number => zFace + dir * d;
  const range = (a: number, b: number): [number, number] => (dir > 0 ? [zAt(a), zAt(b)] : [zAt(b), zAt(a)]);
  const [z0, z1] = range(0, 0.45);
  const [z2, z3] = range(0.45, 0.95);
  kit.box("concrete", cx - hw, cx + hw, 0, PLINTH * 0.66, z0, z1, m, 2);
  kit.box("concrete", cx - hw, cx + hw, 0, PLINTH * 0.33, z2, z3, m, 2);
  kit.floor(cx - hw, cx + hw, z0, z1, PLINTH * 0.66, m);
  kit.floor(cx - hw, cx + hw, z2, z3, PLINTH * 0.33, m);
}

/** One arcaded face: piers with imposts, archivolts, balustrades, steps at open bays. */
function arcadeFace(kit: Kit, s: WingSpec, z0: number, outward: 1 | -1): void {
  const m = s.frame;
  const bay = s.length / s.bays;
  const top = PLINTH + s.storeys * s.storeyH;
  const holes: Hole[] = [];
  const isOpen = (i: number): boolean => (s.openBays ?? []).includes(i);
  const isPass = (i: number): boolean => (s.passBays ?? []).includes(i);
  const zOut = outward < 0 ? z0 : z0 + FRONT_THICK;
  const proud = (from: number, to: number): [number, number] => (outward < 0 ? [zOut - to, zOut - from] : [zOut + from, zOut + to]);
  for (let k = 0; k < s.storeys; k++) {
    const f = PLINTH + k * s.storeyH;
    for (let i = 0; i < s.bays; i++) {
      const hw = (bay - 0.85) / 2;
      const h: Hole = { cx: (i + 0.5) * bay, hw, bottom: f + 0.01, spring: f + s.storeyH * 0.62, rise: hw * 0.62 };
      holes.push(h);
      const [az0, az1] = proud(0, 0.05);
      kit.archivolt("trim", h, 0.13, az0, az1 - az0, m);
      if (!(k === 0 && (isOpen(i) || isPass(i)))) balustrade(kit, m, i * bay + 0.42, (i + 1) * bay - 0.42, f, z0 + 0.06);
      if (k === 0 && !isPass(i)) {
        if (isOpen(i)) steps(kit, m, h.cx, hw + 0.15, zOut, outward);
        else kit.block(i * bay, (i + 1) * bay, z0, z0 + FRONT_THICK, m);
      }
    }
    for (let i = 0; i <= s.bays; i++) {
      const x = i * bay;
      const spring = f + s.storeyH * 0.62;
      const [iz0, iz1] = proud(-0.02, 0.1);
      const [bz0, bz1] = proud(-0.02, 0.06);
      kit.box("trim", x - 0.52, x + 0.52, spring - 0.14, spring + 0.03, iz0, iz1, m, 2);
      kit.box("trim", x - 0.47, x + 0.47, f, f + 0.42, bz0, bz1, m, 2);
    }
    if (k > 0) {
      const [cz0, cz1] = proud(-0.02, 0.14);
      kit.box("trim", -0.05, s.length + 0.05, f - 0.3, f - 0.06, cz0, cz1, m, 2);
    }
  }
  for (let i = 0; i <= s.bays; i++) kit.block(i * bay - 0.42, i * bay + 0.42, z0, z0 + FRONT_THICK, m);
  kit.archWall("plaster", 0, s.length, 0, top, z0, FRONT_THICK, holes, m);
  const [tz0, tz1] = proud(-0.02, 0.2);
  kit.box("trim", -0.05, s.length + 0.05, top - 0.28, top, tz0, tz1, m, 2);
  const [pz0, pz1] = proud(-0.02, 0.08);
  kit.box("ochre", -0.05, s.length + 0.05, 0, PLINTH * 0.85, pz0, pz1, m, 2);
}

function solidRooms(kit: Kit, s: WingSpec): void {
  const m = s.frame;
  const bay = s.length / s.bays;
  const top = PLINTH + s.storeys * s.storeyH;
  kit.box("plaster", 0, s.length, 0, top, s.gallery, s.width, m);
  kit.block(0, s.length, s.gallery, s.width, m);
  for (let k = 0; k < s.storeys; k++) {
    const f = PLINTH + k * s.storeyH;
    for (let i = 0; i < s.bays; i++) {
      const cx = (i + 0.5) * bay;
      kit.box("trim", cx - 0.78, cx + 0.78, f, f + 3.0, s.gallery - 0.05, s.gallery, m, 2);
      kit.panel("shutter", cx - 0.68, cx + 0.68, f + 0.03, f + 2.92, s.gallery - 0.06, -1, m);
      kit.box("trim", cx - 0.78, cx + 0.78, f + 0.75, f + 3.05, s.width, s.width + 0.05, m, 2);
      kit.panel("shutter", cx - 0.68, cx + 0.68, f + 0.82, f + 2.96, s.width + 0.06, 1, m);
      kit.box("trim", cx - 0.9, cx + 0.9, f + 0.68, f + 0.78, s.width, s.width + 0.14, m, 2);
    }
    if (k > 0) kit.box("trim", -0.05, s.length + 0.05, f - 0.26, f - 0.06, s.width, s.width + 0.12, m, 2);
    for (const [xFace, dir] of [[0, -1], [s.length, 1]] as const) {
      const cz = (s.gallery + s.width) / 2;
      kit.add("shutter", planeOnEnd(xFace, dir, cz, f + 0.8), m);
    }
  }
  kit.box("trim", -0.05, s.length + 0.05, top - 0.28, top, s.width, s.width + 0.2, m, 2);
  kit.box("ochre", -0.05, s.length + 0.05, 0, PLINTH * 0.85, s.width, s.width + 0.08, m, 2);
}

function planeOnEnd(xFace: number, dir: 1 | -1, cz: number, y0: number): PlaneGeometry {
  const g = new PlaneGeometry(1.5, 2.2);
  g.rotateY((dir * Math.PI) / 2);
  g.translate(xFace + dir * 0.02, y0 + 1.1, cz);
  return g;
}

/** Dark timber king-post trusses and purlins under the tiles of the clock wing. */
function trusses(kit: Kit, s: WingSpec, top: number): void {
  const m = s.frame;
  const bay = s.length / s.bays;
  const halfW = s.width / 2;
  const ridge = top + halfW * PITCH;
  for (let i = 0; i <= s.bays; i++) {
    const x = i * bay;
    const left = new Vector3(x, top + 0.05, 0.3);
    const right = new Vector3(x, top + 0.05, s.width - 0.3);
    const apex = new Vector3(x, ridge - 0.2, halfW);
    kit.beam("wood", left, right, 0.16, 0.24, m);
    kit.beam("wood", left, apex, 0.15, 0.2, m);
    kit.beam("wood", right, apex, 0.15, 0.2, m);
    kit.beam("wood", new Vector3(x, top + 0.05, halfW), apex, 0.15, 0.15, m);
    for (const side of [0.32, 0.66]) {
      const kx = new Vector3(x, top + 0.05 + side * (ridge - top - 0.25), side * halfW + 0.3);
      kit.beam("wood", kx, new Vector3(x, top + 0.05, halfW), 0.09, 0.1, m);
      const ky = new Vector3(x, top + 0.05 + side * (ridge - top - 0.25), s.width - side * halfW - 0.3);
      kit.beam("wood", ky, new Vector3(x, top + 0.05, halfW), 0.09, 0.1, m);
    }
  }
  for (let t = 0.14; t < 0.98; t += 0.21) {
    const y = top + 0.12 + t * (ridge - top - 0.3);
    for (const z of [0.3 + t * (halfW - 0.3), s.width - 0.3 - t * (halfW - 0.3)]) {
      kit.beam("wood", new Vector3(0, y, z), new Vector3(s.length, y, z), 0.1, 0.1, m);
    }
  }
}

export function buildWing(kit: Kit, s: WingSpec): void {
  const m = s.frame;
  const top = PLINTH + s.storeys * s.storeyH;
  arcadeFace(kit, s, 0, -1);
  const floorZ1 = s.twoFaced ? s.width - FRONT_THICK : s.gallery;
  if (s.twoFaced) {
    arcadeFace(kit, s, s.width - FRONT_THICK, 1);
    kit.hip("wood", -0.1, s.length + 0.1, 0.02, s.width - 0.02, top + 0.02, PITCH, m, { flip: true, tile: 1.6 });
    trusses(kit, s, top);
  } else {
    solidRooms(kit, s);
    kit.box("plaster", FRONT_THICK, s.length, top - 0.14, top - 0.02, FRONT_THICK, s.gallery, m);
  }
  for (let k = 0; k < s.storeys; k++) {
    const f = PLINTH + k * s.storeyH;
    kit.box("checker", 0.3, s.length - 0.3, f - 0.1, f, FRONT_THICK, floorZ1, m, 0.62);
    if (k > 0) kit.box("plaster", 0.3, s.length - 0.3, f - 0.26, f - 0.1, FRONT_THICK, floorZ1, m);
  }
  kit.box("ochre", 0, s.length, 0, PLINTH - 0.1, FRONT_THICK, floorZ1, m);
  kit.floor(0, s.length, 0, floorZ1 + FRONT_THICK, PLINTH, m);

  const roofZ0 = -OVERHANG;
  const roofZ1 = s.width + OVERHANG;
  const roofX0 = -OVERHANG;
  const roofX1 = s.length + OVERHANG;
  kit.hip("tile", roofX0, roofX1, roofZ0, roofZ1, top + 0.12, PITCH, m, { capKey: "cap" });
  for (const [a, b, c, d] of [
    [roofX0, roofX1, roofZ0, 0],
    [roofX0, roofX1, s.width, roofZ1],
    [roofX0, 0, 0, s.width],
    [s.length, roofX1, 0, s.width],
  ] as const) {
    kit.box(s.twoFaced ? "wood" : "plaster", a, b, top + 0.03, top + 0.11, c, d, m, 2);
  }
  kit.box("paint", roofX0 - 0.05, roofX1 + 0.05, top + 0.04, top + 0.17, roofZ0 - 0.08, roofZ0 + 0.02, m, 2);
  kit.box("paint", roofX0 - 0.05, roofX1 + 0.05, top + 0.04, top + 0.17, roofZ1 - 0.02, roofZ1 + 0.08, m, 2);
}

export { FRONT_THICK };
