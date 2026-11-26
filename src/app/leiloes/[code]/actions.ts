"use server";

import { db } from "@/lib/db";
import { addWatch, removeWatch } from "@/lib/auction-watch";
import { attempts, clientIp, recordAttempt } from "@/lib/rate-limit";

/** Marca "me avise" numa carta do leilão (site). */
export async function watchAction(auctionCode: number, code: string, phone: string, name: string) {
  const a = await db.auction.findUnique({ where: { code: auctionCode } });
  if (!a || a.status !== "AGENDADO") return { error: "Esse leilão não aceita mais lembretes." };
  // contra robôs: no máximo 60 marcações por hora do mesmo aparelho
  const ip = await clientIp();
  if ((await attempts(`watch:${ip}`, 60)) >= 60) return { error: "Muitas marcações seguidas. Tente de novo mais tarde." };
  await recordAttempt(`watch:${ip}`);
  const r = await addWatch(a.id, code, phone, name);
  if ("error" in r) return { error: r.error };
  return { ok: true, total: r.total };
}

export async function unwatchAction(auctionCode: number, code: string, phone: string) {
  const a = await db.auction.findUnique({ where: { code: auctionCode } });
  if (!a) return { error: "Leilão não encontrado." };
  await removeWatch(a.id, code, phone);
  return { ok: true };
}
