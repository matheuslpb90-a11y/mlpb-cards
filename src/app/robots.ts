import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/orders";

// Diz ao Google o que indexar: catálogo, cartas e leilões sim; áreas privadas e de pagamento não.
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api/",
        "/carrinho",
        "/checkout",
        "/minha-conta",
        "/entrar",
        "/cadastro",
        "/completar-cadastro",
        "/pagamento",
        "/pagar/",
        "/pedido",
        "/fatura/",
        "/caixa/",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
