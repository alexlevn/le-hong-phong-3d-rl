export type HairStyle = "short" | "long" | "bun" | "cap";

/** One playable character: colours plus which pieces the body builder adds. */
export interface Look {
  readonly label: string;
  readonly skin: number;
  readonly top: number;
  /** Forearms in the top's colour (long sleeves) instead of bare skin. */
  readonly longSleeves: boolean;
  readonly pants: number;
  readonly shoes: number;
  readonly hair: number;
  readonly hairStyle: HairStyle;
  /** Ao dai: front and back flaps from the waist down, in the top's colour. */
  readonly aoDai: boolean;
  readonly collar: number | null;
  readonly glasses: boolean;
  readonly backpack: number | null;
  /** Cap colour for the "cap" hair style. */
  readonly hat: number | null;
  readonly tie: number | null;
  /** School badge on the left chest (students). */
  readonly badge: boolean;
  /** Round print on a T-shirt front. */
  readonly print: number | null;
  /** Front button row (ao dai: the diagonal fastening on the right chest). */
  readonly buttons: number | null;
  readonly belt: number | null;
  /** Coloured stripe on sneakers. */
  readonly stripe: number | null;
}

export const LOOKS = {
  "nam-sinh": {
    label: "Nam sinh", skin: 0xf0c49c, top: 0xfafafa, longSleeves: false, pants: 0x27324f, shoes: 0x2b2b2e,
    hair: 0x1f1a17, hairStyle: "short", aoDai: false, collar: 0xfafafa, glasses: false, backpack: 0x2f6fb5, hat: null,
    tie: null, badge: true, print: null, buttons: 0xe8e8e8, belt: 0x2a2522, stripe: null,
  },
  "nu-sinh": {
    label: "Nữ sinh áo dài", skin: 0xf3cba6, top: 0xfbfbf7, longSleeves: true, pants: 0xfbfbf7, shoes: 0xf0e6d6,
    hair: 0x1b1715, hairStyle: "long", aoDai: true, collar: null, glasses: false, backpack: null, hat: null,
    tie: null, badge: false, print: null, buttons: 0xd9d4c4, belt: null, stripe: null,
  },
  "thay-giao": {
    label: "Thầy giáo", skin: 0xe2b08a, top: 0xa9cbe8, longSleeves: true, pants: 0x55585e, shoes: 0x3a2c22,
    hair: 0x2a2724, hairStyle: "short", aoDai: false, collar: 0xa9cbe8, glasses: true, backpack: null, hat: null,
    tie: 0x24375e, badge: false, print: null, buttons: null, belt: 0x3a2c22, stripe: null,
  },
  "co-giao": {
    label: "Cô giáo áo dài", skin: 0xf0c6a2, top: 0xb5303a, longSleeves: true, pants: 0xfbfbf7, shoes: 0xd8b98c,
    hair: 0x231c18, hairStyle: "bun", aoDai: true, collar: null, glasses: false, backpack: null, hat: null,
    tie: null, badge: false, print: null, buttons: 0xe6c15a, belt: null, stripe: null,
  },
  "cuu-hoc-sinh": {
    label: "Cựu học sinh", skin: 0xe7b991, top: 0xd9473b, longSleeves: false, pants: 0x3f5f8f, shoes: 0xf2f2f2,
    hair: 0x2b2420, hairStyle: "cap", aoDai: false, collar: null, glasses: false, backpack: 0x3d3d42, hat: 0x2a4d7a,
    tie: null, badge: false, print: 0xfff4e0, buttons: null, belt: 0x2a2522, stripe: 0xd9473b,
  },
} as const satisfies Record<string, Look>;

export type LookId = keyof typeof LOOKS;
export const DEFAULT_LOOK: LookId = "nam-sinh";

export function parseLook(v: string | null | undefined): LookId {
  return v !== null && v !== undefined && v in LOOKS ? (v as LookId) : DEFAULT_LOOK;
}
