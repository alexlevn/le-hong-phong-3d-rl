import { CircleGeometry, Group, Mesh, MeshBasicMaterial, RingGeometry, type Object3D } from "three";

const COLOR = 0xffe27a;

function flat(geometry: RingGeometry | CircleGeometry, opacity: number): Mesh<RingGeometry | CircleGeometry, MeshBasicMaterial> {
  geometry.rotateX(-Math.PI / 2);
  const m = new Mesh(geometry, new MeshBasicMaterial({ color: COLOR, transparent: true, opacity, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  m.renderOrder = 2;
  return m;
}

/** Destination marker like most 3D games: a ripple on click, then a pulsing ring + dot until the character arrives. */
export class ClickMarker {
  private readonly root = new Group();
  private readonly ripple = flat(new RingGeometry(0.42, 0.5, 40), 0.9);
  private readonly ring = flat(new RingGeometry(0.3, 0.38, 40), 0.85);
  private readonly dot = flat(new CircleGeometry(0.1, 20), 0.95);
  private age = 0;
  /** Seconds left of the fade-out after arrival; < 0 = not fading. */
  private fading = -1;

  constructor(parent: Object3D) {
    this.root.add(this.ripple, this.ring, this.dot);
    this.root.visible = false;
    parent.add(this.root);
  }

  show(x: number, y: number, z: number): void {
    this.root.position.set(x, y + 0.03, z);
    this.root.visible = true;
    this.age = 0;
    this.fading = -1;
  }

  /** Arrived or cancelled: fade out instead of popping off. */
  hide(): void {
    if (this.root.visible && this.fading < 0) this.fading = 0.3;
  }

  update(dt: number): void {
    if (!this.root.visible) return;
    this.age += dt;
    let alpha = 1;
    if (this.fading >= 0) {
      this.fading -= dt;
      alpha = Math.max(0, this.fading / 0.3);
      if (this.fading <= 0) {
        this.root.visible = false;
        return;
      }
    }
    // Ripple: grows from the point and fades within half a second.
    const r = Math.min(1, this.age / 0.5);
    this.ripple.visible = r < 1;
    this.ripple.scale.setScalar(0.3 + r * 1.6);
    this.ripple.material.opacity = (1 - r) * 0.9 * alpha;
    // Ring pops in with a small overshoot, then breathes.
    const pop = Math.min(1, this.age / 0.18);
    const pulse = 1 + Math.sin(this.age * 6) * 0.08;
    this.ring.scale.setScalar((pop < 1 ? pop * 1.15 : 1) * pulse);
    this.ring.material.opacity = 0.85 * alpha;
    this.dot.material.opacity = 0.95 * alpha;
  }
}
