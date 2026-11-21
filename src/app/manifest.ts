import type { MetadataRoute } from "next";

// Faz o site "virar um app" no celular (Adicionar à Tela de Início / Instalar app).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MLPB Cards",
    short_name: "MLPB Cards",
    description: "Cartas Pokémon avulsas, selados e leilões.",
    id: "/",
    start_url: "/?app=1",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    lang: "pt-BR",
    categories: ["shopping"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Leilões", url: "/leiloes", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Cartas avulsas", url: "/catalogo?tipo=cartas", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Minha conta", url: "/minha-conta", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
