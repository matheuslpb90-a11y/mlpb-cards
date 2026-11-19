import Link from "next/link";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { BOX_STATUS, backfillBoxes, boxBalance, boxUrl, boxParticipations, daysOpen, freeShippingCents } from "@/lib/boxes";
import { BoxRow, FreeShippingSetting } from "./BoxControls";
import { phoneKey, phoneVariants } from "@/lib/phone";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type SP = Promise<{ q?: string; status?: string; arquivadas?: string; ordem?: string; inadimplentes?: string }>;

export default async function BoxesPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  await backfillBoxes().catch(() => {});
  const now = new Date();
  const debtorPhones = [...new Set((await db.invoice.findMany({ where: { status: "PENDENTE", dueAt: { lt: now } }, select: { phone: true } })).map((i) => phoneKey(i.phone)))];

  const where: Prisma.BoxWhereInput = { archived: sp.arquivadas === "1" };
  if (sp.status) where.status = sp.status;
  if (sp.q) where.OR = [{ name: { contains: sp.q, mode: "insensitive" } }, { phone: { contains: phoneKey(sp.q).slice(-8) || sp.q } }, ...(Number(sp.q) ? [{ code: Number(sp.q) }] : [])];
  if (sp.inadimplentes === "1") where.phone = { in: debtorPhones.flatMap(phoneVariants) };

  const [boxes, all, threshold] = await Promise.all([
    db.box.findMany({ where, include: { orders: true, invoices: true }, orderBy: { createdAt: "desc" }, take: 300 }),
    db.box.findMany({ where: { archived: false }, include: { orders: true, invoices: true } }),
    freeShippingCents(),
  ]);
  const rows = boxes.map((b) => ({ b, balance: boxBalance(b), parts: boxParticipations(b) }));
  if (sp.ordem === "saldo") rows.sort((x, y) => y.balance - x.balance);
  if (sp.ordem === "antigas") rows.sort((x, y) => x.b.createdAt.getTime() - y.b.createdAt.getTime());

  const count = (s: string) => all.filter((b) => b.status === s).length;
  const openBalance = all.filter((b) => b.status === "PENDENTE").reduce((s, b) => s + boxBalance(b), 0);
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/admin/caixas${p.toString() ? `?${p}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-2xl font-bold">Caixas</h1>
          <p className="text-sm text-slate-500">Cartas acumuladas de cada cliente (arremates pagos + compras “acumular” no site).</p>
        </div>
        <FreeShippingSetting current={threshold} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Total" value={all.length} />
        <Stat label="Ativas / pendentes" value={count("PENDENTE") + count("FRETE_SOLICITADO") + count("EM_SEPARACAO")} color="text-green-300" />
        <Stat label="Enviadas" value={count("ENVIADA")} color="text-blue-300" />
        <Stat label="Concluídas" value={count("CONCLUIDA") + count("PRESENCIAL")} color="text-slate-500" />
        <Stat label="Saldo aberto" value={formatBRL(openBalance)} color="text-green-300" />
      </div>

      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <form className="flex-1"><input name="q" defaultValue={sp.q} className="input" placeholder="Buscar por cliente, telefone ou nº da caixa…" /></form>
          <Link href={qs({ inadimplentes: sp.inadimplentes === "1" ? undefined : "1" })} className={`rounded-lg border px-3 py-2 text-sm ${sp.inadimplentes === "1" ? "border-red-500 text-red-300" : "border-red-900 text-red-300"}`}>
            ⚠ Inadimplentes <span className="rounded-full bg-red-950/60 px-1.5">{debtorPhones.length}</span>
          </Link>
          <Link href={qs({ arquivadas: sp.arquivadas === "1" ? undefined : "1" })} className={`rounded-lg border px-3 py-2 text-sm ${sp.arquivadas === "1" ? "border-brand text-brand" : ""}`}>🗄 Arquivadas</Link>
          <Link href={qs({ ordem: sp.ordem === "saldo" ? "antigas" : sp.ordem === "antigas" ? undefined : "saldo" })} className="rounded-lg border px-3 py-2 text-sm">
            ⇅ {sp.ordem === "saldo" ? "Maior saldo" : sp.ordem === "antigas" ? "Mais antigas" : "Mais recentes"}
          </Link>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href={qs({ status: undefined })} className={`rounded-full border px-3 py-1 ${!sp.status ? "bg-white text-black" : ""}`}>Todos {all.length}</Link>
          {Object.entries(BOX_STATUS).map(([k, l]) => (
            <Link key={k} href={qs({ status: k })} className={`rounded-full border px-3 py-1 ${sp.status === k ? "bg-white text-black" : ""}`}>{l} {count(k)}</Link>
          ))}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500">
            <tr><th className="p-3">Cliente</th><th className="p-3">Status</th><th className="p-3">Saldo</th><th className="p-3">Frete</th><th className="p-3">Part.</th><th className="p-3">Rastreio</th><th className="p-3">Tempo</th><th className="p-3"></th></tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(({ b, balance, parts }) => (
              <BoxRow
                key={b.id}
                box={{
                  id: b.id, code: b.code, token: b.token, name: b.name, phone: b.phone, status: b.status, archived: b.archived,
                  shippingPaid: b.shippingPaid, shippingMethod: b.shippingMethod, trackingCode: b.trackingCode,
                  created: b.createdAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
                  closed: b.closedAt?.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) ?? "",
                  days: daysOpen(b), debtor: debtorPhones.includes(phoneKey(b.phone)), link: boxUrl(b),
                }}
                balance={balance}
                free={balance >= threshold || b.shippingMethod === "GRATIS"}
                parts={parts}
              />
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-slate-500">Nenhuma caixa aqui.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, color = "" }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
