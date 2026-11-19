import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

// Busca de cartas Pokémon para o painel (somente admin).
// Fontes, em ordem: TCGdex (português, depois inglês) e Pokémon TCG API (inglês).
// GET ?q=nome&num=025      → lista de resultados
// GET ?tcgdex=<id>&lang=en → detalhes de uma carta da TCGdex

export type LookupCard = {
  key: string;
  source: "tcgdex" | "ptcg";
  tcgdexId?: string;
  lang?: string;
  name: string;
  setName: string;
  number: string;
  rarity: string;
  imageSmall: string;
  imageLarge: string;
};

const TCGDEX = "https://api.tcgdex.net/v2";
const PTCG = "https://api.pokemontcg.io/v2/cards";
const TIMEOUT = 9000;

async function getJson(url: string) {
  const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT), cache: "no-store", headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`${r.status} em ${new URL(url).host}`);
  return r.json();
}

const sameNumber = (a: string, b: string) =>
  a.split("/")[0].replace(/^0+/, "").toLowerCase() === b.split("/")[0].replace(/^0+/, "").toLowerCase();

async function searchTcgdex(lang: string, q: string, num: string): Promise<LookupCard[]> {
  const data = (await getJson(`${TCGDEX}/${lang}/cards?name=${encodeURIComponent(q)}`)) as {
    id: string; localId: string; name: string; image?: string;
  }[];
  if (!Array.isArray(data)) return [];
  return data
    .filter((c) => c.image && (!num || sameNumber(c.localId, num)))
    .map((c) => ({
      key: `tcgdex-${lang}-${c.id}`,
      source: "tcgdex" as const,
      tcgdexId: c.id,
      lang,
      name: c.name,
      setName: "",
      number: c.localId,
      rarity: "",
      imageSmall: `${c.image}/low.webp`,
      imageLarge: `${c.image}/high.webp`,
    }));
}

async function searchPtcg(q: string, num: string): Promise<LookupCard[]> {
  const parts = [`name:"${q.replace(/"/g, "")}*"`];
  if (num) parts.push(`number:${num.split("/")[0].replace(/^0+/, "") || "0"}`);
  const data = (await getJson(`${PTCG}?q=${encodeURIComponent(parts.join(" "))}&pageSize=60&orderBy=-set.releaseDate`)) as {
    data?: { id: string; name: string; number: string; rarity?: string; set?: { name?: string; printedTotal?: number }; images?: { small?: string; large?: string } }[];
  };
  return (data.data ?? [])
    .filter((c) => c.images?.small)
    .map((c) => ({
      key: `ptcg-${c.id}`,
      source: "ptcg" as const,
      name: c.name,
      setName: c.set?.name ?? "",
      number: c.set?.printedTotal ? `${c.number}/${c.set.printedTotal}` : c.number,
      rarity: c.rarity ?? "",
      imageSmall: c.images!.small!,
      imageLarge: c.images?.large ?? c.images!.small!,
    }));
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const url = new URL(req.url);

  // Detalhes de uma carta da TCGdex
  const tcgdexId = url.searchParams.get("tcgdex");
  if (tcgdexId) {
    const lang = url.searchParams.get("lang") || "en";
    try {
      const d = await getJson(`${TCGDEX}/${lang}/cards/${encodeURIComponent(tcgdexId)}`);
      const total = d?.set?.cardCount?.official;
      return NextResponse.json({
        name: d?.name ?? "",
        setName: d?.set?.name ?? "",
        number: total ? `${d.localId}/${total}` : d?.localId ?? "",
        rarity: d?.rarity ?? "",
      });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 502 });
    }
  }

  const q = (url.searchParams.get("q") ?? "").trim();
  const num = (url.searchParams.get("num") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [], message: "Digite pelo menos 2 letras." });

  // Idioma escolhido → idiomas da TCGdex. Sempre completamos com o inglês, que tem o acervo mais
  // completo de imagens (cartas sem imagem no idioma escolhido aparecem com a imagem em inglês).
  const idioma = url.searchParams.get("idioma") ?? "Português";
  const LANG_MAP: Record<string, string[]> = {
    Português: ["pt-br", "pt"],
    Inglês: [],
    Japonês: ["ja"],
    Chinês: ["zh-tw", "zh-cn"],
  };
  const langs = [...(LANG_MAP[idioma] ?? []), "en"];

  const errors: string[] = [];
  const settled = await Promise.allSettled(langs.map((l) => searchTcgdex(l, q, num)));
  const merged = new Map<string, LookupCard>();
  settled.forEach((r, i) => {
    if (r.status === "rejected") {
      errors.push(`TCGdex ${langs[i]}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
      return;
    }
    for (const c of r.value) if (c.tcgdexId && !merged.has(c.tcgdexId)) merged.set(c.tcgdexId, c);
  });
  let results = [...merged.values()].slice(0, 400);
  let source = `TCGdex (${idioma}${idioma === "Inglês" ? "" : " + inglês"})`;

  if (results.length === 0) {
    try {
      results = await searchPtcg(q, num);
      source = "Pokémon TCG API (inglês)";
    } catch (e) {
      errors.push(`Pokémon TCG API: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (results.length) return NextResponse.json({ results, source });

  console.error("Busca de carta sem resultados", { q, num, idioma, errors });
  return NextResponse.json({
    results: [],
    message: errors.length > langs.length ? `Não foi possível consultar as bases de cartas (${errors[0]}).` : "Nenhuma carta encontrada com esse nome/número.",
  });
}
