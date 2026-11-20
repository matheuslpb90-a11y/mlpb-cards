import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { fmtDate } from "@/lib/auctions";
import { pendingInvoicesFor } from "@/lib/paygroups";
import { createCheckoutLink, infinitePayEnabled } from "@/lib/infinitepay";
import { siteUrl } from "@/lib/orders";
import { whatsappLink } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pagar invoices — MLPB Cards", robots: { index: false } };

export default async function PayAllPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ erro?: string }> }) {
  const { token } = await params;
  const { erro } = await searchParams;
  const g = await db.paymentGroup.findUnique({ where: { token } });
  if (!g) notFound();

  if (g.status === "PAGO") {
    const ids = JSON.parse(g.invoiceIdsJson || "[]") as string[];
    const paid = await db.invoice.findMany({ where: { id: { in: ids } }, orderBy: { code: "asc" } });
    return (
      <div className="card mx-auto max-w-lg space-y-4 p-6 text-center">
        <p className="text-5xl">✅</p>
        <h1 className="text-2xl font-bold">Pagamento confirmado</h1>
        <p className="text-slate-600">{formatBRL(g.totalCents)} · invoices {paid.map((i) => `#${i.code}`).join(", ")}</p>
        <Link href="/" className="btn-outline">Voltar à loja</Link>
      </div>
    );
  }

  const pend = await pendingInvoicesFor(g.phone);
  const total = pend.reduce((s, i) => s + i.totalCents, 0);

  async function pay() {
    "use server";
    const grp = await db.paymentGroup.findUnique({ where: { token } });
    if (!grp || grp.status !== "ABERTO") redirect(`/pagar/${token}`);
    const list = await pendingInvoicesFor(grp.phone);
    if (list.length === 0) redirect(`/pagar/${token}`);
    let url = "";
    try {
      if (!infinitePayEnabled()) throw new Error("demo");
      const sum = list.reduce((s, i) => s + i.totalCents, 0);
      url = await createCheckoutLink({
        orderNsu: `G${grp.code}`,
        items: list.map((i) => ({ description: `Invoice #${i.code}${i.auction ? ` — ${i.auction.name}` : ""}`, quantity: 1, priceCents: i.totalCents })),
        customer: { name: list[0].name || "Cliente MLPB", phone: grp.phone },
        redirectUrl: `${siteUrl()}/pagamento/retorno`,
        webhookUrl: `${siteUrl()}/api/webhooks/infinitepay`,
      });
      await db.paymentGroup.update({ where: { id: grp.id }, data: { invoiceIdsJson: JSON.stringify(list.map((i) => i.id)), totalCents: sum, paymentUrl: url, name: list[0].name } });
    } catch (e) {
      redirect(`/pagar/${token}?erro=${e instanceof Error && e.message === "demo" ? "demo" : "1"}`);
    }
    redirect(url);
  }

  return (
    <div className="card mx-auto max-w-lg space-y-4 p-6">
      <h1 className="text-2xl font-bold">Pagar invoices em aberto</h1>
      <p className="text-sm text-slate-600">{pend[0]?.name || g.name || "Cliente"}</p>
      {pend.length === 0 ? (
        <p className="rounded bg-green-950/60 p-3 text-sm text-green-300">Você não tem invoices em aberto. 🎉</p>
      ) : (
        <>
          <ul className="divide-y text-sm">
            {pend.map((i) => (
              <li key={i.id} className="flex justify-between gap-3 py-2">
                <span>
                  <Link href={`/fatura/${i.code}`} className="underline">Invoice #{i.code}</Link>
                  {i.auction ? ` · ${i.auction.name}` : ""}
                  <span className={`block text-xs ${i.dueAt < new Date() ? "text-red-300" : "text-slate-500"}`}>vence {fmtDate(i.dueAt)}</span>
                </span>
                <span className="whitespace-nowrap">{formatBRL(i.totalCents)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t pt-3 text-xl font-bold"><span>Total</span><span>{formatBRL(total)}</span></div>
          {erro === "demo" && <p className="rounded bg-amber-950/50 p-2 text-sm text-amber-300">Pagamento online não configurado. Fale com a loja.</p>}
          {erro === "1" && <p className="rounded bg-red-950/60 p-2 text-sm text-red-300">Não foi possível gerar o pagamento agora. Tente novamente ou fale com a loja.</p>}
          <form action={pay}><button className="btn-primary w-full py-3">Pagar tudo com Pix ou cartão (InfinitePay)</button></form>
        </>
      )}
      <a href={whatsappLink("Olá! Sobre meus invoices em aberto")} target="_blank" rel="noreferrer" className="btn-outline w-full">Falar com a loja</a>
    </div>
  );
}
