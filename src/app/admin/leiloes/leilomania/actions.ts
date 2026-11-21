"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";

export type ExtInput = { id?: string; title: string; description: string; url: string; imageUrl: string; startsAt: string; endsAt: string; visible: boolean };

const normUrl = (u: string) => {
  const s = u.trim();
  if (!s) return "";
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
};

export async function saveExternalAuctionAction(x: ExtInput) {
  await requireAdmin();
  const title = x.title.trim();
  const url = normUrl(x.url);
  // datas vêm do campo "datetime-local" (horário de Brasília)
  const startsAt = new Date(`${x.startsAt}:00-03:00`);
  const endsAt = new Date(`${x.endsAt}:00-03:00`);
  if (!title) return { error: "Dê um nome ao leilão." };
  if (!/^https?:\/\/[^\s]+\.[^\s]+/.test(url)) return { error: "Cole o link do leilão na Leilomania." };
  if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime())) return { error: "Preencha início e fim." };
  if (endsAt <= startsAt) return { error: "O fim precisa ser depois do início." };
  const data = { title, description: x.description.trim(), url, imageUrl: x.imageUrl.trim(), startsAt, endsAt, visible: x.visible };
  if (x.id) await db.externalAuction.update({ where: { id: x.id }, data });
  else await db.externalAuction.create({ data });
  await logActivity("auction_saved", `Leilão na Leilomania: ${title}`);
  revalidatePath("/admin/leiloes/leilomania");
  revalidatePath("/leiloes");
  return { ok: "Salvo ✔" };
}

export async function deleteExternalAuctionAction(id: string) {
  await requireAdmin();
  await db.externalAuction.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/leiloes/leilomania");
  revalidatePath("/leiloes");
  return { ok: true };
}

export async function saveLeilomaniaProfileAction(url: string) {
  await requireAdmin();
  const value = normUrl(url);
  await db.setting.upsert({ where: { key: "leilomaniaUrl" }, create: { key: "leilomaniaUrl", value }, update: { value } });
  revalidatePath("/leiloes");
  revalidatePath("/admin/leiloes/leilomania");
  return { ok: "Link salvo ✔" };
}
