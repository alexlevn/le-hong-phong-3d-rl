import { BufferGeometry, CylinderGeometry, Float32BufferAttribute, Group, Shape, ShapeGeometry, ShapeUtils, SphereGeometry, Vector2, Vector3, type Material, type Matrix4 } from "three";
import { frame, Kit, type Hole, type MatKey } from "./kit.ts";
import { buildTrees, pottedShrub, type TreeSpec } from "./plants.ts";
import { CAMPUS_OUTLINE, COURT_TREES, NEIGHBOURS, type Footprint, type P2 } from "./site-data.ts";
import { buildWing, PLINTH } from "./wing.ts";

/** World metres, axis of symmetry Z = 0. */
const COURT_X0 = -29.7;
const EAST_X0 = 23.5;
const EAST_X1 = 32.5;
const COURT_Z = 22.7;
const GATE_X = 69.7;

function plane(kit: Kit, key: MatKey, x0: number, x1: number, z0: number, z1: number, y: number, tile: number): void {
  kit.box(key, x0, x1, y - 0.04, y, z0, z1, undefined, tile);
}

function buildMainWings(kit: Kit): void {
  // passBays join the corridors: north/south bays in front of the clock hall's open ends, west bays where the north/south galleries run in.
  buildWing(kit, { frame: frame(EAST_X1, -COURT_Z, Math.PI), length: 62.2, width: 8.7, gallery: 3.2, storeys: 2, storeyH: 4.3, bays: 17, openBays: [8], passBays: [0, 1] });
  buildWing(kit, { frame: frame(COURT_X0, COURT_Z, 0), length: 62.2, width: 8.7, gallery: 3.2, storeys: 2, storeyH: 4.3, bays: 17, openBays: [8], passBays: [15, 16] });
  buildWing(kit, { frame: frame(COURT_X0, -38.3, -Math.PI / 2), length: 76.6, width: 17.7, gallery: 3.4, storeys: 2, storeyH: 4.3, bays: 21, openBays: [10], passBays: [3, 17] });
  buildWing(kit, { frame: frame(EAST_X0, COURT_Z, Math.PI / 2), length: COURT_Z * 2, width: EAST_X1 - EAST_X0, gallery: 3, storeys: 1, storeyH: 5, bays: 13, openBays: [6], twoFaced: true });
  buildWing(kit, { frame: frame(40, -27, Math.PI), length: 7.5, width: 8, gallery: 2.6, storeys: 1, storeyH: 4.6, bays: 2 });
  buildWing(kit, { frame: frame(EAST_X1, 27, 0), length: 7.5, width: 8, gallery: 2.6, storeys: 1, storeyH: 4.6, bays: 2 });
}

/** Projecting entrance under the clock tower: arch, school sign, small tiled roof. */
function buildPorch(kit: Kit): void {
  const front = frame(36.2, 2.75, Math.PI / 2);
  const entry: Hole = { cx: 2.75, hw: 1.55, bottom: PLINTH + 0.01, spring: 3.0, rise: 1.05 };
  kit.archWall("trim", 0, 5.5, 0, 5.6, -1, 1, [entry], front);
  kit.archivolt("plaster", entry, 0.16, 0, 0.05, front);
  kit.panel("signPorch", 0.55, 4.95, 4.15, 5.5, 0.03, 1, front);
  for (const z of [-2.75, 2.25]) {
    const side: Hole = { cx: 1.35, hw: 0.85, bottom: PLINTH + 0.01, spring: 2.8, rise: 0.7 };
    kit.archWall("plaster", 0, 2.7, 0, 5.6, 0, 0.5, [side], frame(EAST_X1, z, 0));
  }
  for (const s of [-1, 1]) {
    kit.box("trim", 35.0, 36.35, 0, PLINTH, s > 0 ? 1.7 : -2.9, s > 0 ? 2.9 : -1.7, undefined, 2);
    kit.box("trim", 35.05, 36.3, 3.02, 3.22, s > 0 ? 1.65 : -2.85, s > 0 ? 2.85 : -1.65, undefined, 2);
    kit.box("trim", 35.0, 36.35, 5.42, 5.62, s > 0 ? 1.7 : -2.9, s > 0 ? 2.9 : -1.7, undefined, 2);
    kit.block(35.2, 36.2, s > 0 ? 1.2 : -2.75, s > 0 ? 2.75 : -1.2);
    kit.block(EAST_X1, 35.2, s > 0 ? 2.25 : -2.75, s > 0 ? 2.75 : -2.25);
  }
  kit.box("checker", EAST_X1, 35.2, PLINTH - 0.1, PLINTH, -2.25, 2.25, undefined, 0.62);
  kit.floor(EAST_X1, 36.2, -2.75, 2.75, PLINTH);
  kit.box("concrete", 36.2, 36.7, 0, 0.3, -2.75, 2.75, undefined, 2);
  kit.box("concrete", 36.7, 37.2, 0, 0.15, -2.75, 2.75, undefined, 2);
  kit.floor(36.2, 36.7, -2.75, 2.75, 0.3);
  kit.floor(36.7, 37.2, -2.75, 2.75, 0.15);
  kit.box("wood", 32, 37.15, 5.6, 5.72, -3.55, 3.55, undefined, 2);
  kit.hip("tile", 31.7, 37.25, -3.6, 3.6, 5.72, 0.55, undefined, { capKey: "cap" });

  kit.box("plaster", 28.35, 31.25, 5.4, 10.5, -1.45, 1.45);
  for (const [x, z] of [[28.35, -1.45], [31.25, -1.45], [28.35, 1.45], [31.25, 1.45]] as const) {
    kit.box("trim", x - 0.2, x + 0.2, 7.0, 10.45, z - 0.2, z + 0.2, undefined, 2);
  }
  kit.box("trim", 28.1, 31.5, 6.75, 7.05, -1.7, 1.7, undefined, 2);
  for (const m of [frame(31.27, 1.05, Math.PI / 2), frame(28.33, -1.05, -Math.PI / 2)]) {
    kit.box("trim", -0.1, 2.2, 7.45, 9.85, -0.02, 0.05, m, 2);
    kit.panel("clock", 0.0, 2.1, 7.6, 9.7, 0.07, 1, m);
  }
  kit.box("wood", 27.7, 31.9, 10.5, 10.62, -2.15, 2.15, undefined, 2);
  kit.hip("tile", 27.45, 32.15, -2.35, 2.35, 10.62, 0.55, undefined, { capKey: "cap", tile: 1.6 });
  for (const [x, z, dx, dz] of [[27.45, -2.35, -1, -1], [32.15, -2.35, 1, -1], [27.45, 2.35, -1, 1], [32.15, 2.35, 1, 1]] as const) {
    kit.beam("cap", new Vector3(x - dx * 0.5, 10.82, z - dz * 0.5), new Vector3(x + dx * 0.1, 11.1, z + dz * 0.1), 0.18, 0.18);
  }
  for (const s of [-1, 1]) {
    kit.beam("paint", new Vector3(36.25, 4.1, s * 2.65), new Vector3(37.1, 9.1, s * 2.65), 0.06, 0.06);
    kit.panel("flag", 0, 1.5, 8.1, 9.08, 0.0, 1, frame(37.08, s * 2.65, 0));
  }
}

/** Two-storey corner building with a cross hip facing the front garden. */
function buildVilla(kit: Kit, x0: number, x1: number, z0: number, z1: number, gardenSide: 1 | -1): void {
  const top = PLINTH + 8.4;
  const faces: readonly (readonly [Matrix4, number])[] = [
    [frame(x0, z1 - 0.4, 0), x1 - x0],
    [frame(x1, z0 + 0.4, Math.PI), x1 - x0],
    [frame(x1 - 0.4, z1, Math.PI / 2), z1 - z0],
    [frame(x0 + 0.4, z0, -Math.PI / 2), z1 - z0],
  ];
  kit.box("dark", x0 + 0.5, x1 - 0.5, 0, top - 0.1, z0 + 0.5, z1 - 0.5);
  kit.block(x0, x1, z0, z1);
  for (const [m, length] of faces) {
    const count = Math.max(3, Math.round(length / 4));
    const step = length / count;
    const holes: Hole[] = [];
    for (let i = 0; i < count; i++) {
      const cx = (i + 0.5) * step;
      const low: Hole = { cx, hw: 1.05, bottom: PLINTH + 0.05, spring: 2.85, rise: 0.8 };
      const up: Hole = { cx, hw: 0.72, bottom: PLINTH + 4.2 + 0.7, spring: PLINTH + 4.2 + 3.1, rise: 0 };
      holes.push(low, up);
      kit.archivolt("trim", low, 0.12, 0.4, 0.05, m);
      kit.panel("shutter", cx - 0.68, cx + 0.68, up.bottom, up.spring, 0.12, 1, m);
      kit.box("trim", cx - 0.88, cx + 0.88, up.bottom - 0.12, up.bottom, 0.4, 0.54, m, 2);
      kit.box("trim", cx - 0.88, cx + 0.88, up.spring, up.spring + 0.16, 0.4, 0.5, m, 2);
    }
    kit.archWall("plaster", 0, length, 0, top, 0, 0.4, holes, m);
    kit.box("trim", -0.04, length + 0.04, PLINTH + 3.94, PLINTH + 4.2, 0.4, 0.56, m, 2);
    kit.box("trim", -0.04, length + 0.04, top - 0.28, top, 0.4, 0.62, m, 2);
    kit.box("ochre", -0.04, length + 0.04, 0, PLINTH * 0.85, 0.4, 0.5, m, 2);
  }
  kit.box("plaster", x0 - 1.1, x1 + 1.1, top + 0.03, top + 0.1, z0 - 1.1, z1 + 1.1, undefined, 2);
  kit.hip("tile", x0 - 1.1, x1 + 1.1, z0 - 1.1, z1 + 1.1, top + 0.12, 0.58, undefined, { capKey: "cap" });
  const cx = (x0 + x1) / 2;
  const faceZ = gardenSide > 0 ? z1 : z0;
  const zA = faceZ - gardenSide * 5;
  const zB = faceZ + gardenSide * 1.9;
  kit.hip("tile", cx - 4.2, cx + 4.2, Math.min(zA, zB), Math.max(zA, zB), top + 1.2, 0.75, undefined, { capKey: "cap" });
}

function buildVillas(kit: Kit): void {
  buildVilla(kit, 40, 58, -40, -22, 1);
  buildVilla(kit, 40, 58, 22, 40, -1);
}

function hedgeRect(kit: Kit, x0: number, x1: number, z0: number, z1: number, t: number, h: number): void {
  kit.box("hedge", x0, x1, 0, h, z0, z0 + t, undefined, 1.2);
  kit.box("hedge", x0, x1, 0, h, z1 - t, z1, undefined, 1.2);
  kit.box("hedge", x0, x0 + t, 0, h, z0 + t, z1 - t, undefined, 1.2);
  kit.box("hedge", x1 - t, x1, 0, h, z0 + t, z1 - t, undefined, 1.2);
}

function buildGardens(kit: Kit): void {
  plane(kit, "asphalt", 37, GATE_X, -3.6, 3.6, 0.06, 5);
  plane(kit, "gravel", 47.5, GATE_X, -18, 18, 0.05, 5);
  plane(kit, "asphalt", 58, GATE_X, -44, 44, 0.04, 5);
  for (const s of [-1, 1]) {
    const z0 = s > 0 ? 3.9 : -17;
    const z1 = s > 0 ? 17 : -3.9;
    plane(kit, "grass", 36.3, 47.2, z0, z1, 0.05, 3);
    hedgeRect(kit, 36.5, 47, z0 + 0.2, z1 - 0.2, 0.5, 0.65);
    hedgeRect(kit, 38, 45.5, z0 + 1.6, z1 - 1.6, 0.42, 0.5);
    const cx = 41.75;
    const cz = (z0 + z1) / 2;
    kit.add("trim", new CylinderGeometry(1.5, 1.6, 0.45, 24).translate(cx, 0.22, cz), undefined, 2);
    kit.add("hedge", new SphereGeometry(0.62, 12, 8).translate(cx, 0.82, cz), undefined, 1.2);
    kit.block(36.5, 47, Math.min(z0, z1) + 0.2, Math.max(z0, z1) - 0.2);
    for (const [x, z] of [[37.2, 3.4], [39.7, 3.45], [37.1, 7], [47.6, 3.7], [47.6, 8], [47.6, 12.5]] as const) pottedShrub(kit, x, s * z, 0.82);
  }
}

/** Slatted bench facing local -z; footprint blocks walking. */
function bench(kit: Kit, x: number, z: number, rot: number, y: number): void {
  const m = frame(x, z, rot);
  for (const dz of [-0.2, -0.08, 0.04, 0.16]) kit.box("wood", -0.85, 0.85, y + 0.43, y + 0.47, dz - 0.05, dz + 0.05, m, 1.5);
  for (const dz of [0.27, 0.4]) kit.box("wood", -0.85, 0.85, y + 0.62 + (dz - 0.27), y + 0.72 + (dz - 0.27), dz + 0.02, dz + 0.05, m, 1.5);
  for (const bx of [-0.75, 0.75]) {
    kit.box("iron", bx - 0.03, bx + 0.03, y, y + 0.46, -0.28, -0.22, m);
    kit.box("iron", bx - 0.03, bx + 0.03, y, y + 0.92, 0.3, 0.36, m);
    kit.box("iron", bx - 0.03, bx + 0.03, y + 0.4, y + 0.46, -0.28, 0.33, m);
  }
  kit.block(-0.85, 0.85, -0.28, 0.36, m);
}

function buildCourt(kit: Kit): void {
  plane(kit, "pavers", COURT_X0, EAST_X0, -COURT_Z, COURT_Z, 0.05, 4);
  for (const [x, z] of COURT_TREES) {
    if (x > COURT_X0 && x < EAST_X0) {
      kit.add("trim", new CylinderGeometry(1.25, 1.3, 0.42, 20).translate(x, 0.21, z), undefined, 2);
      kit.add("grass", new CylinderGeometry(1.08, 1.08, 0.46, 20).translate(x, 0.23, z), undefined, 2);
    }
  }
  kit.box("metalRoof", COURT_X0 + 0.5, COURT_X0 + 4.6, 3.6, 3.72, -9, 8);
  for (const z of [-8.8, -2.9, 2.9, 7.8]) {
    kit.box("paint", COURT_X0 + 4.3, COURT_X0 + 4.45, 0, 3.6, z - 0.07, z + 0.07);
    kit.block(COURT_X0 + 4.3, COURT_X0 + 4.45, z - 0.07, z + 0.07);
  }
  kit.box("dark", 18.6, 20.4, 0, 1.4, -0.9, 0.9, undefined, 2);
  kit.box("trim", 18.35, 20.65, 0, 0.3, -1.15, 1.15, undefined, 2);
  kit.block(18.35, 20.65, -1.15, 1.15);
  kit.add("bronze", new CylinderGeometry(0.26, 0.34, 0.55, 12).translate(19.5, 1.68, 0));
  kit.add("bronze", new SphereGeometry(0.17, 14, 10).translate(19.5, 2.1, 0));
  // Clock hall: one bench behind the balustrade of every other bay, skipping the central passage.
  const hallBay = (COURT_Z * 2) / 13;
  for (const i of [1, 3, 5]) for (const s of [-1, 1]) bench(kit, 24.6, s * (COURT_Z - (i + 0.5) * hallBay), -Math.PI / 2, PLINTH);
  // North/south galleries: against the room wall behind a pier, between two classroom doors (one door per bay).
  const wingBay = 62.2 / 17;
  for (const i of [3, 5, 7, 10, 12, 14]) {
    const x = COURT_X0 + i * wingBay;
    bench(kit, x, 25.4, 0, PLINTH);
    bench(kit, x, -25.4, Math.PI, PLINTH);
  }
  // Court: in the outer tree rows, halfway between trees, facing the central walk.
  for (const x of [-15, 0.5]) {
    bench(kit, x, 15.5, 0, 0.05);
    bench(kit, x, -15.5, Math.PI, 0.05);
  }
}

function buildBoundaryAndGate(kit: Kit): void {
  const n = CAMPUS_OUTLINE.length;
  for (let i = 0; i < n; i++) {
    const a = CAMPUS_OUTLINE[i] as P2;
    const b = CAMPUS_OUTLINE[(i + 1) % n] as P2;
    if (a[0] > GATE_X - 1 && b[0] > GATE_X - 1) continue;
    kit.beam("plaster", new Vector3(a[0], 1.2, a[1]), new Vector3(b[0], 1.2, b[1]), 0.22, 2.4, undefined, 3);
    kit.blockers.push({ x0: Math.min(a[0], b[0]) - 0.2, x1: Math.max(a[0], b[0]) + 0.2, z0: Math.min(a[1], b[1]) - 0.2, z1: Math.max(a[1], b[1]) + 0.2 });
  }
  const X = GATE_X;
  const fence = (z0: number, z1: number): void => {
    kit.box("ochre", X - 0.16, X + 0.16, 0, 1.05, z0, z1);
    kit.box("trim", X - 0.22, X + 0.22, 1.05, 1.17, z0, z1, undefined, 2);
    kit.block(X - 0.3, X + 0.3, z0, z1);
    for (let z = z0 + 0.1; z < z1; z += 0.2) kit.box("iron", X - 0.02, X + 0.02, 1.17, 2.05, z - 0.02, z + 0.02);
    kit.box("iron", X - 0.03, X + 0.03, 1.95, 2.0, z0, z1);
    for (let z = z0; z <= z1; z += 5) {
      kit.box("trim", X - 0.33, X + 0.33, 0, 2.25, z - 0.33, z + 0.33, undefined, 2);
      kit.box("trim", X - 0.42, X + 0.42, 2.25, 2.4, z - 0.42, z + 0.42, undefined, 2);
    }
  };
  fence(-77, -14);
  fence(9.1, 57.8);

  for (const s of [-1, 1]) {
    const z0 = s > 0 ? 3.4 : -5.3;
    const z1 = s > 0 ? 5.3 : -3.4;
    kit.box("trim", X - 0.68, X + 0.68, 0, 1.05, z0 - 0.14, z1 + 0.14, undefined, 2);
    kit.box("trim", X - 0.55, X + 0.55, 1.05, 6.4, z0, z1, undefined, 2);
    for (const face of [-1, 1]) {
      const fx = X + face * 0.55;
      kit.box("ochre", fx - 0.03, fx + 0.03, 1.4, 4.95, z0 + 0.34, z1 - 0.34);
      kit.box("ochre", fx - 0.03, fx + 0.03, 5.35, 6.1, z0 + 0.5, z1 - 0.5);
      kit.box("ochre", X + face * 0.68 - 0.03, X + face * 0.68 + 0.03, 0.16, 0.9, z0 + 0.1, z1 - 0.1);
    }
    // Stepped bracket on the outer side of each pylon, and the lower ochre pier that carries the side gate.
    const outer = s > 0 ? z1 : z0;
    for (const [reach, y0, y1] of [[0.18, 5.05, 6.3], [0.36, 5.3, 6.05], [0.5, 5.5, 5.85]] as const) {
      const a = outer + s * reach;
      kit.box("trim", X - 0.3, X + 0.3, y0, y1, Math.min(outer, a), Math.max(outer, a), undefined, 2);
    }
    const pier = outer + s * 0.62;
    const pz0 = Math.min(outer, pier);
    const pz1 = Math.max(outer, pier);
    kit.box("trim", X - 0.5, X + 0.5, 0, 0.95, pz0, pz1, undefined, 2);
    kit.box("ochre", X - 0.42, X + 0.42, 0.95, 3.7, pz0, pz1);
    kit.box("trim", X - 0.5, X + 0.5, 3.7, 3.92, pz0, pz1 , undefined, 2);
    kit.block(X - 0.5, X + 0.5, pz0, pz1);
    kit.box("trim", X - 0.72, X + 0.72, 6.4, 6.62, z0 - 0.12, z1 + 0.12, undefined, 2);
    kit.box("trim", X - 0.42, X + 0.42, 6.62, 7.15, z0 + 0.36, z1 - 0.36, undefined, 2);
    kit.block(X - 0.68, X + 0.68, z0 - 0.14, z1 + 0.14);

    const pz = s * 8.8;
    kit.box("trim", X - 0.4, X + 0.4, 0, 3.0, pz - 0.4, pz + 0.4, undefined, 2);
    kit.box("trim", X - 0.5, X + 0.5, 3.0, 3.18, pz - 0.5, pz + 0.5, undefined, 2);
    kit.block(X - 0.4, X + 0.4, pz - 0.4, pz + 0.4);
    gateLeaf(kit, frame(X, s * 5.95, s > 0 ? -Math.PI / 2 : Math.PI / 2), 2.45, 2.3);
    kit.block(X - 0.1, X + 0.1, s > 0 ? 5.3 : -8.6, s > 0 ? 8.6 : -5.3);

    const hingeZ = s * 3.35;
    gateLeaf(kit, frame(X, hingeZ, s > 0 ? Math.PI - 0.25 : Math.PI + 0.25), 3.3, 3.1);
  }
  kit.box("trim", X - 0.34, X + 0.34, 5.42, 6.5, -3.5, 3.5, undefined, 2);
  kit.box("ochre", X - 0.37, X + 0.37, 6.38, 6.56, -3.5, 3.5);
  kit.panel("signGate", 0.1, 6.7, 5.54, 6.38, 0.36, 1, frame(X, 3.4, Math.PI / 2));
  kit.panel("signGate", 0.1, 6.7, 5.54, 6.38, 0.36, 1, frame(X, -3.4, -Math.PI / 2));

  kit.box("plaster", X - 6, X - 0.3, 0, 3, -14, -9.1);
  kit.box("wood", X - 6.5, X + 0.2, 3, 3.08, -14.5, -8.6, undefined, 2);
  kit.hip("tile", X - 6.8, X + 0.5, -14.8, -8.3, 3.08, 0.5, undefined, { capKey: "cap" });
  kit.panel("shutter", 0.6, 2.1, 0.7, 2.5, 0.02, 1, frame(X - 6, -9.1, 0));
  kit.block(X - 6, X - 0.3, -14, -9.1);
}

/** Leaf hinged at local origin, extending along +x: solid lower panel, bars rising to a curved top rail. */
function gateLeaf(kit: Kit, m: Matrix4, width: number, topY: number): void {
  kit.box("paint", 0.05, width, 0.12, 1.25, -0.03, 0.03, m, 2);
  const count = Math.round(width / 0.13);
  const topAt = (x: number): number => topY + 0.42 * Math.sin((x / width) * Math.PI * 0.5);
  for (let i = 0; i <= count; i++) {
    const x = 0.05 + (i / count) * (width - 0.05);
    kit.box("paint", x - 0.012, x + 0.012, 1.25, topAt(x), -0.012, 0.012, m, 2);
  }
  const steps = 10;
  for (let i = 0; i < steps; i++) {
    const a = 0.05 + (i / steps) * (width - 0.05);
    const b = 0.05 + ((i + 1) / steps) * (width - 0.05);
    kit.beam("paint", new Vector3(a, topAt(a), 0), new Vector3(b, topAt(b), 0), 0.05, 0.05, m);
  }
  kit.box("paint", 0, 0.07, 0.1, topAt(0.05), -0.04, 0.04, m, 2);
  kit.box("paint", width - 0.05, width, 0.1, topAt(width), -0.04, 0.04, m, 2);
}

function buildStreet(kit: Kit): void {
  plane(kit, "concrete", GATE_X, 74, -190, 190, 0.14, 3);
  kit.floor(GATE_X, 74, -190, 190, 0.14);
  plane(kit, "asphalt", 74, 98, -190, 190, 0.05, 5);
  plane(kit, "concrete", 98, 103, -190, 190, 0.14, 3);
  for (let z = -186; z < 186; z += 8) {
    kit.box("trim", 79.9, 80.05, 0.05, 0.065, z, z + 4, undefined, 2);
    kit.box("trim", 91.9, 92.05, 0.05, 0.065, z, z + 4, undefined, 2);
  }
  kit.box("trim", 85.9, 86.05, 0.05, 0.065, -190, 190, undefined, 2);
  for (let z = -80; z <= 70; z += 30) {
    kit.add("concrete", new CylinderGeometry(0.11, 0.17, 10, 8).translate(73.2, 5, z), undefined, 2);
    kit.block(73, 73.4, z - 0.2, z + 0.2);
  }
  for (const [h, dx] of [[8.8, 0], [8.5, 0.35], [8.2, -0.3], [7.8, 0.15], [7.4, -0.2]] as const) {
    kit.beam("iron", new Vector3(73.2 + dx, h, -190), new Vector3(73.2 + dx, h - 0.1, 190), 0.035, 0.035);
  }
}

function buildNeighbours(kit: Kit): void {
  const tiled = new Set(["khuB", "khuC", "canteen", "annex", "publisher"]);
  for (const b of NEIGHBOURS) extrudeFootprint(kit, b, tiled.has(b.id) ? "tile" : "concrete");
}

function extrudeFootprint(kit: Kit, b: Footprint, cap: MatKey): void {
  const h = b.floors * 3.4 + 0.6;
  const pts = ShapeUtils.area(b.points.map((p) => new Vector2(p[0], -p[1]))) > 0 ? b.points : [...b.points].reverse();
  const pos: number[] = [];
  const nrm: number[] = [];
  const uv: number[] = [];
  let along = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % pts.length]!;
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const nx = (q[1] - p[1]) / len;
    const nz = -(q[0] - p[0]) / len;
    const u0 = along / 3.6;
    const u1 = (along + len) / 3.6;
    const quad: readonly (readonly [P2, number, number, number])[] = [[p, 0, u0, 0], [q, 0, u1, 0], [q, h, u1, b.floors], [p, 0, u0, 0], [q, h, u1, b.floors], [p, h, u0, b.floors]];
    for (const [v, y, s, t] of quad) {
      pos.push(v[0], y, v[1]);
      nrm.push(nx, 0, nz);
      uv.push(s, t);
    }
    along += len;
    kit.blockers.push({ x0: Math.min(p[0], q[0]) - 0.1, x1: Math.max(p[0], q[0]) + 0.1, z0: Math.min(p[1], q[1]) - 0.1, z1: Math.max(p[1], q[1]) + 0.1 });
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new Float32BufferAttribute(nrm, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  kit.add("neighbour", g);
  const top = new ShapeGeometry(new Shape(pts.map((p) => new Vector2(p[0], -p[1])))).rotateX(-Math.PI / 2).translate(0, h, 0);
  kit.add(cap, top, undefined, 3);
}

function treeList(): TreeSpec[] {
  const list: TreeSpec[] = COURT_TREES.map(([x, z], i) => ({ x, z, height: 15 + (i % 4), crown: 5.2 + (i % 3) * 0.6, seed: 11 + i * 7 }));
  let seed = 400;
  for (let z = -72; z <= 56; z += 14) {
    if (Math.abs(z) > 9) list.push({ x: 72.1, z, height: 15, crown: 6, seed: seed++ });
  }
  for (let z = -72; z <= 72; z += 16) list.push({ x: 100.5, z: z + 5, height: 15, crown: 7, seed: seed++ });
  for (const [x, z, h, c] of [[61, -13, 13, 5.5], [62, 13, 13, 5.5], [53, -18, 9, 3.6], [53, 18, 9, 3.6], [-7, 33.5, 12, 5], [12, -35, 13, 5], [38, 44, 12, 5], [38, -44, 12, 5], [-3, 48, 14, 6], [-58, 12, 15, 7], [-60, -18, 16, 7], [66, -32, 11, 4.5], [66, 32, 11, 4.5]] as const) {
    list.push({ x, z, height: h, crown: c, seed: seed++ });
  }
  return list;
}

export interface Campus { group: Group; kit: Kit }

export function buildCampus(materials: Readonly<Record<MatKey, Material>>, foliage: Material): Campus {
  const kit = new Kit();
  kit.box("gravel", -900, 900, -0.1, 0, -900, 900, undefined, 6);
  buildMainWings(kit);
  buildPorch(kit);
  buildVillas(kit);
  buildGardens(kit);
  buildCourt(kit);
  buildBoundaryAndGate(kit);
  buildStreet(kit);
  buildNeighbours(kit);
  const leaves = buildTrees(kit, treeList(), foliage);
  const group = kit.build("campus", materials);
  group.add(leaves);
  return { group, kit };
}
