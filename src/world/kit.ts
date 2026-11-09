import { BoxGeometry, BufferGeometry, ExtrudeGeometry, Float32BufferAttribute, Group, Matrix4, Mesh, Path, PlaneGeometry, Shape, Vector3, type Material } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export type MatKey =
  | "plaster" | "trim" | "ochre" | "tile" | "cap" | "wood" | "checker" | "shutter" | "iron" | "terracotta" | "bronze"
  | "pavers" | "gravel" | "grass" | "hedge" | "asphalt" | "concrete" | "bark" | "dark" | "neighbour" | "metalRoof" | "paint"
  | "signPorch" | "signGate" | "clock" | "flag";

/** World-space axis-aligned rectangle on the ground. */
export interface Rect { x0: number; x1: number; z0: number; z1: number }
export interface RaisedFloor { rect: Rect; y: number }
export interface Hole { cx: number; hw: number; bottom: number; spring: number; rise: number }

const FLAT_KEYS: ReadonlySet<MatKey> = new Set<MatKey>(["pavers", "gravel", "grass", "asphalt", "checker"]);
const UP = new Vector3(0, 1, 0);
const SIDE = new Vector3(1, 0, 0);

export function frame(x: number, z: number, theta: number): Matrix4 {
  return new Matrix4().makeRotationY(theta).setPosition(x, 0, z);
}

function projectWorldUV(g: BufferGeometry, tile: number): void {
  const pos = g.getAttribute("position");
  const nrm = g.getAttribute("normal");
  const uv = g.getAttribute("uv");
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nrm.getX(i));
    const ay = Math.abs(nrm.getY(i));
    const az = Math.abs(nrm.getZ(i));
    if (ay >= ax && ay >= az) uv.setXY(i, pos.getX(i) / tile, pos.getZ(i) / tile);
    else if (ax >= az) uv.setXY(i, pos.getZ(i) / tile, pos.getY(i) / tile);
    else uv.setXY(i, pos.getX(i) / tile, pos.getY(i) / tile);
  }
}

/** Collects static geometry per material, merged into one mesh per material; also records walking blockers and raised floors. */
export class Kit {
  readonly blockers: Rect[] = [];
  readonly floors: RaisedFloor[] = [];
  private readonly parts = new Map<MatKey, BufferGeometry[]>();

  /** `tile` re-projects UVs in world metres; omit it to keep the geometry's own UVs. */
  add(key: MatKey, geometry: BufferGeometry, m?: Matrix4, tile?: number): void {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    for (const name of Object.keys(g.attributes)) if (name !== "position" && name !== "normal" && name !== "uv") g.deleteAttribute(name);
    g.clearGroups();
    if (m) g.applyMatrix4(m);
    if (tile !== undefined) projectWorldUV(g, tile);
    const list = this.parts.get(key) ?? [];
    list.push(g);
    this.parts.set(key, list);
    geometry.dispose();
  }

  box(key: MatKey, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, m?: Matrix4, tile = 3): void {
    this.add(key, new BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), m, tile);
  }

  /** Box of section w×h running from a to b. */
  beam(key: MatKey, a: Vector3, b: Vector3, w: number, h: number, m?: Matrix4, tile = 2): void {
    const dir = b.clone().sub(a);
    const up = Math.abs(dir.clone().normalize().y) > 0.99 ? SIDE : UP;
    const place = new Matrix4().lookAt(a, b, up).setPosition(a.clone().add(b).multiplyScalar(0.5));
    if (m) place.premultiply(m);
    this.add(key, new BoxGeometry(w, h, dir.length()), place, tile);
  }

  /** One-texture rectangle in the local XY plane at depth z, facing +z or -z (signs, shutters, clock faces). */
  panel(key: MatKey, x0: number, x1: number, y0: number, y1: number, z: number, facing: 1 | -1, m?: Matrix4): void {
    const g = new PlaneGeometry(x1 - x0, y1 - y0);
    if (facing < 0) g.rotateY(Math.PI);
    this.add(key, g.translate((x0 + x1) / 2, (y0 + y1) / 2, z), m);
  }

  /** Solid wall in the local XY plane, thickness along +z from z0, with arched (rise > 0) or square (rise = 0) openings. */
  archWall(key: MatKey, x0: number, x1: number, y0: number, y1: number, z0: number, thick: number, holes: readonly Hole[], m?: Matrix4, tile = 3): void {
    const shape = new Shape();
    shape.moveTo(x0, y0).lineTo(x1, y0).lineTo(x1, y1).lineTo(x0, y1).closePath();
    for (const h of holes) {
      const p = new Path();
      p.moveTo(h.cx - h.hw, h.bottom).lineTo(h.cx + h.hw, h.bottom).lineTo(h.cx + h.hw, h.spring);
      if (h.rise > 0) p.absellipse(h.cx, h.spring, h.hw, h.rise, 0, Math.PI, false, 0);
      else p.lineTo(h.cx - h.hw, h.spring);
      p.closePath();
      shape.holes.push(p);
    }
    this.add(key, new ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: 9 }).translate(0, 0, z0), m, tile);
  }

  /** Thin raised moulding following the top of an arched opening. */
  archivolt(key: MatKey, h: Hole, width: number, z0: number, depth: number, m?: Matrix4): void {
    const s = new Shape();
    s.moveTo(h.cx + h.hw + width, h.spring);
    s.absellipse(h.cx, h.spring, h.hw + width, h.rise + width, 0, Math.PI, false, 0);
    s.lineTo(h.cx - h.hw, h.spring);
    s.absellipse(h.cx, h.spring, h.hw, h.rise, Math.PI, 0, true, 0);
    s.closePath();
    this.add(key, new ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 9 }).translate(0, 0, z0), m, 2);
  }

  /** Hip roof with equal pitch on all sides. `flip` shows the inner face (exposed timber ceilings). */
  hip(key: MatKey, x0: number, x1: number, z0: number, z1: number, y: number, pitch: number, m?: Matrix4, opts: { flip?: boolean; tile?: number; capKey?: MatKey } = {}): void {
    const alongX = x1 - x0 >= z1 - z0;
    const half = (alongX ? z1 - z0 : x1 - x0) / 2;
    const top = y + half * pitch;
    const a = new Vector3(x0, y, z0);
    const b = new Vector3(x1, y, z0);
    const c = new Vector3(x1, y, z1);
    const d = new Vector3(x0, y, z1);
    const r0 = alongX ? new Vector3(x0 + half, top, (z0 + z1) / 2) : new Vector3((x0 + x1) / 2, top, z0 + half);
    const r1 = alongX ? new Vector3(x1 - half, top, (z0 + z1) / 2) : new Vector3((x0 + x1) / 2, top, z1 - half);
    const faces = alongX
      ? [[a, b, r1, r0], [c, d, r0, r1], [d, a, r0], [b, c, r1]]
      : [[b, c, r1, r0], [d, a, r0, r1], [a, b, r0], [c, d, r1]];
    const tile = opts.tile ?? 2.2;
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    for (const face of faces) {
      const [p0, p1, p2] = face as [Vector3, Vector3, Vector3];
      const along = p1.clone().sub(p0).normalize();
      const n = along.clone().cross(p2.clone().sub(p0)).normalize();
      if (n.y < 0) n.negate();
      const slope = n.clone().cross(along);
      const outward = n.clone().multiplyScalar(opts.flip ? -1 : 1);
      for (let i = 1; i + 1 < face.length; i++) {
        const tri = [face[0]!, face[i]!, face[i + 1]!];
        const windingUp = tri[1]!.clone().sub(tri[0]!).cross(tri[2]!.clone().sub(tri[0]!)).dot(outward) > 0;
        if (!windingUp) tri.reverse();
        for (const v of tri) {
          positions.push(v.x, v.y, v.z);
          normals.push(outward.x, outward.y, outward.z);
          const rel = v.clone().sub(p0);
          uvs.push(rel.dot(along) / tile, rel.dot(slope) / tile);
        }
      }
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(positions, 3));
    g.setAttribute("normal", new Float32BufferAttribute(normals, 3));
    g.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
    this.add(key, g, m);
    if (opts.capKey) {
      const lift = new Vector3(0, 0.07, 0);
      for (const [from, to] of [[a, r0], [d, r0], [b, r1], [c, r1], [r0, r1]] as const) {
        if (from.distanceTo(to) > 0.05) this.beam(opts.capKey, from.clone().add(lift), to.clone().add(lift), 0.17, 0.11, m);
      }
    }
  }

  /** Local rectangle → world AABB (frames only ever turn by quarter circles or half circles). */
  worldRect(x0: number, x1: number, z0: number, z1: number, m?: Matrix4): Rect {
    const p = new Vector3(x0, 0, z0).applyMatrix4(m ?? new Matrix4());
    const q = new Vector3(x1, 0, z1).applyMatrix4(m ?? new Matrix4());
    return { x0: Math.min(p.x, q.x), x1: Math.max(p.x, q.x), z0: Math.min(p.z, q.z), z1: Math.max(p.z, q.z) };
  }

  block(x0: number, x1: number, z0: number, z1: number, m?: Matrix4): void {
    this.blockers.push(this.worldRect(x0, x1, z0, z1, m));
  }

  floor(x0: number, x1: number, z0: number, z1: number, y: number, m?: Matrix4): void {
    this.floors.push({ rect: this.worldRect(x0, x1, z0, z1, m), y });
  }

  build(name: string, materials: Readonly<Record<MatKey, Material>>): Group {
    const group = new Group();
    group.name = name;
    for (const [key, geos] of this.parts) {
      const merged = mergeGeometries(geos, false);
      if (!merged) throw new Error(`merge failed for ${key}`);
      for (const g of geos) g.dispose();
      const mesh = new Mesh(merged, materials[key]);
      mesh.name = `${name}:${key}`;
      mesh.castShadow = !FLAT_KEYS.has(key);
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
    }
    this.parts.clear();
    return group;
  }
}
