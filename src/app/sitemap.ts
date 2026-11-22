import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { siteUrl } from "@/lib/orders";

// Lista de páginas para o Google: as páginas fixas e cada carta/produto ativo do catálogo.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const fixas: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/catalogo`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/catalogo?tipo=cartas`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/catalogo?tipo=selados`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/leiloes`, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/grupo`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/pontos`, changeFrequency: "monthly", priority: 0.3 },
  ];

  try {
    const cartas = await db.card.findMany({
      where: { active: true },
      select: { id: true, updatedAt: true, stock: true },
      orderBy: { updatedAt: "desc" },
      take: 45000,
    });
    return [
      ...fixas,
      ...cartas.map((c) => ({
        url: `${base}/cartas/${c.id}`,
        lastModified: c.updatedAt,
        changeFrequency: "weekly" as const,
        priority: c.stock > 0 ? 0.7 : 0.4,
      })),
    ];
  } catch {
    // Sem banco (ex.: build sem DATABASE_URL): devolve só as páginas fixas.
    return fixas;
  }
}
