import Link from "next/link";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { STATUS_LABEL } from "@/lib/orders";
import { whatsappLinkTo } from "@/lib/whatsapp";
import { OrderControls } from "./OrderControls";

export const dynamic = "force-dynamic";

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const orders = await db.order.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
    include: { user: true, items: true },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap gap-1 p-2 text-sm">
        <Link href="/admin/pedidos" className={`rounded-lg px-3 py-1 ${!status ? "bg-brand text-white" : "hover:bg-slate-100"}`}>Todos</Link>
        {Object.entries(STATUS_LABEL).map(([k, l]) => (
          <Link key={k} href={`/admin/pedidos?status=${k}`} className={`rounded-lg px-3 py-1 ${status === k ? "bg-brand text-white" : "hover:bg-slate-100"}`}>{l}</Link>
        ))}
      </div>

      {orders.length === 0 && <div className="card p-6 text-center text-slate-500">Nenhum pedido.</div>}

      {orders.map((o) => (
        <div key={o.id} className="card space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <Link href={`/pedido/${o.code}`} className="text-lg font-bold text-brand hover:underline">#{o.code}</Link>
              <span className="ml-2 text-sm text-slate-500">{o.createdAt.toLocaleString("pt-BR")}</span>
              <p className="text-sm">
                {o.user.name} · {o.user.email} ·{" "}
                <a className="text-whats underline" target="_blank" rel="noreferrer" href={whatsappLinkTo(o.user.phone, `Olá, ${o.user.name.split(" ")[0]}! Sobre o seu pedido #${o.code} na MLPB Cards:`)}>
                  {o.user.phone}
                </a>
              </p>
              <p className="text-xs text-slate-500">
                {o.user.street}, {o.user.number} {o.user.complement} · {o.user.neighborhood} · {o.user.city}/{o.user.state} · CEP {o.user.cep}
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold">{formatBRL(o.totalCents)}</p>
              <p className="text-xs text-slate-500">Frete: {o.shippingMethod === "ACUMULAR" ? "acumular" : `${o.shippingMethod} ${formatBRL(o.shippingCents)}`}</p>
            </div>
          </div>
          <ul className="text-sm text-slate-700">
            {o.items.map((i) => <li key={i.id}>{i.quantity}x {i.name} — {formatBRL(i.priceCents * i.quantity)}</li>)}
          </ul>
          <OrderControls key={o.id} id={o.id} status={o.status} tracking={o.trackingCode} labels={STATUS_LABEL} receiptUrl={o.receiptUrl} />
        </div>
      ))}
    </div>
  );
}
