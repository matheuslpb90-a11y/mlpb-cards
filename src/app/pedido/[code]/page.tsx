import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { STATUS_LABEL } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await requireUser(`/pedido/${code}`);
  const order = await db.order.findUnique({ where: { code: Number(code) || -1 }, include: { items: true, box: true } });
  if (!order || (order.userId !== user.id && user.role !== "ADMIN")) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/minha-conta" className="text-sm text-brand hover:underline">← Meus pedidos</Link>
      <div className="card space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">Pedido #{order.code}</h1>
          <span className="rounded-full bg-brand-light px-3 py-1 text-sm font-semibold text-brand">{STATUS_LABEL[order.status] ?? order.status}</span>
        </div>
        <ul className="divide-y text-sm">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between py-2"><span>{i.quantity}x {i.name}</span><span>{formatBRL(i.priceCents * i.quantity)}</span></li>
          ))}
        </ul>
        <div className="space-y-1 border-t pt-3 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatBRL(order.subtotalCents)}</span></div>
          <div className="flex justify-between"><span>Frete ({order.shippingMethod === "ACUMULAR" ? "acumulado" : order.shippingMethod})</span><span>{formatBRL(order.shippingCents)}</span></div>
          <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{formatBRL(order.totalCents)}</span></div>
        </div>
        {order.box && (
          <a href={`/caixa/${order.box.code}?t=${order.box.token}`} className="block rounded-lg bg-brand/15 p-3 text-sm text-brand">📦 Este pedido está na sua caixa #{order.box.code} — ver caixa e pedir envio →</a>
        )}
        {order.trackingCode && <p className="text-sm">Código de rastreio: <strong>{order.trackingCode}</strong></p>}
        {order.receiptUrl && <a href={order.receiptUrl} target="_blank" rel="noreferrer" className="text-sm text-brand hover:underline">Ver comprovante</a>}
        {order.status === "AGUARDANDO_PAGAMENTO" && order.paymentUrl && (
          <a href={order.paymentUrl} className="btn-primary w-full">Pagar agora</a>
        )}
      </div>
    </div>
  );
}
