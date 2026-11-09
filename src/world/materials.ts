import { CanvasTexture, Color, DoubleSide, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, TextureLoader, type Material, type Texture } from "three";
import type { MatKey } from "./kit.ts";

const loader = new TextureLoader();

async function tex(url: string, srgb: boolean): Promise<Texture> {
  const t = await loader.loadAsync(url);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = SRGBColorSpace;
  return t;
}

/** `reliefOnly` keeps the photo's bumps but paints the colour from code: the source photos are the wrong hue for this school. */
async function pbr(folder: string, color: number | Color, normalScale = 1, reliefOnly = false): Promise<MeshStandardMaterial> {
  const base = `/assets/materials/${folder}`;
  const [map, normalMap, roughnessMap] = await Promise.all([tex(`${base}/color.jpg`, true), tex(`${base}/normal.jpg`, false), tex(`${base}/roughness.jpg`, false)]);
  const m = new MeshStandardMaterial({ map: reliefOnly ? null : map, normalMap, roughnessMap, color, roughness: 1 });
  m.normalScale.set(normalScale, normalScale);
  return m;
}

function canvas(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = false): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

/** Red and white tiles laid on the diagonal, as in every gallery of the school. */
function checkerMap(): CanvasTexture {
  return canvas(256, 256, (g) => {
    g.fillStyle = "#e9e1cf";
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = "#9d3626";
    g.beginPath();
    g.moveTo(128, 2);
    g.lineTo(254, 128);
    g.lineTo(128, 254);
    g.lineTo(2, 128);
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(90,70,55,.55)";
    g.lineWidth = 2;
    g.stroke();
  }, true);
}

function shutterMap(): CanvasTexture {
  return canvas(256, 512, (g) => {
    g.fillStyle = "#5c8688";
    g.fillRect(0, 0, 256, 512);
    for (const x of [14, 136]) {
      for (let y = 18; y < 492; y += 11) {
        g.fillStyle = "#44696c";
        g.fillRect(x, y, 106, 3);
        g.fillStyle = "#7aa3a3";
        g.fillRect(x, y + 3, 106, 3);
      }
    }
    g.fillStyle = "#3f6063";
    g.fillRect(126, 0, 4, 512);
  });
}

function porchSign(): CanvasTexture {
  return canvas(512, 300, (g) => {
    g.fillStyle = "#1d4f9b";
    g.fillRect(0, 0, 512, 300);
    g.fillStyle = "#e7c75c";
    g.textAlign = "center";
    g.font = "bold 30px Georgia, serif";
    g.fillText("TRƯỜNG THPT CHUYÊN", 256, 92, 440);
    g.font = "bold 54px Georgia, serif";
    g.fillText("LÊ HỒNG PHONG", 256, 186, 450);
  });
}

function gateSign(): CanvasTexture {
  return canvas(1024, 128, (g) => {
    g.fillStyle = "#efe6cf";
    g.fillRect(0, 0, 1024, 128);
    g.fillStyle = "#4a3a26";
    g.textAlign = "center";
    g.font = "bold 24px Georgia, serif";
    g.fillText("SỞ GIÁO DỤC VÀ ĐÀO TẠO THÀNH PHỐ HỒ CHÍ MINH", 512, 36, 720);
    g.font = "bold 50px Georgia, serif";
    g.fillText("TRƯỜNG TRUNG HỌC PHỔ THÔNG CHUYÊN LÊ HỒNG PHONG", 512, 100, 990);
  });
}

function clockFace(): CanvasTexture {
  return canvas(256, 256, (g) => {
    g.fillStyle = "#f7f4ea";
    g.beginPath();
    g.arc(128, 128, 124, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#33404f";
    g.lineWidth = 6;
    g.stroke();
    g.fillStyle = "#22262c";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "bold 30px Georgia, serif";
    for (let i = 1; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.fillText(String(i), 128 + Math.sin(a) * 96, 128 - Math.cos(a) * 96);
    }
    g.lineCap = "round";
    const hand = (a: number, len: number, w: number): void => {
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(128, 128);
      g.lineTo(128 + Math.sin(a) * len, 128 - Math.cos(a) * len);
      g.stroke();
    };
    g.strokeStyle = "#1a1d22";
    hand((7.4 / 12) * Math.PI * 2, 58, 8);
    hand((5 / 12) * Math.PI * 2, 86, 5);
  });
}

function flagMap(): CanvasTexture {
  return canvas(192, 128, (g) => {
    g.fillStyle = "#c8201c";
    g.fillRect(0, 0, 192, 128);
    g.fillStyle = "#f5d33a";
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 40 : 15.5;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      g.lineTo(96 + Math.cos(a) * r, 64 + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
  });
}

/** Neighbouring blocks only need rows of windows; one texture tile is one storey. */
function neighbourMap(): CanvasTexture {
  return canvas(256, 256, (g) => {
    g.fillStyle = "#cfc9b9";
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = "#4d5b66";
    g.fillRect(44, 60, 168, 120);
    g.fillStyle = "#b9b2a0";
    g.fillRect(124, 60, 8, 120);
    g.fillRect(0, 232, 256, 10);
  }, true);
}

function leafMap(): CanvasTexture {
  let seed = 7;
  const rnd = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  return canvas(512, 512, (g) => {
    for (let i = 0; i < 620; i++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * 225;
      const shade = 60 + rnd() * 70;
      g.fillStyle = `rgb(${shade * 0.66}, ${shade * 1.02}, ${shade * 0.42})`;
      g.save();
      g.translate(256 + Math.cos(a) * r, 256 + Math.sin(a) * r);
      g.rotate(rnd() * Math.PI * 2);
      g.beginPath();
      g.ellipse(0, 0, 15, 7, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  });
}

/** Leaves are lit from the crown's rounded normals on both sides, or each card would flicker dark as it turns away. */
export function createFoliageMaterial(): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ map: leafMap(), alphaTest: 0.5, side: DoubleSide, vertexColors: true, roughness: 0.82 });
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace("#include <normal_fragment_begin>", "vec3 normal = normalize( vNormal ); vec3 nonPerturbedNormal = normal;");
  };
  return m;
}

export async function createMaterials(): Promise<Record<MatKey, Material>> {
  const [plaster, trim, ochre, tile, pavers, gravel, grass, hedge, asphalt, concrete, bark, wood] = await Promise.all([
    pbr("plaster", 0xf0dfb6, 0.35, true),
    pbr("plaster", 0xfaf2de, 0.3, true),
    pbr("plaster", 0xb2925a, 0.5, true),
    pbr("tile", 0xffffff),
    pbr("pavers", 0x8f8a7e, 1.3, true),
    pbr("gravel", 0x9b978d, 1, true),
    pbr("grass", new Color(1.25, 1.45, 0.85)),
    pbr("grass", 0x6f9a50, 1.4),
    pbr("asphalt", new Color(1.7, 1.7, 1.66)),
    pbr("pavers", 0xb9b4a8, 0.7, true),
    pbr("bark", new Color(1.3, 1.25, 1.2)),
    pbr("wood", 0x93623a),
  ]);
  const flat = (color: Color | number, roughness = 0.85, metalness = 0): MeshStandardMaterial => new MeshStandardMaterial({ color, roughness, metalness });
  const decal = (map: Texture): MeshStandardMaterial => new MeshStandardMaterial({ map, roughness: 0.6 });
  return {
    plaster, trim, ochre, tile, pavers, gravel, grass, hedge, asphalt, concrete, bark, wood,
    cap: flat(0xb7906e, 0.9),
    checker: new MeshStandardMaterial({ map: checkerMap(), roughness: 0.32 }),
    shutter: decal(shutterMap()),
    iron: flat(0x1d1e20, 0.55, 0.5),
    paint: flat(0x9aa2a6, 0.55, 0.35),
    terracotta: flat(0xb5683f, 0.85),
    bronze: flat(0x4b3f33, 0.45, 0.65),
    dark: flat(0x2b2a28, 0.95),
    neighbour: new MeshStandardMaterial({ map: neighbourMap(), roughness: 0.8 }),
    metalRoof: flat(0x8e959a, 0.6, 0.3),
    signPorch: decal(porchSign()),
    signGate: decal(gateSign()),
    clock: decal(clockFace()),
    flag: new MeshStandardMaterial({ map: flagMap(), side: DoubleSide, roughness: 0.8 }),
  };
}
