import Link from "next/link";
import { checkPayment, infinitePayEnabled } from "@/lib/infinitepay";
import { markOrderPaid } from "@/lib/orders";

export const dynamic = "force-dynamic";

type SP = Promise<{ order_nsu?: string; transaction_nsu?: string; slug?: string; receipt_url?: string }>;

// A InfinitePay redireciona para cá após o pagamento.
export default async function PaymentReturnPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const code = Number(sp.order_nsu);
  let paid = false;

  if (infinitePayEnabled() && code && sp.transaction_nsu && sp.slug) {
    const check = await checkPayment({ orderNsu: String(code), transactionNsu: sp.transaction_nsu, slug: sp.slug });
    if (check.paid) {
      const order = await markOrderPaid(code, { transactionNsu: sp.transaction_nsu, receiptUrl: sp.receipt_url, paidAmountCents: check.paidAmountCents });
      paid = !!order && order.status !== "AGUARDANDO_PAGAMENTO";
    }
  }

  return (
    <div className="card mx-auto max-w-lg space-y-4 p-8 text-center">
      {paid ? (
        <>
          <p className="text-5xl">🎉</p>
          <h1 className="text-2xl font-bold">Pagamento confirmado!</h1>
          <p className="text-slate-600">Obrigado pela compra. Você pode acompanhar o pedido na sua conta.</p>
        </>
      ) : (
        <>
          <p className="text-5xl">⏳</p>
          <h1 className="text-2xl font-bold">Estamos confirmando seu pagamento</h1>
          <p className="text-slate-600">Assim que a InfinitePay confirmar, o pedido será atualizado automaticamente.</p>
        </>
      )}
      <div className="flex justify-center gap-2">
        {code > 0 && <Link href={`/pedido/${code}`} className="btn-primary">Ver pedido #{code}</Link>}
        <Link href="/" className="btn-outline">Voltar ao catálogo</Link>
      </div>
    </div>
  );
}
