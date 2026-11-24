// Listas fixas usadas no catálogo, filtros e painel.

export const KINDS = [
  { value: "CARTA", label: "Cartas avulsas", slug: "cartas" },
  { value: "PRODUTO", label: "Selados", slug: "selados" },
] as const;

export const CONDITIONS = [
  { value: "M", label: "M — Mint (perfeita)" },
  { value: "NM", label: "NM — Near Mint (praticamente nova)" },
  { value: "SP", label: "SP — Slightly Played (pouco usada)" },
  { value: "MP", label: "MP — Moderately Played (usada)" },
  { value: "HP", label: "HP — Heavily Played (muito usada)" },
  { value: "DMG", label: "DMG — Damaged (danificada)" },
] as const;

export const LANGUAGES = [
  { value: "Chinês", flag: "🇨🇳", short: "CH" },
  { value: "Inglês", flag: "🇺🇸", short: "ENG" },
  { value: "Japonês", flag: "🇯🇵", short: "JP" },
  { value: "Português", flag: "🇧🇷", short: "PT-BR" },
] as const;

export const FINISHES = ["Normal", "Foil", "Reverse Foil", "Promo"] as const;

export const PRODUCT_CATEGORIES = [
  "Booster",
  "Box / Coleção",
  "Elite Trainer Box (ETB)",
  "Deck",
  "Lata",
  "Blister",
  "Acessórios",
  "Outros",
] as const;

export function kindFromSlug(slug?: string) {
  return KINDS.find((k) => k.slug === slug)?.value;
}

export function conditionShort(value: string) {
  return value === "D" ? "DMG" : value;
}

export function languageFlag(lang: string) {
  return LANGUAGES.find((l) => l.value === lang)?.flag ?? "";
}

/** Número da carta para comparar ("001/217", "1/217" e "1" são a mesma carta). */
export const numKey = (n: string) => (n.split("/")[0] ?? "").trim().replace(/^0+(?=\w)/, "").toLowerCase();

/**
 * Cada versão de uma carta é um item de estoque separado: mesma carta (coleção + número)
 * em idioma, tipo (Normal, Foil, Reverse…) e estado diferentes = estoques diferentes.
 */
export const variantKey = (v: { number: string; language: string; finish: string; condition: string }) =>
  [numKey(v.number), v.language, v.finish, v.condition].join("|");
