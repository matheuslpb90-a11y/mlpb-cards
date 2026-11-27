import "server-only";

// Coleções completas de Pokémon TCG (TCGdex, gratuito): lista de coleções e todas as cartas de uma coleção.
const API = "https://api.tcgdex.net/v2";

export type TcgSet = { id: string; nameEn: string; namePt: string; logo: string; total: number; official: number; releaseDate: string };
export type TcgSetCard = { tcgdexId: string; localId: string; number: string; name: string; namePt: string; image: string; imageLarge: string };

async function get<T>(path: string, revalidate = 86400): Promise<T> {
  const r = await fetch(`${API}${path}`, { headers: { Accept: "application/json" }, next: { revalidate }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`TCGdex ${r.status}`);
  return (await r.json()) as T;
}

type RawSet = { id: string; name: string; logo?: string; cardCount?: { total?: number; official?: number } };

/** Todas as coleções, das mais novas para as mais antigas, com o nome em português quando existe. */
export async function listSets(): Promise<TcgSet[]> {
  const [en, pt] = await Promise.all([get<RawSet[]>("/en/sets"), get<RawSet[]>("/pt/sets").catch(() => [] as RawSet[])]);
  const ptName = new Map(pt.map((s) => [s.id, s.name]));
  // a API devolve em ordem de lançamento (antigas primeiro)
  return en
    .map((s) => ({
      id: s.id,
      nameEn: s.name,
      namePt: ptName.get(s.id) ?? "",
      logo: s.logo ? `${s.logo}.webp` : "",
      total: s.cardCount?.total ?? 0,
      official: s.cardCount?.official ?? 0,
      releaseDate: "",
    }))
    .reverse();
}

/** Uma coleção com todas as cartas (número no formato 001/217). */
export async function getSet(id: string) {
  // inglês e português ao mesmo tempo (antes era um depois do outro)
  const [s, pt] = await Promise.all([
    get<RawSet & { releaseDate?: string; cards?: { id: string; localId: string; name: string; image?: string }[]; serie?: { name: string } }>(`/en/sets/${encodeURIComponent(id)}`),
    get<{ name?: string; cards?: { id: string; name: string }[] }>(`/pt/sets/${encodeURIComponent(id)}`).catch(() => ({ name: "", cards: [] as { id: string; name: string }[] })),
  ]);
  const ptCard = new Map((pt.cards ?? []).map((c) => [c.id, c.name]));
  const official = s.cardCount?.official ?? 0;
  const pad = String(official || 0).length;
  const cards: TcgSetCard[] = (s.cards ?? []).map((c) => {
    const n = /^\d+$/.test(c.localId) ? c.localId.padStart(Math.max(3, pad), "0") : c.localId;
    return {
      tcgdexId: c.id,
      localId: c.localId,
      number: official && /^\d+$/.test(c.localId) ? `${n}/${String(official).padStart(Math.max(3, pad), "0")}` : c.localId,
      name: c.name,
      namePt: ptCard.get(c.id) ?? "",
      image: c.image ? `${c.image}/low.webp` : "",
      imageLarge: c.image ? `${c.image}/high.webp` : "",
    };
  });
  return {
    id: s.id,
    nameEn: s.name,
    namePt: pt.name ?? "",
    serie: s.serie?.name ?? "",
    releaseDate: s.releaseDate ?? "",
    logo: s.logo ? `${s.logo}.webp` : "",
    total: s.cardCount?.total ?? cards.length,
    official,
    cards,
  };
}

/** Raridade de uma carta (buscada só na hora de salvar, para as cartas escolhidas). */
export async function cardRarity(tcgdexId: string, lang: "pt" | "en" = "pt") {
  const c = await get<{ rarity?: string }>(`/${lang}/cards/${encodeURIComponent(tcgdexId)}`).catch(() => null);
  if (c?.rarity) return c.rarity;
  if (lang === "pt") return cardRarity(tcgdexId, "en");
  return "";
}
