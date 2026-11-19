// Formato do leilão enquanto é editado no painel (compartilhado entre navegador e servidor).
export type Media = { url: string; type: "image" | "video" };

export type ItemDraft = {
  cardId?: string;
  name: string;
  number: string;
  finish: string;
  condition: string;
  language: string;
  graded: boolean;
  note: string;
  cost: string;
  market: string;
  start: string;
  buyout: string;
  step: string;
  hideMarket: boolean;
  hideBuyout: boolean;
  imageUrl: string;
  media: Media[];
};

export type LotDraft = { title: string; imageUrl: string; oneReal: boolean; hideMarket: boolean; hideBuyout: boolean; items: ItemDraft[] };

export type AuctionDraft = {
  id?: string;
  name: string;
  description: string;
  imageUrl: string;
  startDate: string; // AAAA-MM-DD (horário de Brasília)
  startTime: string; // HH:MM
  endDate: string;
  endTime: string;
  paymentDays: number;
  initialPct: number;
  buyoutPct: number;
  defaultStep: string;
  oneReal: boolean;
  infinitepayHandle: string;
  visible: boolean;
  lots: LotDraft[];
};

export const emptyItem = (over: Partial<ItemDraft> = {}): ItemDraft => ({
  name: "", number: "", finish: "Normal", condition: "NM", language: "Português", graded: false, note: "",
  cost: "", market: "", start: "", buyout: "", step: "", hideMarket: false, hideBuyout: false, imageUrl: "", media: [], ...over,
});

export const emptyLot = (n: number): LotDraft => ({ title: `Lote ${n}`, imageUrl: "", oneReal: false, hideMarket: false, hideBuyout: false, items: [] });

/** "12,50" → 1250; vazio/ inválido → null */
export function reaisToCents(v: string): number | null {
  const t = v.trim().replace(/[R$\s]/g, "");
  if (!t) return null;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}
export const centsToReais = (c: number | null | undefined) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));

/** Data/hora de Brasília → Date (UTC). O Brasil não tem horário de verão desde 2019. */
export const brt = (date: string, time: string) => new Date(`${date}T${time || "00:00"}:00-03:00`);
export function toBrtParts(d: Date) {
  const s = new Date(d.getTime() - 3 * 60 * 60 * 1000).toISOString();
  return { date: s.slice(0, 10), time: s.slice(11, 16) };
}
