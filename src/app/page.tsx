import Link from "next/link";
import { db } from "@/lib/db";
import { ProductTile } from "@/components/ProductTile";
import { CardFan } from "@/components/CardFan";
import { CONDITIONS, LANGUAGES } from "@/lib/catalog";
import { whatsappLink } from "@/lib/whatsapp";
import { getSettings, youtubeId } from "@/lib/settings";
import { TiktokIcon, WhatsIcon, YoutubeIcon } from "@/components/SocialIcons";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const available = { active: true, stock: { gt: 0 } };
  const [s, fanCards, featured, newCards, newProducts] = await Promise.all([
    getSettings(),
    db.card.findMany({
      where: { ...available, kind: "CARTA", imageUrl: { not: "" } },
      orderBy: [{ featured: "desc" }, { updatedAt: "desc" }],
      take: 3,
    }),
    db.card.findMany({ where: { ...available, featured: true }, orderBy: { updatedAt: "desc" }, take: 10 }),
    db.card.findMany({ where: { ...available, kind: "CARTA" }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.card.findMany({ where: { ...available, kind: "PRODUTO" }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  return (
    <div className="space-y-10">
      {/* Banner principal (textos e imagem editáveis em Painel → Aparência e links) */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-[#1a1008] via-black to-[#140b04] p-8 sm:p-12">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand/25 blur-3xl" />
        <div className="relative grid items-center gap-8 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl">{s.heroTitle}</h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-slate-700">{s.heroText}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href={s.whatsappGroupUrl || whatsappLink("Olá, MLPB Cards!")} target="_blank" rel="noreferrer" className="btn-primary px-5 py-3">
                <WhatsIcon /> {s.whatsappGroupUrl ? "Entre no grupo" : "Fale no WhatsApp"}
              </a>
              <Link href="/catalogo?tipo=cartas" className="btn-outline px-5 py-3">Cartas Avulsas →</Link>
              <Link href="/catalogo?tipo=selados" className="btn-outline px-5 py-3">Selados →</Link>
              {s.youtubeUrl && (
                <a href={s.youtubeUrl} target="_blank" rel="noreferrer" className="btn-youtube px-5 py-3"><YoutubeIcon /> YouTube</a>
              )}
              {s.tiktokUrl && (
                <a href={s.tiktokUrl} target="_blank" rel="noreferrer" className="btn border border-slate-300 bg-black px-5 py-3 text-white hover:border-brand"><TiktokIcon /> TikTok</a>
              )}
            </div>
          </div>
          {fanCards.length > 0 ? (
            <CardFan cards={fanCards} />
          ) : (
            s.heroImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.heroImageUrl} alt="" className="mx-auto max-h-80 w-auto drop-shadow-[0_0_40px_rgba(255,122,0,0.35)]" />
            )
          )}
        </div>
      </section>

      {/* Atalhos por seção */}
      <section className="grid gap-4 sm:grid-cols-2">
        <Link href="/catalogo?tipo=cartas" className="card flex items-center gap-4 p-5 hover:border-brand">
          <span className="text-4xl">🃏</span>
          <span><span className="block text-lg font-bold">Cartas avulsas</span><span className="text-sm text-slate-500">Filtre por coleção, estado e idioma</span></span>
        </Link>
        <Link href="/catalogo?tipo=selados" className="card flex items-center gap-4 p-5 hover:border-brand">
          <span className="text-4xl">📦</span>
          <span><span className="block text-lg font-bold">Selados</span><span className="text-sm text-slate-500">Boosters, boxes, ETBs e acessórios</span></span>
        </Link>
      </section>

      {featured.length > 0 && <Shelf title="⭐ Destaques" href="/catalogo" items={featured} />}
      {newCards.length > 0 && <Shelf title="Novidades em cartas avulsas" href="/catalogo?tipo=cartas" items={newCards} />}
      {newProducts.length > 0 && <Shelf title="Selados" href="/catalogo?tipo=selados" items={newProducts} />}

      {/* YouTube */}
      {(s.youtubeVideoUrl || s.youtubeUrl) && (
        <section className="card grid items-center gap-6 overflow-hidden p-5 md:grid-cols-[1.4fr_1fr]">
          {youtubeId(s.youtubeVideoUrl) ? (
            <div className="aspect-video overflow-hidden rounded-xl">
              <iframe
                className="h-full w-full"
                src={`https://www.youtube-nocookie.com/embed/${youtubeId(s.youtubeVideoUrl)}`}
                title="Vídeo da MLPB Cards"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-xl bg-slate-100"><YoutubeIcon className="h-16 w-16 text-youtube" /></div>
          )}
          <div className="space-y-3">
            <h2 className="flex items-center gap-2 text-xl font-bold"><YoutubeIcon className="h-6 w-6 text-youtube" /> MLPB Cards no YouTube</h2>
            <p className="text-slate-600">Aberturas de boosters, leilões ao vivo, novidades e dicas para colecionadores.</p>
            <div className="flex flex-wrap gap-2">
              {s.youtubeUrl && <a href={s.youtubeUrl} target="_blank" rel="noreferrer" className="btn-youtube">Inscreva-se no canal</a>}
              {s.tiktokUrl && <a href={s.tiktokUrl} target="_blank" rel="noreferrer" className="btn border border-slate-300 bg-black text-white hover:border-brand"><TiktokIcon /> Siga no TikTok</a>}
            </div>
          </div>
        </section>
      )}

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
            <p className="font-bold text-brand">1. Pelo site</p>
            <p className="text-sm text-slate-700">Monte o carrinho, faça seu cadastro, escolha o frete — ou acumule seus pedidos e pague um frete só — e pague com Pix ou cartão.</p>
          </div>
          <div className="rounded-xl bg-green-950/60 p-4">
            <p className="font-bold text-green-300">2. Pelo WhatsApp</p>
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
