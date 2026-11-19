import Link from "next/link";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { fmtDate, parseJson } from "@/lib/auctions";
import { InvoiceActions } from "./InvoiceActions";

export const dynamic = "force-dynamic";

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await searchParams;
  const now = new Date();
  const where =
    f === "pendentes" ? { status: "PENDENTE" } : f === "devedores" ? { status: "PENDENTE", dueAt: { lt: now } } : f === "pagos" ? { status: "PAGO" } : {};
  const invoices = await db.invoice.findMany({ where, orderBy: { code: "desc" }, include: { auction: true }, take: 300 });
  const all = await db.invoice.findMany({ where: { status: "PENDENTE" }, select: { totalCents: true, dueAt: true } });
  const overdue = all.filter((i) => i.dueAt < now);
  const tab = (key: string, label: string) => (
    <Link href={`/admin/faturas${key ? `?f=${key}` : ""}`} className={`rounded-lg border px-3 py-1.5 text-sm ${(f ?? "") === key ? "border-brand text-brand" : ""}`}>{label}</Link>
  );
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Invoices dos leilões</h1>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4"><p className="text-xs uppercase text-slate-500">A receber</p><p className="text-2xl font-bold">{formatBRL(all.reduce((s, i) => s + i.totalCents, 0))}</p></div>
        <div className="card p-4"><p className="text-xs uppercase text-slate-500">Devedores (vencidos)</p><p className="text-2xl font-bold text-red-300">{overdue.length} · {formatBRL(overdue.reduce((s, i) => s + i.totalCents, 0))}</p></div>
        <div className="card p-4"><p className="text-xs uppercase text-slate-500">Pendentes no prazo</p><p className="text-2xl font-bold">{all.length - overdue.length}</p></div>
      </div>
      <div className="card flex flex-wrap gap-2 p-3">{tab("", "Todos")}{tab("pendentes", "Pendentes")}{tab("devedores", "Devedores")}{tab("pagos", "Pagos")}</div>
      <div className="space-y-2">
        {invoices.map((inv) => {
          const late = inv.status === "PENDENTE" && inv.dueAt < now;
          return (
            <div key={inv.id} className={`card flex flex-wrap items-center gap-3 p-4 ${late ? "border-red-800" : ""}`}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">#{inv.code} · {inv.name || "Sem nome"} · <span className="text-slate-500">+{inv.phone}</span></p>
                <p className="text-xs text-slate-500">{inv.auction?.name ?? "—"} · vence {fmtDate(inv.dueAt)}{inv.sentAt ? ` · enviado ${fmtDate(inv.sentAt)}` : " · não enviado"}</p>
                <p className="text-xs text-slate-600">{parseJson<{ title: string }[]>(inv.itemsJson, []).map((i) => i.title).join(" · ")}</p>
              </div>
              <span className="text-lg font-bold">{formatBRL(inv.totalCents)}</span>
              <span className={`rounded px-2 py-1 text-xs font-bold ${inv.status === "PAGO" ? "bg-green-950/60 text-green-300" : late ? "bg-red-950/60 text-red-300" : inv.status === "CANCELADO" ? "bg-slate-100 text-slate-500" : "bg-amber-950/50 text-amber-300"}`}>
                {inv.status === "PAGO" ? "Pago" : late ? "Vencido" : inv.status === "CANCELADO" ? "Cancelado" : "Pendente"}
              </span>
              <InvoiceActions id={inv.id} code={inv.code} status={inv.status} />
            </div>
          );
        })}
        {invoices.length === 0 && <div className="card p-8 text-center text-slate-500">Nenhum invoice aqui.</div>}
      </div>
    </div>
  );
}
