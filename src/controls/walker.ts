import { MathUtils, type PerspectiveCamera, type Vector3 } from "three";
import type { Rect, RaisedFloor } from "../world/kit.ts";

const EYE = 1.62;
const RADIUS = 0.3;
const WALK = 4.2;
const FLY = 22;
export const BOUNDS = { x0: -130, x1: 102, z0: -180, z1: 180 };

export function groundAt(floors: readonly RaisedFloor[], x: number, z: number): number {
  let y = 0;
  for (const f of floors) if (x >= f.rect.x0 && x <= f.rect.x1 && z >= f.rect.z0 && z <= f.rect.z1 && f.y > y) y = f.y;
  return y;
}

export function insideBlocker(blockers: readonly Rect[], x: number, z: number, margin: number): boolean {
  for (const b of blockers) if (x > b.x0 - margin && x < b.x1 + margin && z > b.z0 - margin && z < b.z1 + margin) return true;
  return false;
}

/** Pushes a circle out of every blocking rectangle so walking slides along walls. */
export function pushOut(px: number, pz: number, blockers: readonly Rect[], radius: number): { x: number; z: number } {
  let x = px;
  let z = pz;
  for (let pass = 0; pass < 2; pass++) {
    for (const b of blockers) {
      const nx = MathUtils.clamp(x, b.x0, b.x1);
      const nz = MathUtils.clamp(z, b.z0, b.z1);
      const dx = x - nx;
      const dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * radius;
        z = nz + (dz / d) * radius;
      } else {
        const min = Math.min(x - b.x0, b.x1 - x, z - b.z0, b.z1 - z);
        if (min === x - b.x0) x = b.x0 - radius;
        else if (min === b.x1 - x) x = b.x1 + radius;
        else if (min === z - b.z0) z = b.z0 - radius;
        else z = b.z1 + radius;
      }
    }
  }
  return { x: MathUtils.clamp(x, BOUNDS.x0, BOUNDS.x1), z: MathUtils.clamp(z, BOUNDS.z0, BOUNDS.z1) };
}

export interface Place { x: number; y: number; z: number; lookX: number; lookY: number; lookZ: number; fly: boolean }

/** First-person walking on the ground and galleries (drag to look, WASD to move), with a free-flight mode for overviews. */
export class Walker {
  fly = false;
  private yaw = 0;
  private pitch = 0;
  private x = 0;
  private z = 0;
  private y = EYE;
  private readonly keys = new Set<string>();
  private dragging = false;

  constructor(private readonly camera: PerspectiveCamera, private readonly dom: HTMLElement, private readonly blockers: readonly Rect[], private readonly floors: readonly RaisedFloor[]) {
    camera.rotation.order = "YXZ";
    window.addEventListener("keydown", (e) => this.keys.add(e.code));
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.keys.clear());
    dom.addEventListener("pointerdown", (e) => {
      this.dragging = true;
      dom.setPointerCapture(e.pointerId);
    });
    dom.addEventListener("pointerup", () => (this.dragging = false));
    dom.addEventListener("pointermove", (e) => {
      if (!this.dragging) return;
      this.yaw -= e.movementX * 0.0034;
      this.pitch = MathUtils.clamp(this.pitch - e.movementY * 0.0034, -1.45, 1.45);
    });
  }

  goTo(p: Place): void {
    this.fly = p.fly;
    this.x = p.x;
    this.z = p.z;
    this.y = p.y;
    const dx = p.lookX - p.x;
    const dz = p.lookZ - p.z;
    this.yaw = Math.atan2(-dx, -dz);
    this.pitch = Math.atan2(p.lookY - p.y, Math.hypot(dx, dz));
    this.apply();
  }

  update(dt: number): void {
    const forward = (this.keys.has("KeyW") || this.keys.has("ArrowUp") ? 1 : 0) - (this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0);
    const strafe = (this.keys.has("KeyD") || this.keys.has("ArrowRight") ? 1 : 0) - (this.keys.has("KeyA") || this.keys.has("ArrowLeft") ? 1 : 0);
    const speed = (this.fly ? FLY : WALK) * (this.keys.has("ShiftLeft") ? 1.9 : 1);
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const len = Math.hypot(forward, strafe) || 1;
    const fwd = (forward / len) * speed * dt;
    const side = (strafe / len) * speed * dt;
    if (this.fly) {
      const cp = Math.cos(this.pitch);
      this.x += -sin * cp * fwd + cos * side;
      this.z += -cos * cp * fwd - sin * side;
      this.y += Math.sin(this.pitch) * fwd + ((this.keys.has("KeyE") ? 1 : 0) - (this.keys.has("KeyQ") ? 1 : 0)) * speed * dt;
      this.y = Math.max(0.6, this.y);
    } else {
      this.x += -sin * fwd + cos * side;
      this.z += -cos * fwd - sin * side;
      const p = pushOut(this.x, this.z, this.blockers, RADIUS);
      this.x = p.x;
      this.z = p.z;
      const target = groundAt(this.floors, this.x, this.z) + EYE;
      this.y = MathUtils.damp(this.y, target, 14, dt);
    }
    this.apply();
  }

  private apply(): void {
    (this.camera.position as Vector3).set(this.x, this.y, this.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
}
