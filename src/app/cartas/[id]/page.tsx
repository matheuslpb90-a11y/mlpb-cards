import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { CardImage } from "@/components/CardImage";
import { HoloCard } from "@/components/HoloCard";
import { PriceLinks } from "@/components/PriceLinks";
import { AddToCartButton } from "@/components/AddToCartButton";
import { languageFlag } from "@/lib/catalog";
import { formatBRL } from "@/lib/money";
import { siteUrl } from "@/lib/orders";
import { Offers } from "./Offers";

export const dynamic = "force-dynamic";

type CardRow = NonNullable<Awaited<ReturnType<typeof db.card.findUnique>>>;

// "Charizard ex (199/165) — 151"
function seoTitle(c: CardRow) {
  if (c.kind !== "CARTA") return c.name;
  const numero = c.number ? ` (${c.number})` : "";
  const colecao = c.setName && c.setName !== "—" ? ` — ${c.setName}` : "";
  return `${c.name}${numero}${colecao}`;
}

function seoDescription(c: CardRow) {
  const preco = formatBRL(c.priceCents);
  const estoque = c.stock > 0 ? "Em estoque" : "Esgotada no momento";
  if (c.kind !== "CARTA") {
    return `${c.name}${c.category ? ` (${c.category})` : ""} por ${preco}. ${estoque}. Compre na MLPB Cards pelo site (Pix ou cartão) ou pelo WhatsApp.`;
  }
  const detalhes = [c.rarity, c.condition, c.finish !== "Normal" ? c.finish : "", c.language].filter(Boolean).join(", ");
  return `${seoTitle(c)} — carta ${c.game} avulsa${detalhes ? ` (${detalhes})` : ""} por ${preco}. ${estoque}. Compre na MLPB Cards pelo site (Pix ou cartão) ou pelo WhatsApp.`;
}

const absoluta = (url: string) => (/^https?:\/\//.test(url) ? url : `${siteUrl()}${url.startsWith("/") ? "" : "/"}${url}`);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const c = await db.card.findUnique({ where: { id } });
  if (!c || !c.active) return { title: "Carta não encontrada | MLPB Cards", robots: { index: false } };
  const title = `${seoTitle(c)} | MLPB Cards`;
  const description = seoDescription(c);
  const images = c.imageUrl ? [{ url: absoluta(c.imageUrl), alt: c.name }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: `/cartas/${c.id}` },
    openGraph: { title, description, url: `/cartas/${c.id}`, type: "website", siteName: "MLPB Cards", locale: "pt_BR", images },
    twitter: { card: images ? "summary_large_image" : "summary", title, description, images: images?.map((i) => i.url) },
  };
}

// Dados estruturados (schema.org/Product): permitem ao Google mostrar preço e estoque no resultado da busca.
function productJsonLd(c: CardRow, variantes: CardRow[]) {
  const url = `${siteUrl()}/cartas/${c.id}`;
  const condicao = (v: CardRow) =>
    v.kind !== "CARTA" || v.condition === "M" || v.condition === "NM"
      ? "https://schema.org/NewCondition"
      : v.condition === "D" || v.condition === "DMG" || v.condition === "HP"
        ? "https://schema.org/DamagedCondition"
        : "https://schema.org/UsedCondition";
  const oferta = (v: CardRow) => ({
    "@type": "Offer",
    url: `${siteUrl()}/cartas/${v.id}`,
    priceCurrency: "BRL",
    price: (v.priceCents / 100).toFixed(2),
    availability: v.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    itemCondition: condicao(v),
    seller: { "@type": "Organization", name: "MLPB Cards" },
  });
  const lista = variantes.length ? variantes : [c];
  const precos = lista.map((v) => v.priceCents / 100);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: seoTitle(c),
    description: seoDescription(c),
    url,
    ...(c.imageUrl ? { image: [absoluta(c.imageUrl)] } : {}),
    brand: { "@type": "Brand", name: c.game || "Pokémon" },
    category: c.kind === "CARTA" ? "Cartas colecionáveis" : c.category || "Produtos selados",
    ...(c.number ? { sku: `${c.setName}-${c.number}` } : {}),
    offers:
      lista.length > 1
        ? {
            "@type": "AggregateOffer",
            priceCurrency: "BRL",
            lowPrice: Math.min(...precos).toFixed(2),
            highPrice: Math.max(...precos).toFixed(2),
            offerCount: lista.length,
            availability: lista.some((v) => v.stock > 0) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            offers: lista.map(oferta),
          }
        : oferta(c),
  };
}

function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export default async function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.card.findUnique({ where: { id } });
  if (!c || !c.active) notFound();
  const isCard = c.kind === "CARTA";

  const back = (
    <Link href={`/catalogo?tipo=${isCard ? "cartas" : "selados"}`} className="text-2xl text-slate-600 hover:text-white" aria-label="Voltar">←</Link>
  );

  if (!isCard) {
    return (
      <div className="card grid gap-8 overflow-hidden md:grid-cols-[minmax(260px,380px)_1fr]">
        <JsonLd data={productJsonLd(c, [])} />
        <div className="space-y-4 bg-slate-100 p-6">
          {back}
          <CardImage src={c.imageUrl} alt={c.name} className="object-contain bg-white" />
        </div>
        <div className="space-y-5 p-6">
          <h1 className="text-3xl font-bold">{c.name}</h1>
          <div className="flex flex-wrap gap-2 text-sm">
            {c.category && <span className="rounded bg-slate-100 px-2 py-1">📦 {c.category}</span>}
            {c.setName && c.setName !== "—" && <span className="rounded bg-slate-100 px-2 py-1">{c.setName}</span>}
            <span className="rounded bg-slate-100 px-2 py-1">{languageFlag(c.language)} {c.language}</span>
          </div>
          <p className="text-4xl font-extrabold text-brand">{formatBRL(c.priceCents)}</p>
          <p className="text-sm text-slate-500">{c.stock > 0 ? `${c.stock} unidade(s) disponível(is)` : "Esgotado"}</p>
          {c.description && <p className="whitespace-pre-line text-slate-700">{c.description}</p>}
          <div className="max-w-xs">
            <AddToCartButton card={{ cardId: c.id, name: c.name, setName: c.category, priceCents: c.priceCents, imageUrl: c.imageUrl, stock: c.stock }} />
          </div>
        </div>
      </div>
    );
  }

  // Todas as versões em estoque da mesma carta (mesma coleção e número), em estados/idiomas diferentes
  const variants = await db.card.findMany({
    where: { active: true, kind: "CARTA", name: c.name, setName: c.setName, number: c.number },
    orderBy: [{ priceCents: "asc" }],
  });
  const available = variants.filter((v) => v.stock > 0);

  return (
    <div className="card grid overflow-hidden md:grid-cols-[minmax(260px,400px)_1fr]">
      <JsonLd data={productJsonLd(c, variants)} />
      <div className="space-y-4 bg-slate-100 p-6">
        {back}
        <HoloCard holo={c.finish !== "Normal"} max={14}>
          <CardImage src={c.imageUrl} alt={c.name} className="shadow-[0_0_50px_-12px_rgba(255,122,0,0.6)]" />
        </HoloCard>
      </div>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold leading-tight">
            {c.name} {c.number && <span className="font-medium text-slate-500">({c.number})</span>}
          </h1>
          <p className="mt-1 text-slate-500">
            {c.setName}{c.rarity ? ` · ${c.rarity}` : ""}{c.game ? ` · ${c.game}` : ""}
          </p>
        </div>
        <Offers
          initialId={c.id}
          offers={variants.map((v) => ({
            id: v.id,
            name: v.name,
            setName: v.setName,
            condition: v.condition === "D" ? "DMG" : v.condition,
            finish: v.finish,
            language: v.language,
            priceCents: v.priceCents,
            compareAtCents: v.compareAtCents,
            stock: v.stock,
            imageUrl: v.imageUrl,
            description: v.description,
          }))}
        />
        {available.length === 0 && <p className="text-sm text-slate-500">Esta carta está esgotada no momento. Fale com a gente no WhatsApp para encomendar.</p>}
        {c.game === "Pokémon" && <PriceLinks name={c.name} number={c.number} />}
      </div>
    </div>
  );
}
