import { ACESFilmicToneMapping, Color, DirectionalLight, EquirectangularReflectionMapping, Fog, HemisphereLight, PCFSoftShadowMap, PerspectiveCamera, PMREMGenerator, Scene, SRGBColorSpace, TextureLoader, Timer, WebGLRenderer } from "three";
import { Walker, type Place } from "./controls/walker.ts";
import { buildCampus } from "./world/campus.ts";
import { createFoliageMaterial, createMaterials } from "./world/materials.ts";
import "./style.css";

const PLACES: Readonly<Record<string, { label: string; place: Place }>> = {
  gate: { label: "Cổng trường", place: { x: 88, y: 1.62, z: 0, lookX: 20, lookY: 5, lookZ: 0, fly: false } },
  front: { label: "Sân trước", place: { x: 55, y: 1.62, z: 0, lookX: 20, lookY: 4, lookZ: 0, fly: false } },
  hall: { label: "Hành lang đồng hồ", place: { x: 28, y: 2.07, z: 21, lookX: 28, lookY: 2.6, lookZ: -20, fly: false } },
  gallery: { label: "Hành lang lớp học", place: { x: -24, y: 2.07, z: -24.5, lookX: 22, lookY: 2.5, lookZ: -24.5, fly: false } },
  court: { label: "Sân trong", place: { x: 18, y: 1.62, z: 15, lookX: -20, lookY: 5, lookZ: -14, fly: false } },
  aerial: { label: "Nhìn từ trên cao", place: { x: 92, y: 62, z: 72, lookX: 12, lookY: 0, lookZ: 0, fly: true } },
  top: { label: "Đối chiếu vệ tinh", place: { x: 15, y: 150, z: 0.1, lookX: 15, lookY: 0, lookZ: 0, fly: true } },
};

async function start(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: "default", preserveDrawingBuffer: params.has("shot") });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById("app")!.appendChild(renderer.domElement);

  const scene = new Scene();
  scene.fog = new Fog(new Color(0xc9d6e0), 150, 520);
  const camera = new PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.2, 1400);

  const sky = await new TextureLoader().loadAsync("/assets/env/sky.jpg");
  sky.mapping = EquirectangularReflectionMapping;
  sky.colorSpace = SRGBColorSpace;
  scene.background = sky;
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(sky).texture;
  scene.environmentIntensity = 0.62;
  pmrem.dispose();

  scene.add(new HemisphereLight(0xe6eef6, 0xb7a483, 1.75));
  const sun = new DirectionalLight(0xfff0d6, 3.1);
  sun.position.set(95, 120, 52);
  sun.target.position.set(10, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.left = -125;
  sun.shadow.camera.right = 125;
  sun.shadow.camera.top = 125;
  sun.shadow.camera.bottom = -125;
  sun.shadow.camera.far = 420;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.05;
  sun.shadow.radius = 2.5;
  scene.add(sun, sun.target);

  const materials = await createMaterials();
  const { group, kit } = buildCampus(materials, createFoliageMaterial());
  scene.add(group);
  scene.updateMatrixWorld(true);

  const walker = new Walker(camera, renderer.domElement, kit.blockers, kit.floors);
  const startPlace = PLACES[params.get("view") ?? "gate"] ?? PLACES.gate!;
  walker.goTo(startPlace.place);

  const bar = document.getElementById("places")!;
  for (const entry of Object.values(PLACES)) {
    const b = document.createElement("button");
    b.textContent = entry.label;
    b.addEventListener("click", () => {
      walker.goTo(entry.place);
      renderer.domElement.focus();
    });
    bar.appendChild(b);
  }
  const fly = document.getElementById("fly") as HTMLInputElement;
  fly.checked = walker.fly;
  fly.addEventListener("change", () => (walker.fly = fly.checked));
  if (params.has("shot")) for (const id of ["hud", "help"]) document.getElementById(id)!.style.display = "none";

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // The world never moves, so the sun's shadow map only has to be drawn once.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  const timer = new Timer();
  renderer.setAnimationLoop((t) => {
    timer.update(t);
    walker.update(Math.min(timer.getDelta(), 0.05));
    if (fly.checked !== walker.fly) fly.checked = walker.fly;
    renderer.render(scene, camera);
  });
  document.getElementById("loading")!.remove();
  renderer.compile(scene, camera);
  (window as unknown as { __lhp: unknown }).__lhp = { ready: true, info: renderer.info };
}

start().catch((err: unknown) => {
  document.getElementById("loading")!.textContent = `Không tải được cảnh 3D: ${String(err)}`;
  console.error(err);
});
