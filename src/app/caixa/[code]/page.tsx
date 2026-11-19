import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatBRL } from "@/lib/money";
import { BOX_STATUS, BOX_STATUS_COLOR, boxDetails } from "@/lib/boxes";
import { whatsappLink } from "@/lib/whatsapp";
import { RequestShipping } from "./RequestShipping";

export const dynamic = "force-dynamic";
export const metadata = { title: "Minha caixa — MLPB Cards", robots: { index: false } };

export default async function BoxPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ t?: string }> }) {
  const { code } = await params;
  const { t } = await searchParams;
  const user = await getCurrentUser();
  const raw = await db.box.findUnique({ where: { code: Number(code) || -1 } });
  // acesso: link com token, dono logado ou admin
  if (!raw || !(t === raw.token || (user && (user.id === raw.userId || user.role === "ADMIN")))) notFound();
  const d = (await boxDetails(raw.id))!;
  const { box, entries, balance, threshold } = d;
  const pct = Math.min(100, Math.round((balance / threshold) * 100));
  const prefill = user && user.id === box.userId
    ? { name: user.name, cep: user.cep, street: user.street, number: user.number, complement: user.complement, neighborhood: user.neighborhood, city: user.city, state: user.state }
    : box.addressJson ? JSON.parse(box.addressJson) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="card space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-black">📦 Caixa #{box.code}</h1>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${BOX_STATUS_COLOR[box.status]}`}>{BOX_STATUS[box.status]}</span>
          <span className="ml-auto text-sm text-slate-500">{box.name}</span>
        </div>
        <div>
          <div className="flex items-end justify-between">
            <p className="text-sm text-slate-500">Saldo acumulado</p>
            <p className="text-3xl font-black text-brand">{formatBRL(balance)}</p>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-gradient-to-r from-brand-amber to-brand" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-sm">
            {balance >= threshold ? <span className="font-bold text-green-300">🎉 Frete grátis liberado!</span> : <>Faltam <strong>{formatBRL(threshold - balance)}</strong> para o frete grátis ({formatBRL(threshold)}).</>}
          </p>
        </div>
        {box.trackingCode && <p className="rounded bg-blue-950/60 p-3 text-sm text-blue-300">Código de rastreio: <strong>{box.trackingCode}</strong></p>}
      </div>

      <div className="card divide-y">
        <h2 className="p-4 font-bold">O que está na caixa</h2>
        {entries.map((e) => (
          <div key={e.key} className="space-y-1 p-4 text-sm">
            <div className="flex justify-between font-semibold"><span>{e.source}</span><span>{formatBRL(e.total)}</span></div>
            <p className="text-xs text-slate-500">{e.date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
            <ul className="text-slate-600">{e.items.map((i, k) => <li key={k} className="flex justify-between gap-3"><span>{i.title}</span><span className="whitespace-nowrap">{formatBRL(i.cents)}</span></li>)}</ul>
          </div>
        ))}
        {entries.length === 0 && <p className="p-4 text-sm text-slate-500">Nada por aqui ainda.</p>}
      </div>

      {box.status === "PENDENTE" ? (
        <RequestShipping code={box.code} token={box.token} freeUnlocked={balance >= threshold} prefill={prefill} />
      ) : (
        <div className="card p-5 text-sm">
          <p>
            Envio solicitado {box.requestedAt ? `em ${box.requestedAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : ""} ·{" "}
            {box.shippingMethod === "RETIRADA" ? "Retirada pessoalmente" : box.shippingMethod === "GRATIS" ? "Frete grátis" : `${box.shippingMethod} ${formatBRL(box.shippingCents)}${box.shippingPaid ? " (pago)" : " (aguardando pagamento)"}`}
          </p>
        </div>
      )}
      <a href={whatsappLink(`Olá! Sobre a minha caixa #${box.code}`)} target="_blank" rel="noreferrer" className="btn-outline w-full">Falar com a loja</a>
    </div>
  );
}
