"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export type Facet = { value: string; label: string; count: number };

type Props = {
  languages: Facet[];
  conditions: Facet[];
  finishes: Facet[];
  showCardFacets: boolean;
  priceMax: number; // em reais
};

const list = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);

export function FilterButton(props: Props) {
  const params = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<string[]>(list(params.get("idioma")));
  const [cond, setCond] = useState<string[]>(list(params.get("condicao")));
  const [fin, setFin] = useState<string[]>(list(params.get("acabamento")));
  const [min, setMin] = useState(Number(params.get("preco_min") ?? 0));
  const [max, setMax] = useState(Number(params.get("preco_max") ?? props.priceMax) || props.priceMax);

  const activeCount =
    list(params.get("idioma")).length + list(params.get("condicao")).length + list(params.get("acabamento")).length +
    (params.get("preco_min") || params.get("preco_max") ? 1 : 0);

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  function apply(reset = false) {
    const q = new URLSearchParams(params.toString());
    const put = (k: string, v: string) => (v ? q.set(k, v) : q.delete(k));
    put("idioma", reset ? "" : lang.join(","));
    put("condicao", reset ? "" : cond.join(","));
    put("acabamento", reset ? "" : fin.join(","));
    put("preco_min", reset || min <= 0 ? "" : String(min));
    put("preco_max", reset || max >= props.priceMax ? "" : String(max));
    if (reset) {
      setLang([]); setCond([]); setFin([]); setMin(0); setMax(props.priceMax);
    }
    setOpen(false);
    router.push(`/catalogo?${q.toString()}`);
  }

  const step = props.priceMax > 500 ? 10 : 1;
  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  const Chips = ({ title, items, sel, set }: { title: string; items: Facet[]; sel: string[]; set: (v: string[]) => void }) =>
    items.length === 0 ? null : (
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</p>
        <div className="flex flex-wrap gap-2">
          {items.map((f) => {
            const on = sel.includes(f.value);
            return (
              <button
                type="button"
                key={f.value}
                onClick={() => toggle(sel, set, f.value)}
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                  on ? "border-brand bg-brand/20 text-white" : "border-slate-300 bg-slate-100 text-slate-700 hover:border-slate-400"
                } ${f.count === 0 && !on ? "opacity-40" : ""}`}
              >
                {f.label} <span className="ml-1 text-xs font-normal text-slate-500">{f.count}</span>
              </button>
            );
          })}
        </div>
      </div>
    );

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-outline">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M7 12h10M10 18h4" /></svg>
        Filtrar{activeCount > 0 && <span className="rounded-full bg-brand px-2 text-xs text-white">{activeCount}</span>}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-lg space-y-5 overflow-y-auto rounded-t-2xl border bg-panel p-6 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Filtrar</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-2xl leading-none text-slate-500 hover:text-white" aria-label="Fechar">×</button>
            </div>

            <Chips title="Idioma" items={props.languages} sel={lang} set={setLang} />
            {props.showCardFacets && <Chips title="Condição" items={props.conditions} sel={cond} set={setCond} />}
            {props.showCardFacets && <Chips title="Tipo" items={props.finishes} sel={fin} set={setFin} />}

            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Preço</p>
              <p className="font-semibold text-brand">{fmt(min)} – {fmt(max)}</p>
              <div className="relative h-6">
                <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded bg-slate-200" />
                <div
                  className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded bg-brand"
                  style={{ left: `${(min / props.priceMax) * 100}%`, right: `${100 - (max / props.priceMax) * 100}%` }}
                />
                <input type="range" min={0} max={props.priceMax} step={step} value={min}
                  onChange={(e) => setMin(Math.min(Number(e.target.value), max - step))} className="range-thumb absolute inset-0 w-full" aria-label="Preço mínimo" />
                <input type="range" min={0} max={props.priceMax} step={step} value={max}
                  onChange={(e) => setMax(Math.max(Number(e.target.value), min + step))} className="range-thumb absolute inset-0 w-full" aria-label="Preço máximo" />
              </div>
              <div className="flex justify-between text-sm text-slate-500">
                <span>Mín: <strong className="text-white">{fmt(min)}</strong></span>
                <span>Máx: <strong className="text-white">{fmt(max)}</strong></span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => apply(true)} className="btn-outline flex-1">Limpar</button>
              <button type="button" onClick={() => apply()} className="btn-primary flex-1">Aplicar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
