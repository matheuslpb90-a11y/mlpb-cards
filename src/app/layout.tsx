import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";
import { CartBadge } from "@/components/CartBadge";
import { getCurrentUser } from "@/lib/auth";
import { whatsappLink } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "MLPB Cards — Cartas colecionáveis",
  description: "Catálogo de cartas colecionáveis da MLPB Cards. Compre pelo site ou direto pelo WhatsApp.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen flex-col">
        <CartProvider>
          <header className="bg-brand text-white shadow">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
              <Link href="/" className="text-xl font-extrabold tracking-tight">
                MLPB <span className="text-amber-300">Cards</span>
              </Link>
              <nav className="flex flex-wrap items-center gap-1 text-sm font-medium">
                <Link href="/" className="rounded-lg px-3 py-2 hover:bg-white/10">Início</Link>
                <Link href="/catalogo?tipo=cartas" className="rounded-lg px-3 py-2 hover:bg-white/10">Cartas avulsas</Link>
                <Link href="/catalogo?tipo=produtos" className="rounded-lg px-3 py-2 hover:bg-white/10">Produtos</Link>
                <CartBadge />
                {user ? (
                  <>
                    <Link href="/minha-conta" className="rounded-lg px-3 py-2 hover:bg-white/10">
                      Olá, {user.name.split(" ")[0]}
                    </Link>
                    {user.role === "ADMIN" && (
                      <Link href="/admin" className="rounded-lg bg-amber-400 px-3 py-2 text-slate-900 hover:bg-amber-300">
                        Painel
                      </Link>
                    )}
                  </>
                ) : (
                  <Link href="/entrar" className="rounded-lg px-3 py-2 hover:bg-white/10">Entrar</Link>
                )}
              </nav>
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
          <footer className="border-t bg-white py-6 text-center text-sm text-slate-500">
            MLPB Cards · <a className="text-whats underline" href={whatsappLink("Olá, MLPB Cards!")} target="_blank" rel="noreferrer">Fale conosco no WhatsApp</a>
          </footer>
        </CartProvider>
      </body>
    </html>
  );
}
