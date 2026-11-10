import { BoxGeometry, BufferGeometry, CanvasTexture, CircleGeometry, Color, CylinderGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, Object3D, SphereGeometry, TorusGeometry, Vector3, type Material } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { LOOKS, type LookId } from "./looks.ts";

// Model space: feet on y = 0, facing +z, character's left on +x. About 1.65 m with a big head, like the reference chibis.
const HIP_Y = 0.66;
const KNEE_Y = 0.36;
const SHOULDER = new Vector3(0.215, 1.04, 0);
const ELBOW_Y = 0.81;
const NECK_Y = 1.1;
const HEAD_Y = 1.37;
const HEAD_R = 0.27;
const WAIST_Y = 0.72;
/** One walk cycle (two steps) covers this many metres at full stride. */
const STRIDE = 1.25;

type Joint = "hips" | "torso" | "head" | "armL" | "foreL" | "armR" | "foreR" | "thighL" | "shinL" | "thighR" | "shinR" | "flapF" | "flapB";

/** Pivot of each joint in model space and its parent. */
const PIVOT: Readonly<Record<Joint, readonly [Vector3, Joint | null]>> = {
  hips: [new Vector3(0, HIP_Y, 0), null],
  torso: [new Vector3(0, HIP_Y, 0), "hips"],
  head: [new Vector3(0, NECK_Y, 0), "torso"],
  armL: [SHOULDER.clone(), "torso"],
  foreL: [new Vector3(SHOULDER.x, ELBOW_Y, 0), "armL"],
  armR: [new Vector3(-SHOULDER.x, SHOULDER.y, 0), "torso"],
  foreR: [new Vector3(-SHOULDER.x, ELBOW_Y, 0), "armR"],
  thighL: [new Vector3(0.1, HIP_Y, 0), "hips"],
  shinL: [new Vector3(0.1, KNEE_Y, 0), "thighL"],
  thighR: [new Vector3(-0.1, HIP_Y, 0), "hips"],
  shinR: [new Vector3(-0.1, KNEE_Y, 0), "thighR"],
  flapF: [new Vector3(0, WAIST_Y, 0.12), "hips"],
  flapB: [new Vector3(0, WAIST_Y, -0.12), "hips"],
};

/** Paints a part one colour (or by height) so every part of a joint merges into one mesh. */
function paint(g: BufferGeometry, color: number | ((y: number) => number)): BufferGeometry {
  const pos = g.getAttribute("position");
  const out = new Float32Array(pos.count * 3);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    c.set(typeof color === "number" ? color : color(pos.getY(i)));
    out.set([c.r, c.g, c.b], i * 3);
  }
  g.deleteAttribute("uv");
  g.setAttribute("color", new Float32BufferAttribute(out, 3));
  return g.index ? g.toNonIndexed() : g;
}

const limb = (r0: number, r1: number, x: number, y0: number, y1: number, z = 0): BufferGeometry =>
  new CylinderGeometry(r1, r0, y1 - y0, 12).translate(x, (y0 + y1) / 2, z);
const ball = (r: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1): BufferGeometry =>
  new SphereGeometry(r, 16, 12).scale(sx, sy, sz).translate(x, y, z);
/** Top of a sphere down to `theta` from the crown, tipped back by `tilt` (hair, cap). */
const dome = (r: number, theta: number, tilt: number): BufferGeometry =>
  new SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, theta).rotateX(-tilt).translate(0, HEAD_Y, 0);

function buildParts(id: LookId): Map<Joint, BufferGeometry[]> {
  const look = LOOKS[id];
  const parts = new Map<Joint, BufferGeometry[]>();
  const add = (j: Joint, g: BufferGeometry, color: number | ((y: number) => number)): void => {
    const list = parts.get(j) ?? [];
    list.push(paint(g, color));
    parts.set(j, list);
  };

  // Legs: trousers to the ankle, a shoe as part of the shin.
  for (const [s, thigh, shin] of [[1, "thighL", "shinL"], [-1, "thighR", "shinR"]] as const) {
    const x = 0.1 * s;
    add(thigh, limb(0.07, 0.08, x, KNEE_Y, HIP_Y), look.pants);
    add(shin, ball(0.068, x, KNEE_Y, 0), look.pants);
    add(shin, limb(0.058, 0.066, x, 0.08, KNEE_Y), look.pants);
    add(shin, new BoxGeometry(0.13, 0.09, 0.24).translate(x, 0.045, 0.035), look.shoes);
  }

  // Torso: shirt over trousers, or one long garment for the ao dai.
  const torsoColor = look.aoDai ? look.top : (y: number): number => (y < WAIST_Y ? look.pants : look.top);
  add("torso", limb(0.175, 0.19, 0, 0.6, 0.98), torsoColor);
  add("torso", ball(0.19, 0, 0.98, 0, 1, 0.55, 0.9), look.top);
  if (look.collar !== null) add("torso", new TorusGeometry(0.075, 0.028, 8, 16).rotateX(Math.PI / 2).translate(0, 1.07, 0.01), look.collar);
  if (look.aoDai) {
    // Mandarin collar of the ao dai.
    add("torso", limb(0.06, 0.062, 0, 1.03, 1.12), look.top);
    add("flapF", new BoxGeometry(0.3, 0.56, 0.025).translate(0, WAIST_Y - 0.28, 0.12), look.top);
    add("flapB", new BoxGeometry(0.3, 0.56, 0.025).translate(0, WAIST_Y - 0.28, -0.12), look.top);
  }
  if (look.backpack !== null) {
    add("torso", new BoxGeometry(0.3, 0.36, 0.14).translate(0, 0.86, -0.24), look.backpack);
    add("torso", new BoxGeometry(0.22, 0.14, 0.05).translate(0, 0.76, -0.33), look.backpack);
  }

  // Arms: sleeve on the upper arm, skin or sleeve below the elbow, round hands.
  for (const [s, arm, fore] of [[1, "armL", "foreL"], [-1, "armR", "foreR"]] as const) {
    const x = SHOULDER.x * s;
    add(arm, ball(0.072, x, SHOULDER.y, 0), look.top);
    add(arm, limb(0.058, 0.068, x, ELBOW_Y, SHOULDER.y), look.top);
    add(fore, limb(0.05, 0.056, x, 0.6, ELBOW_Y), look.longSleeves ? look.top : look.skin);
    add(fore, ball(0.058, x, 0.57, 0), look.skin);
  }

  // Head: big round face, dot eyes with a highlight, blush, small smile.
  add("head", limb(0.05, 0.05, 0, 1.04, 1.14), look.skin);
  add("head", ball(HEAD_R, 0, HEAD_Y, 0, 1, 0.97, 0.96), look.skin);
  for (const s of [1, -1]) {
    add("head", ball(0.034, 0.095 * s, HEAD_Y - 0.01, 0.245, 1, 1.35, 0.6), 0x1e1a1a);
    add("head", ball(0.011, 0.095 * s + 0.01, HEAD_Y + 0.015, 0.262), 0xffffff);
    add("head", ball(0.035, 0.155 * s, HEAD_Y - 0.075, 0.21, 1, 0.55, 0.4), 0xf29a96);
    if (look.hairStyle !== "long") add("head", ball(0.05, HEAD_R * s, HEAD_Y - 0.02, 0, 0.6, 1, 1), look.skin);
  }
  add("head", new TorusGeometry(0.032, 0.008, 6, 12, Math.PI).rotateZ(Math.PI).translate(0, HEAD_Y - 0.095, 0.25), 0x8a3a35);
  if (look.glasses) {
    for (const s of [1, -1]) add("head", new TorusGeometry(0.055, 0.009, 6, 18).translate(0.095 * s, HEAD_Y - 0.005, 0.262), 0x2a2a2e);
    add("head", new BoxGeometry(0.08, 0.012, 0.012).translate(0, HEAD_Y, 0.27), 0x2a2a2e);
  }

  // Hair: a cap over the crown plus one tipped back to cover the nape; styles add to it.
  add("head", dome(HEAD_R + 0.02, 1.05, 0), look.hair);
  add("head", dome(HEAD_R + 0.015, 1.25, 0.75), look.hair);
  if (look.hairStyle === "long") {
    add("head", new BoxGeometry(0.5, 0.62, 0.16).translate(0, HEAD_Y - 0.2, -0.16), look.hair);
    for (const s of [1, -1]) add("head", new BoxGeometry(0.09, 0.4, 0.14).translate(0.235 * s, HEAD_Y - 0.12, -0.02), look.hair);
  }
  if (look.hairStyle === "bun") add("head", ball(0.12, 0, HEAD_Y + 0.12, -0.25), look.hair);
  if (look.hairStyle === "cap" && look.hat !== null) {
    add("head", dome(HEAD_R + 0.035, 1.15, 0.1), look.hat);
    add("head", new CylinderGeometry(0.17, 0.17, 0.02, 20).scale(1, 1, 1.15).translate(0, HEAD_Y + 0.16, 0.25), look.hat);
  }
  return parts;
}

function blobTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(0,0,0,1)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

const smooth = (from: number, to: number, k: number): number => from + (to - from) * k;

/** One character: a jointed body (one merged mesh per joint) plus a soft blob shadow, walk cycle driven by speed. */
export class Avatar {
  readonly root = new Group();
  private readonly joints = {} as Record<Joint, Object3D>;
  private phase = 0;
  private stride = 0;
  private time = 0;

  constructor(id: LookId, material: Material) {
    const parts = buildParts(id);
    for (const name of Object.keys(PIVOT) as Joint[]) {
      const [pivot, parent] = PIVOT[name];
      const node = new Object3D();
      node.position.copy(pivot).sub(parent ? PIVOT[parent][0] : new Vector3());
      const list = parts.get(name);
      if (list) {
        const mesh = new Mesh(mergeGeometries(list)!.translate(-pivot.x, -pivot.y, -pivot.z), material);
        mesh.castShadow = false;
        node.add(mesh);
        for (const g of list) g.dispose();
      }
      this.joints[name] = node;
      (parent ? this.joints[parent] : this.root).add(node);
    }
    // Static shadow map never redraws, so the character gets a contact blob instead of a cast shadow.
    const blob = new Mesh(
      new CircleGeometry(0.42, 20).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({ map: blobTexture(), color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    );
    blob.position.y = 0.015;
    blob.renderOrder = 1;
    this.root.add(blob);
  }

  /** `speed` in m/s along the ground; 0 = standing. */
  update(dt: number, speed: number): void {
    this.time += dt;
    this.stride = smooth(this.stride, Math.min(speed / 4.2, 1.4), 1 - Math.exp(-10 * dt));
    this.phase += (speed / STRIDE) * Math.PI * 2 * dt;
    const s = this.stride;
    const sin = Math.sin(this.phase);
    const j = this.joints;
    // Forward swing is a negative x rotation (the foot moves to +z).
    j.thighL.rotation.x = -sin * 0.6 * s;
    j.thighR.rotation.x = sin * 0.6 * s;
    j.shinL.rotation.x = Math.max(0, Math.cos(this.phase)) * 0.9 * s;
    j.shinR.rotation.x = Math.max(0, -Math.cos(this.phase)) * 0.9 * s;
    j.armL.rotation.x = sin * 0.55 * s;
    j.armR.rotation.x = -sin * 0.55 * s;
    j.armL.rotation.z = 0.07;
    j.armR.rotation.z = -0.07;
    j.foreL.rotation.x = -0.25 * s - 0.05;
    j.foreR.rotation.x = -0.25 * s - 0.05;
    j.torso.rotation.y = sin * 0.1 * s;
    j.torso.rotation.x = 0.06 * s;
    j.hips.position.y = HIP_Y + Math.abs(Math.cos(this.phase)) * 0.035 * s + Math.sin(this.time * 2) * 0.004;
    j.head.rotation.x = Math.sin(this.time * 1.3) * 0.03 * (1 - Math.min(1, s));
    // The ao dai flaps lift with whichever leg is in front / behind so legs never poke through them.
    j.flapF.rotation.x = Math.min(0, j.thighL.rotation.x, j.thighR.rotation.x) * 0.95;
    j.flapB.rotation.x = Math.max(0, j.thighL.rotation.x, j.thighR.rotation.x) * 0.95;
  }
}
