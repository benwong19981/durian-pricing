import type { RoundDir } from "./pricing";

export const uid = (): string => Math.random().toString(36).slice(2, 9);

export type GradeId = string;

export interface Grade {
  id: GradeId;
  name: string;
}

export interface Variety {
  id: string;
  name: string;
  buy: Record<GradeId, number | null>;
  premKg: number | null;
  pulp: { avg: number | null; ratio: number | null };
  prem100: number | null;
}

export interface State {
  currency: string;
  date: string;
  grades: Grade[];
  varieties: Variety[];
  premKg: number;
  prem100: number;
  roundStep: number;
  roundDir: RoundDir;
  cardMsg: string;
  bilingual: boolean;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function seedVariety(name: string, buy: [number, number, number], avg: number, ratio: number, gradeIds: [string, string, string]): Variety {
  return {
    id: uid(),
    name,
    buy: { [gradeIds[0]]: buy[0], [gradeIds[1]]: buy[1], [gradeIds[2]]: buy[2] },
    premKg: null,
    pulp: { avg, ratio },
    prem100: null,
  };
}

export function seedState(): State {
  const grades: Grade[] = [
    { id: uid(), name: "A" },
    { id: uid(), name: "B" },
    { id: uid(), name: "C" },
  ];
  const gradeIds: [string, string, string] = [grades[0].id, grades[1].id, grades[2].id];

  const varieties: Variety[] = [
    seedVariety("Musang King 猫山王", [45, 36, 28], 45, 33, gradeIds),
    seedVariety("Black Thorn 黑刺", [55, 44, 34], 55, 35, gradeIds),
    seedVariety("D24 Sultan", [22, 18, 14], 22, 31, gradeIds),
    seedVariety("Red Prawn 红虾", [30, 24, 19], 30, 30, gradeIds),
    seedVariety("Tekka 竹脚", [18, 15, 12], 18, 30, gradeIds),
    seedVariety("Kampung 甘榜", [10, 8, 6], 10, 26, gradeIds),
  ];

  return {
    currency: "RM",
    date: todayIso(),
    grades,
    varieties,
    premKg: 8,
    prem100: 3,
    roundStep: 0.5,
    roundDir: "up",
    cardMsg: "WhatsApp us to order  ·  微信下单",
    bilingual: true,
  };
}

export function newVariety(grades: Grade[]): Variety {
  const v: Variety = {
    id: uid(),
    name: "New variety",
    buy: {},
    premKg: null,
    pulp: { avg: null, ratio: null },
    prem100: null,
  };
  grades.forEach((g) => {
    v.buy[g.id] = null;
  });
  return v;
}
