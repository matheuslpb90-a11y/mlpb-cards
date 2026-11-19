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
    .slice(0, 60)
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

  const errors: string[] = [];
  const attempts: [string, () => Promise<LookupCard[]>][] = [
    ["TCGdex (português)", () => searchTcgdex("pt-br", q, num)],
    ["TCGdex (português)", () => searchTcgdex("pt", q, num)],
    ["TCGdex (inglês)", () => searchTcgdex("en", q, num)],
    ["Pokémon TCG API", () => searchPtcg(q, num)],
  ];
  for (const [label, run] of attempts) {
    try {
      const results = await run();
      if (results.length) return NextResponse.json({ results, source: label });
    } catch (e) {
      errors.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.error("Busca de carta sem resultados", { q, num, errors });
  return NextResponse.json({
    results: [],
    message: errors.length === 4 ? `Não foi possível consultar as bases de cartas (${errors[0]}).` : "Nenhuma carta encontrada com esse nome/número.",
  });
}
