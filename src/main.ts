import { ACESFilmicToneMapping, Color, DirectionalLight, EquirectangularReflectionMapping, Fog, HemisphereLight, MeshStandardMaterial, PCFSoftShadowMap, PerspectiveCamera, PMREMGenerator, Scene, SRGBColorSpace, TextureLoader, Timer, WebGLRenderer } from "three";
import { LOOKS, parseLook, type LookId } from "./avatar/looks.ts";
import { Avatar } from "./avatar/model.ts";
import { Player } from "./controls/player.ts";
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

const LOOK_KEY = "lhp.look";
const HELP_FREE = 'Kéo chuột để nhìn · W A S D để đi · Shift để đi nhanh · Bật "Bay" rồi dùng Q / E để lên xuống';
const HELP_AVATAR = "Kéo chuột để xoay camera · Lăn chuột để gần / xa · W A S D để đi · Shift để chạy";

function savedLook(): string | null {
  try {
    return localStorage.getItem(LOOK_KEY);
  } catch {
    return null;
  }
}

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
  const player = new Player(camera, renderer.domElement, kit.blockers, kit.floors);
  const avatarMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
  const avatars = new Map<LookId, Avatar>();
  const help = document.getElementById("help")!;
  const lookSelect = document.getElementById("look") as HTMLSelectElement;
  const fly = document.getElementById("fly") as HTMLInputElement;

  /** Character to take back after flying; cleared only when the user picks "none". */
  let lastLook: LookId | null = null;

  /** Hands control to the chosen character, or back to the eye-level walker when `id` is null. */
  const setLook = (id: LookId | null): void => {
    if (player.avatar) scene.remove(player.avatar.root);
    if (id === null) {
      if (player.active) {
        const p = camera.position;
        walker.goTo({ x: p.x, y: p.y, z: p.z, lookX: player.x, lookY: p.y - 1, lookZ: player.z, fly: false });
      }
      player.active = false;
      player.avatar = null;
    } else {
      let avatar = avatars.get(id);
      if (!avatar) {
        avatar = new Avatar(id, avatarMaterial);
        avatars.set(id, avatar);
      }
      if (!player.active) {
        // Start where the eye-level camera stood, facing where it looked.
        const p = camera.position;
        const dir = camera.getWorldDirection(avatar.root.position.clone());
        player.place(p.x, p.z, p.x + dir.x, p.z + dir.z);
      }
      player.avatar = avatar;
      player.active = true;
      lastLook = id;
      walker.fly = false;
      scene.add(avatar.root);
    }
    lookSelect.value = id ?? "";
    help.textContent = player.active ? HELP_AVATAR : HELP_FREE;
    try {
      localStorage.setItem(LOOK_KEY, lastLook ?? "none");
    } catch {
      // Private mode: the choice just is not remembered.
    }
  };

  for (const [id, look] of Object.entries(LOOKS)) lookSelect.add(new Option(look.label, id));
  lookSelect.addEventListener("change", () => {
    if (lookSelect.value === "") lastLook = null;
    setLook(lookSelect.value === "" ? null : parseLook(lookSelect.value));
    lookSelect.blur();
  });

  const startPlace = PLACES[params.get("view") ?? "gate"] ?? PLACES.gate!;
  walker.goTo(startPlace.place);
  const wanted = params.get("nv") ?? savedLook();
  if (wanted !== "none") lastLook = parseLook(wanted);
  setLook(startPlace.place.fly ? null : lastLook);

  const bar = document.getElementById("places")!;
  for (const entry of Object.values(PLACES)) {
    const b = document.createElement("button");
    b.textContent = entry.label;
    b.addEventListener("click", () => {
      if (lastLook !== null && !entry.place.fly) {
        const p = entry.place;
        if (!player.active) {
          walker.goTo(p);
          setLook(lastLook);
        }
        player.place(p.x, p.z, p.lookX, p.lookZ);
      } else {
        if (player.active) setLook(null);
        walker.goTo(entry.place);
      }
      renderer.domElement.focus();
    });
    bar.appendChild(b);
  }
  fly.checked = walker.fly;
  fly.addEventListener("change", () => {
    if (fly.checked && player.active) setLook(null);
    walker.fly = fly.checked;
    // Landing takes the last character back, right under where the camera was flying.
    if (!fly.checked && lastLook !== null) setLook(lastLook);
  });
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
    const dt = Math.min(timer.getDelta(), 0.05);
    if (player.active) player.update(dt);
    else walker.update(dt);
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
