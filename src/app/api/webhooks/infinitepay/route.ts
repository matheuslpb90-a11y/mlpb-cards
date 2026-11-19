import { NextResponse } from "next/server";
import { checkPayment, infinitePayEnabled } from "@/lib/infinitepay";
import { markOrderPaid } from "@/lib/orders";
import { markInvoicePaid } from "@/lib/auctions";
import { markBoxShippingPaid } from "@/lib/boxes";
import { db } from "@/lib/db";

// Webhook chamado pela InfinitePay quando um pagamento é aprovado.
// Por segurança, o pagamento é reconfirmado na API antes de atualizar o pedido.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const orderNsu = String(body?.order_nsu ?? "");
  const transactionNsu = String(body?.transaction_nsu ?? "");
  const slug = String(body?.invoice_slug ?? body?.slug ?? "");

  // frete da caixa: order_nsu = "B" + código
  if (orderNsu.startsWith("B")) {
    const code = Number(orderNsu.slice(1));
    if (!code || !transactionNsu || !slug) return NextResponse.json({ ok: false, error: "payload incompleto" }, { status: 400 });
    const check = await checkPayment({ orderNsu, transactionNsu, slug });
    if (!check.paid) return NextResponse.json({ ok: false, error: "pagamento não confirmado" }, { status: 400 });
    await markBoxShippingPaid(code, { transactionNsu, paidAmountCents: check.paidAmountCents });
    return NextResponse.json({ ok: true });
  }

  // invoices de leilão: order_nsu = "F" + código
  if (orderNsu.startsWith("F")) {
    const code = Number(orderNsu.slice(1));
    const inv = code ? await db.invoice.findUnique({ where: { code }, include: { auction: true } }) : null;
    if (!inv || !transactionNsu || !slug) return NextResponse.json({ ok: false, error: "payload incompleto" }, { status: 400 });
    const check = await checkPayment({ handle: inv.auction?.infinitepayHandle || undefined, orderNsu, transactionNsu, slug });
    if (!check.paid) return NextResponse.json({ ok: false, error: "pagamento não confirmado" }, { status: 400 });
    await markInvoicePaid(code, { transactionNsu, receiptUrl: typeof body?.receipt_url === "string" ? body.receipt_url : undefined, paidAmountCents: check.paidAmountCents });
    return NextResponse.json({ ok: true });
  }

  if (!infinitePayEnabled()) return NextResponse.json({ ok: false }, { status: 404 });
  const code = Number(orderNsu);
  if (!code || !transactionNsu || !slug) return NextResponse.json({ ok: false, error: "payload incompleto" }, { status: 400 });

  const check = await checkPayment({ orderNsu, transactionNsu, slug });
  if (!check.paid) return NextResponse.json({ ok: false, error: "pagamento não confirmado" }, { status: 400 });

  await markOrderPaid(code, {
    transactionNsu,
    receiptUrl: typeof body?.receipt_url === "string" ? body.receipt_url : undefined,
    paidAmountCents: check.paidAmountCents,
  });
  return NextResponse.json({ ok: true });
}
