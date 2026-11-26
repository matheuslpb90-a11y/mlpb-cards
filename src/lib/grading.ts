// Pré-avaliação (estimativa) no estilo PSA — referências públicas de centralização da PSA.
// Não é uma nota oficial: serve para a pessoa ter uma ideia antes de mandar graduar.

/** Limites de centralização por nota (lado maior %), frente e verso. */
export const CENTERING: { grade: number; front: number; back: number }[] = [
  { grade: 10, front: 55, back: 75 },
  { grade: 9, front: 60, back: 90 },
  { grade: 8, front: 65, back: 90 },
  { grade: 7, front: 70, back: 90 },
  { grade: 6, front: 80, back: 90 },
  { grade: 5, front: 85, back: 90 },
  { grade: 4, front: 85, back: 90 },
  { grade: 3, front: 90, back: 90 },
];

/** Maior nota que a centralização permite (worst = lado maior em %, ex.: 58 de 58/42). */
export function centeringCap(frontWorst: number | null, backWorst: number | null) {
  for (const c of CENTERING) {
    if ((frontWorst === null || frontWorst <= c.front) && (backWorst === null || backWorst <= c.back)) return c.grade;
  }
  return 2;
}

export type Question = { key: "cantos" | "bordas" | "superficie"; title: string; help: string; options: { label: string; cap: number }[] };

export const QUESTIONS: Question[] = [
  {
    key: "cantos",
    title: "Cantos",
    help: "Olhe os 4 cantos da frente e do verso de pertinho, com boa luz.",
    options: [
      { label: "Perfeitos, bem pontudos", cap: 10 },
      { label: "Um canto com desgaste levíssimo (só de muito perto)", cap: 9 },
      { label: "Desgaste leve em vários cantos / pontinha branca", cap: 8 },
      { label: "Cantos arredondados ou com branco visível", cap: 6 },
      { label: "Canto dobrado, amassado ou descascado", cap: 4 },
    ],
  },
  {
    key: "bordas",
    title: "Bordas",
    help: "Veja as laterais, principalmente no verso (onde o branco aparece mais).",
    options: [
      { label: "Sem nenhuma marca", cap: 10 },
      { label: "1 ou 2 pontinhos brancos minúsculos", cap: 9 },
      { label: "Algumas marquinhas brancas leves", cap: 8 },
      { label: "Várias marcas brancas visíveis", cap: 6 },
      { label: "Borda lascada, descascada ou rasgada", cap: 4 },
    ],
  },
  {
    key: "superficie",
    title: "Superfície",
    help: "Incline a carta contra uma luz forte e olhe a frente e o verso (holo risca fácil).",
    options: [
      { label: "Perfeita, sem riscos nem marcas", cap: 10 },
      { label: "Um risquinho que só aparece contra a luz", cap: 9 },
      { label: "Alguns riscos leves ou linha de impressão", cap: 8 },
      { label: "Riscos visíveis, manchas ou marca de dedo que não sai", cap: 6 },
      { label: "Vinco, amassado, dobra ou dano de água", cap: 3 },
    ],
  },
];

export const GRADE_NAME: Record<number, string> = {
  10: "Gem Mint", 9: "Mint", 8: "NM-MT", 7: "Near Mint", 6: "EX-MT", 5: "Excellent", 4: "VG-EX", 3: "Very Good", 2: "Good", 1: "Poor",
};
