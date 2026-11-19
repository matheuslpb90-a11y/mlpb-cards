import Link from "next/link";
import { notFound } from "next/navigation";
import { formatBRL } from "@/lib/money";
import { BOX_STATUS, BOX_STATUS_COLOR, boxDetails, boxUrl } from "@/lib/boxes";
import { BoxNotes } from "./BoxNotes";

export const dynamic = "force-dynamic";

export default async function AdminBoxPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await boxDetails(id);
  if (!d) notFound();
  const { box, entries, balance, threshold } = d;
  const addr = box.addressJson ? (JSON.parse(box.addressJson) as Record<string, string>) : null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/caixas" className="text-slate-500 hover:text-white">←</Link>
        <h1 className="text-2xl font-bold">Caixa #{box.code} — {box.name || "Sem nome"}</h1>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${BOX_STATUS_COLOR[box.status]}`}>{BOX_STATUS[box.status]}</span>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card space-y-1 p-4 text-sm">
          <p className="text-xs uppercase text-slate-500">Cliente</p>
          <p className="font-semibold">{box.name}</p>
          <p>+{box.phone}</p>
          <a className="break-all text-xs text-brand underline" href={boxUrl(box)} target="_blank" rel="noreferrer">link público da caixa</a>
        </div>
        <div className="card space-y-1 p-4 text-sm">
          <p className="text-xs uppercase text-slate-500">Saldo</p>
          <p className="text-2xl font-bold text-green-300">{formatBRL(balance)}</p>
          <p className="text-slate-500">{balance >= threshold ? "Frete grátis" : `Faltam ${formatBRL(threshold - balance)} p/ frete grátis`}</p>
        </div>
        <div className="card space-y-1 p-4 text-sm">
          <p className="text-xs uppercase text-slate-500">Envio</p>
          <p>{box.shippingMethod ? (box.shippingMethod === "RETIRADA" ? "Retirada pessoalmente" : box.shippingMethod === "GRATIS" ? "Frete grátis" : `${box.shippingMethod} · ${formatBRL(box.shippingCents)} · ${box.shippingPaid ? "pago" : "não pago"}`) : "Ainda não solicitado"}</p>
          {addr && <p className="text-slate-600">{addr.name} — {addr.street}, {addr.number} {addr.complement} · {addr.neighborhood} · {addr.city}/{addr.state} · CEP {addr.cep}</p>}
          {box.trackingCode && <p>Rastreio: <strong>{box.trackingCode}</strong></p>}
        </div>
      </div>
      <div className="card divide-y">
        <h2 className="p-4 font-bold">Participações ({entries.length})</h2>
        {entries.map((e) => (
          <div key={e.key} className="p-4 text-sm">
            <div className="flex justify-between font-semibold"><span>{e.source} · {e.date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span><span>{formatBRL(e.total)}</span></div>
            <ul className="text-slate-600">{e.items.map((i, k) => <li key={k} className="flex justify-between gap-2"><span>{i.title}</span><span>{formatBRL(i.cents)}</span></li>)}</ul>
          </div>
        ))}
      </div>
      <BoxNotes id={box.id} notes={box.notes} />
    </div>
  );
}
