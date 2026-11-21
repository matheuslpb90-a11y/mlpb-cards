/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { db } from "@/lib/db";
import { AUCTION_STATUS, fmtDate, runSchedule } from "@/lib/auctions";
import { getSettings } from "@/lib/settings";
import { leilomaniaAuctions, leilomaniaLinks } from "@/lib/leilomania";
import { PhotoGallery } from "@/components/PhotoGallery";
import { LmItemsCarousel } from "@/components/LmItemsCarousel";
import { WhatsIcon } from "@/components/SocialIcons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leilões — MLPB Cards", description: "Leilões ativos e próximos no grupo de WhatsApp da MLPB Cards e na Leilomania." };

const badge = (live: boolean) => (live ? "bg-green-950/60 text-green-300" : "bg-brand/20 text-brand");

export default async function AuctionsPage() {
  await runSchedule().catch(() => {});
  const now = new Date();
  const include = { lots: { include: { items: { select: { imageUrl: true } } } } } as const;
  const [s, upcoming, ended, external, lm] = await Promise.all([
    getSettings(),
    db.auction.findMany({ where: { visible: true, status: { in: ["ATIVO", "AGENDADO"] } }, orderBy: { startsAt: "asc" }, include, take: 40 }),
    db.auction.findMany({ where: { visible: true, status: "ENCERRADO" }, orderBy: { endsAt: "desc" }, include, take: 6 }),
    leilomaniaAuctions(),
    leilomaniaLinks(),
  ]);
  upcoming.sort((a, b) => (a.status === "ATIVO" ? 0 : 1) - (b.status === "ATIVO" ? 0 : 1));

  const AuctionCard = ({ a }: { a: (typeof upcoming)[number] }) => {
    const imgs = a.lots.flatMap((l) => l.items.map((i) => i.imageUrl)).filter(Boolean).slice(0, 4);
    const count = a.lots.reduce((n, l) => n + l.items.length, 0);
    return (
      <Link href={`/leiloes/${a.code}`} className="card flex gap-4 p-4 hover:border-brand">
        <div className="flex w-28 shrink-0 -space-x-10">
          {a.imageUrl ? <img src={a.imageUrl} alt="" className="w-28 rounded-lg object-cover" /> : imgs.map((u, i) => <img key={i} src={u} alt="" className="w-16 rounded shadow-lg" style={{ transform: `rotate(${(i - 1) * 6}deg)` }} />)}
        </div>
        <div className="min-w-0 space-y-1">
          <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${a.status === "ENCERRADO" ? "bg-slate-100 text-slate-500" : badge(a.status === "ATIVO")}`}>
            {a.status === "ATIVO" ? "🔴 AO VIVO" : AUCTION_STATUS[a.status]}
          </span>
          <h3 className="font-bold leading-tight">{a.name}</h3>
          {a.description && <p className="line-clamp-2 text-sm text-slate-600">{a.description}</p>}
          <p className="text-xs text-slate-500">{fmtDate(a.startsAt)} → {fmtDate(a.endsAt)} · {count} carta(s)</p>
        </div>
      </Link>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black">Leilões</h1>
        <p className="text-slate-600">Leilões ativos e próximos no nosso grupo do WhatsApp e na Leilomania.</p>
        <p className="text-sm text-slate-500">Primeira vez? Veja <Link href="/grupo" className="text-brand underline">como funcionam os leilões do grupo</Link> e o programa <Link href="/pontos" className="text-brand underline">🪙 MLPB Points</Link> — arremates também dão pontos.</p>
      </div>

      {/* Grupo do WhatsApp */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">🟢 No grupo do WhatsApp</h2>
            <p className="text-sm text-slate-500">Lance por enquete, direto no grupo. Basta estar no grupo para participar.</p>
          </div>
          {s.whatsappGroupUrl && <a href={s.whatsappGroupUrl} target="_blank" rel="noreferrer" className="btn-primary"><WhatsIcon /> Entrar no grupo</a>}
        </div>
        {upcoming.length === 0 ? (
          <div className="card p-8 text-center text-slate-500">Nenhum leilão agendado no grupo agora. Entre no grupo para ser avisado do próximo!</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">{upcoming.map((a) => <AuctionCard key={a.id} a={a} />)}</div>
        )}
      </section>

      {/* Leilomania */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">🟣 Na Leilomania</h2>
            <p className="text-sm text-slate-500">Leilões da MLPB Cards na plataforma Leilomania.</p>
          </div>
          {lm.profileUrl && <a href={lm.profileUrl} target="_blank" rel="noreferrer" className="btn border border-purple-500 text-purple-300 hover:bg-purple-950/40">Ver todos na Leilomania ↗</a>}
        </div>
        <div className="card flex flex-wrap items-center justify-between gap-3 border-purple-700 p-4 text-sm">
          <p>⚠️ <strong>Para dar lances na Leilomania é preciso fazer um cadastro prévio</strong> na plataforma (grátis). Faça pelo nosso link de indicação:</p>
          <a href={lm.refUrl} target="_blank" rel="noreferrer" className="btn bg-purple-700 text-white hover:bg-purple-600">Fazer cadastro na Leilomania ↗</a>
        </div>
        {external.length === 0 ? (
          <div className="card p-8 text-center text-slate-500">Nenhum leilão ativo na Leilomania no momento.</div>
        ) : (
          <div className="space-y-5">
            {external.map((a) => {
              const live = now >= a.startsAt;
              const withItems = a.items.length > 0;
              return (
                <div key={a.key} className="card space-y-3 p-4">
                  <div className="flex flex-wrap items-start gap-4">
                    {!withItems && (a.images.length
                      ? <PhotoGallery images={a.images} className="w-32 shrink-0 sm:w-40" />
                      : <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-lg bg-purple-950/40 text-4xl">🔨</div>)}
                    <div className="min-w-0 flex-1 basis-full space-y-1 sm:basis-0">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${live ? "bg-green-950/60 text-green-300" : "bg-purple-950/60 text-purple-300"}`}>{live ? "🔴 AO VIVO" : "Agendado"} · Leilomania</span>
                      <h3 className="text-lg font-bold leading-tight">{a.title}</h3>
                      {a.description && <p className="line-clamp-3 whitespace-pre-line text-sm text-slate-600">{a.description}</p>}
                      <p className="text-xs text-slate-500">{fmtDate(a.startsAt)} → {fmtDate(a.endsAt)}{a.itemCount ? ` · ${a.itemCount} carta(s)` : ""}</p>
                    </div>
                    <a href={a.url} target="_blank" rel="noreferrer" className="btn w-full bg-purple-700 text-sm text-white hover:bg-purple-600 sm:w-auto">Participar na Leilomania ↗</a>
                  </div>
                  {withItems && (
                    <>
                      <p className="text-xs text-slate-500">Toque numa carta para ver os detalhes · arraste para o lado para ver todas →</p>
                      <LmItemsCarousel items={a.items} url={a.url} />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {ended.length > 0 && (
        <details className="space-y-3">
          <summary className="cursor-pointer text-sm text-slate-500">Leilões encerrados recentemente no grupo</summary>
          <div className="mt-3 grid gap-4 md:grid-cols-2">{ended.map((a) => <AuctionCard key={a.id} a={a} />)}</div>
        </details>
      )}
    </div>
  );
}
