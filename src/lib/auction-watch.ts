import "server-only";
import { db } from "./db";
import { phoneKey } from "./phone";

// Lembretes por carta: a pessoa marca "me avise" (site ou !avisar 1.3 no grupo) e,
// quando o bot posta a carta no grupo, ele convoca todo mundo que marcou.

const MAX_PER_PERSON = 40; // por leilão

/** Leilão para o qual vale o !avisar: o ao vivo, ou o próximo agendado. */
export async function currentAuction() {
  return (
    (await db.auction.findFirst({ where: { status: "ATIVO", visible: true }, orderBy: { startsAt: "asc" } })) ??
    (await db.auction.findFirst({ where: { status: "AGENDADO", visible: true }, orderBy: { startsAt: "asc" } }))
  );
}

/** Confere se o código (ex.: "1.3") existe no leilão e devolve o nome da carta. */
export async function itemByCode(auctionId: string, code: string) {
  const [l, i] = code.split(".").map(Number);
  if (!l || !i) return null;
  const lot = await db.auctionLot.findFirst({ where: { auctionId, position: l }, include: { items: { where: { position: i } } } });
  return lot?.items[0] ?? null;
}

export async function addWatch(auctionId: string, code: string, phone: string, name: string) {
  const k = phoneKey(phone);
  if (k.length < 12) return { error: "Número de WhatsApp inválido. Use DDD + número (ex.: 61999998888)." };
  const item = await itemByCode(auctionId, code);
  if (!item) return { error: `Não achei a carta ${code} neste leilão.` };
  const mine = await db.auctionWatch.count({ where: { auctionId, phone: k } });
  if (mine >= MAX_PER_PERSON) return { error: "Você já marcou o máximo de cartas neste leilão." };
  await db.auctionWatch.upsert({
    where: { auctionId_code_phone: { auctionId, code, phone: k } },
    create: { auctionId, code, phone: k, name: name.slice(0, 60) },
    update: { name: name.slice(0, 60) || undefined },
  });
  const total = await db.auctionWatch.count({ where: { auctionId, code } });
  return { ok: true, item, total };
}

export async function removeWatch(auctionId: string, code: string, phone: string) {
  await db.auctionWatch.deleteMany({ where: { auctionId, code, phone: phoneKey(phone) } });
}

/** Quem pediu para ser chamado em cada carta do leilão. */
export async function watchersByCode(auctionId: string) {
  const rows = await db.auctionWatch.findMany({ where: { auctionId }, orderBy: { createdAt: "asc" } });
  const m = new Map<string, string[]>();
  for (const r of rows) m.set(r.code, [...(m.get(r.code) ?? []), r.phone]);
  return m;
}
