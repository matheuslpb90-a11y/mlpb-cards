import Link from "next/link";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { AUCTION_STATUS, fmtDate } from "@/lib/auctions";
import { AuctionRowActions } from "./RowActions";

export const dynamic = "force-dynamic";

export default async function AdminAuctions({ searchParams }: { searchParams: Promise<{ f?: string; q?: string }> }) {
  const { f, q } = await searchParams;
  const now = new Date();
  const where =
    f === "ativos" ? { status: "ATIVO" } : f === "futuros" ? { status: "AGENDADO" } : f === "passados" ? { status: { in: ["ENCERRADO", "CANCELADO"] } } : {};
  const auctions = await db.auction.findMany({
    where: { ...where, ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}) },
    orderBy: { startsAt: "desc" },
    include: { lots: { include: { items: true } }, invoices: true },
  });
  const tab = (key: string, label: string) => (
    <Link href={`/admin/leiloes${key ? `?f=${key}` : ""}`} className={`rounded-lg border px-3 py-1.5 text-sm ${(f ?? "") === key ? "border-brand text-brand" : ""}`}>{label}</Link>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h1 className="text-2xl font-bold">Leilões</h1>
          <p className="text-sm text-slate-500">Enquetes no grupo do WhatsApp, com invoice automático para os vencedores.</p>
        </div>
        <Link href="/admin/bot" className="btn-outline">⚙ Bot WhatsApp</Link>
        <Link href="/admin/leiloes/leilomania" className="btn-outline">🟣 Leilomania</Link>
        <Link href="/admin/leiloes/novo" className="btn-primary">+ Novo leilão</Link>
      </div>
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <form className="mr-auto"><input name="q" defaultValue={q} className="input" placeholder="Buscar por nome do leilão…" /></form>
        {tab("", "Todos")}{tab("ativos", "Ativos")}{tab("futuros", "Futuros")}{tab("passados", "Passados")}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500">
            <tr><th className="p-3">Nome</th><th className="p-3">Início</th><th className="p-3">Fim</th><th className="p-3 text-right">Mercado</th><th className="p-3 text-right">Arrecadado</th><th className="p-3 text-right">Pago</th><th className="p-3">Status</th><th className="p-3"></th></tr>
          </thead>
          <tbody className="divide-y">
            {auctions.map((a) => {
              const items = a.lots.flatMap((l) => l.items);
              const market = items.reduce((s, i) => s + i.marketCents, 0);
              const raised = items.reduce((s, i) => s + (i.winningCents ?? 0), 0);
              const paid = a.invoices.filter((i) => i.status === "PAGO").reduce((s, i) => s + i.totalCents, 0);
              return (
                <tr key={a.id}>
                  <td className="p-3">
                    <Link href={`/admin/leiloes/${a.id}`} className="font-semibold hover:text-brand">{a.name}</Link>
                    <p className="text-xs text-slate-500">#{a.code} · {a.lots.length} lote(s) · {items.length} carta(s){a.visible ? "" : " · oculto no site"}</p>
                  </td>
                  <td className="p-3 whitespace-nowrap">{fmtDate(a.startsAt)}</td>
                  <td className="p-3 whitespace-nowrap">{fmtDate(a.endsAt)}</td>
                  <td className="p-3 text-right text-slate-500">{formatBRL(market)}</td>
                  <td className="p-3 text-right font-semibold">{formatBRL(raised)}</td>
                  <td className="p-3 text-right font-semibold text-green-300">{formatBRL(paid)}</td>
                  <td className="p-3"><span className={`rounded px-2 py-1 text-xs font-bold ${a.status === "ATIVO" ? "bg-green-950/60 text-green-300" : a.status === "AGENDADO" ? "bg-blue-950/60 text-blue-300" : "bg-slate-100 text-slate-500"}`}>{AUCTION_STATUS[a.status]}</span>
                    {a.status === "AGENDADO" && a.startsAt < now && <p className="text-[10px] text-amber-300">aguardando o agendador</p>}
                  </td>
                  <td className="p-3"><AuctionRowActions id={a.id} status={a.status} visible={a.visible} /></td>
                </tr>
              );
            })}
            {auctions.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-slate-500">Nenhum leilão ainda. Clique em “Novo leilão”.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
