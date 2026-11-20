import "server-only";
import type { AuctionItem } from "@prisma/client";
import { db } from "./db";
import { formatBRL } from "./money";
import { lastPollMap, log, sendImage, sendPoll, sendText, sendVideo, supportsPolls, zapiMode } from "./zapi";
import { whapiPollResults } from "./whapi";
import { phoneKey } from "./phone";
import { WHATSAPP_NUMBER } from "./whatsapp";
import { createHash } from "crypto";
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
  const mode = supportsPolls() ? "POLL" : "TEXT";
  await db.auction.update({ where: { id: a.id }, data: { status: "ATIVO", mode } });

  const howTo =
    mode === "POLL"
      ? ["🗳️ Vote no valor que quer pagar em cada enquete.", "🏆 Vence o maior valor — empate: quem votou primeiro."]
      : [
          "💬 Para dar lance, digite o *código da carta* e o *valor*. Ex.: *1.2 $55*",
          "🏆 Vence o maior lance — empate: quem mandou primeiro.",
          "🔨 Quem der o valor de arremate leva na hora.",
        ];
  const opening = [
    `🔥 *${a.name}* começou!`,
    a.description,
    "",
    ...howTo,
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
        mode === "TEXT" ? `➕ Incremento mínimo: ${formatBRL(it.stepCents)}\n💬 Lance: *${lot.position}.${it.position} $${(it.startCents / 100).toLocaleString("pt-BR")}*` : "",
      ].filter(Boolean).join("\n");
      const media = itemMedia(it);
      const first = it.imageUrl ? [{ url: it.imageUrl, type: "image" as const }, ...media] : media;
      if (first.length === 0) await sendText(group, caption);
      for (const [i, m] of first.entries()) {
        const cap = i === 0 ? caption : "";
        if (m.type === "video") await sendVideo(group, absolute(m.url), cap);
        else await sendImage(group, absolute(m.url), cap);
      }
      if (mode === "TEXT") continue;
      const opts = itemOptions(it);
      const pollId = await sendPoll(
        group,
        `${lot.position}.${it.position} — ${it.name}${it.number ? ` (${it.number})` : ""}`,
        opts.map((c, i) => optionLabel(c, !hideBuyout && i === opts.length - 1)),
      );
      await db.auctionItem.update({ where: { id: it.id }, data: { pollMessageId: pollId, pollMapJson: JSON.stringify(lastPollMap) } });
    }
  }
}

/**
 * Valor (centavos) de uma opção votada. A Whapi manda o id da opção, que é o SHA-256 (base64) do texto
 * exato da opção — então calculamos o id de cada opção do item e comparamos. Texto da opção também é aceito.
 * Nunca tenta "ler número" de um id desconhecido (isso gerava valores aleatórios).
 */
function optionCentsFor(item: { optionsJson: string; pollMapJson?: string }, opt: string): number | null {
  const opts = itemOptions(item);
  for (const c of opts)
    for (const label of [optionLabel(c), optionLabel(c, true)]) {
      if (opt === label || opt === createHash("sha256").update(label).digest("base64")) return c;
    }
  const saved = parseJson<Record<string, string>>(item.pollMapJson || "{}", {})[opt];
  const txt = saved ?? opt;
  if (!/R\$/.test(txt)) return null; // id desconhecido: ignora
  const v = parseOptionCents(txt);
  return v != null && opts.includes(v) ? v : null;
}

/** Registra/atualiza o voto de alguém numa enquete (vindo do webhook). */
export async function registerVote(input: { pollMessageId: string; phone: string; name: string; options: string[] }) {
  const item = await db.auctionItem.findFirst({ where: { pollMessageId: input.pollMessageId }, include: { lot: { include: { auction: true } } } });
  if (!item) return { ok: false, reason: "enquete não encontrada" };
  const a = item.lot.auction;
  if (a.status !== "ATIVO" || new Date() > a.endsAt) return { ok: false, reason: "leilão fora do horário" };
  const phone = phoneKey(input.phone);
  if (phone === phoneKey(WHATSAPP_NUMBER)) return { ok: false, reason: "voto do próprio número da loja (ignorado)" };
  const values = input.options.map((o) => optionCentsFor(item, o)).filter((v): v is number => v !== null);
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

const fmtCode = (lot: number, item: number) => `${lot}.${item}`;

/** Interpreta "1.2 $55", "1.2 55", "$55 1.2", "#1.2 R$ 55,00". Sem código: só vale se o leilão tiver 1 carta. */
export function parseBid(text: string): { code?: string; cents: number } | null {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length > 60) return null;
  const code = t.match(/(?:^|\s|#)(\d{1,2})\.(\d{1,3})(?=\s|$)/);
  const rest = code ? t.replace(code[0], " ") : t;
  const money = /(?:R?\$)\s*(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/i;
  const plain = /(?:^|\s)(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)(?=\s|$)/;
  const val = rest.match(money) ?? (code ? rest.match(plain) : null);
  if (!val) return null;
  const cents = Math.round(Number(val[1].replace(/\./g, "").replace(",", ".")) * 100);
  if (!Number.isFinite(cents) || cents <= 0) return null;
  return { code: code ? `${Number(code[1])}.${Number(code[2])}` : undefined, cents };
}

/** Lance por mensagem no grupo (modo TEXT). Responde no grupo confirmando ou recusando. */
export async function registerTextBid(input: { group: string; phone: string; name: string; text: string }) {
  const bid = parseBid(input.text);
  if (!bid) return { ok: false, reason: "não é lance" };
  const configured = await db.setting.findUnique({ where: { key: "botGroupId" } });
  if (!configured?.value || configured.value !== input.group) return { ok: false, reason: "outro grupo" };
  const a = await db.auction.findFirst({
    where: { status: "ATIVO", mode: "TEXT" },
    orderBy: { startsAt: "desc" },
    include: { lots: { include: { items: { include: { votes: { orderBy: [{ optionCents: "desc" }, { votedAt: "asc" }], take: 1 } } } } } },
  });
  if (!a || new Date() > a.endsAt) return { ok: false, reason: "sem leilão ativo" };
  const all = a.lots.flatMap((l) => l.items.map((it) => ({ lot: l, it })));
  const target = bid.code ? all.find((x) => fmtCode(x.lot.position, x.it.position) === bid.code) : all.length === 1 ? all[0] : undefined;
  if (!target) {
    if (bid.code) await sendText(input.group, `❌ Não encontrei a carta *${bid.code}* neste leilão.`).catch(() => {});
    return { ok: false, reason: "carta não encontrada" };
  }
  const { lot, it } = target;
  const code = fmtCode(lot.position, it.position);
  if (it.winningCents != null) {
    await sendText(input.group, `🔨 *${code}* ${it.name} já foi arrematada.`).catch(() => {});
    return { ok: false, reason: "arrematada" };
  }
  const top = it.votes[0];
  const min = top ? top.optionCents + it.stepCents : it.startCents;
  if (bid.cents < min) {
    await sendText(input.group, `❌ *${code}* ${it.name}: o lance mínimo agora é *${formatBRL(min)}*.`).catch(() => {});
    return { ok: false, reason: "abaixo do mínimo" };
  }
  const phone = phoneKey(input.phone);
  const cents = it.buyoutCents > 0 && bid.cents >= it.buyoutCents ? it.buyoutCents : bid.cents;
  await db.auctionVote.upsert({
    where: { itemId_phone: { itemId: it.id, phone } },
    create: { itemId: it.id, phone, name: input.name, optionCents: cents },
    update: { optionCents: cents, name: input.name, votedAt: new Date() },
  });
  const who = input.name || `…${phone.slice(-4)}`;
  if (it.buyoutCents > 0 && cents >= it.buyoutCents) {
    await db.auctionItem.update({ where: { id: it.id }, data: { winnerPhone: phone, winnerName: input.name, winningCents: cents } });
    await sendText(input.group, `🔨 *ARREMATADO!* ${code} ${it.name} — *${formatBRL(cents)}* (${who})`).catch(() => {});
  } else {
    await sendText(input.group, `✅ *${code}* ${it.name} — maior lance: *${formatBRL(cents)}* (${who})`).catch(() => {});
  }
  return { ok: true, code, cents };
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

  // Whapi: confere os votos direto na enquete (caso algum aviso de voto tenha se perdido)
  if (zapiMode() === "whapi" && a.mode === "POLL") {
    for (const lot of a.lots)
      for (const it of lot.items) {
        if (!it.pollMessageId) continue;
        try {
          const results = await whapiPollResults(it.pollMessageId);
          const known = new Set(it.votes.map((v) => v.phone));
          for (const r of results)
            for (const voter of r.voters) {
              const cents = optionCentsFor(it, r.name);
              const ph = phoneKey(voter);
              if (cents == null || ph === phoneKey(WHATSAPP_NUMBER)) continue;
              const prev = it.votes.find((v) => v.phone === ph);
              if (prev) {
                // A enquete é a fonte da verdade: se a pessoa trocou o voto e o aviso se perdeu, vale o atual
                if (prev.optionCents !== cents) {
                  await log("voto-corrigido", { item: it.id, phone: ph, de: prev.optionCents, para: cents });
                  Object.assign(prev, await db.auctionVote.update({ where: { id: prev.id }, data: { optionCents: cents, votedAt: new Date() } }));
                }
                continue;
              }
              if (known.has(ph)) continue;
              const v = await db.auctionVote.create({ data: { itemId: it.id, phone: ph, name: "", optionCents: cents } });
              it.votes.push(v);
            }
          it.votes.sort((x, y) => y.optionCents - x.optionCents || x.votedAt.getTime() - y.votedAt.getTime());
        } catch (e) {
          await log("erro-conferencia-enquete", { item: it.id, error: String(e) });
        }
      }
  }

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
  const { payAllNote } = await import("./paygroups");
  await sendText(inv.phone, msg + (await payAllNote(inv.phone).catch(() => "")));
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
  // MLPB Points: bônus do ranking do mês anterior (roda uma vez por mês)
  await import("./points").then((p) => p.payMonthlyRanking()).catch(() => {});
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

export async function markInvoicePaid(code: number, info: { transactionNsu?: string; receiptUrl?: string; paidAmountCents?: number; silent?: boolean }) {
  const inv = await db.invoice.findUnique({ where: { code } });
  if (!inv || inv.status !== "PENDENTE") return inv;
  if (info.paidAmountCents !== undefined && info.paidAmountCents < inv.totalCents) return inv;
  const updated = await db.invoice.update({
    where: { id: inv.id },
    data: { status: "PAGO", paidAt: new Date(), transactionNsu: info.transactionNsu ?? "", receiptUrl: info.receiptUrl ?? "" },
  });
  const { addInvoiceToBox } = await import("./boxes");
  const box = await addInvoiceToBox(updated.id).catch(() => null);
  // MLPB Points: arremate pago
  await import("./points")
    .then(({ creditPurchase }) => creditPurchase(inv.phone, inv.name, inv.totalCents, "LEILAO", `INV-${inv.code}`, `Invoice #${inv.code}`))
    .catch(() => {});
  if (!info.silent) sendText(inv.phone, `✅ Pagamento do invoice #${inv.code} confirmado! Obrigado pela compra na MLPB Cards. 🧡${await boxNote(box?.id)}`).catch(() => {});
  return updated;
}

/** Texto "suas cartas foram para a caixa #X..." para a mensagem de pagamento confirmado. */
export async function boxNote(boxId?: string | null) {
  if (!boxId) return "";
  const { boxBalance, boxUrl, freeShippingCents } = await import("./boxes");
  const full = await db.box.findUnique({ where: { id: boxId }, include: { orders: true, invoices: true } });
  if (!full) return "";
  const bal = boxBalance(full);
  const free = await freeShippingCents();
  return `\n\n📦 Suas cartas foram para a sua *caixa #${full.code}* (saldo ${formatBRL(bal)}).${bal >= free ? " Frete grátis liberado! 🎉" : ` Faltam ${formatBRL(free - bal)} para o frete grátis.`}\nPeça o envio quando quiser: ${boxUrl(full)}`;
}
