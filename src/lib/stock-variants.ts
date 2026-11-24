import "server-only";
import { db } from "./db";
import { numKey } from "./catalog";

export type StockVariant = { id: string; name: string; setName: string; number: string; language: string; finish: string; condition: string; stock: number; priceCents: number; active: boolean };

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Versões já cadastradas de uma coleção. Reconhece a carta pelo NÚMERO e por um destes:
 * nome da coleção parecido (inglês, português ou o que você usa) ou nome da carta igual (inglês ou português).
 * O número devolvido é o da coleção (ex.: 001/217), para casar com a lista de cartas.
 */
export async function variantsForSet(setNames: string[], setCards?: { number: string; name: string; namePt?: string }[]): Promise<StockVariant[]> {
  const sets = [...new Set(setNames.map(norm).filter((s) => s.length >= 3))];
  if (!sets.length) return [];
  const rows = await db.card.findMany({
    where: { kind: "CARTA" },
    select: { id: true, name: true, setName: true, number: true, language: true, finish: true, condition: true, stock: true, priceCents: true, active: true },
  });
  const sameSet = (s: string) => {
    const n = norm(s);
    return !!n && sets.some((x) => n === x || n.includes(x) || (n.length >= 5 && x.includes(n)));
  };
  if (!setCards) return rows.filter((r) => sameSet(r.setName));
  // palavras do nome (sem "de", "da", "ex"...): "Erika's Oddish" e "Oddish de Érika" têm "oddish" em comum
  const words = (s: string) => new Set(s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/'s\b/g, "").split(/[^a-z0-9]+/).filter((w) => w.length >= 4));
  const byNum = new Map<string, { number: string; names: string[]; words: Set<string> }>();
  for (const c of setCards) {
    const all = [c.name, c.namePt ?? ""];
    byNum.set(numKey(c.number), { number: c.number, names: all.map(norm).filter(Boolean), words: new Set(all.flatMap((n) => [...words(n)])) });
  }
  const out: StockVariant[] = [];
  for (const r of rows) {
    const card = byNum.get(numKey(r.number));
    if (!card) continue;
    const nameOk = card.names.includes(norm(r.name)) || [...words(r.name)].some((w) => card.words.has(w));
    if (sameSet(r.setName) || nameOk) out.push({ ...r, number: card.number });
  }
  return out;
}

/** Versões já cadastradas de UMA carta (mesma coleção e número, ou mesmo nome e número). */
export async function variantsForCard(name: string, setName: string, number: string): Promise<StockVariant[]> {
  if (!number.trim() && !name.trim()) return [];
  const rows = await db.card.findMany({
    where: {
      kind: "CARTA",
      OR: [
        ...(setName.trim() ? [{ setName: { equals: setName.trim(), mode: "insensitive" as const } }] : []),
        ...(name.trim() ? [{ name: { equals: name.trim(), mode: "insensitive" as const } }] : []),
      ],
    },
    select: { id: true, name: true, setName: true, number: true, language: true, finish: true, condition: true, stock: true, priceCents: true, active: true },
    take: 300,
  });
  const k = numKey(number);
  return rows.filter((r) => (k ? numKey(r.number) === k : true) && (!setName.trim() || r.setName.toLowerCase() === setName.trim().toLowerCase() || r.name.toLowerCase() === name.trim().toLowerCase()));
}
