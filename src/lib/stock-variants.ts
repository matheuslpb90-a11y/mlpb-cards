import "server-only";
import { db } from "./db";
import { numKey } from "./catalog";

export type StockVariant = { id: string; name: string; setName: string; number: string; language: string; finish: string; condition: string; stock: number; priceCents: number; active: boolean };

/** Versões já cadastradas de uma coleção (aceita mais de um nome para a coleção, ex.: inglês e português). */
export async function variantsForSet(setNames: string[]): Promise<StockVariant[]> {
  const names = [...new Set(setNames.map((s) => s.trim()).filter(Boolean))];
  if (!names.length) return [];
  const rows = await db.card.findMany({
    where: { kind: "CARTA", setName: { in: names, mode: "insensitive" } },
    select: { id: true, name: true, setName: true, number: true, language: true, finish: true, condition: true, stock: true, priceCents: true, active: true },
  });
  return rows;
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
