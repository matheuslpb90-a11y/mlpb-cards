import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { MYP_ATTRIBUTION, mypFind, mypPrice, mypSearch, type MypCard } from "@/lib/myp";

// Busca de cartas Pokémon para o painel (somente admin).
// Fontes, em ordem: TCGdex (português, depois inglês) e Pokémon TCG API (inglês).
// GET ?q=nome&num=025      → lista de resultados
// GET ?tcgdex=<id>&lang=en → detalhes de uma carta da TCGdex

export type LookupCard = {
  key: string;
  source: "tcgdex" | "ptcg" | "myp";
  priceCents?: number | null; // valor de mercado no Brasil (MYP Cards)
  priceBasis?: string;
  link?: string;
  tcgdexId?: string;
  lang?: string;
  name: string;
  setName: string;
  number: string;
  rarity: string;
  imageSmall: string;
  imageLarge: string;
  imageAlt?: string; // imagem reserva (se a principal não abrir)
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
      number: c.set?.printedTotal && /^\d+$/.test(c.number) ? `${c.number}/${c.set.printedTotal}` : c.number,
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

  // Só o preço de mercado (MYP Cards) de uma carta: ?myp=nome&num=025/165&idioma=Português&finish=Foil
  const mypName = url.searchParams.get("myp");
  if (mypName) {
    try {
      const list = await mypFind(mypName, url.searchParams.get("num") ?? "");
      const idioma = url.searchParams.get("idioma") ?? undefined;
      const finish = url.searchParams.get("finish") ?? undefined;
      return NextResponse.json({
        attribution: MYP_ATTRIBUTION,
        results: list.slice(0, 30).map((c) => ({ ...c, price: mypPrice(c, idioma, finish) })),
        message: list.length ? undefined : "A MYP não encontrou carta com esse nome exato (use o nome em inglês ou português, ex.: Charizard ex).",
      });
    } catch (e) {
      return NextResponse.json({ results: [], message: `Não deu para consultar a MYP: ${e instanceof Error ? e.message : String(e)}` });
    }
  }

  // Busca pelo código impresso na carta: "094/083", "TG12/TG30", "SVP053"
  const codigo = (url.searchParams.get("codigo") ?? "").trim().toUpperCase();
  if (codigo) {
    const idioma = url.searchParams.get("idioma") ?? "Português";
    return NextResponse.json(await searchByCode(codigo, idioma));
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
  // MYP Cards (preço do mercado brasileiro) em paralelo com as bases de imagens
  const mypPromise = mypSearch(q).then(
    (list) => list.filter((c) => c.imageUrl && (!num || sameNumber(c.number.replace(/^[A-Za-z-]*/, ""), num) || c.number.toUpperCase().includes(num.toUpperCase()))).map((c) => mypToLookup(c, idioma)),
    (e) => {
      errors.push(`MYP: ${e instanceof Error ? e.message : String(e)}`);
      return [] as LookupCard[];
    },
  ).then((list) => list.sort((a, b) => Number(Boolean(b.priceCents)) - Number(Boolean(a.priceCents)))); // com preço primeiro
  const settled = await Promise.allSettled(langs.map((l) => searchTcgdex(l, q, num)));
  const merged = new Map<string, LookupCard>();
  settled.forEach((r, i) => {
    if (r.status === "rejected") {
      errors.push(`TCGdex ${langs[i]}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
      return;
    }
    for (const c of r.value) if (c.tcgdexId && !merged.has(c.tcgdexId)) merged.set(c.tcgdexId, c);
  });
  const myp = await mypPromise;
  let results = [...myp, ...merged.values()].slice(0, 400);
  let source = `${myp.length ? `MYP Cards (${myp.length}, com preço em R$) + ` : ""}TCGdex (${idioma}${idioma === "Inglês" ? "" : " + inglês"})`;

  if (results.length === 0) {
    try {
      results = await searchPtcg(q, num);
      source = "Pokémon TCG API (inglês)";
    } catch (e) {
      errors.push(`Pokémon TCG API: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (results.length) return NextResponse.json({ results, source, attribution: myp.length ? MYP_ATTRIBUTION : undefined, warning: errors.find((e) => e.startsWith("MYP")) });

  console.error("Busca de carta sem resultados", { q, num, idioma, errors });
  return NextResponse.json({
    results: [],
    message: errors.length > langs.length ? `Não foi possível consultar as bases de cartas (${errors[0]}).` : "Nenhuma carta encontrada com esse nome/número.",
  });
}

const CODE_LANGS: Record<string, string[]> = {
  Português: ["pt-br", "pt", "en"],
  Inglês: ["en"],
  Japonês: ["ja", "en"],
  Chinês: ["zh-tw", "zh-cn", "en"],
};

async function searchByCode(codigo: string, idioma: string): Promise<{ results: LookupCard[]; source?: string; message?: string }> {
  const [numPart, totalPart] = codigo.replace(/\s/g, "").split("/");
  const promo = numPart.match(/^([A-Z-]+?)(\d+)$/); // ex.: SVP053, SWSH020
  const errors: string[] = [];

  for (const lang of CODE_LANGS[idioma] ?? ["en"]) {
    try {
      // todas as coleções do idioma (para casar o total "/083" e prefixos de promo)
      const sets = (await getJson(`${TCGDEX}/${lang}/sets`)) as { id: string; name: string; cardCount?: { official?: number; total?: number } }[];
      const candidates = new Set<string>();
      if (totalPart) {
        const total = Number(totalPart.replace(/\D/g, ""));
        for (const s of sets) if (s.cardCount?.official === total) candidates.add(s.id);
      }
      const localIds = new Set([numPart, numPart.replace(/^0+/, ""), numPart.padStart(3, "0")]);
      if (promo) {
        localIds.add(promo[2]);
        localIds.add(promo[2].padStart(3, "0"));
        localIds.add(numPart);
      }
      const found: LookupCard[] = [];
      const setList = candidates.size ? [...candidates] : promo ? sets.filter((s) => s.id.toUpperCase().replace(/[^A-Z]/g, "").startsWith(promo[1].replace(/-/g, ""))).map((s) => s.id) : [];
      for (const setId of setList.slice(0, 12)) {
        const set = (await getJson(`${TCGDEX}/${lang}/sets/${encodeURIComponent(setId)}`)) as {
          name: string; cardCount?: { official?: number }; cards?: { id: string; localId: string; name: string; image?: string }[];
        };
        for (const c of set.cards ?? []) {
          if (!localIds.has(c.localId.toUpperCase()) || !c.image) continue;
          found.push({
            key: `code-${lang}-${c.id}`, source: "tcgdex", tcgdexId: c.id, lang, name: c.name, setName: set.name,
            number: set.cardCount?.official && /^\d+$/.test(c.localId) ? `${c.localId}/${String(set.cardCount.official).padStart(c.localId.length, "0")}` : c.localId,
            rarity: "", imageSmall: `${c.image}/low.webp`, imageLarge: `${c.image}/high.webp`,
          });
        }
      }
      if (found.length) return { results: found, source: `TCGdex (${lang})` };
    } catch (e) {
      errors.push(`${lang}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { results: [], message: errors.length ? `Não foi possível consultar a base (${errors[0]}).` : "Nenhuma carta com esse código. Confira ou use “Manual”." };
}

function mypToLookup(c: MypCard, idioma: string): LookupCard {
  const price = mypPrice(c, idioma);
  return {
    key: `myp-${c.id}`,
    source: "myp",
    name: c.name,
    setName: c.setName,
    number: c.number,
    rarity: "",
    imageSmall: c.imageUrl,
    imageLarge: c.imageUrl,
    imageAlt: c.imageAlt,
    priceCents: price?.cents ?? null,
    priceBasis: price?.basis,
    link: c.link,
  };
}
