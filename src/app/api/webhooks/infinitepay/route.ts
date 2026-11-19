import { NextResponse } from "next/server";
import { checkPayment, infinitePayEnabled } from "@/lib/infinitepay";
import { markOrderPaid } from "@/lib/orders";

// Webhook chamado pela InfinitePay quando um pagamento é aprovado.
// Por segurança, o pagamento é reconfirmado na API antes de atualizar o pedido.
export async function POST(req: Request) {
  if (!infinitePayEnabled()) return NextResponse.json({ ok: false }, { status: 404 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const orderNsu = String(body?.order_nsu ?? "");
  const transactionNsu = String(body?.transaction_nsu ?? "");
  const slug = String(body?.invoice_slug ?? body?.slug ?? "");
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
