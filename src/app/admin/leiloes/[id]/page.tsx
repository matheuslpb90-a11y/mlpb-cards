import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { centsToReais, toBrtParts, type AuctionDraft } from "@/lib/auction-draft";
import { AUCTION_STATUS, fmtDate, itemMedia } from "@/lib/auctions";
import { AuctionEditor } from "../AuctionEditor";
import { AuctionRowActions } from "../RowActions";

export const dynamic = "force-dynamic";

export default async function EditAuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await db.auction.findUnique({
    where: { id },
    include: {
      lots: { orderBy: { position: "asc" }, include: { items: { orderBy: { position: "asc" }, include: { votes: { orderBy: [{ optionCents: "desc" }, { votedAt: "asc" }] } } } } },
      invoices: { orderBy: { code: "asc" } },
    },
  });
  if (!a) notFound();

  const s = toBrtParts(a.startsAt), e = toBrtParts(a.endsAt);
  const draft: AuctionDraft = {
    id: a.id, name: a.name, description: a.description, imageUrl: a.imageUrl,
    startDate: s.date, startTime: s.time, endDate: e.date, endTime: e.time, paymentDays: a.paymentDays,
    initialPct: a.initialPct, buyoutPct: a.buyoutPct, defaultStep: centsToReais(a.defaultStepCents), oneReal: a.oneReal,
    infinitepayHandle: a.infinitepayHandle, visible: a.visible,
    lots: a.lots.map((l) => ({
      title: l.title, imageUrl: l.imageUrl, oneReal: l.oneReal, hideMarket: l.hideMarket, hideBuyout: l.hideBuyout,
      items: l.items.map((it) => ({
        cardId: it.cardId ?? undefined, name: it.name, number: it.number, finish: it.finish, condition: it.condition, language: it.language,
        graded: it.graded, note: it.note, cost: centsToReais(it.costCents), market: centsToReais(it.marketCents || null),
        start: centsToReais(it.startOverride), buyout: centsToReais(it.buyoutOverride), step: centsToReais(it.stepOverride),
        hideMarket: it.hideMarket, hideBuyout: it.hideBuyout, imageUrl: it.imageUrl, media: itemMedia(it),
      })),
    })),
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/leiloes" className="text-slate-500 hover:text-white">←</Link>
        <h1 className="text-2xl font-bold">{a.name}</h1>
        <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold">{AUCTION_STATUS[a.status]}</span>
        <div className="ml-auto"><AuctionRowActions id={a.id} status={a.status} visible={a.visible} /></div>
      </div>

      {a.status !== "AGENDADO" && (() => {
        const items = a.lots.flatMap((l) => l.items);
        const won = items.filter((i) => i.winningCents != null);
        const raised = won.reduce((s, i) => s + (i.winningCents ?? 0), 0);
        const paid = a.invoices.filter((i) => i.status === "PAGO").reduce((s, i) => s + i.totalCents, 0);
        const pend = a.invoices.filter((i) => i.status === "PENDENTE").reduce((s, i) => s + i.totalCents, 0);
        const ranking = a.invoices.map((i) => ({ ...i, count: (JSON.parse(i.itemsJson) as unknown[]).length })).sort((x, y) => y.totalCents - x.totalCents);
        const stats: [string, string, string][] = [
          ["Total cartas", String(items.length), "border-blue-800"],
          ["Arrematadas", String(won.length), "border-amber-700 text-amber-300"],
          ["Total mercado", formatBRL(items.reduce((s, i) => s + i.marketCents, 0)), "border-blue-800"],
          ["Arrecadado", formatBRL(raised), "border-green-800 text-green-300"],
          ["Pendente", formatBRL(pend), "border-red-800 text-red-300"],
          ["Total pago", formatBRL(paid), "border-purple-800 text-purple-300"],
        ];
        return (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
              {stats.map(([l, v, c]) => <div key={l} className={`card border p-4 ${c}`}><p className="text-xs uppercase opacity-80">{l}</p><p className="text-xl font-bold">{v}</p></div>)}
            </div>
            <section className="card space-y-2 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Ranking de arrematadores</h2>
                <a href={`/api/admin/leiloes/${a.id}/csv`} className="btn-outline text-sm">⬇ CSV</a>
              </div>
              {ranking.map((r, k) => (
                <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 font-bold">{k + 1}</span>
                  <span className="flex-1"><strong>{r.name || "Sem nome"}</strong> <span className="text-slate-500">· +{r.phone} · {r.count} carta(s)</span></span>
                  <strong className="text-green-300">{formatBRL(r.totalCents)}</strong>
                  <span className={`rounded px-2 py-0.5 text-xs font-bold ${r.status === "PAGO" ? "bg-green-950/60 text-green-300" : "bg-red-950/60 text-red-300"}`}>{r.status === "PAGO" ? "Pago" : r.status === "CANCELADO" ? "Cancelado" : "Pendente"}</span>
                  <span className="text-xs text-slate-500">{r.sentAt ? "✓ invoice enviado" : "○ não enviado"}</span>
                </div>
              ))}
              {ranking.length === 0 && <p className="text-sm text-slate-500">Os vencedores aparecem aqui quando o leilão encerrar.</p>}
            </section>
          </>
        );
      })()}

      {a.status !== "AGENDADO" && (
        <section className="card space-y-3 p-5">
          <h2 className="text-lg font-bold">Votos e vencedores</h2>
          {a.lots.flatMap((l) =>
            l.items.map((it) => {
              const top = it.votes[0];
              return (
                <div key={it.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{l.position}.{it.position} {it.name}</strong>
                    <span className="text-slate-500">{it.number} · {it.condition} · {it.language}</span>
                    <span className="ml-auto">{it.votes.length} voto(s)</span>
                    {it.winningCents != null ? (
                      <span className="rounded bg-green-950/60 px-2 py-0.5 font-bold text-green-300">🏆 {it.winnerName || it.winnerPhone} — {formatBRL(it.winningCents)}</span>
                    ) : top ? (
                      <span className="rounded bg-brand/20 px-2 py-0.5 font-bold text-brand">Liderando: {top.name || top.phone} — {formatBRL(top.optionCents)}</span>
                    ) : null}
                  </div>
                  {it.votes.length > 0 && (
                    <p className="mt-1 text-xs text-slate-500">
                      {it.votes.slice(0, 8).map((v) => `${v.name || "…" + v.phone.slice(-4)} ${formatBRL(v.optionCents)} (${fmtDate(v.votedAt)})`).join(" · ")}
                    </p>
                  )}
                </div>
              );
            }),
          )}
          {a.invoices.length > 0 && (
            <p className="text-sm">Invoices gerados: {a.invoices.map((i) => `#${i.code}`).join(", ")} — <Link className="text-brand underline" href="/admin/faturas">ver invoices</Link></p>
          )}
        </section>
      )}

      <AuctionEditor initial={draft} blobEnabled={Boolean(process.env.BLOB_READ_WRITE_TOKEN)} locked={a.status !== "AGENDADO"} />
    </div>
  );
}
