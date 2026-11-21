"use client";

import { useActionState, useRef, useState } from "react";
import { saveCardAction, uploadImageAction } from "@/app/admin/actions";
import { CardImage } from "@/components/CardImage";
import { CONDITIONS, FINISHES, LANGUAGES, PRODUCT_CATEGORIES } from "@/lib/catalog";
import { CardLookup, type LookupResult } from "./CardLookup";
import { shrinkImage } from "./ImageUploadField";

export type CardFormValues = {
  id?: string;
  kind: "CARTA" | "PRODUTO";
  category: string;
  featured: boolean;
  name: string;
  game: string;
  setName: string;
  number: string;
  rarity: string;
  condition: string;
  finish: string;
  language: string;
  price: string;
  compareAt: string;
  stock: number;
  imageUrl: string;
  description: string;
  active: boolean;
};

export function CardForm({ initial }: { initial: CardFormValues }) {
  const [state, action, pending] = useActionState(saveCardAction, undefined);
  const [v, setV] = useState(initial);
  const [uploading, setUploading] = useState("");
  const isCard = v.kind === "CARTA";

  const bind = (k: keyof CardFormValues) => ({
    name: k,
    value: String(v[k] ?? ""),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value }),
  });

  const [market, setMarket] = useState<{ cents: number; basis?: string; link?: string } | null>(null);
  const [marketMsg, setMarketMsg] = useState("");
  const reqRef = useRef(0);
  const fmt = (c: number) => (c / 100).toFixed(2).replace(".", ",");

  /** Busca o valor de mercado no Brasil (MYP Cards) e preenche o preço se estiver vazio. */
  async function fetchMarket(name: string, number: string, language: string, finish: string, fill: boolean) {
    if (!name.trim()) return;
    const id = ++reqRef.current;
    setMarketMsg("Buscando preço de mercado na MYP…");
    try {
      const q = new URLSearchParams({ myp: name, num: number, idioma: language, finish });
      const j = (await (await fetch(`/api/admin/buscar-carta?${q}`)).json()) as {
        results?: { link: string; price: { cents: number; basis: string } | null }[];
        message?: string;
      };
      if (id !== reqRef.current) return; // chegou uma busca mais nova
      const best = (j.results ?? []).find((c) => c.price);
      if (!best?.price) {
        setMarket(null);
        setMarketMsg(j.message ?? "A MYP não tem oferta dessa carta agora — defina o preço manualmente.");
        return;
      }
      const cents = best.price.cents;
      setMarket({ cents, basis: best.price.basis, link: best.link });
      setMarketMsg("");
      if (fill) setV((prev) => (prev.price ? prev : { ...prev, price: fmt(cents) }));
    } catch {
      if (id === reqRef.current) setMarketMsg("Não deu para consultar a MYP agora.");
    }
  }

  function applyLookup(r: LookupResult) {
    if (r.marketCents) {
      reqRef.current++;
      setMarket({ cents: r.marketCents, basis: r.marketBasis, link: r.marketLink });
      setMarketMsg("");
      setV((prev) => (prev.price ? prev : { ...prev, price: fmt(r.marketCents!) }));
    } else {
      // carta escolhida no TCGdex: procura o preço dela na MYP (nome + número + idioma + variante)
      fetchMarket(r.name, r.number, r.language || v.language, v.finish, true);
    }
    setV((prev) => ({
      ...prev,
      name: r.name || prev.name,
      game: "Pokémon",
      setName: r.setName || prev.setName,
      number: r.number || prev.number,
      rarity: r.rarity || prev.rarity,
      imageUrl: r.imageUrl || prev.imageUrl,
      language: r.language || prev.language,
    }));
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading("Enviando foto…");
    try {
      const res = await uploadImageAction(await shrinkImage(file));
      if (res.url) {
        setV((prev) => ({ ...prev, imageUrl: res.url! }));
        setUploading("Foto enviada ✓");
      } else setUploading(res.error ?? "Não foi possível enviar a foto.");
    } catch {
      setUploading("Não foi possível ler essa imagem. Tente JPG ou PNG.");
    }
    e.target.value = "";
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
      <div className="space-y-6">
        {isCard && <CardLookup onPick={applyLookup} defaultLanguage={v.language} />}
        <form action={action} className="card grid gap-3 p-5 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">{isCard ? "2. Dados da carta" : "Dados do produto"}</h2>
          {v.id && <input type="hidden" name="id" value={v.id} />}
          <input type="hidden" name="kind" value={v.kind} />
          <input type="hidden" name="game" value={v.game || "Pokémon"} />

          <div className="sm:col-span-2"><label className="label">{isCard ? "Nome da carta" : "Nome do produto"}</label><input className="input" required {...bind("name")} /></div>

          {isCard ? (
            <>
              <div><label className="label">Coleção</label><input className="input" required {...bind("setName")} /></div>
              <div><label className="label">Número</label><input className="input" placeholder="025/165" {...bind("number")} /></div>
              <div><label className="label">Raridade</label><input className="input" {...bind("rarity")} /></div>
              <div><label className="label">Estado</label>
                <select className="input" {...bind("condition")}>{CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
              </div>
              <div><label className="label">Tipo</label>
                <select className="input" {...bind("finish")}>{FINISHES.map((f) => <option key={f} value={f}>{f}</option>)}</select>
              </div>
            </>
          ) : (
            <>
              <div><label className="label">Categoria</label>
                <select className="input" required {...bind("category")}>
                  <option value="">Escolha…</option>
                  {PRODUCT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label className="label">Coleção (opcional)</label><input className="input" {...bind("setName")} /></div>
            </>
          )}

          <div><label className="label">Idioma</label>
            <select className="input" {...bind("language")}>{LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.flag} {l.value}</option>)}</select>
          </div>
          <div>
            <label className="label">Preço (R$)</label>
            <input className="input" required inputMode="decimal" placeholder="12,50" {...bind("price")} />
            {isCard && (
              <p className="mt-1 text-xs text-slate-500">
                {market ? (
                  <>
                    Mercado BR: <strong className="text-green-300">R$ {fmt(market.cents)}</strong>
                    {market.basis ? ` (${market.basis})` : ""} ·{" "}
                    <button type="button" className="text-brand underline" onClick={() => setV((prev) => ({ ...prev, price: fmt(market.cents) }))}>usar este preço</button> · fonte{" "}
                    <a href={market.link || "https://mypcards.com"} target="_blank" rel="noreferrer" className="underline">MYP Cards</a> ·{" "}
                  </>
                ) : (
                  marketMsg && <>{marketMsg} · </>
                )}
                <button type="button" className="text-brand underline" onClick={() => fetchMarket(v.name, v.number, v.language, v.finish, false)}>🔄 preço MYP</button>
                <span className="text-slate-600"> (usa nome, número, idioma e variante preenchidos)</span>
              </p>
            )}
          </div>
          <div><label className="label">Preço original “de” (opcional — mostra desconto)</label><input className="input" inputMode="decimal" placeholder="ex.: 15,00" {...bind("compareAt")} /></div>
          <div><label className="label">Estoque</label><input className="input" type="number" min={0} required {...bind("stock")} /></div>

          <div className="space-y-2 sm:col-span-2">
            <label className="label">Imagem</label>
            <div className="flex flex-wrap items-center gap-2">
              <label className="btn-outline cursor-pointer text-sm">
                📷 Enviar foto
                <input type="file" accept="image/*" className="hidden" onChange={onPhoto} />
              </label>
              {uploading && <span className="text-sm text-slate-600">{uploading}</span>}
            </div>
            <input className="input" placeholder="…ou cole o link de uma imagem (https://…)" {...bind("imageUrl")} />
          </div>

          <div className="sm:col-span-2"><label className="label">Descrição / observações</label><textarea className="input min-h-20" {...bind("description")} /></div>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="active" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} /> Mostrar no site
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="featured" checked={v.featured} onChange={(e) => setV({ ...v, featured: e.target.checked })} /> ⭐ Destaque na tela de início
          </label>
          {state?.error && <p className="rounded bg-red-950/60 p-2 text-sm text-red-300 sm:col-span-2">{state.error}</p>}
          <button className="btn-primary sm:col-span-2" disabled={pending || uploading === "Enviando foto…"}>
            {pending ? "Salvando…" : isCard ? "Salvar carta" : "Salvar produto"}
          </button>
        </form>
      </div>
      <aside className="order-first space-y-2 lg:order-none">
        <p className="text-sm font-semibold text-slate-500">Pré-visualização</p>
        <div className="mx-auto w-40 lg:w-full"><CardImage src={v.imageUrl} alt={v.name} className={isCard ? "" : "object-contain bg-panel"} /></div>
      </aside>
    </div>
  );
}
