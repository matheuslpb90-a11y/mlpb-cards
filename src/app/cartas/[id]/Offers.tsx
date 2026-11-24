"use client";

import { useMemo, useState } from "react";
import { AddToCartButton } from "@/components/AddToCartButton";
import { CONDITIONS, FINISHES, LANGUAGES, languageFlag } from "@/lib/catalog";
import { discountPct, formatBRL } from "@/lib/money";

type Offer = {
  id: string; name: string; setName: string; condition: string; finish: string; language: string;
  priceCents: number; compareAtCents: number | null; stock: number; imageUrl: string; description: string;
};

export function Offers({ offers, initialId }: { offers: Offer[]; initialId: string }) {
  const [cond, setCond] = useState("");
  const [lang, setLang] = useState("");
  const [fin, setFin] = useState("");
  const shown = useMemo(
    () => offers.filter((o) => (!cond || o.condition === cond) && (!lang || o.language === lang) && (!fin || o.finish === fin)),
    [offers, cond, lang, fin],
  );
  const inStock = shown.filter((o) => o.stock > 0);
  const minPrice = inStock.length ? Math.min(...inStock.map((o) => o.priceCents)) : null;
  const totalStock = inStock.reduce((s, o) => s + o.stock, 0);
  const langs = LANGUAGES.filter((l) => offers.some((o) => o.language === l.value));
  const conds = CONDITIONS.filter((c) => offers.some((o) => o.condition === c.value));
  const fins = FINISHES.filter((f) => offers.some((o) => o.finish === f));

  return (
    <div className="space-y-6">
      <div className={`grid gap-3 ${fins.length > 1 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Condição</p>
          <select className="input" value={cond} onChange={(e) => setCond(e.target.value)}>
            <option value="">Todas</option>
            {conds.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Idioma</p>
          <select className="input" value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="">Todos os idiomas</option>
            {langs.map((l) => <option key={l.value} value={l.value}>{l.flag} {l.value}</option>)}
          </select>
        </div>
        {fins.length > 1 && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Tipo</p>
            <select className="input" value={fin} onChange={(e) => setFin(e.target.value)}>
              <option value="">Todos os tipos</option>
              {fins.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 rounded-xl border p-4 text-sm">
        <div><p className="text-xs uppercase tracking-wider text-slate-500">A partir de</p><p className="text-xl font-bold text-brand">{minPrice !== null ? formatBRL(minPrice) : "—"}</p></div>
        <div><p className="text-xs uppercase tracking-wider text-slate-500">Disponíveis</p><p className="text-xl font-bold">{totalStock}</p></div>
        <div><p className="text-xs uppercase tracking-wider text-slate-500">Ofertas</p><p className="text-xl font-bold">{inStock.length}</p></div>
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-bold">Ofertas disponíveis</h2>
        {shown.length === 0 && (
          <div className="rounded-xl border border-dashed p-8 text-center text-slate-500">Nenhuma oferta nessa condição/idioma/tipo no momento.</div>
        )}
        {shown.map((o) => (
          <div key={o.id} className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${o.id === initialId ? "border-brand/60" : ""}`}>
            <span className="rounded bg-slate-100 px-2 py-1 text-sm font-bold">{o.condition}</span>
            <span className="text-sm">{languageFlag(o.language)} {o.language}</span>
            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${o.finish !== "Normal" ? "bg-brand/20 text-brand" : "bg-slate-100 text-slate-400"}`}>{o.finish}</span>
            {o.description && <span className="text-xs text-slate-500">{o.description}</span>}
            <span className="ml-auto text-right">
              {discountPct(o.priceCents, o.compareAtCents) > 0 && (
                <span className="mr-2 text-xs text-slate-500 line-through">{formatBRL(o.compareAtCents!)}</span>
              )}
              <span className="text-lg font-bold text-brand">{formatBRL(o.priceCents)}</span>
            </span>
            <span className="w-16 text-right text-xs text-slate-500">{o.stock > 0 ? `${o.stock} disp.` : "esgotada"}</span>
            <div className="w-full sm:w-48">
              <AddToCartButton className="text-sm" card={{ cardId: o.id, name: o.name, setName: o.setName, priceCents: o.priceCents, imageUrl: o.imageUrl, stock: o.stock }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
