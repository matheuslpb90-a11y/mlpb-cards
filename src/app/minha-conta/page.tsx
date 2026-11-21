import Link from "next/link";
import { profileComplete, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { STATUS_LABEL } from "@/lib/orders";
import { whatsappLink } from "@/lib/whatsapp";
import { logoutAction } from "../actions";
import { boxBalance, boxUrl, BOX_STATUS, freeShippingCents } from "@/lib/boxes";
import { phoneVariants } from "@/lib/phone";
import { ProfileForm } from "./ProfileForm";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser("/minha-conta");
  const orders = await db.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { items: true } });
  const [boxes, free] = await Promise.all([
    db.box.findMany({
      where: { archived: false, OR: [{ userId: user.id }, ...(user.phone ? [{ phone: { in: phoneVariants(user.phone) } }] : [])] },
      include: { orders: true, invoices: true },
      orderBy: { createdAt: "desc" },
    }),
    freeShippingCents(),
  ]);
  const accumulated = orders.filter((o) => o.status === "ACUMULANDO" && !o.boxId);
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

      {!profileComplete(user) && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-amber-700 bg-amber-950/50 p-4">
          <p>Seu cadastro está incompleto. Para comprar, confirme <strong>nome completo, CPF, telefone e endereço</strong>.</p>
          <Link href="/completar-cadastro" className="btn-primary">Completar cadastro</Link>
        </div>
      )}
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
        <p>🔐 Verificação em duas etapas: {user.totpEnabled ? <strong className="text-green-300">ativada</strong> : <strong className="text-amber-300">desativada</strong>}</p>
        <Link href="/minha-conta/seguranca" className="btn-outline">Segurança da conta</Link>
      </div>

      {accumulated.length > 0 && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-amber-700 bg-amber-950/50 p-4">
          <p>
            Você tem <strong>{accumulated.length} pedido(s) acumulado(s)</strong> com {accumulatedCards} carta(s) guardadas na loja.
          </p>
          <a href={shipRequest} target="_blank" rel="noreferrer" className="btn-whats">Solicitar envio dos acumulados</a>
        </div>
      )}

      {boxes.length > 0 && (
        <section className="card divide-y">
          <h2 className="p-4 font-semibold">📦 Minhas caixas</h2>
          {boxes.map((b) => {
            const bal = boxBalance(b);
            return (
              <a key={b.id} href={boxUrl(b)} className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-slate-100">
                <span><strong>Caixa #{b.code}</strong> <span className="text-sm text-slate-500">· {BOX_STATUS[b.status]}</span></span>
                <span className="text-sm text-slate-500">{bal >= free ? "Frete grátis ✔" : `faltam ${formatBRL(free - bal)} p/ frete grátis`}</span>
                <span className="font-bold text-brand">{formatBRL(bal)}</span>
              </a>
            );
          })}
        </section>
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
