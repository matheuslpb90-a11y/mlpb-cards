import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { ProductTile } from "@/components/ProductTile";
import { CONDITIONS, FINISHES, KINDS, LANGUAGES, PRODUCT_CATEGORIES, kindFromSlug } from "@/lib/catalog";
import { FilterButton } from "./FilterModal";
import { discountPct } from "@/lib/money";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type SP = Promise<{
  q?: string; tipo?: string; condicao?: string; idioma?: string; acabamento?: string; categoria?: string;
  colecao?: string; ordem?: string; esgotados?: string; preco_min?: string; preco_max?: string;
}>;

const list = (v?: string) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);

export async function generateMetadata({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const kind = kindFromSlug(sp.tipo);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const what = kind === "PRODUTO" ? "Produtos selados Pokémon (booster, ETB, box)" : kind ? "Cartas Pokémon avulsas" : "Cartas Pokémon e produtos selados";
  const title = q ? `${q} — ${what} | MLPB Cards` : `${what} | MLPB Cards`;
  const description = q
    ? `Encontre ${q} na MLPB Cards: cartas Pokémon TCG com preço, estado e idioma. Envio para todo o Brasil.`
    : kind === "PRODUTO"
      ? "Compre produtos selados de Pokémon TCG: booster box, Elite Trainer Box, blisters e coleções especiais. Envio para todo o Brasil."
      : "Compre cartas Pokémon avulsas em português, inglês e japonês: full arts, ex, ilustrações especiais e raras. Filtre por coleção, idioma, estado e preço.";
  const canonical = kind ? `/catalogo?tipo=${sp.tipo}` : "/catalogo";
  return { title, description, alternates: { canonical }, ...(q || sp.colecao || sp.idioma || sp.condicao ? { robots: { index: false, follow: true } } : {}) };
}

export default async function CatalogPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const kind = kindFromSlug(sp.tipo);
  const showCardFacets = kind !== "PRODUTO";

  // filtro base (sem os filtros da janela) — usado para contar as opções
  const base: Prisma.CardWhereInput = { active: true };
  if (kind) base.kind = kind;
  if (sp.q)
    base.OR = [
      { name: { contains: sp.q, mode: "insensitive" } },
      { setName: { contains: sp.q, mode: "insensitive" } },
      { number: { contains: sp.q } },
    ];
  if (sp.categoria) base.category = sp.categoria;
  if (sp.colecao) base.setName = sp.colecao;
  if (sp.esgotados !== "1") base.stock = { gt: 0 };

  const idiomas = list(sp.idioma);
  const condicoes = list(sp.condicao);
  const acabamentos = list(sp.acabamento);
  const where: Prisma.CardWhereInput = { ...base };
  if (idiomas.length) where.language = { in: idiomas };
  if (condicoes.length) where.condition = { in: condicoes };
  if (acabamentos.length) where.finish = { in: acabamentos };
  const pmin = Number(sp.preco_min);
  const pmax = Number(sp.preco_max);
  if (pmin > 0 || pmax > 0)
    where.priceCents = { ...(pmin > 0 ? { gte: Math.round(pmin * 100) } : {}), ...(pmax > 0 ? { lte: Math.round(pmax * 100) } : {}) };

  const orderBy: Prisma.CardOrderByWithRelationInput =
    sp.ordem === "menor" ? { priceCents: "asc" } : sp.ordem === "maior" ? { priceCents: "desc" } : sp.ordem === "nome" ? { name: "asc" } : { createdAt: "desc" };
  // número da carta: "025/165", "TG12", "SV-P 045"… → ordena pela parte numérica
  const cardNum = (n: string) => {
    const m = n.match(/\d+/);
    return m ? Number(m[0]) : Number.MAX_SAFE_INTEGER;
  };

  const [items, sets, byLang, byCond, byFinish, priceAgg] = await Promise.all([
    db.card.findMany({ where, orderBy, take: 1000 }),
    db.card.findMany({ where: { active: true, kind: "CARTA" }, distinct: ["setName"], select: { setName: true }, orderBy: { setName: "asc" } }),
    db.card.groupBy({ by: ["language"], where: base, _count: true }),
    db.card.groupBy({ by: ["condition"], where: base, _count: true }),
    db.card.groupBy({ by: ["finish"], where: base, _count: true }),
    db.card.aggregate({ where: base, _max: { priceCents: true } }),
  ]);

  if (sp.ordem === "desconto")
    items.sort((a, b) => discountPct(b.priceCents, b.compareAtCents) - discountPct(a.priceCents, a.compareAtCents) || a.priceCents - b.priceCents);
  if (sp.ordem === "numero")
    items.sort((a, b) => a.setName.localeCompare(b.setName, "pt-BR") || cardNum(a.number) - cardNum(b.number) || a.number.localeCompare(b.number));

  const count = (rows: { _count: number }[], key: string, field: "language" | "condition" | "finish") =>
    (rows as ({ _count: number } & Record<string, string>)[]).find((r) => r[field] === key)?._count ?? 0;
  const priceMax = Math.max(50, Math.ceil((priceAgg._max.priceCents ?? 0) / 100 / 50) * 50);

  const title = kind === "CARTA" ? "Cartas avulsas" : kind === "PRODUTO" ? "Selados" : "Catálogo completo";
  const tab = (slug?: string) => `/catalogo${slug ? `?tipo=${slug}` : ""}`;
  const activeChips = [
    ...idiomas.map((v) => LANGUAGES.find((l) => l.value === v)?.short ?? v),
    ...condicoes,
    ...acabamentos,
    ...(pmin > 0 || pmax > 0 ? [`R$ ${pmin || 0} – ${pmax || priceMax}`] : []),
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-bold">{title}</h1>
        <Link href={tab()} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${!kind ? "bg-brand text-white" : "border bg-panel"}`}>Tudo</Link>
        {KINDS.map((k) => (
          <Link key={k.slug} href={tab(k.slug)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${kind === k.value ? "bg-brand text-white" : "border bg-panel"}`}>
            {k.label}
          </Link>
        ))}
      </div>

      <form className="card flex flex-wrap items-center gap-3 p-4" action="/catalogo">
        {sp.tipo && <input type="hidden" name="tipo" value={sp.tipo} />}
        {sp.idioma && <input type="hidden" name="idioma" value={sp.idioma} />}
        {sp.condicao && <input type="hidden" name="condicao" value={sp.condicao} />}
        {sp.acabamento && <input type="hidden" name="acabamento" value={sp.acabamento} />}
        {sp.preco_min && <input type="hidden" name="preco_min" value={sp.preco_min} />}
        {sp.preco_max && <input type="hidden" name="preco_max" value={sp.preco_max} />}
        <input name="q" defaultValue={sp.q} placeholder="Buscar por nome, coleção ou número…" className="input min-w-[220px] flex-1" />
        {showCardFacets ? (
          <select name="colecao" defaultValue={sp.colecao ?? ""} className="input w-auto max-w-[240px]">
            <option value="">Todas as coleções</option>
            {sets.map((s) => <option key={s.setName} value={s.setName}>{s.setName}</option>)}
          </select>
        ) : (
          <select name="categoria" defaultValue={sp.categoria ?? ""} className="input w-auto">
            <option value="">Todas as categorias</option>
            {PRODUCT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <select name="ordem" defaultValue={sp.ordem ?? ""} className="input w-auto">
          <option value="">Mais recentes</option>
          <option value="menor">Menor preço</option>
          <option value="maior">Maior preço</option>
          <option value="desconto">Maior desconto</option>
          <option value="nome">Nome (A–Z)</option>
          {showCardFacets && <option value="numero">Número da carta</option>}
        </select>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" name="esgotados" value="1" defaultChecked={sp.esgotados === "1"} /> Esgotados
        </label>
        <button className="btn-primary">Buscar</button>
        <Suspense>
          <FilterButton
            showCardFacets={showCardFacets}
            priceMax={priceMax}
            languages={LANGUAGES.map((l) => ({ value: l.value, label: `${l.flag} ${l.short}`, count: count(byLang, l.value, "language") }))}
            conditions={CONDITIONS.map((c) => ({ value: c.value, label: `${c.value} · ${c.label.split("— ")[1]?.split(" (")[0] ?? ""}`, count: count(byCond, c.value, "condition") }))}
            finishes={FINISHES.map((f) => ({ value: f, label: f, count: count(byFinish, f, "finish") }))}
          />
        </Suspense>
      </form>

      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <span>{items.length} item(ns) encontrado(s)</span>
        {activeChips.map((c) => <span key={c} className="rounded-full bg-brand/15 px-2.5 py-0.5 text-xs font-semibold text-brand">{c}</span>)}
        {activeChips.length > 0 && (
          <Link href={`/catalogo${sp.tipo ? `?tipo=${sp.tipo}` : ""}`} className="text-xs underline hover:text-white">limpar filtros</Link>
        )}
      </div>

      {items.length === 0 ? (
        <div className="card p-10 text-center text-slate-500">Nenhum item encontrado com esses filtros.</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((c) => <ProductTile key={c.id} c={c} />)}
        </div>
      )}
    </div>
  );
}
