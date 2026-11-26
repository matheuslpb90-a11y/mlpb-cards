"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { formatBRL } from "@/lib/money";
import { setCollectionAction, setManyAction } from "../actions";

type Card = { cardId: string; number: string; name: string; namePt: string; image: string; imageLarge: string; key: string };
type Entry = { qty: number; wish: boolean };
type SetInfo = { id: string; nameEn: string; namePt: string; logo: string; official: number; total: number; serie: string; releaseDate: string };

export function CollectionGrid({ logged, set, cards, initial, forSale }: { logged: boolean; set: SetInfo; cards: Card[]; initial: Record<string, Entry>; forSale: Record<string, { id: string; priceCents: number }> }) {
  const [mine, setMine] = useState<Record<string, Entry>>(initial);
  const [filter, setFilter] = useState<"todas" | "tenho" | "faltam" | "desejos" | "venda">("todas");
  const [q, setQ] = useState("");
  const [zoom, setZoom] = useState<Card | null>(null);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  const have = (c: Card) => (mine[c.cardId]?.qty ?? 0) > 0;
  const haveCount = cards.filter(have).length;
  const officialCards = cards.filter((c) => /^\d+$/.test(c.number.split("/")[0]) && Number(c.number.split("/")[0]) <= (set.official || Infinity));
  const officialHave = officialCards.filter(have).length;
  const pct = Math.round((officialHave / (officialCards.length || 1)) * 100);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return cards.filter((c) => {
      if (t && !`${c.name} ${c.namePt} ${c.number}`.toLowerCase().includes(t)) return false;
      if (filter === "tenho") return have(c);
      if (filter === "faltam") return !have(c);
      if (filter === "desejos") return mine[c.cardId]?.wish;
      if (filter === "venda") return !!forSale[c.key];
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, q, filter, mine, forSale]);

  function save(c: Card, next: Entry) {
    if (!logged) return setMsg("Entre na sua conta para salvar sua coleção (é grátis).");
    const prev = mine[c.cardId];
    setMine((m) => ({ ...m, [c.cardId]: next }));
    start(async () => {
      const r = await setCollectionAction({ setId: set.id, cardId: c.cardId, number: c.number, name: c.name, image: c.image }, next.qty, next.wish);
      if (r.error) {
        setMsg(r.error);
        setMine((m) => ({ ...m, [c.cardId]: prev ?? { qty: 0, wish: false } }));
      }
    });
  }
  function markShown(haveIt: boolean) {
    if (!logged) return setMsg("Entre na sua conta para salvar sua coleção (é grátis).");
    if (!confirm(haveIt ? `Marcar as ${shown.length} cartas mostradas como "tenho"?` : `Desmarcar as ${shown.length} cartas mostradas?`)) return;
    const refs = shown.map((c) => ({ setId: set.id, cardId: c.cardId, number: c.number, name: c.name, image: c.image }));
    setMine((m) => {
      const n = { ...m };
      for (const c of shown) n[c.cardId] = { qty: haveIt ? Math.max(1, m[c.cardId]?.qty ?? 0) : 0, wish: m[c.cardId]?.wish ?? false };
      return n;
    });
    start(async () => {
      const r = await setManyAction(refs, haveIt);
      if (r.error) setMsg(r.error);
    });
  }

  const tab = (f: typeof filter, label: string) => (
    <button key={f} type="button" onClick={() => setFilter(f)} className={`rounded-full border px-3 py-1 text-sm ${filter === f ? "border-brand bg-brand font-bold text-black" : "border-slate-200"}`}>{label}</button>
  );

  return (
    <div className="space-y-4">
      <section className="card flex flex-wrap items-center gap-4 p-5">
        {set.logo && <img src={set.logo} alt="" className="h-14 max-w-[160px] object-contain" />}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-black">{set.namePt || set.nameEn}</h1>
          <p className="text-xs text-slate-500">{set.namePt && set.namePt !== set.nameEn ? `${set.nameEn} · ` : ""}{set.serie}{set.releaseDate ? ` · ${set.releaseDate.slice(0, 4)}` : ""}</p>
        </div>
        <div className="w-full sm:w-64">
          <div className="flex justify-between text-sm"><span>{officialHave} de {officialCards.length || set.official}</span><b className="text-brand">{pct}%</b></div>
          <div className="mt-1 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-gradient-to-r from-brand-amber to-brand transition-all" style={{ width: `${pct}%` }} /></div>
          <p className="mt-1 text-[11px] text-slate-500">{haveCount} cartas diferentes no total{set.total > set.official ? ` (inclui secretas)` : ""}</p>
        </div>
      </section>

      {!logged && (
        <p className="card p-3 text-sm">Você está só olhando. <Link href={`/entrar?next=/colecao/${encodeURIComponent(set.id)}`} className="text-brand underline">Entre</Link> ou <Link href={`/cadastro?next=/colecao/${encodeURIComponent(set.id)}`} className="text-brand underline">crie sua conta grátis</Link> para salvar sua coleção.</p>
      )}
      {msg && <p className="rounded bg-amber-950/50 p-2 text-sm text-amber-200">{msg}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {tab("todas", `Todas (${cards.length})`)}
        {tab("tenho", `Tenho (${haveCount})`)}
        {tab("faltam", `Faltam (${cards.length - haveCount})`)}
        {tab("desejos", `❤️ Desejos (${Object.values(mine).filter((e) => e.wish).length})`)}
        {Object.keys(forSale).length > 0 && tab("venda", `🛒 À venda na MLPB (${cards.filter((c) => forSale[c.key]).length})`)}
        <input className="input ml-auto w-44 !py-1 text-sm" placeholder="Filtrar nome ou nº" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {logged && shown.length > 0 && (
        <div className="flex gap-2 text-xs">
          <button type="button" className="rounded border px-2 py-1 hover:border-brand" onClick={() => markShown(true)} disabled={pending}>✓ Marcar mostradas como "tenho"</button>
          <button type="button" className="rounded border px-2 py-1 hover:border-brand" onClick={() => markShown(false)} disabled={pending}>Desmarcar mostradas</button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
        {shown.map((c) => {
          const e = mine[c.cardId] ?? { qty: 0, wish: false };
          const owned = e.qty > 0;
          const sale = forSale[c.key];
          return (
            <div key={c.cardId} className={`relative rounded-lg border-2 p-1 ${owned ? "border-brand bg-brand/5" : "border-transparent"}`}>
              <button type="button" onClick={() => save(c, { ...e, qty: owned ? 0 : 1 })} className="block w-full" title={owned ? "Tirar da coleção" : "Tenho esta carta"}>
                {c.image
                  ? <img src={c.image} alt={c.name} loading="lazy" className={`aspect-[63/88] w-full rounded object-contain transition ${owned ? "" : "opacity-40 grayscale"}`} />
                  : <div className="flex aspect-[63/88] items-center justify-center rounded bg-slate-100 text-2xl">🃏</div>}
              </button>
              {owned && <span className="absolute left-2 top-2 rounded bg-brand px-1 text-[10px] font-black text-black">✓{e.qty > 1 ? ` ×${e.qty}` : ""}</span>}
              <button type="button" onClick={() => save(c, { ...e, wish: !e.wish })} className="absolute right-2 top-2 text-sm" title="Lista de desejos">{e.wish ? "❤️" : "🤍"}</button>
              <p className="mt-1 truncate text-[11px] font-semibold" title={c.namePt || c.name}>{c.namePt || c.name}</p>
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>{c.number}</span>
                <button type="button" onClick={() => setZoom(c)} className="underline">ver</button>
              </div>
              {owned && (
                <div className="mt-0.5 flex items-center justify-between rounded bg-black/30 px-1 text-xs">
                  <button type="button" className="px-1 text-brand" onClick={() => save(c, { ...e, qty: e.qty - 1 })}>−</button>
                  <span>{e.qty}</span>
                  <button type="button" className="px-1 text-brand" onClick={() => save(c, { ...e, qty: e.qty + 1 })}>+</button>
                </div>
              )}
              {!owned && sale && (
                <Link href={`/cartas/${sale.id}`} className="mt-0.5 block rounded bg-green-950/60 px-1 py-0.5 text-center text-[10px] font-bold text-green-300">🛒 {formatBRL(sale.priceCents)}</Link>
              )}
            </div>
          );
        })}
      </div>
      {shown.length === 0 && <p className="card p-6 text-center text-sm text-slate-500">Nenhuma carta nesse filtro.</p>}

      {zoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setZoom(null)}>
          <div className="max-h-full space-y-2 text-center" onClick={(e) => e.stopPropagation()}>
            <img src={zoom.imageLarge || zoom.image} alt={zoom.name} className="mx-auto max-h-[75vh] rounded-xl" />
            <p className="font-bold">{zoom.namePt || zoom.name} <span className="text-slate-400">· {zoom.number}</span></p>
            {forSale[zoom.key] && <Link href={`/cartas/${forSale[zoom.key].id}`} className="btn-primary">🛒 Comprar na MLPB por {formatBRL(forSale[zoom.key].priceCents)}</Link>}
            <button type="button" className="block w-full text-sm text-slate-400" onClick={() => setZoom(null)}>fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}
