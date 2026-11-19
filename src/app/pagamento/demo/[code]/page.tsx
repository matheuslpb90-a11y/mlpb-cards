import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { infinitePayEnabled } from "@/lib/infinitepay";
import { formatBRL } from "@/lib/money";
import { cancelOrder, markOrderPaid } from "@/lib/orders";

export const dynamic = "force-dynamic";

// Página usada apenas enquanto a InfinitePay não está configurada.
export default async function DemoPaymentPage({ params }: { params: Promise<{ code: string }> }) {
  if (infinitePayEnabled()) notFound();
  const { code } = await params;
  const user = await requireUser(`/pagamento/demo/${code}`);
  const order = await db.order.findUnique({ where: { code: Number(code) || -1 } });
  if (!order || order.userId !== user.id) notFound();

  async function approve() {
    "use server";
    const u = await requireUser();
    const o = await db.order.findUnique({ where: { code: Number(code) } });
    if (!o || o.userId !== u.id || infinitePayEnabled()) return;
    await markOrderPaid(o.code, { transactionNsu: "DEMO" });
    redirect(`/pedido/${o.code}`);
  }

  async function cancel() {
    "use server";
    const u = await requireUser();
    const o = await db.order.findUnique({ where: { code: Number(code) } });
    if (!o || o.userId !== u.id) return;
    await cancelOrder(o.id);
    redirect(`/pedido/${o.code}`);
  }

  return (
    <div className="card mx-auto max-w-md space-y-4 p-8 text-center">
      <p className="rounded bg-amber-950/60 p-2 text-sm text-amber-300">
        Modo demonstração: configure INFINITEPAY_HANDLE para receber pagamentos reais.
      </p>
      <h1 className="text-xl font-bold">Pedido #{order.code}</h1>
      <p className="text-3xl font-extrabold text-brand">{formatBRL(order.totalCents)}</p>
      {order.status === "AGUARDANDO_PAGAMENTO" ? (
        <div className="flex flex-col gap-2">
          <form action={approve}><button className="btn-primary w-full">Simular pagamento aprovado</button></form>
          <form action={cancel}><button className="btn-outline w-full">Cancelar pedido</button></form>
        </div>
      ) : (
        <Link href={`/pedido/${order.code}`} className="btn-primary">Ver pedido</Link>
      )}
    </div>
  );
}
