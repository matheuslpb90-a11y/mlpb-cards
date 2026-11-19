import Link from "next/link";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { CardImage } from "@/components/CardImage";
import { AddToCartButton } from "@/components/AddToCartButton";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type SP = Promise<{ q?: string; jogo?: string; colecao?: string; ordem?: string; estoque?: string }>;

export default async function CatalogPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const where: Prisma.CardWhereInput = { active: true };
  if (sp.q) where.OR = [{ name: { contains: sp.q } }, { setName: { contains: sp.q } }, { number: { contains: sp.q } }];
  if (sp.jogo) where.game = sp.jogo;
  if (sp.colecao) where.setName = sp.colecao;
  if (sp.estoque !== "todos") where.stock = { gt: 0 };

  const orderBy: Prisma.CardOrderByWithRelationInput =
    sp.ordem === "menor" ? { priceCents: "asc" } : sp.ordem === "maior" ? { priceCents: "desc" } : sp.ordem === "nome" ? { name: "asc" } : { createdAt: "desc" };

  const [cards, games, sets] = await Promise.all([
    db.card.findMany({ where, orderBy, take: 300 }),
    db.card.findMany({ where: { active: true }, distinct: ["game"], select: { game: true }, orderBy: { game: "asc" } }),
    db.card.findMany({
      where: { active: true, ...(sp.jogo ? { game: sp.jogo } : {}) },
      distinct: ["setName"],
      select: { setName: true },
      orderBy: { setName: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <form className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6" action="/">
        <input name="q" defaultValue={sp.q} placeholder="Buscar carta, coleção ou número…" className="input lg:col-span-2" />
        <select name="jogo" defaultValue={sp.jogo ?? ""} className="input">
          <option value="">Todos os jogos</option>
          {games.map((g) => <option key={g.game} value={g.game}>{g.game}</option>)}
        </select>
        <select name="colecao" defaultValue={sp.colecao ?? ""} className="input">
          <option value="">Todas as coleções</option>
          {sets.map((s) => <option key={s.setName} value={s.setName}>{s.setName}</option>)}
        </select>
        <select name="ordem" defaultValue={sp.ordem ?? ""} className="input">
          <option value="">Mais recentes</option>
          <option value="menor">Menor preço</option>
          <option value="maior">Maior preço</option>
          <option value="nome">Nome (A–Z)</option>
        </select>
        <div className="flex gap-2">
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" name="estoque" value="todos" defaultChecked={sp.estoque === "todos"} /> Esgotadas
          </label>
          <button className="btn-primary flex-1">Filtrar</button>
        </div>
      </form>

      <p className="text-sm text-slate-500">{cards.length} carta(s) encontrada(s)</p>

      {cards.length === 0 ? (
        <div className="card p-10 text-center text-slate-500">Nenhuma carta encontrada.</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {cards.map((c) => (
            <div key={c.id} className="card flex flex-col p-3">
              <Link href={`/cartas/${c.id}`} className="group">
                <CardImage src={c.imageUrl} alt={c.name} className="transition group-hover:scale-[1.02]" />
                <h3 className="mt-2 line-clamp-2 font-semibold leading-tight">{c.name}</h3>
              </Link>
              <p className="text-xs text-slate-500">
                {c.setName}{c.number ? ` · #${c.number}` : ""}{c.rarity ? ` · ${c.rarity}` : ""}
              </p>
              <p className="text-xs text-slate-500">{c.condition} · {c.language}</p>
              <div className="mt-auto pt-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-bold text-brand">{formatBRL(c.priceCents)}</span>
                  <span className="text-xs text-slate-500">{c.stock > 0 ? `${c.stock} disp.` : "Esgotada"}</span>
                </div>
                <AddToCartButton
                  className="mt-2 text-sm"
                  card={{ cardId: c.id, name: c.name, setName: c.setName, priceCents: c.priceCents, imageUrl: c.imageUrl, stock: c.stock }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
