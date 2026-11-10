import { Color, DirectionalLight, HemisphereLight, MeshStandardMaterial, PerspectiveCamera, Scene, Timer, type WebGLRenderer } from "three";
import { LOOKS, type LookId } from "./looks.ts";
import { Avatar } from "./model.ts";

const SPACING = 1.0;

/** `?preview`: every look side by side, slowly turning; `?preview&walk` plays the walk cycle. */
export function startPreview(renderer: WebGLRenderer, params: URLSearchParams): void {
  const scene = new Scene();
  scene.background = new Color(0xdcd8cc);
  scene.add(new HemisphereLight(0xe6eef6, 0xb7a483, 1.9));
  const sun = new DirectionalLight(0xfff0d6, 2.6);
  sun.position.set(3, 6, 5);
  scene.add(sun);
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
  const ids = Object.keys(LOOKS) as LookId[];
  const avatars = ids.map((id, i) => {
    const a = new Avatar(id, material);
    a.root.position.x = (i - (ids.length - 1) / 2) * SPACING;
    scene.add(a.root);
    return a;
  });
  const camera = new PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 100);
  const zoom = Number(params.get("zoom") ?? 1);
  camera.position.set(0, 1.25, 9.5 / zoom);
  camera.lookAt(0, 0.85, 0);
  const walk = params.has("walk");
  const spin = params.get("spin");
  const timer = new Timer();
  renderer.setAnimationLoop((t) => {
    timer.update(t);
    const dt = Math.min(timer.getDelta(), 0.05);
    for (const a of avatars) {
      a.root.rotation.y = spin !== null ? Number(spin) : Math.sin(timer.getElapsed() * 0.5) * 0.8;
      a.update(dt, walk ? 2.8 : 0);
    }
    renderer.render(scene, camera);
  });
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  document.getElementById("loading")?.remove();
  for (const id of ["hud", "help"]) document.getElementById(id)!.style.display = "none";
}
