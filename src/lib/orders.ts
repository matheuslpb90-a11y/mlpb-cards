import "server-only";
import { db } from "./db";
import { ACCUMULATE, quoteShipping } from "./shipping";
import { createCheckoutLink, infinitePayEnabled } from "./infinitepay";
import type { User } from "@prisma/client";

export type CartLine = { cardId: string; quantity: number };

export const STATUS_LABEL: Record<string, string> = {
  AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
  PAGO: "Pago — preparando envio",
  ACUMULANDO: "Pago — acumulado na loja",
  ENVIADO: "Enviado",
  CANCELADO: "Cancelado",
};

export function siteUrl() {
  const url =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    "http://localhost:3000";
  return url.replace(/\/$/, "");
}

/** Cria o pedido reservando o estoque e devolve a URL para pagamento. */
/** Soma as cartas do carrinho com os preços atuais do banco (para cotar o frete). */
export async function cartTotals(lines: CartLine[]) {
  const ids = [...new Set(lines.map((l) => l.cardId))];
  const cards = await db.card.findMany({ where: { id: { in: ids }, active: true }, select: { id: true, priceCents: true } });
  let totalCards = 0;
  let subtotalCents = 0;
  for (const l of lines) {
    const c = cards.find((x) => x.id === l.cardId);
    if (!c || !Number.isInteger(l.quantity) || l.quantity < 1) continue;
    totalCards += l.quantity;
    subtotalCents += c.priceCents * l.quantity;
  }
  return { totalCards, subtotalCents };
}

export async function placeOrder(user: User, lines: CartLine[], shippingId: string) {
  const merged = new Map<string, number>();
  for (const l of lines) {
    if (!Number.isInteger(l.quantity) || l.quantity < 1) throw new Error("Quantidade inválida");
    merged.set(l.cardId, (merged.get(l.cardId) ?? 0) + l.quantity);
  }
  if (merged.size === 0) throw new Error("Seu carrinho está vazio");

  // Cota o frete no servidor (o valor nunca vem do navegador).
  const totals = await cartTotals(lines);
  const shipping = (await quoteShipping(user.cep, totals.totalCards, totals.subtotalCents)).find((o) => o.id === shippingId);
  if (!shipping) throw new Error("Forma de envio indisponível. Escolha novamente.");

  const order = await db.$transaction(async (tx) => {
    const cards = await tx.card.findMany({ where: { id: { in: [...merged.keys()] } } });
    const items = [...merged.entries()].map(([cardId, quantity]) => {
      const card = cards.find((c) => c.id === cardId);
      if (!card || !card.active) throw new Error("Uma das cartas não está mais disponível. Revise o carrinho.");
      if (card.stock < quantity)
        throw new Error(`Estoque insuficiente de "${card.name}" (disponível: ${card.stock}).`);
      return { card, quantity };
    });

    for (const { card, quantity } of items) {
      const updated = await tx.card.updateMany({
        where: { id: card.id, stock: { gte: quantity } },
        data: { stock: { decrement: quantity } },
      });
      if (updated.count === 0) throw new Error(`Estoque insuficiente de "${card.name}".`);
    }

    const subtotalCents = items.reduce((s, i) => s + i.card.priceCents * i.quantity, 0);
    const last = await tx.order.findFirst({ orderBy: { code: "desc" }, select: { code: true } });

    return tx.order.create({
      data: {
        code: (last?.code ?? 1000) + 1,
        userId: user.id,
        shippingMethod: shipping.id === ACCUMULATE ? ACCUMULATE : shipping.label,
        shippingCents: shipping.priceCents,
        subtotalCents,
        totalCents: subtotalCents + shipping.priceCents,
        items: {
          create: items.map(({ card, quantity }) => ({
            cardId: card.id,
            name: `${card.name} (${card.setName})`,
            priceCents: card.priceCents,
            quantity,
          })),
        },
      },
      include: { items: true },
    });
  });

  if (!infinitePayEnabled()) {
    const url = `/pagamento/demo/${order.code}`;
    await db.order.update({ where: { id: order.id }, data: { paymentUrl: url } });
    return url;
  }

  try {
    const items = order.items.map((i) => ({ description: i.name, quantity: i.quantity, priceCents: i.priceCents }));
    if (order.shippingCents > 0)
      items.push({ description: `Frete ${order.shippingMethod}`, quantity: 1, priceCents: order.shippingCents });
    const url = await createCheckoutLink({
      orderNsu: String(order.code),
      items,
      customer: { name: user.name, email: user.email, phone: user.phone },
      address: { cep: user.cep, number: user.number, complement: user.complement },
      redirectUrl: `${siteUrl()}/pagamento/retorno`,
      webhookUrl: `${siteUrl()}/api/webhooks/infinitepay`,
    });
    await db.order.update({ where: { id: order.id }, data: { paymentUrl: url } });
    return url;
  } catch (err) {
    await cancelOrder(order.id);
    throw err;
  }
}

/** Marca como pago (idempotente). Pedidos "ACUMULAR" ficam guardados na loja. */
export async function markOrderPaid(code: number, info: { transactionNsu?: string; receiptUrl?: string; paidAmountCents?: number }) {
  const order = await db.order.findUnique({ where: { code } });
  if (!order) return null;
  if (order.status !== "AGUARDANDO_PAGAMENTO") return order;
  if (info.paidAmountCents !== undefined && info.paidAmountCents < order.totalCents) {
    console.warn(`Pedido ${code}: valor pago (${info.paidAmountCents}) menor que o total (${order.totalCents}).`);
    return order;
  }
  return db.order.update({
    where: { id: order.id },
    data: {
      status: order.shippingMethod === ACCUMULATE ? "ACUMULANDO" : "PAGO",
      paidAt: new Date(),
      transactionNsu: info.transactionNsu ?? "",
      receiptUrl: info.receiptUrl ?? "",
    },
  });
}

/** Cancela e devolve as cartas ao estoque (somente pedidos ainda não pagos). */
export async function cancelOrder(orderId: string) {
  await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order || order.status !== "AGUARDANDO_PAGAMENTO") return;
    for (const item of order.items) {
      await tx.card.update({ where: { id: item.cardId }, data: { stock: { increment: item.quantity } } });
    }
    await tx.order.update({ where: { id: orderId }, data: { status: "CANCELADO" } });
  });
}
