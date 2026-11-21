import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";
import { CartBadge } from "@/components/CartBadge";
import { Logo } from "@/components/Logo";
import { TiktokIcon, WhatsIcon, YoutubeIcon } from "@/components/SocialIcons";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { whatsappLink } from "@/lib/whatsapp";
import { InstallApp, InstallAppLink } from "@/components/InstallApp";

export const metadata: Metadata = {
  title: "MLPB Cards — Cartas Pokémon avulsas e selados",
  description: "Cartas Pokémon avulsas e produtos selados. Compre pelo site ou direto pelo WhatsApp.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://www.mlpbcards.com.br"),
  applicationName: "MLPB Cards",
  appleWebApp: { capable: true, title: "MLPB Cards", statusBarStyle: "black" },
  formatDetection: { telephone: false },
  openGraph: { type: "website", siteName: "MLPB Cards", locale: "pt_BR" },
};

export const viewport: Viewport = { themeColor: "#0a0a0a", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, s] = await Promise.all([getCurrentUser(), getSettings()]);
  const navLink = "rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-white";
  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen flex-col">
        <CartProvider>
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-black/90 backdrop-blur">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2">
              <Link href="/" className="mr-4"><Logo url={s.logoUrl} /></Link>
              <nav className="order-last -mx-1 flex w-full items-center gap-1 overflow-x-auto whitespace-nowrap text-sm font-semibold md:order-none md:mx-0 md:w-auto md:flex-1">
                <Link href="/" className={navLink}>Início</Link>
                <Link href="/catalogo?tipo=cartas" className={navLink}>Cartas Avulsas</Link>
                <Link href="/catalogo?tipo=selados" className={navLink}>Selados</Link>
                <Link href="/leiloes" className={navLink}>Leilões</Link>
                <Link href="/grupo" className={navLink}>Grupo</Link>
                <Link href="/pontos" className={navLink}>🪙 Pontos</Link>
                {s.youtubeUrl && (
                  <a href={s.youtubeUrl} target="_blank" rel="noreferrer" className={`${navLink} flex items-center gap-1`}>
                    <YoutubeIcon className="h-4 w-4 text-youtube" /> YouTube
                  </a>
                )}
                {s.tiktokUrl && (
                  <a href={s.tiktokUrl} target="_blank" rel="noreferrer" className={`${navLink} flex items-center gap-1`}>
                    <TiktokIcon className="h-4 w-4 text-white" /> TikTok
                  </a>
                )}
              </nav>
              <div className="ml-auto flex items-center gap-1 text-sm font-semibold">
                <CartBadge />
                {user ? (
                  <>
                    <Link href="/minha-conta" className={navLink}>Olá, {user.name.split(" ")[0]}</Link>
                    {user.role === "ADMIN" && (
                      <Link href="/admin" className="rounded-lg bg-gradient-to-r from-brand-amber to-brand px-3 py-2 text-gray-950">Painel</Link>
                    )}
                  </>
                ) : (
                  <Link href="/entrar" className="rounded-lg border border-slate-300 px-4 py-2 hover:border-brand">Entrar</Link>
                )}
              </div>
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
          <footer className="border-t border-slate-200 bg-black py-8 text-sm text-slate-500">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4">
              <div className="flex items-center gap-3">
                <Logo url={s.logoUrl} className="h-10" />
                <span>Cartas Pokémon avulsas e selados</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link href="/grupo" className="rounded-lg px-3 py-2 hover:bg-slate-100">Como funciona o grupo</Link>
                <Link href="/pontos" className="rounded-lg px-3 py-2 hover:bg-slate-100">🪙 MLPB Points</Link>
                <InstallAppLink className="rounded-lg px-3 py-2 hover:bg-slate-100" />
                <a href={whatsappLink("Olá, MLPB Cards!")} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg px-3 py-2 hover:bg-slate-100">
                  <WhatsIcon className="h-4 w-4 text-whats" /> Loja
                </a>
                {s.whatsappGroupUrl && (
                  <a href={s.whatsappGroupUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg px-3 py-2 hover:bg-slate-100">
                    <WhatsIcon className="h-4 w-4 text-whats" /> Grupo
                  </a>
                )}
                {s.youtubeUrl && (
                  <a href={s.youtubeUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg px-3 py-2 hover:bg-slate-100">
                    <YoutubeIcon className="h-4 w-4 text-youtube" /> YouTube
                  </a>
                )}
                {s.tiktokUrl && (
                  <a href={s.tiktokUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg px-3 py-2 hover:bg-slate-100">
                    <TiktokIcon className="h-4 w-4 text-white" /> TikTok
                  </a>
                )}
              </div>
            </div>
          </footer>
          <InstallApp />
        </CartProvider>
      </body>
    </html>
  );
}
