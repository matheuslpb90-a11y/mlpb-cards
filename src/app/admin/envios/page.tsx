import Link from "next/link";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { BOX_STATUS } from "@/lib/boxes";
import { getSender, guessService, senderComplete, SF_STATUS } from "@/lib/labels";
import { superFreteEnabled } from "@/lib/shipping";
import { LabelRow, PrintSelected, SenderForm } from "./LabelControls";

export const dynamic = "force-dynamic";

export default async function EnviosPage() {
  const sender = await getSender();
  const boxes = await db.box.findMany({
    where: { archived: false, shippingMethod: { notIn: ["", "RETIRADA"] }, OR: [{ status: { in: ["FRETE_SOLICITADO", "EM_SEPARACAO"] } }, { sfOrderId: { not: "" }, status: { not: "CONCLUIDA" } }] },
    orderBy: { requestedAt: "asc" },
    take: 100,
  });
  const orders = await db.order.findMany({
    where: { shippingMethod: { not: "ACUMULAR" }, OR: [{ status: "PAGO" }, { sfOrderId: { not: "" }, status: { not: "CANCELADO" } }] },
    include: { user: true },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  const addr = (a: { street?: string; number?: string; city?: string; state?: string; cep?: string } | null) =>
    a ? `${a.street}, ${a.number} · ${a.city}/${a.state} · CEP ${a.cep}` : "sem endereço";
  const rows = [
    ...boxes.map((b) => {
      const a = b.addressJson ? (JSON.parse(b.addressJson) as Record<string, string>) : null;
      return {
        kind: "box" as const, id: b.id, title: `Caixa #${b.code} — ${b.name || a?.name || "Sem nome"}`, href: `/admin/caixas/${b.id}`,
        sub: `${BOX_STATUS[b.status]} · ${b.shippingMethod}${b.shippingCents ? ` (${formatBRL(b.shippingCents)}${b.shippingPaid ? " pago" : " NÃO pago"})` : ""} · ${addr(a)}`,
        sfOrderId: b.sfOrderId, sfStatus: b.sfStatus, tracking: b.trackingCode, service: guessService(b.shippingMethod), canLabel: Boolean(a),
      };
    }),
    ...orders.map((o) => ({
      kind: "order" as const, id: o.id, title: `Pedido #${o.code} — ${o.user.name}`, href: `/pedido/${o.code}`,
      sub: `${o.shippingMethod} (${formatBRL(o.shippingCents)}) · ${addr(o.user)}`,
      sfOrderId: o.sfOrderId, sfStatus: o.sfStatus, tracking: o.trackingCode, service: guessService(o.shippingMethod), canLabel: true,
    })),
  ];
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">📮 Envios e etiquetas (SuperFrete)</h1>
      {!superFreteEnabled() && <p className="card p-4 text-amber-300">Configure o SUPERFRETE_TOKEN na Vercel para gerar etiquetas.</p>}
      <div className="card space-y-1 p-4 text-sm text-slate-500">
        <p>“Gerar etiqueta” cria o envio na SuperFrete e <strong>paga com o saldo da sua conta SuperFrete</strong> (coloque saldo por Pix no site deles).</p>
        <p>Depois de gerar: imprima, cole no pacote e poste nos Correios. O rastreio é salvo e aparece para o cliente.</p>
      </div>
      <SenderForm initial={sender} complete={senderComplete(sender)} />
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Para enviar ({rows.length})</h2>
          <PrintSelected ids={rows.filter((r) => r.sfOrderId && r.sfStatus !== "pending").map((r) => r.sfOrderId)} />
        </div>
        {rows.length === 0 && <div className="card p-6 text-center text-slate-500">Nada aguardando envio. 🎉</div>}
        {rows.map((r) => (
          <div key={r.kind + r.id} className="card flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <Link href={r.href} className="font-semibold hover:text-brand">{r.title}</Link>
              <p className="text-xs text-slate-500">{r.sub}</p>
              {r.sfOrderId && (
                <p className="text-xs text-slate-600">
                  Etiqueta {r.sfOrderId} · {SF_STATUS[r.sfStatus] ?? r.sfStatus}
                  {r.tracking ? <> · rastreio <strong>{r.tracking}</strong></> : null}
                </p>
              )}
            </div>
            <LabelRow kind={r.kind} id={r.id} hasLabel={Boolean(r.sfOrderId)} paid={Boolean(r.sfOrderId) && r.sfStatus !== "pending"} defaultService={r.service} canLabel={r.canLabel} />
          </div>
        ))}
      </section>
    </div>
  );
}
