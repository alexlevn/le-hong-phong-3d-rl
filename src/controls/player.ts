import { MathUtils, Raycaster, Vector2, Vector3, type Object3D, type PerspectiveCamera } from "three";
import type { Avatar } from "../avatar/model.ts";
import type { RaisedFloor, Rect } from "../world/kit.ts";
import { ClickMarker } from "./click-marker.ts";
import { Pathfinder, type Point } from "./pathfinder.ts";
import { groundAt, insideBlocker, pushOut } from "./walker.ts";

const RADIUS = 0.3;
const WALK = 3.6;
const RUN = 7;
/** Click walks shorter than this walk; longer ones run. */
const RUN_FROM = 6;
/** Look-at point above the feet (the character's chest). */
const FOCUS_HEIGHT = 1.35;
const MIN_PITCH = -0.15;
const MAX_PITCH = 1.2;
const MIN_DIST = 1.8;
const MAX_DIST = 14;
/** Camera keeps this far from walls and the ground. */
const CLEARANCE = 0.25;
const MARCH_STEP = 0.15;
/** Blockers are 2D footprints; above this the camera is over the roofs and may pass. */
const WALL_TOP = 14;
/** A press that moves less than this (px) is a click, not a drag. */
const CLICK_SLOP = 6;
const PICK_MAX = 160;
const PICK_STEP = 0.1;
const LOW_WALL = 1.2;
/** Easing the camera behind a click walk, held off for a while after the user rotated by hand. */
const AUTO_YAW_DAMP = 1.2;
const AUTO_YAW_HOLD = 1.5;

export function dampAngle(from: number, to: number, lambda: number, dt: number): number {
  const diff = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + diff * (1 - Math.exp(-lambda * dt));
}

const raycaster = new Raycaster();
const ndc = new Vector2();

/**
 * Third-person walking (reference repo's camera rig): WASD relative to the camera, drag to orbit, wheel to zoom,
 * click the ground to path-find there around obstacles.
 */
export class Player {
  active = false;
  avatar: Avatar | null = null;
  x = 0;
  z = 0;
  private y = 0;
  private heading = 0;
  private yaw = 0;
  private pitch = 0.32;
  private distance = 5;
  private shown = 5;
  private readonly focus = new Vector3();
  private readonly keys = new Set<string>();
  private dragging = false;
  private dragged = 0;
  private sinceManual = Infinity;
  private path: Point[] = [];
  private goal: Point | null = null;
  private stuck = 0;
  private replanned = false;
  private readonly finder: Pathfinder;
  private readonly marker: ClickMarker;

  constructor(
    private readonly camera: PerspectiveCamera,
    private readonly dom: HTMLElement,
    private readonly blockers: readonly Rect[],
    private readonly floors: readonly RaisedFloor[],
    parent: Object3D,
  ) {
    this.finder = new Pathfinder(blockers, RADIUS + 0.05);
    this.marker = new ClickMarker(parent);
    window.addEventListener("keydown", (e) => this.keys.add(e.code));
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.keys.clear());
    dom.addEventListener("pointerdown", () => {
      this.dragging = true;
      this.dragged = 0;
    });
    dom.addEventListener("pointerup", (e) => {
      if (this.active && this.dragging && this.dragged < CLICK_SLOP && e.button === 0) this.clickAt(e.clientX, e.clientY);
    });
    window.addEventListener("pointerup", () => (this.dragging = false));
    dom.addEventListener("pointermove", (e) => {
      if (!this.active || !this.dragging) return;
      this.dragged += Math.abs(e.movementX) + Math.abs(e.movementY);
      if (this.dragged < CLICK_SLOP) return;
      this.yaw -= e.movementX * 0.006;
      this.pitch = MathUtils.clamp(this.pitch + e.movementY * 0.006, MIN_PITCH, MAX_PITCH);
      this.sinceManual = 0;
    });
    dom.addEventListener("wheel", (e) => {
      if (!this.active) return;
      e.preventDefault();
      this.distance = MathUtils.clamp(this.distance * Math.exp(e.deltaY * 0.0012), MIN_DIST, MAX_DIST);
    }, { passive: false });
  }

  /** Puts the character at (x, z) facing (lookX, lookZ), camera straight behind. */
  place(x: number, z: number, lookX: number, lookZ: number): void {
    this.cancelWalk();
    const p = pushOut(x, z, this.blockers, RADIUS);
    this.x = p.x;
    this.z = p.z;
    this.y = groundAt(this.floors, this.x, this.z);
    this.heading = Math.atan2(lookX - x, lookZ - z);
    this.yaw = this.heading + Math.PI;
    this.focus.set(this.x, this.y + FOCUS_HEIGHT, this.z);
    this.shown = this.distance;
    this.sync(0, true);
  }

  cancelWalk(): void {
    this.path = [];
    this.goal = null;
    this.marker.hide();
  }

  /**
   * Ground point under a screen pixel, or null when a wall comes first. Marched against the 2D blockers and
   * raised floors instead of raycasting the merged scenery's triangles.
   */
  private pick(clientX: number, clientY: number): Point | null {
    const rect = this.dom.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, this.camera);
    const { origin: o, direction: d } = raycaster.ray;
    for (let t = PICK_STEP; t <= PICK_MAX; t += PICK_STEP) {
      const x = o.x + d.x * t;
      const y = o.y + d.y * t;
      const z = o.z + d.z * t;
      if (y <= groundAt(this.floors, x, z)) return { x, z };
      // Footprints have no height: below knee-ish height the ray may pass (railings, hedges, low walls).
      if (y > LOW_WALL && y < WALL_TOP && insideBlocker(this.blockers, x, z, 0)) return null;
    }
    return null;
  }

  private clickAt(clientX: number, clientY: number): void {
    const hit = this.pick(clientX, clientY);
    if (!hit) return;
    this.goal = hit;
    this.replanned = false;
    if (!this.plan()) return;
    const end = this.path[this.path.length - 1]!;
    this.marker.show(end.x, groundAt(this.floors, end.x, end.z), end.z);
  }

  private plan(): boolean {
    const path = this.goal ? this.finder.find({ x: this.x, z: this.z }, this.goal) : null;
    if (!path) {
      this.cancelWalk();
      return false;
    }
    this.path = path;
    this.stuck = 0;
    return true;
  }

  private remaining(): number {
    let d = 0;
    let px = this.x;
    let pz = this.z;
    for (const p of this.path) {
      d += Math.hypot(p.x - px, p.z - pz);
      px = p.x;
      pz = p.z;
    }
    return d;
  }

  update(dt: number): void {
    this.sinceManual += dt;
    const forward = (this.keys.has("KeyW") || this.keys.has("ArrowUp") ? 1 : 0) - (this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0);
    const strafe = (this.keys.has("KeyD") || this.keys.has("ArrowRight") ? 1 : 0) - (this.keys.has("KeyA") || this.keys.has("ArrowLeft") ? 1 : 0);
    const shift = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    let mx = 0;
    let mz = 0;
    let want = 0;
    if (forward !== 0 || strafe !== 0) {
      // Keys always win over a click walk.
      if (this.path.length > 0) this.cancelWalk();
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      const len = Math.hypot(forward, strafe);
      mx = (-sin * forward + cos * strafe) / len;
      mz = (-cos * forward - sin * strafe) / len;
      want = shift ? RUN : WALK;
    } else if (this.path.length > 0) {
      const last = this.path.length === 1;
      let next = this.path[0]!;
      let d = Math.hypot(next.x - this.x, next.z - this.z);
      if (d < (last ? 0.12 : 0.35)) {
        this.path.shift();
        if (this.path.length === 0) this.marker.hide();
        else {
          next = this.path[0]!;
          d = Math.hypot(next.x - this.x, next.z - this.z);
        }
      }
      if (this.path.length > 0 && d > 1e-4) {
        mx = (next.x - this.x) / d;
        mz = (next.z - this.z) / d;
        want = Math.min(this.remaining() > RUN_FROM || shift ? RUN : WALK, d / Math.max(dt, 1e-4));
      }
    }

    let speed = 0;
    if (want > 0) {
      const p = pushOut(this.x + mx * want * dt, this.z + mz * want * dt, this.blockers, RADIUS);
      // Real speed after sliding along walls, so feet do not run on the spot against a wall.
      speed = Math.hypot(p.x - this.x, p.z - this.z) / Math.max(dt, 1e-4);
      this.x = p.x;
      this.z = p.z;
      this.heading = dampAngle(this.heading, Math.atan2(mx, mz), 12, dt);
      if (this.path.length > 0) {
        // Pushed back by something the grid missed: plan again once, then give up rather than run in place.
        this.stuck = speed < want * 0.2 ? this.stuck + dt : 0;
        if (this.stuck > 0.6) {
          if (this.replanned) this.cancelWalk();
          else {
            this.replanned = true;
            this.plan();
          }
        }
        if (this.sinceManual > AUTO_YAW_HOLD) this.yaw = dampAngle(this.yaw, this.heading + Math.PI, AUTO_YAW_DAMP, dt);
      }
    }
    this.y = MathUtils.damp(this.y, groundAt(this.floors, this.x, this.z), 14, dt);
    if (this.avatar) {
      this.avatar.root.position.set(this.x, this.y, this.z);
      this.avatar.root.rotation.y = this.heading;
      this.avatar.update(dt, speed);
    }
    this.marker.update(dt);
    this.sync(dt, false);
  }

  private blocked(x: number, y: number, z: number): boolean {
    if (y < groundAt(this.floors, x, z) + CLEARANCE) return true;
    return y < WALL_TOP && insideBlocker(this.blockers, x, z, CLEARANCE);
  }

  /** Follows the character and pulls in when a wall would hide it (instant in, eased back out). */
  private sync(dt: number, instant: boolean): void {
    const f = this.focus;
    const k = instant ? 1 : 1 - Math.exp(-10 * dt);
    f.x += (this.x - f.x) * k;
    f.y += (this.y + FOCUS_HEIGHT - f.y) * k;
    f.z += (this.z - f.z) * k;
    const cp = Math.cos(this.pitch);
    const bx = Math.sin(this.yaw) * cp;
    const by = Math.sin(this.pitch);
    const bz = Math.cos(this.yaw) * cp;
    let limit = this.distance;
    for (let d = MARCH_STEP; d <= this.distance; d += MARCH_STEP) {
      if (this.blocked(f.x + bx * d, f.y + by * d, f.z + bz * d)) {
        limit = Math.max(0.5, d - MARCH_STEP);
        break;
      }
    }
    this.shown = instant || limit < this.shown ? limit : MathUtils.damp(this.shown, limit, 4, dt);
    this.camera.position.set(f.x + bx * this.shown, f.y + by * this.shown, f.z + bz * this.shown);
    this.camera.lookAt(f);
  }
}
