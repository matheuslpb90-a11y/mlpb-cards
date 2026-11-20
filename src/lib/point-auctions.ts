import "server-only";
import { createHash } from "crypto";
import { db } from "./db";
import { log, sendImage, sendPoll, sendText, zapiMode } from "./zapi";
import { phoneKey } from "./phone";
import { WHATSAPP_NUMBER } from "./whatsapp";
import { balance, getPointsConfig, isMember, recentSpend } from "./points";
import { whapiPollResults } from "./whapi";

// Leilão de Pontos: o bot posta uma enquete no grupo e o lance é em MLPB Points.
// Vence o maior lance VÁLIDO (membro do grupo com saldo suficiente no encerramento); empate: quem votou primeiro.
// O vencedor tem os pontos descontados e o prêmio entra em "Trocas para entregar".

const label = (pts: number) => `🪙 ${pts} pts`;
const hash = (s: string) => createHash("sha256").update(s).digest("base64");
const parseOpts = (j: string) => JSON.parse(j || "[]") as number[];

async function botGroup() {
  const g = (await db.setting.findUnique({ where: { key: "botGroupId" } }))?.value;
  if (!g) throw new Error("Escolha o grupo em Painel → Bot WhatsApp.");
  return g;
}

/** Valores da enquete: começa em `start` e sobe de `step` em `step` (máx. 12 opções, limite do WhatsApp). */
export function pointOptions(start: number, step: number, count = 10) {
  const n = Math.min(Math.max(count, 2), 12);
  return Array.from({ length: n }, (_, i) => start + i * step);
}

export async function startPointAuction(input: { title: string; imageUrl?: string; start: number; step: number; count?: number; minutes: number }) {
  const pc = await getPointsConfig();
  if (!pc.enabled) throw new Error("Ligue o MLPB Points antes (Painel → 🪙 Pontos).");
  if (zapiMode() !== "whapi") throw new Error("O Leilão de Pontos precisa da Whapi (enquetes).");
  const opts = pointOptions(Math.max(1, Math.round(input.start)), Math.max(1, Math.round(input.step)), input.count ?? 10);
  const group = await botGroup();
  const endsAt = new Date(Date.now() + Math.max(1, input.minutes) * 60_000);
  const fim = endsAt.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  const intro = [
    `🪙 *LEILÃO DE PONTOS* 🪙`,
    `🎁 *${input.title}*`,
    "",
    "O lance é em *MLPB Points*! Vote na enquete o quanto quer pagar.",
    "🏆 Vence o maior lance (empate: quem votou primeiro).",
    "⚠️ Só vale se você tiver os pontos no encerramento — veja seu saldo com *!pontos*.",
    ...(pc.auctionMinSpend > 0 ? [`🛒 Para levar, é preciso ter comprado ao menos R$ ${pc.auctionMinSpend} nos últimos ${pc.spendWindowDays} dias.`] : []),
    `⏰ Encerra às *${fim}*.`,
  ].join("\n");
  if (input.imageUrl) await sendImage(group, input.imageUrl, intro);
  else await sendText(group, intro);
  const pollId = await sendPoll(group, `🪙 ${input.title}`, opts.map(label));
  return db.pointAuction.create({
    data: { title: input.title, imageUrl: input.imageUrl ?? "", optionsJson: JSON.stringify(opts), group, pollMessageId: pollId, endsAt },
  });
}

/** Voto na enquete do Leilão de Pontos (chamado pelo webhook). */
export async function registerPointVote(input: { pollMessageId: string; phone: string; name: string; options: string[] }) {
  const a = await db.pointAuction.findFirst({ where: { pollMessageId: input.pollMessageId } });
  if (!a) return { ok: false, reason: "enquete não encontrada" };
  if (a.status !== "ATIVO" || new Date() > a.endsAt) return { ok: false, reason: "leilão de pontos encerrado" };
  const phone = phoneKey(input.phone);
  if (phone === phoneKey(WHATSAPP_NUMBER)) return { ok: false, reason: "voto da loja ignorado" };
  const opts = parseOpts(a.optionsJson);
  const values = input.options.map((o) => opts.find((v) => o === label(v) || o === hash(label(v)))).filter((v): v is number => v !== undefined);
  if (values.length === 0) {
    await db.pointBid.deleteMany({ where: { auctionId: a.id, phone } });
    return { ok: true, removed: true };
  }
  const points = Math.max(...values);
  const prev = await db.pointBid.findUnique({ where: { auctionId_phone: { auctionId: a.id, phone } } });
  if (prev?.points === points) return { ok: true, unchanged: true };
  await db.pointBid.upsert({
    where: { auctionId_phone: { auctionId: a.id, phone } },
    create: { auctionId: a.id, phone, name: input.name, points },
    update: { points, name: input.name || prev?.name || "", votedAt: new Date() },
  });
  return { ok: true, points };
}

/** Encerra leilões de pontos vencidos (chamado pelo agendador a cada minuto). */
export async function closePointAuctions() {
  const due = await db.pointAuction.findMany({ where: { status: "ATIVO", endsAt: { lte: new Date() } }, include: { bids: true } });
  for (const a of due) {
    await db.pointAuction.update({ where: { id: a.id }, data: { status: "ENCERRADO" } });
    // confere a enquete na Whapi (votos cujo aviso se perdeu ou que mudaram)
    try {
      const opts = parseOpts(a.optionsJson);
      for (const r of await whapiPollResults(a.pollMessageId)) {
        const v = opts.find((x) => r.name === label(x));
        if (v === undefined) continue;
        for (const voter of r.voters) {
          const ph = phoneKey(voter);
          if (ph === phoneKey(WHATSAPP_NUMBER)) continue;
          const b = a.bids.find((x) => x.phone === ph);
          if (!b) a.bids.push(await db.pointBid.create({ data: { auctionId: a.id, phone: ph, points: v } }));
          else if (b.points !== v) Object.assign(b, await db.pointBid.update({ where: { id: b.id }, data: { points: v, votedAt: new Date() } }));
        }
      }
    } catch (e) {
      await log("erro-leilao-pontos", { leilao: a.id, error: String(e) });
    }
    // maior lance válido: membro do grupo e com saldo no encerramento
    const pc = await getPointsConfig();
    const sorted = [...a.bids].sort((x, y) => y.points - x.points || x.votedAt.getTime() - y.votedAt.getTime());
    let winner: (typeof sorted)[number] | null = null;
    const skipped: string[] = [];
    for (const b of sorted) {
      if ((await isMember(b.phone)) && (await balance(b.phone)) >= b.points && (pc.auctionMinSpend <= 0 || (await recentSpend(b.phone, pc)) >= pc.auctionMinSpend)) {
        winner = b;
        break;
      }
      skipped.push(`@${b.phone}`);
    }
    if (!winner) {
      await sendText(a.group, `🪙 Leilão de Pontos *${a.title}* encerrado sem lances válidos.`).catch(() => {});
      continue;
    }
    const red = await db.redemption.create({
      data: { phone: winner.phone, name: winner.name, rewardKey: `leilao-${a.id}`, rewardName: `Leilão de Pontos: ${a.title}`, points: winner.points },
    });
    await db.pointEntry.create({ data: { phone: winner.phone, name: winner.name, points: -winner.points, source: "RESGATE", note: `Leilão de Pontos: ${a.title}`, refId: `RED-${red.id}` } });
    await db.pointAuction.update({ where: { id: a.id }, data: { winnerPhone: winner.phone, winnerName: winner.name, winnerPoints: winner.points } });
    const who = winner.name ? winner.name.split(" ")[0] : `…${winner.phone.slice(-4)}`;
    await sendText(
      a.group,
      `🏁 *Leilão de Pontos encerrado!*\n🎁 ${a.title}\n🏆 *${who}* levou por *${winner.points} pontos*! 🎉${skipped.length ? `\n_(Lances maiores sem saldo ou sem a compra mínima foram desconsiderados.)_` : ""}\n\nA loja vai falar com você para entregar.`,
    ).catch(() => {});
  }
  return due.length;
}
