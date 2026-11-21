/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { db } from "@/lib/db";
import { AUCTION_STATUS, fmtDate, runSchedule } from "@/lib/auctions";
import { getSettings } from "@/lib/settings";
import { WhatsIcon } from "@/components/SocialIcons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leilões — MLPB Cards" };

export default async function AuctionsPage() {
  await runSchedule().catch(() => {});
  const now = new Date();
  const [s, auctions, external, lmProfile] = await Promise.all([
    getSettings(),
    db.auction.findMany({
      where: { visible: true, status: { not: "CANCELADO" } },
      orderBy: { startsAt: "desc" },
      include: { lots: { include: { items: { select: { imageUrl: true } } } } },
      take: 40,
    }),
    db.externalAuction.findMany({ where: { visible: true, endsAt: { gt: new Date(Date.now() - 30 * 86400_000) } }, orderBy: { startsAt: "desc" }, take: 30 }),
    db.setting.findUnique({ where: { key: "leilomaniaUrl" } }),
  ]);
  const extStatus = (a: { startsAt: Date; endsAt: Date }) => (now < a.startsAt ? 1 : now <= a.endsAt ? 0 : 2);
  external.sort((a, b) => extStatus(a) - extStatus(b));
  const order = { ATIVO: 0, AGENDADO: 1, ENCERRADO: 2 } as Record<string, number>;
  auctions.sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">Leilões</h1>
          <p className="text-slate-600">Leilões no nosso grupo do WhatsApp (lance por enquete) e na Leilomania.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={s.whatsappGroupUrl} target="_blank" rel="noreferrer" className="btn-primary"><WhatsIcon /> Entre no grupo</a>
          {lmProfile?.value && <a href={lmProfile.value} target="_blank" rel="noreferrer" className="btn border border-purple-500 text-purple-300 hover:bg-purple-950/40">🟣 Meus leilões na Leilomania ↗</a>}
        </div>
      </div>

      {external.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">🟣 Na Leilomania</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {external.map((a) => {
              const st = extStatus(a);
              return (
                <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="card flex gap-4 p-4 hover:border-purple-500">
                  {a.imageUrl ? <img src={a.imageUrl} alt="" className="w-28 shrink-0 rounded-lg object-cover" /> : <div className="flex w-28 shrink-0 items-center justify-center rounded-lg bg-purple-950/40 text-4xl">🔨</div>}
                  <div className="min-w-0 space-y-1">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${st === 0 ? "bg-green-950/60 text-green-300" : st === 1 ? "bg-purple-950/60 text-purple-300" : "bg-slate-100 text-slate-500"}`}>
                      {st === 0 ? "🔴 AO VIVO" : st === 1 ? "Agendado" : "Encerrado"} · Leilomania
                    </span>
                    <h3 className="font-bold leading-tight">{a.title}</h3>
                    {a.description && <p className="line-clamp-2 text-sm text-slate-600">{a.description}</p>}
                    <p className="text-xs text-slate-500">{fmtDate(a.startsAt)} → {fmtDate(a.endsAt)}</p>
                    {st !== 2 && <span className="inline-block text-sm font-semibold text-purple-300">Participar na Leilomania ↗</span>}
                  </div>
                </a>
              );
            })}
          </div>
        </section>
      )}

      {external.length > 0 && <h2 className="text-xl font-bold">🟢 No grupo do WhatsApp</h2>}
      {auctions.length === 0 && <div className="card p-10 text-center text-slate-500">Nenhum leilão no WhatsApp agendado no momento. Entre no grupo para ser avisado!</div>}
      <div className="grid gap-4 md:grid-cols-2">
        {auctions.map((a) => {
          const imgs = a.lots.flatMap((l) => l.items.map((i) => i.imageUrl)).filter(Boolean).slice(0, 4);
          const count = a.lots.reduce((s, l) => s + l.items.length, 0);
          return (
            <Link key={a.id} href={`/leiloes/${a.code}`} className="card flex gap-4 p-4 hover:border-brand">
              <div className="flex w-28 shrink-0 -space-x-10">
                {a.imageUrl ? <img src={a.imageUrl} alt="" className="w-28 rounded-lg object-cover" /> : imgs.map((u, i) => <img key={i} src={u} alt="" className="w-16 rounded shadow-lg" style={{ transform: `rotate(${(i - 1) * 6}deg)` }} />)}
              </div>
              <div className="min-w-0 space-y-1">
                <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${a.status === "ATIVO" ? "bg-green-950/60 text-green-300" : a.status === "AGENDADO" ? "bg-brand/20 text-brand" : "bg-slate-100 text-slate-500"}`}>
                  {a.status === "ATIVO" ? "🔴 AO VIVO" : AUCTION_STATUS[a.status]}
                </span>
                <h2 className="font-bold leading-tight">{a.name}</h2>
                {a.description && <p className="line-clamp-2 text-sm text-slate-600">{a.description}</p>}
                <p className="text-xs text-slate-500">{fmtDate(a.startsAt)} → {fmtDate(a.endsAt)} · {count} carta(s)</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
