import { MathUtils, Vector3, type PerspectiveCamera } from "three";
import type { Avatar } from "../avatar/model.ts";
import type { RaisedFloor, Rect } from "../world/kit.ts";
import { groundAt, insideBlocker, pushOut } from "./walker.ts";

const RADIUS = 0.3;
const WALK = 3.6;
const RUN = 7;
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

export function dampAngle(from: number, to: number, lambda: number, dt: number): number {
  const diff = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + diff * (1 - Math.exp(-lambda * dt));
}

/** Third-person walking (reference repo's camera rig): WASD relative to the camera, drag to orbit, wheel to zoom. */
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

  constructor(private readonly camera: PerspectiveCamera, dom: HTMLElement, private readonly blockers: readonly Rect[], private readonly floors: readonly RaisedFloor[]) {
    window.addEventListener("keydown", (e) => this.keys.add(e.code));
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.keys.clear());
    dom.addEventListener("pointerdown", () => (this.dragging = true));
    window.addEventListener("pointerup", () => (this.dragging = false));
    dom.addEventListener("pointermove", (e) => {
      if (!this.active || !this.dragging) return;
      this.yaw -= e.movementX * 0.006;
      this.pitch = MathUtils.clamp(this.pitch + e.movementY * 0.006, MIN_PITCH, MAX_PITCH);
    });
    dom.addEventListener("wheel", (e) => {
      if (!this.active) return;
      e.preventDefault();
      this.distance = MathUtils.clamp(this.distance * Math.exp(e.deltaY * 0.0012), MIN_DIST, MAX_DIST);
    }, { passive: false });
  }

  /** Puts the character at (x, z) facing (lookX, lookZ), camera straight behind. */
  place(x: number, z: number, lookX: number, lookZ: number): void {
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

  update(dt: number): void {
    const forward = (this.keys.has("KeyW") || this.keys.has("ArrowUp") ? 1 : 0) - (this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0);
    const strafe = (this.keys.has("KeyD") || this.keys.has("ArrowRight") ? 1 : 0) - (this.keys.has("KeyA") || this.keys.has("ArrowLeft") ? 1 : 0);
    let speed = 0;
    if (forward !== 0 || strafe !== 0) {
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      const len = Math.hypot(forward, strafe);
      const mx = (-sin * forward + cos * strafe) / len;
      const mz = (-cos * forward - sin * strafe) / len;
      const want = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") ? RUN : WALK;
      const p = pushOut(this.x + mx * want * dt, this.z + mz * want * dt, this.blockers, RADIUS);
      // Real speed after sliding along walls, so feet do not run on the spot against a wall.
      speed = Math.hypot(p.x - this.x, p.z - this.z) / Math.max(dt, 1e-4);
      this.x = p.x;
      this.z = p.z;
      this.heading = dampAngle(this.heading, Math.atan2(mx, mz), 12, dt);
    }
    this.y = MathUtils.damp(this.y, groundAt(this.floors, this.x, this.z), 14, dt);
    if (this.avatar) {
      this.avatar.root.position.set(this.x, this.y, this.z);
      this.avatar.root.rotation.y = this.heading;
      this.avatar.update(dt, speed);
    }
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
