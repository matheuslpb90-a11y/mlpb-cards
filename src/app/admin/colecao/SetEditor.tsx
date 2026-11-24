"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState, useTransition } from "react";
import { CONDITIONS, FINISHES, LANGUAGES, numKey, variantKey } from "@/lib/catalog";
import { formatBRL, parseBRLToCents } from "@/lib/money";
import { bulkSaveCardsAction } from "./actions";

type SetInfo = { id: string; nameEn: string; namePt: string; logo: string; total: number; official: number };
type SetCard = { tcgdexId: string; localId: string; number: string; name: string; image: string; imageLarge: string };
type Variant = { id: string; number: string; language: string; finish: string; condition: string; stock: number; priceCents: number; active: boolean };
type Row = { sel: boolean; language: string; finish: string; condition: string; price: string; qty: string; touchedQty: boolean; touchedPrice: boolean };
type Defaults = { language: string; finish: string; condition: string };

const COND_SHORT = CONDITIONS.map((c) => c.value);
const short = (lang: string) => LANGUAGES.find((l) => l.value === lang)?.short ?? lang;
const cents = (s: string) => parseBRLToCents(s) ?? 0;
const toBRL = (c: number) => (c / 100).toFixed(2).replace(".", ",");

export function SetEditor() {
  const [sets, setSets] = useState<SetInfo[]>([]);
  const [q, setQ] = useState("");
  const [set, setSet] = useState<(SetInfo & { cards: SetCard[]; serie: string; releaseDate: string }) | null>(null);
  const [setName, setSetName] = useState("");
  const [variants, setVariants] = useState<Variant[]>([]);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [defs, setDefs] = useState<Defaults>({ language: "Português", finish: "Normal", condition: "NM" });
  const [filter, setFilter] = useState<"todas" | "tenho" | "marcadas">("todas");
  const [find, setFind] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>();
  const [loading, setLoading] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    fetch("/api/admin/colecao").then((r) => r.json()).then((j) => (j.sets ? setSets(j.sets) : setMsg({ error: j.error }))).catch(() => setMsg({ error: "Não consegui carregar as coleções." }));
  }, []);

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = t ? sets.filter((s) => `${s.nameEn} ${s.namePt} ${s.id}`.toLowerCase().includes(t)) : sets;
    return list.slice(0, t ? 30 : 12);
  }, [sets, q]);

  async function openSet(id: string) {
    setLoading("Carregando as cartas da coleção…");
    setMsg(undefined);
    try {
      const j = await (await fetch(`/api/admin/colecao?id=${encodeURIComponent(id)}`)).json();
      if (j.error) throw new Error(j.error);
      setSet(j.set);
      // nome da coleção no site: o que você já usa no estoque; senão português; senão inglês
      const used = (j.variants as (Variant & { setName?: string })[])[0]?.setName;
      setSetName(used || j.set.namePt || j.set.nameEn);
      setVariants(j.variants);
      setRows({});
      setFind("");
    } catch (e) {
      setMsg({ error: e instanceof Error ? e.message : String(e) });
    }
    setLoading("");
  }

  const byKey = useMemo(() => new Map(variants.map((v) => [variantKey(v), v])), [variants]);
  const byNumber = useMemo(() => {
    const m = new Map<string, Variant[]>();
    for (const v of variants) m.set(numKey(v.number), [...(m.get(numKey(v.number)) ?? []), v]);
    return m;
  }, [variants]);

  const rowOf = (c: SetCard): Row => {
    const r = rows[c.tcgdexId];
    if (r) return r;
    return { sel: false, ...defs, price: "", qty: "", touchedQty: false, touchedPrice: false };
  };
  const existingOf = (c: SetCard, r: Row) => byKey.get(variantKey({ number: c.number, language: r.language, finish: r.finish, condition: r.condition }));
  const qtyOf = (c: SetCard, r: Row) => (r.touchedQty ? r.qty : String(existingOf(c, r)?.stock ?? (r.sel ? 1 : 0)));
  const priceOf = (c: SetCard, r: Row) => (r.touchedPrice ? r.price : existingOf(c, r) ? toBRL(existingOf(c, r)!.priceCents) : r.price);

  const update = (c: SetCard, patch: Partial<Row>) => setRows((p) => ({ ...p, [c.tcgdexId]: { ...rowOf(c), ...patch } }));
  // trocar idioma/tipo/estado mostra o estoque daquela versão (zera o que foi digitado)
  const changeVariant = (c: SetCard, patch: Partial<Row>) => update(c, { ...patch, touchedQty: false, touchedPrice: false, price: "" });

  function applyDefaults() {
    if (!set) return;
    setRows((p) => {
      const n = { ...p };
      for (const c of set.cards) n[c.tcgdexId] = { ...(n[c.tcgdexId] ?? { sel: false, price: "", qty: "", touchedQty: false, touchedPrice: false }), ...defs, touchedQty: false, touchedPrice: false, price: "" };
      return n;
    });
  }

  async function mypPrice(c: SetCard) {
    const r = rowOf(c);
    update(c, { price: "…", touchedPrice: true });
    try {
      const qs = new URLSearchParams({ myp: c.name, num: c.number, idioma: r.language, finish: r.finish });
      const j = (await (await fetch(`/api/admin/buscar-carta?${qs}`)).json()) as { results?: { price: { cents: number } | null }[]; message?: string };
      const best = (j.results ?? []).find((x) => x.price);
      update(c, { price: best?.price ? toBRL(best.price.cents) : "", touchedPrice: true, sel: true });
      if (!best?.price) setMsg({ error: `A MYP não tem preço para ${c.name} (${c.number}). Digite o preço.` });
    } catch {
      update(c, { price: "", touchedPrice: true });
    }
  }

  const shown = useMemo(() => {
    if (!set) return [];
    const t = find.trim().toLowerCase();
    return set.cards.filter((c) => {
      if (t && !`${c.name} ${c.localId}`.toLowerCase().includes(t)) return false;
      if (filter === "tenho") return (byNumber.get(numKey(c.number)) ?? []).some((v) => v.stock > 0);
      if (filter === "marcadas") return rows[c.tcgdexId]?.sel;
      return true;
    });
  }, [set, find, filter, byNumber, rows]);

  const selected = set ? set.cards.filter((c) => rows[c.tcgdexId]?.sel) : [];
  const units = selected.reduce((s, c) => s + (Number(qtyOf(c, rowOf(c))) || 0), 0);
  const value = selected.reduce((s, c) => s + (Number(qtyOf(c, rowOf(c))) || 0) * cents(priceOf(c, rowOf(c))), 0);
  const ownedCount = set ? set.cards.filter((c) => (byNumber.get(numKey(c.number)) ?? []).some((v) => v.stock > 0)).length : 0;

  function save() {
    if (!set) return;
    const missing = selected.find((c) => cents(priceOf(c, rowOf(c))) <= 0);
    if (missing) return setMsg({ error: `Falta o preço de ${missing.name} (${missing.number}).` });
    const items = selected.map((c) => {
      const r = rowOf(c);
      return { tcgdexId: c.tcgdexId, name: c.name, number: c.number, imageUrl: c.imageLarge, language: r.language, finish: r.finish, condition: r.condition, priceCents: cents(priceOf(c, r)), stock: Math.max(0, Math.round(Number(qtyOf(c, r)) || 0)) };
    });
    start(async () => {
      const res = await bulkSaveCardsAction(setName, [set.nameEn, set.namePt], items);
      setMsg(res);
      if ("variants" in res && res.variants) {
        setVariants(res.variants);
        setRows({});
      }
    });
  }

  const sel = "input !py-1 !px-2 text-xs";
  return (
    <div className="space-y-4 pb-28">
      <section className="card space-y-3 p-4">
        <input className="input" placeholder="🔎 Nome da coleção (ex.: Ascended Heroes, Heróis Excelsos, 151…)" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          {matches.map((s) => (
            <button key={s.id} type="button" onClick={() => openSet(s.id)}
              className={`rounded-full border px-3 py-1 text-sm ${set?.id === s.id ? "border-brand bg-brand font-bold text-black" : "border-slate-200 hover:border-brand"}`}>
              {s.namePt && s.namePt !== s.nameEn ? `${s.nameEn} · ${s.namePt}` : s.nameEn}
            </button>
          ))}
          {!sets.length && !msg?.error && <span className="text-sm text-slate-500">Carregando coleções…</span>}
        </div>
      </section>

      {loading && <p className="card p-4 text-sm text-slate-500">{loading}</p>}
      {msg?.error && <p className="rounded bg-red-950/60 p-3 text-sm text-red-300">{msg.error}</p>}
      {msg?.ok && <p className="rounded bg-green-950/60 p-3 text-sm text-green-300">{msg.ok}</p>}

      {set && !loading && (
        <>
          <section className="card flex flex-wrap items-center gap-4 p-4">
            {set.logo && <img src={set.logo} alt="" className="h-12 max-w-[140px] object-contain" />}
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold">{set.nameEn}{set.namePt && set.namePt !== set.nameEn ? ` · ${set.namePt}` : ""}</p>
              <p className="text-xs text-slate-500">{set.cards.length} cartas · {set.serie} {set.releaseDate && `· ${set.releaseDate.slice(0, 4)}`}</p>
              <p className="text-xs text-brand">✓ {ownedCount} carta(s) dessa coleção já no estoque</p>
            </div>
            <div className="w-full sm:w-72">
              <label className="label">Nome da coleção no site</label>
              <input className="input" value={setName} onChange={(e) => setSetName(e.target.value)} />
            </div>
          </section>

          <section className="card space-y-2 border-dashed p-4">
            <p className="text-sm font-bold text-brand">⚡ Padrão para todas as cartas</p>
            <div className="grid grid-cols-3 gap-2">
              <select className="input" value={defs.language} onChange={(e) => setDefs({ ...defs, language: e.target.value })}>{LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.flag} {l.value}</option>)}</select>
              <select className="input" value={defs.finish} onChange={(e) => setDefs({ ...defs, finish: e.target.value })}>{FINISHES.map((f) => <option key={f}>{f}</option>)}</select>
              <select className="input" value={defs.condition} onChange={(e) => setDefs({ ...defs, condition: e.target.value })}>{COND_SHORT.map((c) => <option key={c}>{c}</option>)}</select>
            </div>
            <button type="button" className="btn-outline text-sm" onClick={applyDefaults}>Aplicar a todas</button>
          </section>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            {(["todas", "tenho", "marcadas"] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFilter(f)} className={`rounded-full border px-3 py-1 ${filter === f ? "border-brand bg-brand font-bold text-black" : "border-slate-200"}`}>
                {f === "todas" ? "Todas" : f === "tenho" ? "Só as que tenho" : `Marcadas (${selected.length})`}
              </button>
            ))}
            <input className="input ml-auto w-44 !py-1 text-sm" placeholder="Filtrar nome ou nº" value={find} onChange={(e) => setFind(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {shown.map((c) => {
              const r = rowOf(c);
              const ex = existingOf(c, r);
              const others = (byNumber.get(numKey(c.number)) ?? []).filter((v) => v.stock > 0);
              return (
                <div key={c.tcgdexId} className={`relative space-y-1 rounded-xl border-2 bg-[#151515] p-2 ${r.sel ? "border-brand" : "border-transparent"}`}>
                  <button type="button" onClick={() => update(c, { sel: !r.sel })} className="block w-full">
                    <span className={`absolute left-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-md border-2 text-sm font-black ${r.sel ? "border-brand bg-brand text-black" : "border-white/60 bg-black/50"}`}>{r.sel ? "✓" : ""}</span>
                    {c.image ? <img src={c.image} alt={c.name} loading="lazy" className="aspect-[63/88] w-full rounded-lg object-contain" /> : <div className="flex aspect-[63/88] items-center justify-center rounded-lg bg-black/40 text-3xl">🃏</div>}
                  </button>
                  <p className="truncate text-sm font-bold" title={c.name}>{c.name}</p>
                  <p className="text-[11px] text-slate-500">{c.number}</p>
                  {others.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {others.map((v) => (
                        <button key={v.id} type="button" title="Carregar esta versão"
                          onClick={() => changeVariant(c, { language: v.language, finish: v.finish, condition: v.condition, sel: true })}
                          className="rounded bg-green-950/60 px-1 text-[10px] text-green-300">
                          {short(v.language)}·{v.condition}{v.finish !== "Normal" ? `·${v.finish.replace(" Foil", "")}` : ""} ×{v.stock}
                        </button>
                      ))}
                    </div>
                  )}
                  <select className={sel} value={r.language} onChange={(e) => changeVariant(c, { language: e.target.value })}>{LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.flag} {l.value}</option>)}</select>
                  <div className="grid grid-cols-2 gap-1">
                    <select className={sel} value={r.finish} onChange={(e) => changeVariant(c, { finish: e.target.value })}>{FINISHES.map((f) => <option key={f}>{f}</option>)}</select>
                    <select className={sel} value={r.condition} onChange={(e) => changeVariant(c, { condition: e.target.value })}>{COND_SHORT.map((x) => <option key={x}>{x}</option>)}</select>
                  </div>
                  <p className={`text-[11px] ${ex ? "font-bold text-green-300" : "text-slate-500"}`}>
                    {ex ? `📦 Em estoque: ${ex.stock} · ${formatBRL(ex.priceCents)}` : "📦 Em estoque: 0 (versão nova)"}
                  </p>
                  <div className="flex gap-1">
                    <input className={`${sel} w-full font-bold text-brand`} inputMode="decimal" placeholder="Preço R$" value={priceOf(c, r)} onChange={(e) => update(c, { price: e.target.value, touchedPrice: true, sel: true })} />
                    <button type="button" className="rounded border px-1 text-[10px] text-slate-400 hover:border-brand" title="Preço de referência da MYP Cards" onClick={() => mypPrice(c)}>MYP</button>
                  </div>
                  <div className="flex items-center justify-between rounded bg-black/30 px-1">
                    <button type="button" className="px-2 text-lg text-brand" onClick={() => update(c, { qty: String(Math.max(0, (Number(qtyOf(c, r)) || 0) - 1)), touchedQty: true, sel: true })}>−</button>
                    <input className="w-10 bg-transparent text-center font-bold outline-none" inputMode="numeric" value={qtyOf(c, r)} onChange={(e) => update(c, { qty: e.target.value.replace(/\D/g, ""), touchedQty: true, sel: true })} />
                    <button type="button" className="px-2 text-lg text-brand" onClick={() => update(c, { qty: String((Number(qtyOf(c, r)) || 0) + 1), touchedQty: true, sel: true })}>+</button>
                  </div>
                  <p className="text-center text-[10px] text-slate-500">estoque total desta versão</p>
                </div>
              );
            })}
          </div>
          {shown.length === 0 && <p className="card p-6 text-center text-sm text-slate-500">Nenhuma carta nesse filtro.</p>}
        </>
      )}

      {set && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-black/90 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <p className="flex-1 text-sm text-slate-300"><b className="text-white">{selected.length} carta(s)</b> marcadas · {units} unidade(s) · {formatBRL(value)}</p>
            <button type="button" className="btn-primary" disabled={pending || !selected.length} onClick={save}>{pending ? "Salvando…" : "Salvar no estoque"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
