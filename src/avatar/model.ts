import {
  BoxGeometry, BufferGeometry, CanvasTexture, CircleGeometry, Color, CylinderGeometry, ExtrudeGeometry, Float32BufferAttribute, Group, LatheGeometry,
  Mesh, MeshBasicMaterial, Object3D, Quaternion, Shape, SphereGeometry, TorusGeometry, Vector2, Vector3, type Material,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { LOOKS, type Look, type LookId } from "./looks.ts";

// Model space: feet on y = 0, facing +z, character's left on +x. About 1.65 m with a big head, like the reference chibis.
const HIP_Y = 0.66;
const KNEE_Y = 0.36;
const SHOULDER = new Vector3(0.2, 1.03, 0);
const ELBOW_Y = 0.81;
const WRIST_Y = 0.6;
const NECK_Y = 1.1;
const HEAD_Y = 1.37;
const HEAD_R = 0.27;
/** Head is a little wider than tall: rounder, friendlier face. */
const HEAD_SCALE = new Vector3(1.06, 0.95, 1);
const WAIST_Y = 0.72;
/** One walk cycle (two steps) covers this many metres at a slow walk; longer when faster. */
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
  thighL: [new Vector3(0.095, HIP_Y, 0), "hips"],
  shinL: [new Vector3(0.095, KNEE_Y, 0), "thighL"],
  thighR: [new Vector3(-0.095, HIP_Y, 0), "hips"],
  shinR: [new Vector3(-0.095, KNEE_Y, 0), "thighR"],
  flapF: [new Vector3(0, WAIST_Y, 0.14), "hips"],
  flapB: [new Vector3(0, WAIST_Y, -0.14), "hips"],
};

type Profile = readonly (readonly [number, number])[];

/** Shirt tucked into the trousers: (radius, height) from hem to neck. */
const SHIRT: Profile = [[0.172, 0.69], [0.175, 0.8], [0.179, 0.92], [0.173, 0.99], [0.152, 1.035], [0.11, 1.07], [0.055, 1.095], [0.001, 1.1]];
/** Untucked T-shirt: lower, slightly flared hem. */
const TEE: Profile = [[0.182, 0.61], [0.177, 0.7], ...SHIRT.slice(1)];
/** Ao dai bodice: fitted, narrow waist. */
const BODICE: Profile = [[0.155, 0.6], [0.152, 0.72], [0.15, 0.8], [0.166, 0.9], [0.171, 0.96], [0.16, 1.01], [0.13, 1.05], [0.07, 1.08], [0.001, 1.085]];
const TROUSER_HIPS: Profile = [[0.001, 0.57], [0.11, 0.575], [0.158, 0.6], [0.167, 0.66], [0.167, 0.74], [0.001, 0.745]];
const SLIM_HIPS: Profile = [[0.001, 0.57], [0.1, 0.575], [0.14, 0.6], [0.148, 0.66], [0.148, 0.74], [0.001, 0.745]];

function radiusAt(p: Profile, y: number): number {
  for (let i = 1; i < p.length; i++) {
    const [r0, y0] = p[i - 1]!;
    const [r1, y1] = p[i]!;
    if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0 || 1);
  }
  return 0;
}

/** Front surface depth of a lathe at (x, y): where details (buttons, badge) sit. */
const frontZ = (p: Profile, x: number, y: number): number => Math.sqrt(Math.max(0, radiusAt(p, y) ** 2 - x * x));

const lathe = (p: Profile): BufferGeometry => new LatheGeometry(p.map(([r, y]) => new Vector2(r, y)), 28);

const shade = (hex: number, k: number): number => new Color(hex).multiplyScalar(k).getHex();

/** Paints a part one colour so every part of a joint merges into one mesh. */
function paint(g: BufferGeometry, color: number): BufferGeometry {
  const flat = g.index ? g.toNonIndexed() : g;
  const pos = flat.getAttribute("position");
  const out = new Float32Array(pos.count * 3);
  const c = new Color(color);
  for (let i = 0; i < pos.count; i++) out.set([c.r, c.g, c.b], i * 3);
  for (const name of Object.keys(flat.attributes)) if (name !== "position" && name !== "normal") flat.deleteAttribute(name);
  flat.clearGroups();
  flat.setAttribute("color", new Float32BufferAttribute(out, 3));
  return flat;
}

const limb = (r0: number, r1: number, x: number, y0: number, y1: number, z = 0): BufferGeometry =>
  new CylinderGeometry(r1, r0, y1 - y0, 16).translate(x, (y0 + y1) / 2, z);
const ball = (r: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1): BufferGeometry =>
  new SphereGeometry(r, 20, 14).scale(sx, sy, sz).translate(x, y, z);

/** Box of width w and thickness t from a to b (straps). */
function beam(a: Vector3, b: Vector3, w: number, t: number): BufferGeometry {
  const dir = b.clone().sub(a);
  const g = new BoxGeometry(w, dir.length(), t);
  g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize()));
  return g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
}

/** Point on the (scaled) head sphere: theta from the crown, a around from the front (+z), lifted off the skin. */
function onHead(theta: number, a: number, lift = 0): Vector3 {
  const r = HEAD_R + lift;
  return new Vector3(Math.sin(theta) * Math.sin(a) * r, Math.cos(theta) * r, Math.sin(theta) * Math.cos(a) * r).multiply(HEAD_SCALE).add(new Vector3(0, HEAD_Y, 0));
}

/** Part of a shell around the head: `window` leaves the face open (radians each side of the front). */
function hairShell(lift: number, thetaEnd: number, window = 0, thetaStart = 0): BufferGeometry {
  // SphereGeometry puts +z at phi = PI/2.
  const g = new SphereGeometry(HEAD_R + lift, 36, 20, Math.PI / 2 + window, Math.PI * 2 - window * 2, thetaStart, thetaEnd - thetaStart);
  return g.scale(HEAD_SCALE.x, HEAD_SCALE.y, HEAD_SCALE.z).translate(0, HEAD_Y, 0);
}

/** Fringe lock lying on the forehead, tipped back with the head's curve. */
function lock(theta: number, a: number, r: number, sx: number, sy: number): BufferGeometry {
  const p = onHead(theta, a, 0.012);
  return new SphereGeometry(r, 14, 10).scale(sx, sy, 0.5).rotateX(theta - Math.PI / 2).rotateY(a).translate(p.x, p.y, p.z);
}

/** Ao dai panel: narrow at the waist, wider and rounded at the hem, curved around the legs. */
function flap(length: number): BufferGeometry {
  const top = 0.15;
  const hem = 0.19;
  const s = new Shape();
  s.moveTo(-top, 0);
  s.lineTo(top, 0);
  s.lineTo(hem, -length + 0.05);
  s.quadraticCurveTo(hem, -length, hem - 0.05, -length);
  s.lineTo(-hem + 0.05, -length);
  s.quadraticCurveTo(-hem, -length, -hem, -length + 0.05);
  s.closePath();
  const g = new ExtrudeGeometry(s, { depth: 0.014, bevelEnabled: false, curveSegments: 6 });
  // Bend around the body; extra rows come from re-tessellating via toNonIndexed later, so bend vertices directly.
  const pos = g.getAttribute("position");
  for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getZ(i) - 1.4 * pos.getX(i) ** 2);
  g.computeVertexNormals();
  return g;
}

function buildParts(id: LookId): Map<Joint, BufferGeometry[]> {
  const look: Look = LOOKS[id];
  const parts = new Map<Joint, BufferGeometry[]>();
  const add = (j: Joint, g: BufferGeometry, color: number): void => {
    const list = parts.get(j) ?? [];
    list.push(paint(g, color));
    parts.set(j, list);
  };
  const untucked = look.print !== null;

  // Legs: trousers to the ankle (wide and light under an ao dai), rounded shoes with a sole.
  for (const [s, thigh, shin] of [[1, "thighL", "shinL"], [-1, "thighR", "shinR"]] as const) {
    const x = 0.095 * s;
    const flare = look.aoDai ? 0.012 : 0;
    add(thigh, limb(0.068 + flare, 0.078, x, KNEE_Y, HIP_Y), look.pants);
    add(shin, ball(0.066 + flare, x, KNEE_Y, 0), look.pants);
    add(shin, limb(0.06 + flare * 1.5, 0.066 + flare, x, 0.075, KNEE_Y), look.pants);
    add(shin, ball(0.074, x, 0.06, 0.035, 0.95, 0.62, 1.6), look.shoes);
    add(shin, new BoxGeometry(0.14, 0.025, 0.235).translate(x, 0.0125, 0.035), look.stripe !== null ? 0xf7f7f2 : shade(look.shoes, 0.7));
    if (look.stripe !== null) add(shin, new BoxGeometry(0.012, 0.03, 0.09).translate(x + 0.068 * s, 0.065, 0.03), look.stripe);
  }

  // Torso.
  const body = look.aoDai ? BODICE : untucked ? TEE : SHIRT;
  add("torso", lathe(look.aoDai ? SLIM_HIPS : TROUSER_HIPS), look.pants);
  add("torso", lathe(body), look.top);
  if (look.belt !== null && !untucked) {
    add("torso", new TorusGeometry(0.172, 0.013, 8, 32).rotateX(Math.PI / 2).translate(0, 0.705, 0), look.belt);
    add("torso", new BoxGeometry(0.05, 0.034, 0.014).translate(0, 0.705, 0.184), 0xc9a74a);
  }
  if (look.aoDai) {
    add("torso", limb(0.062, 0.058, 0, 1.04, 1.14), look.top);
    add("flapF", flap(0.66).translate(0, WAIST_Y + 0.03, 0.142), look.top);
    add("flapB", flap(0.66).rotateY(Math.PI).translate(0, WAIST_Y + 0.03, -0.142), look.top);
    // Diagonal fastening from the collar to the right armpit.
    if (look.buttons !== null) {
      for (let k = 0; k < 4; k++) {
        const t = 0.15 + k * 0.27;
        const x = -0.13 * t;
        const y = 1.06 - 0.12 * t;
        add("torso", ball(0.009, x, y, frontZ(BODICE, x, y) + 0.003), look.buttons);
      }
    }
  } else {
    if (look.collar !== null) {
      add("torso", new TorusGeometry(0.06, 0.016, 8, 20).rotateX(Math.PI / 2).translate(0, 1.085, -0.005), look.collar);
      for (const s of [1, -1]) {
        add("torso", new BoxGeometry(0.075, 0.05, 0.012).rotateZ(0.55 * s).rotateX(-0.6).translate(0.042 * s, 1.07, 0.088), shade(look.collar, 0.97));
      }
    } else {
      add("torso", new TorusGeometry(0.058, 0.012, 8, 20).rotateX(Math.PI / 2).translate(0, 1.088, 0), shade(look.top, 0.85));
    }
    if (look.buttons !== null) for (const y of [0.78, 0.86, 0.94, 1.01]) add("torso", ball(0.009, 0, y, frontZ(SHIRT, 0, y) + 0.002), look.buttons);
    if (look.collar !== null) {
      const x = 0.085;
      const y = 0.9;
      add("torso", new BoxGeometry(0.07, 0.075, 0.006).rotateY(Math.atan2(x, frontZ(SHIRT, x, y))).translate(x, y, frontZ(SHIRT, x, y) + 0.002), shade(look.top, 0.93));
    }
    if (look.badge) {
      const x = 0.085;
      const y = 0.97;
      const z = frontZ(SHIRT, x, y) + 0.004;
      const turn = Math.atan2(x, z);
      add("torso", new BoxGeometry(0.075, 0.034, 0.006).rotateY(turn).translate(x, y, z), 0x1d4f9b);
      add("torso", new BoxGeometry(0.05, 0.006, 0.004).rotateY(turn).translate(x, y + 0.004, z + 0.004), 0xe7c75c);
    }
    if (look.tie !== null) {
      add("torso", new BoxGeometry(0.042, 0.036, 0.026).translate(0, 1.058, 0.115), look.tie);
      const blade = new Shape();
      blade.moveTo(-0.02, 0);
      blade.lineTo(0.02, 0);
      blade.lineTo(0.036, -0.25);
      blade.lineTo(0, -0.29);
      blade.lineTo(-0.036, -0.25);
      blade.closePath();
      add("torso", new ExtrudeGeometry(blade, { depth: 0.01, bevelEnabled: false }).rotateX(-0.12).translate(0, 1.045, 0.163), look.tie);
    }
    if (look.print !== null) {
      const z = frontZ(TEE, 0, 0.9);
      add("torso", new CylinderGeometry(0.065, 0.065, 0.006, 28).rotateX(Math.PI / 2).translate(0, 0.9, z + 0.001), look.print);
      add("torso", new CylinderGeometry(0.035, 0.035, 0.006, 24).rotateX(Math.PI / 2).translate(0, 0.9, z + 0.004), shade(look.top, 0.8));
    }
  }
  if (look.backpack !== null) {
    add("torso", ball(0.2, 0, 0.87, -0.235, 0.82, 1, 0.45), look.backpack);
    add("torso", new BoxGeometry(0.2, 0.12, 0.05).translate(0, 0.77, -0.31), shade(look.backpack, 0.82));
    add("torso", new TorusGeometry(0.035, 0.01, 6, 12, Math.PI).translate(0, 1.06, -0.23), shade(look.backpack, 0.7));
    for (const s of [1, -1]) {
      const strap = shade(look.backpack, 0.75);
      add("torso", beam(new Vector3(0.1 * s, 1.03, -0.2), new Vector3(0.11 * s, 1.075, -0.03), 0.04, 0.014), strap);
      add("torso", beam(new Vector3(0.11 * s, 1.075, -0.03), new Vector3(0.115 * s, 1.05, 0.11), 0.04, 0.014), strap);
      add("torso", beam(new Vector3(0.115 * s, 1.05, 0.11), new Vector3(0.12 * s, 0.8, 0.18), 0.04, 0.012), strap);
    }
  }

  // Arms: short sleeves end above the elbow; hands are a palm and a thumb.
  for (const [s, arm, fore] of [[1, "armL", "foreL"], [-1, "armR", "foreR"]] as const) {
    const x = SHOULDER.x * s;
    add(arm, ball(0.07, x, SHOULDER.y, 0), look.top);
    if (look.longSleeves) {
      add(arm, limb(0.058, 0.066, x, ELBOW_Y, SHOULDER.y), look.top);
      add(fore, ball(0.057, x, ELBOW_Y, 0), look.top);
      add(fore, limb(0.052, 0.057, x, WRIST_Y + 0.02, ELBOW_Y), look.top);
      add(fore, new TorusGeometry(0.051, 0.008, 6, 16).rotateX(Math.PI / 2).translate(x, WRIST_Y + 0.025, 0), shade(look.top, 0.9));
    } else {
      add(arm, limb(0.072, 0.07, x, 0.9, SHOULDER.y), look.top);
      add(arm, limb(0.05, 0.054, x, ELBOW_Y, 0.9), look.skin);
      add(fore, ball(0.05, x, ELBOW_Y, 0), look.skin);
      add(fore, limb(0.045, 0.05, x, WRIST_Y + 0.02, ELBOW_Y), look.skin);
    }
    add(fore, ball(0.054, x, WRIST_Y - 0.035, 0, 0.8, 1.05, 0.95), look.skin);
    add(fore, ball(0.02, x - 0.012 * s, WRIST_Y - 0.02, 0.04), look.skin);
  }

  // Head: round face, glossy eyes with two highlights, brows, button nose, blush, smile.
  add("head", limb(0.048, 0.048, 0, 1.04, 1.17), look.skin);
  add("head", new SphereGeometry(HEAD_R, 36, 24).scale(HEAD_SCALE.x, HEAD_SCALE.y, HEAD_SCALE.z).translate(0, HEAD_Y, 0), look.skin);
  const eyeT = Math.PI / 2 + 0.05;
  for (const s of [1, -1]) {
    const a = 0.36 * s;
    const e = onHead(eyeT, a, -0.012);
    add("head", ball(0.038, 0, 0, 0, 0.88, 1.3, 0.45).rotateY(a).translate(e.x, e.y, e.z), 0x241c1c);
    const h1 = onHead(eyeT - 0.07, a + 0.05 * s, 0.006);
    add("head", ball(0.012, h1.x, h1.y, h1.z), 0xffffff);
    const h2 = onHead(eyeT + 0.06, a - 0.04 * s, 0.004);
    add("head", ball(0.006, h2.x, h2.y, h2.z), 0xffffff);
    const b = onHead(eyeT - 0.27, a, 0.004);
    add("head", new BoxGeometry(0.06, 0.013, 0.012).rotateZ(-0.14 * s).rotateY(a).translate(b.x, b.y, b.z), shade(look.hair, 1.1));
    const c = onHead(eyeT + 0.24, 0.62 * s, -0.004);
    add("head", ball(0.042, 0, 0, 0, 1, 0.55, 0.3).rotateY(0.62 * s).translate(c.x, c.y, c.z), 0xf3a19b);
    if (look.hairStyle === "short" || look.hairStyle === "cap") {
      const ear = onHead(Math.PI / 2 + 0.06, (Math.PI / 2) * s, -0.012);
      add("head", ball(0.052, ear.x, ear.y, ear.z, 0.5, 1, 0.8), look.skin);
    }
  }
  const nose = onHead(eyeT + 0.15, 0, -0.004);
  add("head", ball(0.017, nose.x, nose.y, nose.z), shade(look.skin, 0.94));
  const mouth = onHead(eyeT + 0.33, 0, -0.002);
  add("head", new TorusGeometry(0.03, 0.007, 6, 14, Math.PI).rotateZ(Math.PI).rotateX(-0.25).translate(mouth.x, mouth.y + 0.02, mouth.z), 0x9a3f3a);
  if (look.glasses) {
    const frame = 0x2a2a2e;
    for (const s of [1, -1]) {
      const a = 0.36 * s;
      const g = onHead(eyeT - 0.02, a, 0.03);
      add("head", new TorusGeometry(0.056, 0.008, 6, 20).rotateY(a).translate(g.x, g.y, g.z), frame);
      const hinge = onHead(eyeT - 0.04, 0.72 * s, 0.022);
      add("head", beam(hinge, onHead(eyeT - 0.08, 1.5 * s, 0.01), 0.008, 0.008), frame);
    }
    const bridge = onHead(eyeT - 0.05, 0, 0.035);
    add("head", new BoxGeometry(0.06, 0.009, 0.009).translate(bridge.x, bridge.y, bridge.z), frame);
  }

  // Hair: crown shell + back/side shell with the face left open, then the style's own locks.
  const hair = look.hair;
  if (look.hairStyle === "cap" && look.hat !== null) {
    add("head", hairShell(0.016, 1.8, 0.95, 0.9), hair);
    add("head", hairShell(0.04, 1.22), look.hat);
    const rim = onHead(1.22, 0, 0.04);
    add("head", new CylinderGeometry(0.17, 0.17, 0.016, 28, 1, false, -Math.PI / 2, Math.PI).scale(1, 1, 1.15).rotateX(0.16).translate(0, rim.y - 0.01, rim.z - 0.06), look.hat);
    add("head", ball(0.022, 0, HEAD_Y + (HEAD_R + 0.04) * HEAD_SCALE.y, 0), shade(look.hat, 0.8));
  } else {
    add("head", hairShell(0.024, 1.05), hair);
    add("head", hairShell(0.02, look.hairStyle === "long" ? 2.1 : 1.8, 0.95), hair);
  }
  if (look.hairStyle === "short") {
    for (let k = 0; k < 7; k++) add("head", lock(1.0, -0.78 + k * 0.26, 0.07, 0.9, 1.15), hair);
  }
  if (look.hairStyle === "long") {
    for (let k = 0; k < 9; k++) add("head", lock(1.05, -0.84 + k * 0.21, 0.06, 0.95, 1.05), hair);
    add("head", ball(0.27, 0, HEAD_Y - 0.3, -0.13, 0.98, 1.25, 0.48), hair);
    for (const s of [1, -1]) add("head", ball(0.075, 0.245 * s, HEAD_Y - 0.2, 0.0, 0.75, 2.3, 0.75), hair);
  }
  if (look.hairStyle === "bun") {
    // Side-swept fringe, bun high at the back with a pin.
    for (let k = 0; k < 6; k++) add("head", lock(0.95 + k * 0.03, -0.75 + k * 0.2, 0.075, 1.2, 1.0), hair);
    add("head", ball(0.115, 0, HEAD_Y + 0.08, -0.29), hair);
    add("head", new CylinderGeometry(0.008, 0.008, 0.32, 8).rotateZ(Math.PI / 2 - 0.3).translate(0, HEAD_Y + 0.1, -0.3), 0xd9b24a);
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
  private pace = 0;
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
    this.pace = smooth(this.pace, speed, 1 - Math.exp(-8 * dt));
    this.stride = Math.min(this.pace / 3.6, 1.3);
    // Longer steps when running, so cadence rises gently instead of feet spinning.
    this.phase += (this.pace / (STRIDE + this.pace * 0.22)) * Math.PI * 2 * dt;
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
    j.armL.rotation.z = 0.1;
    j.armR.rotation.z = -0.1;
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
