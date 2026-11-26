"use server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

type CardRef = { setId: string; cardId: string; number: string; name: string; image: string };

/** Atualiza uma carta da coleção do cliente: quantidade que tem e/ou se está na lista de desejos. */
export async function setCollectionAction(card: CardRef, qty: number, wish: boolean) {
  const user = await getCurrentUser();
  if (!user) return { error: "Entre na sua conta para salvar a coleção." };
  if (!/^[\w.-]{1,40}$/.test(card.setId) || !/^[\w.-]{1,60}$/.test(card.cardId)) return { error: "Carta inválida." };
  const q = Math.max(0, Math.min(999, Math.round(Number(qty) || 0)));
  if (q === 0 && !wish) {
    await db.collectionEntry.deleteMany({ where: { userId: user.id, cardId: card.cardId } });
    return { ok: true };
  }
  const data = { qty: q, wish, number: card.number.slice(0, 20), name: card.name.slice(0, 80), image: card.image.slice(0, 300), setId: card.setId };
  await db.collectionEntry.upsert({
    where: { userId_cardId: { userId: user.id, cardId: card.cardId } },
    create: { userId: user.id, cardId: card.cardId, ...data },
    update: data,
  });
  return { ok: true };
}

/** Marca todas as cartas de uma lista como "tenho 1" (ex.: "marcar todas"). */
export async function setManyAction(cards: CardRef[], have: boolean) {
  const user = await getCurrentUser();
  if (!user) return { error: "Entre na sua conta para salvar a coleção." };
  const list = cards.filter((c) => /^[\w.-]{1,60}$/.test(c.cardId)).slice(0, 500);
  if (!have) {
    await db.collectionEntry.deleteMany({ where: { userId: user.id, cardId: { in: list.map((c) => c.cardId) }, wish: false } });
    await db.collectionEntry.updateMany({ where: { userId: user.id, cardId: { in: list.map((c) => c.cardId) } }, data: { qty: 0 } });
    return { ok: true };
  }
  await db.$transaction(
    list.map((c) =>
      db.collectionEntry.upsert({
        where: { userId_cardId: { userId: user.id, cardId: c.cardId } },
        create: { userId: user.id, cardId: c.cardId, setId: c.setId, number: c.number, name: c.name, image: c.image, qty: 1 },
        update: { qty: { increment: 0 } },
      }),
    ),
  );
  await db.collectionEntry.updateMany({ where: { userId: user.id, cardId: { in: list.map((c) => c.cardId) }, qty: 0 }, data: { qty: 1 } });
  return { ok: true };
}
