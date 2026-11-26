/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { SafeImg } from "@/components/SafeImg";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { AUCTION_STATUS, fmtDate, itemMedia, itemTitle } from "@/lib/auctions";
import { getSettings } from "@/lib/settings";
import { languageFlag } from "@/lib/catalog";
import { WhatsIcon } from "@/components/SocialIcons";
import { getCurrentUser } from "@/lib/auth";
import { WatchButton } from "./WatchButton";

export const dynamic = "force-dynamic";

export default async function AuctionPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [s, a] = await Promise.all([
    getSettings(),
    db.auction.findUnique({
      where: { code: Number(code) || -1 },
      include: {
        lots: {
          orderBy: { position: "asc" },
          include: { items: { orderBy: { position: "asc" }, include: { votes: { orderBy: [{ optionCents: "desc" }, { votedAt: "asc" }], take: 1 }, _count: { select: { votes: true } } } } },
        },
      },
    }),
  ]);
  if (!a || !a.visible || a.status === "CANCELADO") notFound();
  // lembretes: quantos pediram para ser chamados em cada carta (só antes de o leilão começar)
  const scheduled = a.status === "AGENDADO";
  const [watchCounts, me] = scheduled
    ? await Promise.all([db.auctionWatch.groupBy({ by: ["code"], where: { auctionId: a.id }, _count: true }), getCurrentUser()])
    : [[], null];
  const countOf = (code: string) => watchCounts.find((w) => w.code === code)?._count ?? 0;
  const live = a.status === "ATIVO";

  return (
    <div className="space-y-6">
      <Link href="/leiloes" className="text-sm text-brand hover:underline">← Leilões</Link>
      <div className="card flex flex-wrap items-center gap-4 p-5">
        <div className="min-w-0 flex-1">
          <span className={`rounded px-2 py-0.5 text-xs font-bold ${live ? "bg-green-950/60 text-green-300" : "bg-slate-100 text-slate-500"}`}>{live ? "🔴 AO VIVO" : AUCTION_STATUS[a.status]}</span>
          <h1 className="mt-1 text-2xl font-black">{a.name}</h1>
          {a.description && <p className="text-slate-600">{a.description}</p>}
          <p className="text-sm text-slate-500">Início {fmtDate(a.startsAt)} · Fim {fmtDate(a.endsAt)} · pagamento em até {a.paymentDays} dia(s)</p>
        </div>
        {a.status !== "ENCERRADO" && <a href={s.whatsappGroupUrl} target="_blank" rel="noreferrer" className="btn-primary"><WhatsIcon /> Dar lance no grupo</a>}
      </div>

      {a.lots.map((lot) => (
        <section key={lot.id} className="space-y-3">
          <h2 className="text-xl font-bold">📦 Lote {lot.position} — {lot.title}</h2>
          {lot.imageUrl && <img src={lot.imageUrl} alt="" className="max-h-80 rounded-xl" />}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {lot.items.map((it) => {
              const media = itemMedia(it);
              // sua foto (Mídias) primeiro; depois a imagem da busca
              const img = media.find((m) => m.type === "image")?.url || it.imageUrl;
              const top = it.votes[0];
              const hideMarket = lot.hideMarket || it.hideMarket;
              return (
                <div key={it.id} className="card flex flex-col p-3">
                  <SafeImg srcs={[img ?? "", ...media.filter((m) => m.type === "image").map((m) => m.url), it.imageUrl]} alt={it.name} fallback="🃏" className="aspect-[63/88] w-full rounded-lg object-cover" />
                  <p className="mt-2 text-xs text-slate-500">{lot.position}.{it.position}</p>
                  {scheduled && <div className="mt-1"><WatchButton auctionCode={a.code} code={`${lot.position}.${it.position}`} count={countOf(`${lot.position}.${it.position}`)} defaultPhone={me?.phone ?? ""} defaultName={me?.name ?? ""} /></div>}
                  <h3 className="font-semibold leading-tight">{itemTitle(it)}</h3>
                  <p className="text-xs text-slate-500">{it.condition} · {languageFlag(it.language)} {it.language}</p>
                  {media.some((m) => m.type === "video") && <p className="text-xs text-brand">▶ tem vídeo no grupo</p>}
                  <div className="mt-auto space-y-0.5 pt-2 text-sm">
                    {!hideMarket && it.marketCents > 0 && <p className="text-slate-500">Mercado: {formatBRL(it.marketCents)}</p>}
                    <p>Inicial: <strong>{formatBRL(it.startCents)}</strong></p>
                    {it.winningCents != null ? (
                      <p className="font-bold text-green-300">🏆 Arrematado: {formatBRL(it.winningCents)}</p>
                    ) : live && top ? (
                      <p className="font-bold text-brand">Maior lance: {formatBRL(top.optionCents)} · {it._count.votes} voto(s)</p>
                    ) : a.status === "ENCERRADO" ? (
                      <p className="text-slate-500">Sem lances</p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
