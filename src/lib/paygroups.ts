import "server-only";
import { randomBytes } from "crypto";
import { db } from "./db";
import { formatBRL } from "./money";
import { phoneKey, phoneVariants } from "./phone";
import { siteUrl } from "./orders";

// Pagamento consolidado: o cliente paga todos os invoices pendentes de uma vez (um link só).
// Só entram invoices da conta InfinitePay padrão (leilões sem "conta InfinitePay" própria).

export const payGroupUrl = (g: { token: string }) => `${siteUrl()}/pagar/${g.token}`;

/** Invoices pendentes do cliente que podem ser pagos juntos. */
export async function pendingInvoicesFor(phone: string) {
  const list = await db.invoice.findMany({
    where: { status: "PENDENTE", phone: { in: phoneVariants(phone) } },
    include: { auction: { select: { name: true, infinitepayHandle: true } } },
    orderBy: { code: "asc" },
  });
  return list.filter((i) => !i.auction?.infinitepayHandle);
}

/** Grupo aberto do cliente (cria se não existir). */
export async function openPayGroup(phone: string, name = "") {
  const key = phoneKey(phone);
  const g = await db.paymentGroup.findFirst({ where: { phone: key, status: "ABERTO" }, orderBy: { createdAt: "desc" } });
  if (g) return g;
  for (let i = 0; i < 5; i++) {
    const last = await db.paymentGroup.findFirst({ orderBy: { code: "desc" }, select: { code: true } });
    try {
      return await db.paymentGroup.create({ data: { code: (last?.code ?? 9000) + 1, token: randomBytes(12).toString("hex"), phone: key, name } });
    } catch {
      /* código repetido (corrida): tenta de novo */
    }
  }
  throw new Error("Não foi possível criar o pagamento consolidado.");
}

/** Linha extra na cobrança: “você tem N invoices em aberto, pague tudo aqui”. Vazio se só houver 1. */
export async function payAllNote(phone: string) {
  const pend = await pendingInvoicesFor(phone);
  if (pend.length < 2) return "";
  const g = await openPayGroup(phone, pend[0]?.name ?? "");
  const total = pend.reduce((s, i) => s + i.totalCents, 0);
  return `\n\n🧾 Você tem *${pend.length} invoices em aberto*, somando *${formatBRL(total)}*. Pague tudo de uma vez: ${payGroupUrl(g)}`;
}

/** Mensagem só com o link de pagar tudo (botão no painel). */
export async function payAllMessage(phone: string) {
  const pend = await pendingInvoicesFor(phone);
  if (pend.length === 0) return null;
  const g = await openPayGroup(phone, pend[0]?.name ?? "");
  const total = pend.reduce((s, i) => s + i.totalCents, 0);
  const first = pend[0]?.name ? `, ${pend[0].name.split(" ")[0]}` : "";
  return [
    `Olá${first}! 🧡 Aqui é a *MLPB Cards*.`,
    `Você tem ${pend.length} invoice(s) em aberto:`,
    "",
    ...pend.map((i) => `• #${i.code}${i.auction ? ` (${i.auction.name})` : ""} — ${formatBRL(i.totalCents)}`),
    "",
    `*Total: ${formatBRL(total)}*`,
    `💳 Pague tudo de uma vez (Pix ou cartão): ${payGroupUrl(g)}`,
  ].join("\n");
}

/** Pagamento consolidado confirmado: dá baixa em todos os invoices incluídos e avisa o cliente uma vez só. */
export async function markPayGroupPaid(code: number, info: { transactionNsu?: string; paidAmountCents?: number }) {
  const g = await db.paymentGroup.findUnique({ where: { code } });
  if (!g || g.status !== "ABERTO") return g;
  if (info.paidAmountCents !== undefined && info.paidAmountCents < g.totalCents) return g;
  const ids = JSON.parse(g.invoiceIdsJson || "[]") as string[];
  const { markInvoicePaid, boxNote } = await import("./auctions");
  const invs = await db.invoice.findMany({ where: { id: { in: ids } }, select: { code: true } });
  for (const inv of invs) await markInvoicePaid(inv.code, { transactionNsu: info.transactionNsu ?? "", silent: true });
  const boxId = (await db.invoice.findFirst({ where: { id: { in: ids }, boxId: { not: null } }, select: { boxId: true } }))?.boxId ?? null;
  const updated = await db.paymentGroup.update({ where: { id: g.id }, data: { status: "PAGO", paidAt: new Date(), transactionNsu: info.transactionNsu ?? "" } });
  const { sendText } = await import("./zapi");
  sendText(
    g.phone,
    `✅ Pagamento de ${formatBRL(g.totalCents)} confirmado! Invoices quitados: ${invs.map((i) => `#${i.code}`).join(", ")}. Obrigado pela compra na MLPB Cards. 🧡${await boxNote(boxId)}`,
  ).catch(() => {});
  return updated;
}
