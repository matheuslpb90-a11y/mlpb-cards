import Link from "next/link";
import { db } from "@/lib/db";
import { ProductTile } from "@/components/ProductTile";
import { CONDITIONS, KINDS, LANGUAGES, PRODUCT_CATEGORIES, kindFromSlug } from "@/lib/catalog";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type SP = Promise<{
  q?: string; tipo?: string; condicao?: string; idioma?: string; categoria?: string;
  colecao?: string; ordem?: string; esgotados?: string;
}>;

export default async function CatalogPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const kind = kindFromSlug(sp.tipo);
  const where: Prisma.CardWhereInput = { active: true };
  if (kind) where.kind = kind;
  if (sp.q)
    where.OR = [
      { name: { contains: sp.q, mode: "insensitive" } },
      { setName: { contains: sp.q, mode: "insensitive" } },
      { number: { contains: sp.q } },
    ];
  if (sp.condicao) where.condition = sp.condicao;
  if (sp.idioma) where.language = sp.idioma;
  if (sp.categoria) where.category = sp.categoria;
  if (sp.colecao) where.setName = sp.colecao;
  if (sp.esgotados !== "1") where.stock = { gt: 0 };

  const orderBy: Prisma.CardOrderByWithRelationInput =
    sp.ordem === "menor" ? { priceCents: "asc" } : sp.ordem === "maior" ? { priceCents: "desc" } : sp.ordem === "nome" ? { name: "asc" } : { createdAt: "desc" };

  const [items, sets] = await Promise.all([
    db.card.findMany({ where, orderBy, take: 500 }),
    db.card.findMany({
      where: { active: true, kind: "CARTA" },
      distinct: ["setName"],
      select: { setName: true },
      orderBy: { setName: "asc" },
    }),
  ]);

  const title = kind === "CARTA" ? "Cartas avulsas" : kind === "PRODUTO" ? "Produtos" : "Catálogo completo";
  const showCardFilters = kind !== "PRODUTO";

  // monta links das abas mantendo a busca
  const tab = (slug?: string) => `/catalogo${slug ? `?tipo=${slug}` : ""}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-bold">{title}</h1>
        <Link href={tab()} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${!kind ? "bg-brand text-white" : "bg-white border"}`}>Tudo</Link>
        {KINDS.map((k) => (
          <Link key={k.slug} href={tab(k.slug)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${kind === k.value ? "bg-brand text-white" : "bg-white border"}`}>
            {k.label}
          </Link>
        ))}
      </div>

      <form className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4" action="/catalogo">
        {sp.tipo && <input type="hidden" name="tipo" value={sp.tipo} />}
        <input name="q" defaultValue={sp.q} placeholder="Buscar por nome, coleção ou número…" className="input sm:col-span-2" />
        <select name="idioma" defaultValue={sp.idioma ?? ""} className="input">
          <option value="">Todos os idiomas</option>
          {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.flag} {l.value}</option>)}
        </select>
        {showCardFilters ? (
          <select name="condicao" defaultValue={sp.condicao ?? ""} className="input">
            <option value="">Todos os estados</option>
            {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        ) : (
          <select name="categoria" defaultValue={sp.categoria ?? ""} className="input">
            <option value="">Todas as categorias</option>
            {PRODUCT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        {showCardFilters && (
          <select name="colecao" defaultValue={sp.colecao ?? ""} className="input sm:col-span-2">
            <option value="">Todas as coleções</option>
            {sets.map((s) => <option key={s.setName} value={s.setName}>{s.setName}</option>)}
          </select>
        )}
        <select name="ordem" defaultValue={sp.ordem ?? ""} className="input">
          <option value="">Mais recentes</option>
          <option value="menor">Menor preço</option>
          <option value="maior">Maior preço</option>
          <option value="nome">Nome (A–Z)</option>
        </select>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" name="esgotados" value="1" defaultChecked={sp.esgotados === "1"} /> Mostrar esgotados
          </label>
          <button className="btn-primary ml-auto">Filtrar</button>
        </div>
      </form>

      <p className="text-sm text-slate-500">{items.length} item(ns) encontrado(s)</p>

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
