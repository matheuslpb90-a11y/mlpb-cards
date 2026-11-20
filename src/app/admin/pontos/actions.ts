"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { balance, credit, creditPurchase, getPointsConfig, refuseRedemption, savePointsConfig, type PointsConfig } from "@/lib/points";
import { sendText } from "@/lib/zapi";

const int = (v: unknown, min: number, max: number, def: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : def;
};

export async function savePointsConfigAction(c: PointsConfig) {
  await requireAdmin();
  const clean: PointsConfig = {
    enabled: Boolean(c.enabled),
    perReal: Math.min(Math.max(Number(c.perReal) || 0, 0), 100),
    gameDailyCap: int(c.gameDailyCap, 0, 10000, 10),
    reviewPoints: int(c.reviewPoints, 0, 10000, 20),
    reviewRepeatPoints: int(c.reviewRepeatPoints, 0, 10000, 1),
    referralStay: int(c.referralStay, 0, 100000, 100),
    referralPurchase: int(c.referralPurchase, 0, 100000, 200),
    referralMinCents: int(c.referralMinCents, 0, 10_000_000, 3000),
    boxBonus: int(c.boxBonus, 0, 100000, 300),
    ranking: (c.ranking ?? []).slice(0, 3).map((v) => int(v, 0, 100000, 0)),
    expiryMonths: int(c.expiryMonths, 0, 60, 6),
    rewards: (c.rewards ?? [])
      .map((r, i) => ({ key: r.key || `premio${i + 1}`, name: String(r.name ?? "").trim().slice(0, 60), points: int(r.points, 1, 1_000_000, 100) }))
      .filter((r) => r.name),
  };
  await savePointsConfig(clean);
  await logActivity("points_config", `MLPB Points ${clean.enabled ? "ligado" : "desligado"}`);
  revalidatePath("/admin/pontos");
  return { ok: "Configuração salva ✔" };
}

export async function launchPointsAction(input: { phone: string; name: string; kind: "LEILOMANIA" | "PONTOS"; value: string; note: string }) {
  await requireAdmin();
  const phone = input.phone.replace(/\D/g, "");
  if (phone.length < 10) return { error: "Número inválido (use DDD + número)." };
  const v = Number(input.value.replace(",", "."));
  if (!v) return { error: "Informe o valor." };
  const r =
    input.kind === "LEILOMANIA"
      ? await creditPurchase(phone, input.name, Math.round(v * 100), "LEILOMANIA", "", input.note || `Leilomania R$ ${v}`)
      : await credit({ phone, name: input.name, points: Math.round(v), source: "AJUSTE", note: input.note || "ajuste manual" });
  if (!r.ok) return { error: `Não lançado: ${r.reason}.` };
  await logActivity("points_launch", `${input.kind === "LEILOMANIA" ? `Leilomania R$ ${v}` : `${v} pontos`} para ${phone}`);
  revalidatePath("/admin/pontos");
  return { ok: `${r.points} pontos lançados ✔ (saldo ${await balance(phone)})` };
}

export async function redemptionAction(id: string, cmd: "entregue" | "recusar") {
  await requireAdmin();
  const r = await db.redemption.findUnique({ where: { id } });
  if (!r || r.status !== "PENDENTE") return { error: "Troca não está pendente." };
  if (cmd === "entregue") {
    await db.redemption.update({ where: { id }, data: { status: "ENTREGUE", doneAt: new Date() } });
    sendText(r.phone, `🎁 Seu prêmio *${r.rewardName}* (MLPB Points) foi liberado! Obrigado por fazer parte do grupo. 🧡`).catch(() => {});
  } else {
    await refuseRedemption(id);
    sendText(r.phone, `🪙 Sua troca por *${r.rewardName}* não pôde ser feita agora e os ${r.points} pontos voltaram para o seu saldo. Qualquer dúvida, fale com a loja.`).catch(() => {});
  }
  await logActivity("points_redemption", `Troca ${r.rewardName} (${r.phone}): ${cmd}`);
  revalidatePath("/admin/pontos");
  return { ok: true };
}

export async function getConfigForForm() {
  await requireAdmin();
  return getPointsConfig();
}

export async function startPointAuctionAction(input: { title: string; imageUrl: string; start: string; step: string; count: string; minutes: string }) {
  await requireAdmin();
  const title = input.title.trim();
  if (!title) return { error: "Dê um nome ao prêmio." };
  const { startPointAuction } = await import("@/lib/point-auctions");
  const { siteUrl } = await import("@/lib/orders");
  try {
    const img = input.imageUrl.trim();
    await startPointAuction({
      title,
      imageUrl: img ? (img.startsWith("http") ? img : `${siteUrl()}${img}`) : "",
      start: Number(input.start) || 100,
      step: Number(input.step) || 50,
      count: Number(input.count) || 10,
      minutes: Number(input.minutes) || 30,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  await logActivity("points_auction", `Leilão de Pontos iniciado: ${title}`);
  revalidatePath("/admin/pontos");
  return { ok: "Leilão de Pontos postado no grupo ✔" };
}
