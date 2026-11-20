import "server-only";
import { randomBytes } from "crypto";
import { db } from "./db";
import { formatBRL } from "./money";
import { siteUrl } from "./orders";
import { sendText, zapiEnabled } from "./zapi";
import { freeShippingCents } from "./free-shipping";
import { phoneKey, phoneVariants } from "./phone";

export const BOX_STATUS: Record<string, string> = {
  PENDENTE: "Pendente",
  FRETE_SOLICITADO: "Frete solicitado",
  EM_SEPARACAO: "Em separação",
  ENVIADA: "Enviada",
  PRESENCIAL: "Presencial",
  CONCLUIDA: "Concluída",
};
export const BOX_STATUS_COLOR: Record<string, string> = {
  PENDENTE: "bg-green-950/60 text-green-300",
  FRETE_SOLICITADO: "bg-amber-950/60 text-amber-300",
  EM_SEPARACAO: "bg-teal-950/60 text-teal-300",
  ENVIADA: "bg-blue-950/60 text-blue-300",
  PRESENCIAL: "bg-purple-950/60 text-purple-300",
  CONCLUIDA: "bg-slate-200 text-slate-600",
};

export { freeShippingCents };

export const boxUrl = (b: { code: number; token: string }) => `${siteUrl()}/caixa/${b.code}?t=${b.token}`;

type BoxWithEntries = {
  orders: { subtotalCents: number; status: string }[];
  invoices: { totalCents: number; status: string }[];
};

/** Saldo da caixa = arremates pagos + compras "acumular" pagas. */
export function boxBalance(b: BoxWithEntries) {
  return (
    b.invoices.filter((i) => i.status === "PAGO").reduce((s, i) => s + i.totalCents, 0) +
    b.orders.filter((o) => o.status !== "CANCELADO" && o.status !== "AGUARDANDO_PAGAMENTO").reduce((s, o) => s + o.subtotalCents, 0)
  );
}
export const boxParticipations = (b: BoxWithEntries) =>
  b.invoices.filter((i) => i.status === "PAGO").length + b.orders.filter((o) => o.status !== "CANCELADO" && o.status !== "AGUARDANDO_PAGAMENTO").length;

/** Caixa aberta (Pendente) do cliente — cria uma nova se não houver. */
async function openBoxFor(phone: string, name: string, userId?: string) {
  const p = phoneKey(phone);
  const existing = await db.box.findFirst({
    where: { status: "PENDENTE", archived: false, OR: [{ phone: { in: phoneVariants(phone) } }, ...(userId ? [{ userId }] : [])] },
    orderBy: { createdAt: "asc" },
  });
  if (existing) {
    if ((!existing.name && name) || (!existing.userId && userId))
      await db.box.update({ where: { id: existing.id }, data: { name: existing.name || name, userId: existing.userId || userId } });
    return existing;
  }
  const last = await db.box.findFirst({ orderBy: { code: "desc" }, select: { code: true } });
  return db.box.create({
    data: { code: (last?.code ?? 6000) + 1, token: randomBytes(8).toString("hex"), phone: p, name, userId: userId ?? null },
  });
}

export async function addInvoiceToBox(invoiceId: string) {
  const inv = await db.invoice.findUnique({ where: { id: invoiceId } });
  if (!inv || inv.boxId || inv.status !== "PAGO") return null;
  const user = await db.user.findFirst({ where: { phone: { in: phoneVariants(inv.phone) } } });
  const box = await openBoxFor(inv.phone, inv.name, user?.id);
  await db.invoice.update({ where: { id: inv.id }, data: { boxId: box.id } });
  return box;
}

export async function addOrderToBox(orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { user: true } });
  if (!order || order.boxId || order.shippingMethod !== "ACUMULAR" || order.status === "AGUARDANDO_PAGAMENTO" || order.status === "CANCELADO") return null;
  const box = await openBoxFor(order.user.phone, order.user.name, order.userId);
  await db.order.update({ where: { id: order.id }, data: { boxId: box.id } });
  return box;
}

/** Itens da caixa para exibir (pedidos do site + arremates). */
export async function boxDetails(boxId: string) {
  const box = await db.box.findUnique({
    where: { id: boxId },
    include: { orders: { include: { items: true }, orderBy: { createdAt: "asc" } }, invoices: { include: { auction: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!box) return null;
  const entries = [
    ...box.invoices.filter((i) => i.status === "PAGO").map((i) => ({
      key: `i${i.id}`, date: i.paidAt ?? i.createdAt, source: i.auction?.name ?? `Invoice #${i.code}`, total: i.totalCents,
      items: (JSON.parse(i.itemsJson) as { title: string; cents: number }[]).map((x) => ({ title: x.title, cents: x.cents })),
    })),
    ...box.orders.filter((o) => o.status !== "CANCELADO" && o.status !== "AGUARDANDO_PAGAMENTO").map((o) => ({
      key: `o${o.id}`, date: o.paidAt ?? o.createdAt, source: `Pedido #${o.code} no site`, total: o.subtotalCents,
      items: o.items.map((x) => ({ title: `${x.quantity}x ${x.name}`, cents: x.priceCents * x.quantity })),
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
  return { box, entries, balance: boxBalance(box), threshold: await freeShippingCents() };
}

/** Avisa o cliente pelo WhatsApp (se a Z-API estiver ligada). */
export async function notifyBox(boxId: string, kind: "enviada" | "separacao" | "link") {
  if (!zapiEnabled()) return false;
  const box = await db.box.findUnique({ where: { id: boxId } });
  if (!box) return false;
  const first = box.name ? `, ${box.name.split(" ")[0]}` : "";
  const msg =
    kind === "enviada"
      ? `📦 Olá${first}! Sua caixa #${box.code} da MLPB Cards foi *enviada*!${box.trackingCode ? `\nCódigo de rastreio: *${box.trackingCode}*` : ""}\n\nAcompanhe: ${boxUrl(box)}`
      : kind === "separacao"
        ? `📦 Olá${first}! Sua caixa #${box.code} está *em separação*. Avisaremos quando for enviada.\n${boxUrl(box)}`
        : `📦 Olá${first}! Esta é a sua caixa na MLPB Cards — acompanhe o saldo e peça o envio por aqui:\n${boxUrl(box)}`;
  await sendText(box.phone, msg);
  return true;
}

export const daysOpen = (b: { createdAt: Date; closedAt: Date | null }) =>
  Math.max(0, Math.floor(((b.closedAt ?? new Date()).getTime() - b.createdAt.getTime()) / 86400000));

export const fmtBalance = formatBRL;

/** Quantidade de cartas/itens na caixa (para cotar o frete). */
export async function boxItemCount(boxId: string) {
  const d = await boxDetails(boxId);
  if (!d) return 0;
  return d.entries.reduce((s, e) => s + e.items.reduce((a, i) => a + (Number(i.title.match(/^(\d+)x /)?.[1]) || 1), 0), 0);
}

export async function markBoxShippingPaid(code: number, info: { transactionNsu?: string; paidAmountCents?: number }) {
  const box = await db.box.findUnique({ where: { code } });
  if (!box || box.shippingPaid) return box;
  if (info.paidAmountCents !== undefined && info.paidAmountCents < box.shippingCents) return box;
  const updated = await db.box.update({
    where: { id: box.id },
    data: { shippingPaid: true, status: box.status === "PENDENTE" ? "FRETE_SOLICITADO" : box.status, requestedAt: box.requestedAt ?? new Date(), notes: box.notes + (info.transactionNsu ? `\nFrete pago (InfinitePay ${info.transactionNsu})` : "") },
  });
  // frete pago: gera a etiqueta na SuperFrete
  const { autoLabel } = await import("./labels");
  await autoLabel({ kind: "box", id: box.id });
  return db.box.findUnique({ where: { id: box.id } }).then((b) => b ?? updated);
}

/** Coloca nas caixas os arremates/pedidos pagos que ainda não estão em nenhuma (ex.: dados antigos). */
export async function backfillBoxes() {
  const invs = await db.invoice.findMany({ where: { status: "PAGO", boxId: null }, select: { id: true } });
  for (const i of invs) await addInvoiceToBox(i.id);
  const orders = await db.order.findMany({ where: { boxId: null, shippingMethod: "ACUMULAR", status: { in: ["ACUMULANDO", "PAGO", "ENVIADO"] } }, select: { id: true } });
  for (const o of orders) await addOrderToBox(o.id);
}
