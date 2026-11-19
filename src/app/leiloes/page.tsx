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
  const [s, auctions] = await Promise.all([
    getSettings(),
    db.auction.findMany({
      where: { visible: true, status: { not: "CANCELADO" } },
      orderBy: { startsAt: "desc" },
      include: { lots: { include: { items: { select: { imageUrl: true } } } } },
      take: 40,
    }),
  ]);
  const order = { ATIVO: 0, AGENDADO: 1, ENCERRADO: 2 } as Record<string, number>;
  auctions.sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">Leilões</h1>
          <p className="text-slate-600">Os lances são dados por enquete no nosso grupo do WhatsApp.</p>
        </div>
        <a href={s.whatsappGroupUrl} target="_blank" rel="noreferrer" className="btn-primary"><WhatsIcon /> Entre no grupo para participar</a>
      </div>
      {auctions.length === 0 && <div className="card p-10 text-center text-slate-500">Nenhum leilão agendado no momento. Entre no grupo para ser avisado!</div>}
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
