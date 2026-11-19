// Listas fixas usadas no catálogo, filtros e painel.

export const KINDS = [
  { value: "CARTA", label: "Cartas avulsas", slug: "cartas" },
  { value: "PRODUTO", label: "Selados", slug: "selados" },
] as const;

export const CONDITIONS = [
  { value: "NM", label: "NM — Near Mint (praticamente nova)" },
  { value: "SP", label: "SP — Slightly Played (pouco usada)" },
  { value: "MP", label: "MP — Moderately Played (usada)" },
  { value: "HP", label: "HP — Heavily Played (muito usada)" },
  { value: "DMG", label: "DMG — Damaged (danificada)" },
] as const;

export const LANGUAGES = [
  { value: "Português", flag: "🇧🇷" },
  { value: "Inglês", flag: "🇺🇸" },
  { value: "Japonês", flag: "🇯🇵" },
  { value: "Chinês", flag: "🇨🇳" },
] as const;

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
