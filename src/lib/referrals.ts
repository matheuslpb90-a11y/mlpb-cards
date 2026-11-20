import "server-only";
import { db } from "./db";
import { phoneKey } from "./phone";
import { WHATSAPP_NUMBER } from "./whatsapp";

// Indicação premiada: quem entrou no grupo manda "!indicado @amigo" (até 7 dias depois de entrar).
// O amigo que indicou ganha pontos quando o novo membro fica 7 dias e um bônus na 1ª compra dele.

const DAY = 86400_000;

/** Registra a entrada de alguém no grupo (para a janela de 7 dias da indicação). */
export async function recordJoin(group: string, phone: string) {
  await db.modEvent.create({ data: { group, phone: phoneKey(phone), kind: "JOIN" } }).catch(() => {});
}

export async function registerReferral(group: string, newPhone: string, newName: string, referrer: string) {
  const nk = phoneKey(newPhone);
  const rk = phoneKey(referrer);
  if (!rk || rk.length < 10) return { ok: false, reason: "marque quem te indicou (@pessoa) ou responda a mensagem dela" };
  if (nk === rk) return { ok: false, reason: "você não pode indicar a si mesmo" };
  if (rk === phoneKey(WHATSAPP_NUMBER)) return { ok: false, reason: "a loja não participa da indicação" };
  const join = await db.modEvent.findFirst({ where: { group, phone: nk, kind: "JOIN" }, orderBy: { createdAt: "desc" } });
  if (!join || Date.now() - join.createdAt.getTime() > 7 * DAY) return { ok: false, reason: "a indicação vale só para quem entrou no grupo nos últimos 7 dias" };
  if (await db.referral.findUnique({ where: { newPhone: nk } })) return { ok: false, reason: "você já informou quem te indicou" };
  const { isMember } = await import("./points");
  if (!(await isMember(rk))) return { ok: false, reason: "quem te indicou precisa estar no grupo" };
  await db.referral.create({ data: { newPhone: nk, newName, referrerPhone: rk } });
  return { ok: true };
}

/** 1x por dia: paga quem indicou alguém que ficou 7 dias no grupo. */
export async function payReferralStays() {
  const { credit, getPointsConfig, isMember } = await import("./points");
  const c = await getPointsConfig();
  if (!c.enabled) return;
  const due = await db.referral.findMany({ where: { stayPaid: false, createdAt: { lte: new Date(Date.now() - 7 * DAY) } }, take: 50 });
  const { sendText } = await import("./zapi");
  for (const r of due) {
    await db.referral.update({ where: { id: r.id }, data: { stayPaid: true } });
    if (!(await isMember(r.newPhone))) continue; // saiu antes de 7 dias: sem pontos
    const res = await credit({ phone: r.referrerPhone, points: c.referralStay, source: "INDICACAO", refId: `REF-STAY-${r.id}`, note: `${r.newName || r.newPhone} ficou 7 dias` });
    if (res.ok) sendText(r.referrerPhone, `🤝 Sua indicação deu certo! ${r.newName || "Seu amigo"} completou 7 dias no grupo: *+${c.referralStay} MLPB Points* 🪙\nSe ele fizer a primeira compra, você ganha mais *${c.referralPurchase}*!`).catch(() => {});
  }
}

/** 1ª compra do indicado (a partir do valor mínimo): bônus para quem indicou. */
export async function referralPurchase(phone: string, cents: number) {
  const { credit, getPointsConfig } = await import("./points");
  const c = await getPointsConfig();
  if (!c.enabled || cents < c.referralMinCents) return;
  const r = await db.referral.findUnique({ where: { newPhone: phoneKey(phone) } });
  if (!r || r.purchasePaid) return;
  await db.referral.update({ where: { id: r.id }, data: { purchasePaid: true } });
  const res = await credit({ phone: r.referrerPhone, points: c.referralPurchase, source: "INDICACAO", refId: `REF-BUY-${r.id}`, note: `${r.newName || r.newPhone} fez a 1ª compra` });
  if (res.ok) {
    const { sendText } = await import("./zapi");
    sendText(r.referrerPhone, `🎉 ${r.newName || "Seu indicado"} fez a primeira compra na MLPB! Você ganhou *+${c.referralPurchase} MLPB Points* 🪙`).catch(() => {});
  }
}

export async function referralSummary(phone: string) {
  const k = phoneKey(phone);
  const list = await db.referral.findMany({ where: { referrerPhone: k } });
  return { total: list.length, stayed: list.filter((r) => r.stayPaid).length, bought: list.filter((r) => r.purchasePaid).length };
}
