import type { Rect } from "../world/kit.ts";
import { BOUNDS } from "./walker.ts";

const CELL = 0.5;
const SQRT2 = Math.SQRT2;

export interface Point { x: number; z: number }

/** Min-heap of cell indices keyed by f-score. */
class Heap {
  private items: number[] = [];
  constructor(private readonly key: Float32Array) {}
  get size(): number {
    return this.items.length;
  }
  push(v: number): void {
    const a = this.items;
    a.push(v);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.key[a[p]!]! <= this.key[a[i]!]!) break;
      [a[p], a[i]] = [a[i]!, a[p]!];
      i = p;
    }
  }
  pop(): number {
    const a = this.items;
    const top = a[0]!;
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && this.key[a[l]!]! < this.key[a[m]!]!) m = l;
        if (r < a.length && this.key[a[r]!]! < this.key[a[m]!]!) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i]!, a[m]!];
        i = m;
      }
    }
    return top;
  }
}

/**
 * A* on a 0.5 m grid of the 2D blockers, inflated by the walker's radius, so a click walk goes around walls
 * instead of stopping at the first one (the reference repo walks in a straight line and gets stuck).
 */
export class Pathfinder {
  private readonly w = Math.ceil((BOUNDS.x1 - BOUNDS.x0) / CELL);
  private readonly h = Math.ceil((BOUNDS.z1 - BOUNDS.z0) / CELL);
  private readonly solid: Uint8Array;
  private readonly g: Float32Array;
  private readonly f: Float32Array;
  private readonly from: Int32Array;
  private readonly seen: Uint32Array;
  private stamp = 0;

  constructor(blockers: readonly Rect[], radius: number) {
    const n = this.w * this.h;
    this.solid = new Uint8Array(n);
    this.g = new Float32Array(n);
    this.f = new Float32Array(n);
    this.from = new Int32Array(n);
    this.seen = new Uint32Array(n);
    for (const b of blockers) {
      const c0 = this.col(b.x0 - radius);
      const c1 = this.col(b.x1 + radius);
      const r0 = this.row(b.z0 - radius);
      const r1 = this.row(b.z1 + radius);
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) this.solid[r * this.w + c] = 1;
    }
  }

  private col(x: number): number {
    return Math.min(this.w - 1, Math.max(0, Math.floor((x - BOUNDS.x0) / CELL)));
  }
  private row(z: number): number {
    return Math.min(this.h - 1, Math.max(0, Math.floor((z - BOUNDS.z0) / CELL)));
  }
  private centre(i: number): Point {
    return { x: BOUNDS.x0 + ((i % this.w) + 0.5) * CELL, z: BOUNDS.z0 + (Math.floor(i / this.w) + 0.5) * CELL };
  }

  /** Nearest walkable cell, searching outward ring by ring (a click right against a wall still works). */
  private nearestFree(i: number, maxRing = 12): number {
    if (!this.solid[i]) return i;
    const c = i % this.w;
    const r = Math.floor(i / this.w);
    for (let k = 1; k <= maxRing; k++) {
      let best = -1;
      let bestD = Infinity;
      for (let dr = -k; dr <= k; dr++) {
        for (let dc = -k; dc <= k; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== k) continue;
          const rr = r + dr;
          const cc = c + dc;
          if (rr < 0 || cc < 0 || rr >= this.h || cc >= this.w) continue;
          const j = rr * this.w + cc;
          const d = dr * dr + dc * dc;
          if (!this.solid[j] && d < bestD) {
            best = j;
            bestD = d;
          }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  /** True when the straight segment crosses no solid cell (sampled at a quarter cell). */
  private clear(a: Point, b: Point): boolean {
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (CELL * 0.25));
    for (let s = 0; s <= steps; s++) {
      const t = s / (steps || 1);
      if (this.solid[this.row(a.z + (b.z - a.z) * t) * this.w + this.col(a.x + (b.x - a.x) * t)]) return false;
    }
    return true;
  }

  /** Waypoints from `start` to `goal` (goal moved onto free ground if needed), or null when unreachable. */
  find(start: Point, goal: Point): Point[] | null {
    const s = this.nearestFree(this.row(start.z) * this.w + this.col(start.x));
    const t = this.nearestFree(this.row(goal.z) * this.w + this.col(goal.x));
    if (s < 0 || t < 0) return null;
    const end = this.solid[this.row(goal.z) * this.w + this.col(goal.x)] ? this.centre(t) : goal;
    if (s === t || this.clear(start, end)) return [end];

    const stamp = ++this.stamp;
    const tc = t % this.w;
    const tr = Math.floor(t / this.w);
    const heur = (i: number): number => {
      const dx = Math.abs((i % this.w) - tc);
      const dz = Math.abs(Math.floor(i / this.w) - tr);
      return Math.max(dx, dz) + (SQRT2 - 1) * Math.min(dx, dz);
    };
    const open = new Heap(this.f);
    this.g[s] = 0;
    this.f[s] = heur(s);
    this.from[s] = -1;
    this.seen[s] = stamp;
    open.push(s);
    let found = false;
    while (open.size > 0) {
      const cur = open.pop();
      if (cur === t) {
        found = true;
        break;
      }
      const c = cur % this.w;
      const r = Math.floor(cur / this.w);
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const rr = r + dr;
          const cc = c + dc;
          if (rr < 0 || cc < 0 || rr >= this.h || cc >= this.w) continue;
          const j = rr * this.w + cc;
          if (this.solid[j]) continue;
          // No corner cutting: a diagonal needs both side cells free.
          if (dr !== 0 && dc !== 0 && (this.solid[r * this.w + cc] || this.solid[rr * this.w + c])) continue;
          const g = this.g[cur]! + (dr !== 0 && dc !== 0 ? SQRT2 : 1);
          if (this.seen[j] === stamp && g >= this.g[j]!) continue;
          this.seen[j] = stamp;
          this.g[j] = g;
          this.f[j] = g + heur(j);
          this.from[j] = cur;
          open.push(j);
        }
      }
    }
    if (!found) return null;

    const cells: Point[] = [];
    for (let i = this.from[t]!; i >= 0 && i !== s; i = this.from[i]!) cells.push(this.centre(i));
    cells.reverse();
    cells.push(end);
    // String pulling: keep only corners the straight line cannot skip.
    const path: Point[] = [];
    let anchor = start;
    for (let i = 0; i < cells.length; i++) {
      const next = cells[i + 1];
      if (next === undefined || !this.clear(anchor, next)) {
        path.push(cells[i]!);
        anchor = cells[i]!;
      }
    }
    return path;
  }
}
