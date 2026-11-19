import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { STATUS_LABEL } from "@/lib/orders";
import { whatsappLink } from "@/lib/whatsapp";
import { logoutAction } from "../actions";
import { ProfileForm } from "./ProfileForm";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser("/minha-conta");
  const orders = await db.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { items: true } });
  const accumulated = orders.filter((o) => o.status === "ACUMULANDO");
  const accumulatedCards = accumulated.reduce((s, o) => s + o.items.reduce((a, i) => a + i.quantity, 0), 0);
  const shipRequest = whatsappLink(
    `Olá, MLPB Cards! Sou ${user.name} (${user.email}) e quero solicitar o envio dos meus pedidos acumulados: ${accumulated
      .map((o) => `#${o.code}`)
      .join(", ")} (${accumulatedCards} cartas). Pode me passar o valor do frete?`,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Minha conta</h1>
        <form action={logoutAction}><button className="btn-outline">Sair</button></form>
      </div>

      {accumulated.length > 0 && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-amber-300 bg-amber-50 p-4">
          <p>
            Você tem <strong>{accumulated.length} pedido(s) acumulado(s)</strong> com {accumulatedCards} carta(s) guardadas na loja.
          </p>
          <a href={shipRequest} target="_blank" rel="noreferrer" className="btn-whats">Solicitar envio dos acumulados</a>
        </div>
      )}

      <section className="card">
        <h2 className="border-b p-4 font-semibold">Meus pedidos</h2>
        {orders.length === 0 ? (
          <p className="p-4 text-slate-500">Você ainda não fez pedidos.</p>
        ) : (
          <ul className="divide-y">
            {orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                <div>
                  <Link href={`/pedido/${o.code}`} className="font-semibold text-brand hover:underline">Pedido #{o.code}</Link>
                  <p className="text-xs text-slate-500">{o.createdAt.toLocaleDateString("pt-BR")} · {o.items.length} item(ns) · {o.shippingMethod === "ACUMULAR" ? "Acumulado" : o.shippingMethod}</p>
                </div>
                <span className="text-sm">{STATUS_LABEL[o.status] ?? o.status}</span>
                <span className="font-bold">{formatBRL(o.totalCents)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="dados" className="card p-4">
        <h2 className="mb-3 font-semibold">Meus dados e endereço</h2>
        <ProfileForm
          user={{ name: user.name, phone: user.phone, cpf: user.cpf, cep: user.cep, street: user.street, number: user.number, complement: user.complement, neighborhood: user.neighborhood, city: user.city, state: user.state }}
        />
      </section>
    </div>
  );
}
