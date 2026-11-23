import "server-only";

// Preços de referência do mercado brasileiro (R$) — API pública do MYP Cards.
// Documentação: https://mypcards.github.io/mypcards-api/  ·  Base: https://mypcards.com/api/v1
// Sem chave: 10 consultas/min. Com MYP_API_KEY (header X-Api-Token): 60/min.
// Atribuição obrigatória: onde o preço aparecer, mostrar que vem do MYP Cards com link para mypcards.com.

const BASE = (process.env.MYP_API_URL || "https://mypcards.com/api/v1").replace(/\/+$/, "");
export const MYP_ATTRIBUTION = "Preço de referência: MYP Cards (mypcards.com)";

type Produto = {
  internal_code: number;
  card_code: string;
  name_pt: string | null;
  name_en: string | null;
  edition_pt: string | null;
  edition_en: string | null;
  edition_code: string | null;
  min_price: string | null;
  avg_price: string | null;
  prices: { language: string; printing: string; min_price: string }[];
  img_pt: string | null;
  img_en: string | null;
  link: string;
};

export type MypCard = {
  id: number;
  name: string;
  nameEn: string;
  setName: string;
  number: string;
  imageUrl: string;
  imageAlt: string; // outra imagem (inglês/português) caso a primeira não abra
  minCents: number | null; // menor preço (PT/EN, NM, não graduada)
  avgCents: number | null; // média ponderada
  prices: { language: string; printing: string; cents: number }[];
  link: string;
};

const toCents = (v: string | null | undefined) => {
  const n = Number(v);
  return v != null && Number.isFinite(n) ? Math.round(n * 100) : null;
};

async function call<T>(path: string): Promise<T> {
  const key = (process.env.MYP_API_KEY ?? "").trim();
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: "application/json", "User-Agent": "MLPBCards/1.0 (+https://www.mlpbcards.com.br)", ...(key ? { "X-Api-Token": key } : {}) },
    next: { revalidate: 300 }, // a própria MYP atualiza a cada 5 min
    signal: AbortSignal.timeout(10000),
  });
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("json")) throw new Error(res.status === 403 ? "a MYP bloqueou a consulta (proteção anti-robô)" : `MYP respondeu ${res.status}`);
  const body = (await res.json()) as T & { code?: string; error?: string };
  if (!res.ok) throw new Error(body.code === "rate_limited" ? "limite de consultas da MYP por minuto atingido — tente em 1 minuto" : `MYP: ${body.error ?? res.status}`);
  return body;
}

/** A MYP guarda o código como "pokemon_m6a_036/103"; o número impresso é a parte
 *  depois do último "_". Sem "_", já é o número (ex.: "199/165", "SVP053"). */
export function numeroImpresso(cardCode?: string): string {
  const c = (cardCode || "").trim();
  if (!c.includes("_")) return c;
  return c.slice(c.lastIndexOf("_") + 1).trim();
}

const map = (p: Produto): MypCard => ({
  id: p.internal_code,
  name: p.name_pt || p.name_en || "",
  nameEn: p.name_en || "",
  setName: p.edition_pt || p.edition_en || "",
  number: numeroImpresso(p.card_code),
  imageUrl: p.img_pt || p.img_en || "",
  imageAlt: p.img_pt && p.img_en ? p.img_en : "",
  minCents: toCents(p.min_price),
  avgCents: toCents(p.avg_price),
  prices: (p.prices ?? []).map((x) => ({ language: x.language, printing: x.printing, cents: toCents(x.min_price) ?? 0 })),
  link: p.link,
});

/** Busca cartas Pokémon pelo nome exato (português ou inglês). */
export async function mypSearch(name: string): Promise<MypCard[]> {
  const r = await call<{ cards?: Produto[] }>(`/pokemon/carta/${encodeURIComponent(name.trim())}`);
  return (r.cards ?? []).map(map);
}

const LANG_EN: Record<string, string> = { Português: "Portuguese", Inglês: "English", Japonês: "Japanese", Chinês: "Chinese" };
const PRINT_EN: Record<string, string[]> = { Normal: ["Normal"], Foil: ["Foil"], "Reverse Foil": ["Reverse Foil", "Reverse"], Promo: ["Promo", "Normal"] };
const numKey = (n: string) => (n.match(/(\d+)/)?.[1] ?? n).replace(/^0+/, "");

/** Preço de referência para uma impressão: idioma + variante; se não houver, a média geral. */
export function mypPrice(c: MypCard, language?: string, finish?: string) {
  const lang = language ? LANG_EN[language] : undefined;
  const prints = finish ? PRINT_EN[finish] ?? [finish] : undefined;
  const exact = c.prices.filter((p) => (!lang || p.language === lang) && (!prints || prints.includes(p.printing)) && p.cents > 0);
  if (exact.length) return { cents: Math.min(...exact.map((p) => p.cents)), basis: `menor preço ${language ?? ""} ${finish ?? ""}`.replace(/\s+/g, " ").trim() };
  if (c.avgCents) return { cents: c.avgCents, basis: "média PT/EN" };
  if (c.minCents) return { cents: c.minCents, basis: "menor preço PT/EN" };
  return null;
}

/** Acha a impressão certa pelo nome + número (ex.: "025/165", "SVP053"). */
export async function mypFind(name: string, number?: string) {
  const list = await mypSearch(name);
  if (!number) return list;
  const k = numKey(number);
  const exact = list.filter((c) => numKey(c.number) === k);
  return exact.length ? exact : list;
}
