import "server-only";
import { db } from "./db";
import { log } from "./zapi";
import { phoneKey } from "./phone";

// MLPB Points — pontos para membros do grupo, trocados por prêmios na loja.
// Configuração em Setting "pointsConfig" (Painel → 🪙 Pontos).

export type Reward = { key: string; name: string; points: number; minSpend?: number }; // minSpend: R$ em compras na janela
export type PointsConfig = {
  enabled: boolean;
  perReal: number; // pontos por R$ 1 em compras/arremates pagos
  gameDailyCap: number; // máximo de pontos por dia vindos de jogos
  reviewPoints: number; // 1ª avaliação da loja
  reviewRepeatPoints: number; // reavaliações da loja (no máximo 1x por dia)
  referralStay: number; // indicado ficou 7 dias
  referralPurchase: number; // indicado fez a 1ª compra
  referralMinCents: number;
  spendWindowDays: number; // janela da "compra mínima" dos prêmios
  auctionMinSpend: number; // compra mínima (R$) para vencer um Leilão de Pontos
  boxBonus: number; // caixa chegou no valor do frete grátis (R$ 500): bônus de pontos, 1x por caixa
  ranking: number[]; // bônus do 1º, 2º, 3º do mês
  expiryMonths: number;
  rewards: Reward[];
};

export const DEFAULT_POINTS: PointsConfig = {
  enabled: false,
  perReal: 1,
  gameDailyCap: 10,
  reviewPoints: 20,
  reviewRepeatPoints: 1,
  referralStay: 100,
  referralPurchase: 200,
  referralMinCents: 3000,
  spendWindowDays: 90,
  auctionMinSpend: 50,
  boxBonus: 300,
  ranking: [300, 150, 75],
  expiryMonths: 6,
  rewards: [
    { key: "bulk", name: "🃏 Pacotinho surpresa (5 cartas, vai para a sua caixa)", points: 150, minSpend: 0 },
    { key: "cupom5", name: "Cupom de R$ 5", points: 250, minSpend: 0 },
    { key: "holo", name: "✨ Holo ou Reverse surpresa (vai para a sua caixa)", points: 400, minSpend: 50 },
    { key: "cupom10", name: "Cupom de R$ 10", points: 500, minSpend: 0 },
    { key: "frete15", name: "📦 R$ 15 de desconto no frete (caixas abaixo de R$ 500)", points: 800, minSpend: 0 },
    { key: "booster", name: "🎁 1 booster de alguma coleção + frete grátis", points: 1500, minSpend: 200 },
  ],
};

export async function getPointsConfig(): Promise<PointsConfig> {
  const s = await db.setting.findUnique({ where: { key: "pointsConfig" } });
  try {
    const c = JSON.parse(s?.value ?? "{}") as Partial<PointsConfig>;
    // tabela antiga (com "frete grátis") é trocada pela nova automaticamente
    const old = c.rewards?.length === 4 && c.rewards.some((r) => r.key === "frete");
    const rewards = (c.rewards?.length && !old ? c.rewards : DEFAULT_POINTS.rewards).map((r) =>
      r.key === "booster" && r.name === "1 booster" ? { ...r, name: "🎁 1 booster de alguma coleção + frete grátis" } : r,
    ).map((r) =>
      // prêmios salvos antes da regra de compra mínima: assume o padrão
      r.minSpend === undefined ? { ...r, minSpend: DEFAULT_POINTS.rewards.find((d) => d.key === r.key)?.minSpend ?? 0 } : r,
    );
    return { ...DEFAULT_POINTS, ...c, rewards };
  } catch {
    return DEFAULT_POINTS;
  }
}
export async function savePointsConfig(c: PointsConfig) {
  await db.setting.upsert({ where: { key: "pointsConfig" }, create: { key: "pointsConfig", value: JSON.stringify(c) }, update: { value: JSON.stringify(c) } });
}

// ---- quem está no grupo (só membros ganham/trocam pontos) ----
let memberCache: { at: number; set: Set<string> } | null = null;
export async function groupMembers(fresh = false): Promise<Set<string> | null> {
  if (!fresh && memberCache && Date.now() - memberCache.at < 5 * 60_000) return memberCache.set;
  try {
    const { getModConfig, moderatedGroups, groupInfo } = await import("./moderation");
    const groups = await moderatedGroups(await getModConfig());
    const set = new Set<string>();
    for (const g of groups) for (const p of (await groupInfo(g, fresh)).participants) set.add(phoneKey(p.phone));
    memberCache = { at: Date.now(), set };
    return set;
  } catch (e) {
    await log("erro-pontos", { acao: "listar membros", error: String(e) });
    return null; // não deu para conferir: não bloqueia
  }
}
export async function isMember(phone: string) {
  const set = await groupMembers();
  return set === null ? true : set.has(phoneKey(phone));
}

// ---- saldo ----
export async function balance(phone: string) {
  const k = phoneKey(phone);
  const now = new Date();
  const [plus, minus] = await Promise.all([
    db.pointEntry.aggregate({ _sum: { points: true }, where: { phone: k, points: { gt: 0 }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } }),
    db.pointEntry.aggregate({ _sum: { points: true }, where: { phone: k, points: { lt: 0 } } }),
  ]);
  return Math.max(0, (plus._sum.points ?? 0) + (minus._sum.points ?? 0));
}

type Credit = { phone: string; name?: string; points: number; source: string; note?: string; refId?: string; skipMemberCheck?: boolean };

/** Lança pontos. Só para quem está no grupo; refId evita lançar a mesma coisa duas vezes. */
export async function credit(x: Credit): Promise<{ ok: boolean; reason?: string; points?: number }> {
  const c = await getPointsConfig();
  if (!c.enabled && x.source !== "AJUSTE") return { ok: false, reason: "programa de pontos desligado" };
  if (!x.points) return { ok: false, reason: "zero pontos" };
  const k = phoneKey(x.phone);
  if (x.refId && (await db.pointEntry.findFirst({ where: { refId: x.refId, phone: k } }))) return { ok: false, reason: "já lançado" };
  if (x.points > 0 && !x.skipMemberCheck && !(await isMember(k))) return { ok: false, reason: "fora do grupo" };
  const expiresAt = x.points > 0 && c.expiryMonths > 0 ? new Date(Date.now() + c.expiryMonths * 30 * 86400_000) : null;
  await db.pointEntry.create({ data: { phone: k, name: x.name ?? "", points: x.points, source: x.source, note: x.note ?? "", refId: x.refId ?? "", expiresAt } });
  return { ok: true, points: x.points };
}

/** Pontos por compra paga (site, leilão do bot, Leilomania): perReal por R$ 1. */
export async function creditPurchase(phone: string, name: string, cents: number, source: "COMPRA" | "LEILAO" | "LEILOMANIA", refId: string, note = "") {
  const c = await getPointsConfig();
  const pts = Math.floor((cents / 100) * c.perReal);
  if (pts <= 0) return { ok: false, reason: "valor baixo" };
  const r = await credit({ phone, name, points: pts, source, refId, note });
  if (r.ok) await afterPurchase(phone, cents).catch(() => {});
  return r;
}

/** Pontos de jogo, respeitando o limite diário. */
export async function creditGame(phone: string, name: string, points: number, note: string) {
  const c = await getPointsConfig();
  const k = phoneKey(phone);
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const today = await db.pointEntry.aggregate({ _sum: { points: true }, where: { phone: k, source: "JOGO", createdAt: { gte: new Date(`${ymd}T00:00:00-03:00`) } } });
  const room = Math.max(0, c.gameDailyCap - (today._sum.points ?? 0));
  if (room <= 0) return { ok: false, reason: "limite diário de jogos" };
  return credit({ phone, name, points: Math.min(points, room), source: "JOGO", note });
}

/** Hook para a indicação premiada (1ª compra do indicado) — preenchido na etapa de indicações. */
async function afterPurchase(_phone: string, _cents: number) {}

// ---- ranking do mês ----
export function monthStart(d = new Date()) {
  const ym = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(d);
  return new Date(`${ym}-01T00:00:00-03:00`);
}
export async function monthRanking(limit = 10, from = monthStart(), to?: Date) {
  const rows = await db.pointEntry.groupBy({
    by: ["phone"],
    where: { points: { gt: 0 }, source: { notIn: ["RANKING", "AJUSTE"] }, createdAt: { gte: from, ...(to ? { lt: to } : {}) } },
    _sum: { points: true },
    orderBy: { _sum: { points: "desc" } },
    take: limit,
  });
  const names = await db.pointEntry.findMany({ where: { phone: { in: rows.map((r) => r.phone) }, name: { not: "" } }, orderBy: { createdAt: "desc" }, distinct: ["phone"], select: { phone: true, name: true } });
  return rows.map((r) => ({ phone: r.phone, name: names.find((n) => n.phone === r.phone)?.name ?? "", points: r._sum.points ?? 0 }));
}

/** No início de cada mês: bônus para o top 3 do mês anterior (uma vez só). */
export async function payMonthlyRanking() {
  const c = await getPointsConfig();
  if (!c.enabled) return null;
  const thisMonth = monthStart();
  const prev = monthStart(new Date(thisMonth.getTime() - 86400_000));
  const ref = `RANK-${prev.toISOString().slice(0, 7)}`;
  if (await db.pointEntry.findFirst({ where: { refId: { startsWith: ref } } })) return null;
  const top = await monthRanking(3, prev, thisMonth);
  for (const [i, t] of top.entries()) {
    if (c.ranking[i]) await credit({ phone: t.phone, name: t.name, points: c.ranking[i], source: "RANKING", refId: `${ref}-${i + 1}`, note: `${i + 1}º lugar do mês` });
  }
  return { mes: prev.toISOString().slice(0, 7), top };
}

// ---- compras recentes (para prêmios que exigem compra mínima) ----
/** Quanto a pessoa comprou (R$) na janela: site, leilões do bot e Leilomania. */
export async function recentSpend(phone: string, c?: PointsConfig) {
  const cfg = c ?? (await getPointsConfig());
  const since = new Date(Date.now() - cfg.spendWindowDays * 86400_000);
  const s = await db.pointEntry.aggregate({
    _sum: { points: true },
    where: { phone: phoneKey(phone), source: { in: ["COMPRA", "LEILAO", "LEILOMANIA"] }, points: { gt: 0 }, createdAt: { gte: since } },
  });
  return cfg.perReal > 0 ? (s._sum.points ?? 0) / cfg.perReal : 0;
}

// ---- trocas ----
export async function requestRedemption(phone: string, name: string, rewardKey: string) {
  const c = await getPointsConfig();
  const reward = c.rewards.find((r) => r.key === rewardKey);
  if (!reward) return { ok: false as const, reason: "prêmio não encontrado" };
  if (!(await isMember(phone))) return { ok: false as const, reason: "só membros do grupo podem trocar pontos" };
  if ((reward.minSpend ?? 0) > 0) {
    const spent = await recentSpend(phone, c);
    if (spent < (reward.minSpend ?? 0))
      return { ok: false as const, reason: `esse prêmio exige R$ ${reward.minSpend} em compras nos últimos ${c.spendWindowDays} dias (você tem R$ ${Math.floor(spent)})` };
  }
  const bal = await balance(phone);
  if (bal < reward.points) return { ok: false as const, reason: `saldo insuficiente (${bal} de ${reward.points})` };
  const k = phoneKey(phone);
  const red = await db.redemption.create({ data: { phone: k, name, rewardKey: reward.key, rewardName: reward.name, points: reward.points } });
  await db.pointEntry.create({ data: { phone: k, name, points: -reward.points, source: "RESGATE", note: reward.name, refId: `RED-${red.id}` } });
  return { ok: true as const, reward, balance: bal - reward.points };
}

/** Loja recusou a troca: devolve os pontos. */
export async function refuseRedemption(id: string) {
  const r = await db.redemption.findUnique({ where: { id } });
  if (!r || r.status !== "PENDENTE") return;
  await db.redemption.update({ where: { id }, data: { status: "RECUSADO", doneAt: new Date() } });
  await db.pointEntry.deleteMany({ where: { refId: `RED-${r.id}` } });
}

/** Caixa chegou no valor do frete grátis (ex.: R$ 500): bônus de pontos, uma vez por caixa. */
export async function checkBoxBonus(boxId: string) {
  const c = await getPointsConfig();
  if (!c.enabled || c.boxBonus <= 0) return;
  const { boxBalance, freeShippingCents } = await import("./boxes");
  const box = await db.box.findUnique({ where: { id: boxId }, include: { orders: true, invoices: true } });
  if (!box) return;
  const free = await freeShippingCents();
  if (boxBalance(box) < free) return;
  const r = await credit({ phone: box.phone, name: box.name, points: c.boxBonus, source: "BONUS", refId: `BOX500-${box.id}`, note: `Caixa #${box.code} chegou em R$ ${Math.round(free / 100)}` });
  if (r.ok) {
    const { sendText } = await import("./zapi");
    sendText(box.phone, `🎉 Sua caixa #${box.code} passou de R$ ${Math.round(free / 100)}: *frete grátis liberado* e você ganhou *+${c.boxBonus} MLPB Points*! 🪙`).catch(() => {});
  }
}
