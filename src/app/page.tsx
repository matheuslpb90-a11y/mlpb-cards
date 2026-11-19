import Link from "next/link";
import { db } from "@/lib/db";
import { ProductTile } from "@/components/ProductTile";
import { CONDITIONS, LANGUAGES } from "@/lib/catalog";
import { whatsappLink } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const available = { active: true, stock: { gt: 0 } };
  const [featured, newCards, newProducts] = await Promise.all([
    db.card.findMany({ where: { ...available, featured: true }, orderBy: { updatedAt: "desc" }, take: 10 }),
    db.card.findMany({ where: { ...available, kind: "CARTA" }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.card.findMany({ where: { ...available, kind: "PRODUTO" }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  return (
    <div className="space-y-10">
      {/* Banner principal */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand-dark via-brand to-fuchsia-600 p-8 text-white shadow-lg sm:p-12">
        <p className="text-sm font-semibold uppercase tracking-widest text-amber-300">MLPB Cards</p>
        <h1 className="mt-2 max-w-2xl text-3xl font-extrabold leading-tight sm:text-5xl">Cartas Pokémon avulsas e produtos selados</h1>
        <p className="mt-3 max-w-xl text-white/85">
          Encontre a carta que falta na sua coleção. Compre pelo site com Pix ou cartão, ou finalize direto com a gente pelo WhatsApp.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/catalogo?tipo=cartas" className="btn bg-amber-400 text-slate-900 hover:bg-amber-300">Ver cartas avulsas</Link>
          <Link href="/catalogo?tipo=produtos" className="btn bg-white/15 text-white hover:bg-white/25">Ver produtos</Link>
          <a href={whatsappLink("Olá, MLPB Cards!")} target="_blank" rel="noreferrer" className="btn-whats">Falar no WhatsApp</a>
        </div>
      </section>

      {/* Atalhos por seção */}
      <section className="grid gap-4 sm:grid-cols-2">
        <Link href="/catalogo?tipo=cartas" className="card flex items-center gap-4 p-5 hover:border-brand">
          <span className="text-4xl">🃏</span>
          <span><span className="block text-lg font-bold">Cartas avulsas</span><span className="text-sm text-slate-500">Filtre por coleção, estado e idioma</span></span>
        </Link>
        <Link href="/catalogo?tipo=produtos" className="card flex items-center gap-4 p-5 hover:border-brand">
          <span className="text-4xl">📦</span>
          <span><span className="block text-lg font-bold">Produtos</span><span className="text-sm text-slate-500">Boosters, boxes, ETBs e acessórios</span></span>
        </Link>
      </section>

      {featured.length > 0 && <Shelf title="⭐ Destaques" href="/catalogo" items={featured} />}
      {newCards.length > 0 && <Shelf title="Novidades em cartas avulsas" href="/catalogo?tipo=cartas" items={newCards} />}
      {newProducts.length > 0 && <Shelf title="Produtos" href="/catalogo?tipo=produtos" items={newProducts} />}

      {/* Navegação por idioma e estado */}
      <section className="grid gap-6 md:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 text-lg font-bold">Cartas por idioma</h2>
          <div className="grid grid-cols-2 gap-2">
            {LANGUAGES.map((l) => (
              <Link key={l.value} href={`/catalogo?tipo=cartas&idioma=${encodeURIComponent(l.value)}`} className="rounded-lg border p-3 font-semibold hover:border-brand hover:bg-brand-light">
                {l.flag} {l.value}
              </Link>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h2 className="mb-3 text-lg font-bold">Cartas por estado</h2>
          <div className="space-y-1">
            {CONDITIONS.map((c) => (
              <Link key={c.value} href={`/catalogo?tipo=cartas&condicao=${c.value}`} className="block rounded-lg border px-3 py-2 text-sm hover:border-brand hover:bg-brand-light">
                <strong>{c.value}</strong> — {c.label.split("— ")[1]}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Como comprar */}
      <section className="card p-6">
        <h2 className="mb-4 text-lg font-bold">Como comprar</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl bg-brand-light p-4">
            <p className="font-bold text-brand-dark">1. Pelo site</p>
            <p className="text-sm text-slate-700">Monte o carrinho, faça seu cadastro, escolha o frete — ou acumule seus pedidos e pague um frete só — e pague com Pix ou cartão.</p>
          </div>
          <div className="rounded-xl bg-green-50 p-4">
            <p className="font-bold text-green-800">2. Pelo WhatsApp</p>
            <p className="text-sm text-slate-700">Monte o carrinho e clique em “Finalizar no WhatsApp”: a lista vai pronta para a loja e você combina tudo direto com a gente.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Shelf({ title, href, items }: { title: string; href: string; items: Parameters<typeof ProductTile>[0]["c"][] }) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <h2 className="text-xl font-bold">{title}</h2>
        <Link href={href} className="text-sm font-semibold text-brand hover:underline">Ver todos →</Link>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((c) => <ProductTile key={c.id} c={c} />)}
      </div>
    </section>
  );
}
