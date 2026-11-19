import "server-only";
import type { AuctionItem } from "@prisma/client";
import { db } from "./db";
import { formatBRL } from "./money";
import { log, sendImage, sendPoll, sendText, sendVideo } from "./zapi";
import { phoneKey } from "./phone";
import { siteUrl } from "./orders";

export const AUCTION_STATUS: Record<string, string> = {
  AGENDADO: "Agendado",
  ATIVO: "Ativo",
  ENCERRADO: "Encerrado",
  CANCELADO: "Cancelado",
};

export type Media = { url: string; type: "image" | "video" };

export const parseJson = <T,>(s: string, fallback: T): T => {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
};
export const itemOptions = (it: { optionsJson: string }) => parseJson<number[]>(it.optionsJson, []);
export const itemMedia = (it: { mediaJson: string }) => parseJson<Media[]>(it.mediaJson, []);

export const optionLabel = (cents: number, buyout = false) => (buyout ? `${formatBRL(cents)} (arremate)` : formatBRL(cents));

function parseOptionCents(label: string): number | null {
  const m = label.replace(/\s/g, "").match(/([\d.]+(?:,\d{1,2})?)/);
  if (!m) return null;
  const v = Number(m[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(v) ? Math.round(v * 100) : null;
}

const absolute = (url: string) => (url.startsWith("http") ? url : `${siteUrl()}${url}`);
export const fmtDate = (d: Date) =>
  d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

async function groupId() {
  const s = await db.setting.findUnique({ where: { key: "botGroupId" } });
  if (!s?.value) throw new Error("Grupo do WhatsApp não escolhido (Painel → Bot WhatsApp).");
  return s.value;
}

export function itemTitle(it: Pick<AuctionItem, "name" | "number" | "finish" | "graded">) {
  return `${it.name}${it.number ? ` (${it.number})` : ""}${it.finish !== "Normal" ? ` ${it.finish}` : ""}${it.graded ? " 💎 Graduada" : ""}`;
}

/** Abre o leilão: posta a abertura, o spoiler de cada lote e uma enquete por carta. */
export async function startAuction(auctionId: string) {
  const a = await db.auction.findUnique({
    where: { id: auctionId },
    include: { lots: { orderBy: { position: "asc" }, include: { items: { orderBy: { position: "asc" } } } } },
  });
  if (!a || a.status !== "AGENDADO") return;
  const group = await groupId();
  await db.auction.update({ where: { id: a.id }, data: { status: "ATIVO" } });

  const opening = [
    `🔥 *${a.name}* começou!`,
    a.description,
    "",
    "🗳️ Vote no valor que quer pagar em cada enquete.",
    "🏆 Vence o maior valor — empate: quem votou primeiro.",
    `⏰ Encerra: *${fmtDate(a.endsAt)}*`,
    `💳 Pagamento em até ${a.paymentDays} dia(s) após o fim.`,
    "",
    `${siteUrl()}/leiloes/${a.code}`,
  ].filter((l, i) => i !== 1 || l).join("\n");
  if (a.imageUrl) await sendImage(group, absolute(a.imageUrl), opening);
  else await sendText(group, opening);

  for (const lot of a.lots) {
    if (lot.imageUrl) await sendImage(group, absolute(lot.imageUrl), `📦 *Lote ${lot.position}* — ${lot.title}`);
    else await sendText(group, `📦 *Lote ${lot.position}* — ${lot.title}`);
    for (const it of lot.items) {
      const hideMarket = lot.hideMarket || it.hideMarket;
      const hideBuyout = lot.hideBuyout || it.hideBuyout;
      const caption = [
        `*${lot.position}.${it.position}* — ${itemTitle(it)}`,
        `${it.condition} · ${it.language}`,
        it.note ? `📝 ${it.note}` : "",
        !hideMarket && it.marketCents > 0 ? `📊 Mercado: ${formatBRL(it.marketCents)}` : "",
        `🟢 Inicial: ${formatBRL(it.startCents)}${hideBuyout ? "" : ` · 🔨 Arremate: ${formatBRL(it.buyoutCents)}`}`,
      ].filter(Boolean).join("\n");
      const media = itemMedia(it);
      const first = it.imageUrl ? [{ url: it.imageUrl, type: "image" as const }, ...media] : media;
      if (first.length === 0) await sendText(group, caption);
      for (const [i, m] of first.entries()) {
        const cap = i === 0 ? caption : "";
        if (m.type === "video") await sendVideo(group, absolute(m.url), cap);
        else await sendImage(group, absolute(m.url), cap);
      }
      const opts = itemOptions(it);
      const pollId = await sendPoll(
        group,
        `${lot.position}.${it.position} — ${it.name}${it.number ? ` (${it.number})` : ""}`,
        opts.map((c, i) => optionLabel(c, !hideBuyout && i === opts.length - 1)),
      );
      await db.auctionItem.update({ where: { id: it.id }, data: { pollMessageId: pollId } });
    }
  }
}

/** Registra/atualiza o voto de alguém numa enquete (vindo do webhook). */
export async function registerVote(input: { pollMessageId: string; phone: string; name: string; options: string[] }) {
  const item = await db.auctionItem.findFirst({ where: { pollMessageId: input.pollMessageId }, include: { lot: { include: { auction: true } } } });
  if (!item) return { ok: false, reason: "enquete não encontrada" };
  const a = item.lot.auction;
  if (a.status !== "ATIVO" || new Date() > a.endsAt) return { ok: false, reason: "leilão fora do horário" };
  const phone = phoneKey(input.phone);
  const values = input.options.map(parseOptionCents).filter((v): v is number => v !== null);
  if (values.length === 0) {
    await db.auctionVote.deleteMany({ where: { itemId: item.id, phone } }); // retirou o voto
    return { ok: true, removed: true };
  }
  const optionCents = Math.max(...values);
  const existing = await db.auctionVote.findUnique({ where: { itemId_phone: { itemId: item.id, phone } } });
  if (existing?.optionCents === optionCents) return { ok: true, unchanged: true };
  await db.auctionVote.upsert({
    where: { itemId_phone: { itemId: item.id, phone } },
    create: { itemId: item.id, phone, name: input.name, optionCents },
    update: { optionCents, name: input.name || existing?.name || "", votedAt: new Date() },
  });
  return { ok: true };
}

/** Encerra: vencedor = maior valor (empate: quem votou primeiro); cria invoices e envia. */
export async function closeAuction(auctionId: string) {
  const a = await db.auction.findUnique({
    where: { id: auctionId },
    include: {
      lots: {
        orderBy: { position: "asc" },
        include: { items: { orderBy: { position: "asc" }, include: { votes: { orderBy: [{ optionCents: "desc" }, { votedAt: "asc" }] } } } },
      },
    },
  });
  if (!a || a.status !== "ATIVO") return;
  await db.auction.update({ where: { id: a.id }, data: { status: "ENCERRADO" } });

  const byWinner = new Map<string, { name: string; items: { title: string; cents: number }[] }>();
  const lines: string[] = [];
  for (const lot of a.lots) {
    for (const it of lot.items) {
      const label = `${lot.position}.${it.position} ${it.name}${it.number ? ` (${it.number})` : ""}`;
      const win = it.votes[0];
      if (!win) {
        lines.push(`${label}: sem lances`);
        continue;
      }
      await db.auctionItem.update({ where: { id: it.id }, data: { winnerPhone: win.phone, winnerName: win.name, winningCents: win.optionCents } });
      if (it.cardId) await db.card.updateMany({ where: { id: it.cardId, stock: { gt: 0 } }, data: { stock: { decrement: 1 } } });
      const w = byWinner.get(win.phone) ?? { name: win.name, items: [] };
      w.items.push({ title: `${label} · ${it.condition} · ${it.language}`, cents: win.optionCents });
      byWinner.set(win.phone, w);
      lines.push(`${label}: *${formatBRL(win.optionCents)}* — ${win.name || "…" + win.phone.slice(-4)}`);
    }
  }

  const dueAt = new Date(a.endsAt.getTime() + a.paymentDays * 24 * 60 * 60 * 1000);
  for (const [phone, w] of byWinner) {
    const last = await db.invoice.findFirst({ orderBy: { code: "desc" }, select: { code: true } });
    const inv = await db.invoice.create({
      data: {
        code: (last?.code ?? 5000) + 1,
        auctionId: a.id,
        phone,
        name: w.name,
        itemsJson: JSON.stringify(w.items),
        totalCents: w.items.reduce((s, i) => s + i.cents, 0),
        dueAt,
      },
    });
    await sendInvoice(inv.id).catch((e) => log("erro-invoice", { invoice: inv.code, error: String(e) }));
  }

  try {
    await sendText(await groupId(), `🏁 *${a.name}* encerrado!\n\n${lines.join("\n")}\n\nOs vencedores receberão o invoice no privado. Obrigado a todos! 🧡`);
  } catch (e) {
    await log("erro-resultado", { auction: a.code, error: String(e) });
  }
}

export async function sendInvoice(invoiceId: string) {
  const inv = await db.invoice.findUnique({ where: { id: invoiceId }, include: { auction: true } });
  if (!inv) return;
  const items = parseJson<{ title: string; cents: number }[]>(inv.itemsJson, []);
  const msg = [
    `Olá${inv.name ? `, ${inv.name.split(" ")[0]}` : ""}! 🧡 Aqui é a *MLPB Cards*.`,
    inv.auction ? `Você arrematou no *${inv.auction.name}*:` : "Segue seu invoice:",
    "",
    ...items.map((i) => `• ${i.title} — ${formatBRL(i.cents)}`),
    "",
    `*Total: ${formatBRL(inv.totalCents)}*`,
    `Vencimento: ${inv.dueAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
    "",
    `💳 Pague por Pix ou cartão: ${siteUrl()}/fatura/${inv.code}`,
    "",
    "Suas cartas podem ficar acumuladas na loja para um envio só. Dúvidas? É só responder aqui.",
  ].join("\n");
  await sendText(inv.phone, msg);
  await db.invoice.update({ where: { id: inv.id }, data: { sentAt: new Date() } });
}

/** Agendador (a cada minuto): abre e encerra leilões no horário. */
export async function runSchedule() {
  const now = new Date();
  const toStart = await db.auction.findMany({ where: { status: "AGENDADO", startsAt: { lte: now } }, select: { id: true } });
  const toClose = await db.auction.findMany({ where: { status: "ATIVO", endsAt: { lte: now } }, select: { id: true } });
  const done: string[] = [];
  for (const a of toStart) {
    try {
      await startAuction(a.id);
      done.push(`start ${a.id}`);
    } catch (e) {
      await log("erro-inicio", { auction: a.id, error: String(e) });
      await db.auction.update({ where: { id: a.id }, data: { status: "AGENDADO" } }); // tenta de novo no próximo minuto
    }
  }
  for (const a of toClose) {
    try {
      await closeAuction(a.id);
      done.push(`close ${a.id}`);
    } catch (e) {
      await log("erro-encerramento", { auction: a.id, error: String(e) });
    }
  }
  return done;
}

export async function markInvoicePaid(code: number, info: { transactionNsu?: string; receiptUrl?: string; paidAmountCents?: number }) {
  const inv = await db.invoice.findUnique({ where: { code } });
  if (!inv || inv.status !== "PENDENTE") return inv;
  if (info.paidAmountCents !== undefined && info.paidAmountCents < inv.totalCents) return inv;
  const updated = await db.invoice.update({
    where: { id: inv.id },
    data: { status: "PAGO", paidAt: new Date(), transactionNsu: info.transactionNsu ?? "", receiptUrl: info.receiptUrl ?? "" },
  });
  const { addInvoiceToBox, boxBalance, boxUrl, freeShippingCents } = await import("./boxes");
  const box = await addInvoiceToBox(updated.id).catch(() => null);
  let extra = "";
  if (box) {
    const full = await db.box.findUnique({ where: { id: box.id }, include: { orders: true, invoices: true } });
    const bal = full ? boxBalance(full) : 0;
    const free = await freeShippingCents();
    extra = `\n\n📦 Suas cartas foram para a sua *caixa #${box.code}* (saldo ${formatBRL(bal)}).${bal >= free ? " Frete grátis liberado! 🎉" : ` Faltam ${formatBRL(free - bal)} para o frete grátis.`}\nPeça o envio quando quiser: ${boxUrl(box)}`;
  }
  sendText(inv.phone, `✅ Pagamento do invoice #${inv.code} confirmado! Obrigado pela compra na MLPB Cards. 🧡${extra}`).catch(() => {});
  return updated;
}
