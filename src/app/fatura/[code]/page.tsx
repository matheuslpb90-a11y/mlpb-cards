import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { fmtDate, parseJson } from "@/lib/auctions";
import { createCheckoutLink, infinitePayEnabled } from "@/lib/infinitepay";
import { siteUrl } from "@/lib/orders";
import { whatsappLink } from "@/lib/whatsapp";
import { openPayGroup, pendingInvoicesFor } from "@/lib/paygroups";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoice — MLPB Cards", robots: { index: false } };

export default async function InvoicePage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ erro?: string }> }) {
  const { code } = await params;
  const { erro } = await searchParams;
  const inv = await db.invoice.findUnique({ where: { code: Number(code) || -1 }, include: { auction: true } });
  if (!inv) notFound();
  const items = parseJson<{ title: string; cents: number }[]>(inv.itemsJson, []);

  async function pay() {
    "use server";
    const i = await db.invoice.findUnique({ where: { id: inv!.id }, include: { auction: true } });
    if (!i || i.status !== "PENDENTE") redirect(`/fatura/${code}`);
    let url = "";
    try {
      if (!infinitePayEnabled() && !i.auction?.infinitepayHandle) throw new Error("demo");
      url = await createCheckoutLink({
        handle: i.auction?.infinitepayHandle || undefined,
        orderNsu: `F${i.code}`,
        items: parseJson<{ title: string; cents: number }[]>(i.itemsJson, []).map((x) => ({ description: x.title, quantity: 1, priceCents: x.cents })),
        customer: { name: i.name || "Cliente MLPB", phone: i.phone },
        redirectUrl: `${siteUrl()}/pagamento/retorno`,
        webhookUrl: `${siteUrl()}/api/webhooks/infinitepay`,
      });
      await db.invoice.update({ where: { id: i.id }, data: { paymentUrl: url } });
    } catch (e) {
      redirect(`/fatura/${code}?erro=${e instanceof Error && e.message === "demo" ? "demo" : "1"}`);
    }
    redirect(url);
  }

  const late = inv.status === "PENDENTE" && inv.dueAt < new Date();
  // outros invoices em aberto do mesmo cliente: oferece pagar tudo junto
  const others = inv.status === "PENDENTE" && !inv.auction?.infinitepayHandle ? await pendingInvoicesFor(inv.phone) : [];
  const group = others.length >= 2 ? await openPayGroup(inv.phone, inv.name) : null;
  return (
    <div className="card mx-auto max-w-lg space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Invoice #{inv.code}</h1>
        <span className={`rounded px-2 py-1 text-xs font-bold ${inv.status === "PAGO" ? "bg-green-950/60 text-green-300" : late ? "bg-red-950/60 text-red-300" : "bg-amber-950/50 text-amber-300"}`}>
          {inv.status === "PAGO" ? "Pago ✔" : inv.status === "CANCELADO" ? "Cancelado" : late ? "Vencido" : "Aguardando pagamento"}
        </span>
      </div>
      <p className="text-sm text-slate-600">{inv.name || "Cliente"}{inv.auction ? ` · ${inv.auction.name}` : ""}</p>
      <ul className="divide-y text-sm">
        {items.map((i, k) => <li key={k} className="flex justify-between gap-3 py-2"><span>{i.title}</span><span className="whitespace-nowrap">{formatBRL(i.cents)}</span></li>)}
      </ul>
      <div className="flex justify-between border-t pt-3 text-xl font-bold"><span>Total</span><span>{formatBRL(inv.totalCents)}</span></div>
      <p className="text-sm text-slate-500">Vencimento: {fmtDate(inv.dueAt)}</p>
      {erro === "demo" && <p className="rounded bg-amber-950/50 p-2 text-sm text-amber-300">Pagamento online não configurado. Fale com a loja.</p>}
      {erro === "1" && <p className="rounded bg-red-950/60 p-2 text-sm text-red-300">Não foi possível gerar o pagamento agora. Tente novamente ou fale com a loja.</p>}
      {inv.status === "PENDENTE" && (
        <form action={pay}><button className="btn-primary w-full py-3">Pagar com Pix ou cartão (InfinitePay)</button></form>
      )}
      {group && (
        <a href={`/pagar/${group.token}`} className="btn-outline w-full border-brand text-brand-amber">
          🧾 Pagar meus {others.length} invoices em aberto juntos ({formatBRL(others.reduce((s, i) => s + i.totalCents, 0))})
        </a>
      )}
      {inv.receiptUrl && <a href={inv.receiptUrl} target="_blank" rel="noreferrer" className="block text-sm text-brand underline">Ver comprovante</a>}
      <a href={whatsappLink(`Olá! Sobre o invoice #${inv.code}`)} target="_blank" rel="noreferrer" className="btn-outline w-full">Falar com a loja</a>
    </div>
  );
}
