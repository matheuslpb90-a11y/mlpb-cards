"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { CONDITIONS, FINISHES, LANGUAGES, numKey } from "@/lib/catalog";
import { cardRarity } from "@/lib/tcgdex-sets";
import { variantsForSet } from "@/lib/stock-variants";

export type BulkItem = {
  tcgdexId: string; name: string; number: string; imageUrl: string;
  language: string; finish: string; condition: string; priceCents: number; stock: number;
};

/**
 * Salva várias cartas de uma coleção. Para cada carta, a versão (idioma + tipo + estado) que já existir
 * é ATUALIZADA (estoque e preço); se não existir, é criada. Assim nunca duplica o estoque.
 */
export async function bulkSaveCardsAction(setName: string, otherSetNames: string[], items: BulkItem[]) {
  await requireAdmin();
  const name = setName.trim();
  if (!name) return { error: "Informe o nome da coleção." };
  const ok = items.filter(
    (i) => i.name && LANGUAGES.some((l) => l.value === i.language) && (FINISHES as readonly string[]).includes(i.finish) && CONDITIONS.some((c) => c.value === i.condition),
  );
  const bad = ok.find((i) => !Number.isFinite(i.priceCents) || i.priceCents <= 0 || i.stock < 0 || !Number.isInteger(i.stock));
  if (bad) return { error: `Confira o preço e a quantidade de "${bad.name}" (${bad.number}).` };
  if (!ok.length) return { error: "Nenhuma carta selecionada." };

  const existing = await variantsForSet([name, ...otherSetNames]);
  let created = 0, updated = 0;
  for (const i of ok) {
    const same = existing.find((e) => numKey(e.number) === numKey(i.number) && e.language === i.language && e.finish === i.finish && e.condition === i.condition);
    if (same) {
      await db.card.update({ where: { id: same.id }, data: { stock: i.stock, priceCents: i.priceCents, active: true, ...(i.imageUrl ? { imageUrl: i.imageUrl } : {}) } });
      updated++;
    } else {
      const rarity = i.tcgdexId ? await cardRarity(i.tcgdexId) : "";
      await db.card.create({
        data: { kind: "CARTA", game: "Pokémon", name: i.name, setName: name, number: i.number, rarity, language: i.language, finish: i.finish, condition: i.condition, priceCents: i.priceCents, stock: i.stock, imageUrl: i.imageUrl, active: true },
      });
      created++;
    }
  }
  await logActivity("cards_bulk", `Coleção "${name}": ${created} carta(s) nova(s), ${updated} atualizada(s)`);
  revalidatePath("/");
  revalidatePath("/catalogo");
  revalidatePath("/admin/cartas");
  return { ok: `Salvo ✔ ${created} nova(s), ${updated} atualizada(s).`, variants: await variantsForSet([name, ...otherSetNames]) };
}
