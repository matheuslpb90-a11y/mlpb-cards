import { NextResponse, type NextRequest } from "next/server";

// 1. Um endereço só: quem abre mlpbcards.com.br (sem www) ou o endereço antigo da Vercel vai para www.mlpbcards.com.br
//    (assim o login não "some" ao trocar de endereço). Webhooks e APIs não são redirecionados.
// 2. Renova o cookie de login a cada visita (30 dias a partir do último acesso) e faz ele valer com e sem www.
const COOKIE = "mlpb_session";
const MAIN = "www.mlpbcards.com.br";

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const isGet = req.method === "GET" || req.method === "HEAD";
  if (
    process.env.VERCEL_ENV === "production" &&
    isGet &&
    !req.nextUrl.pathname.startsWith("/api/") &&
    (host === "mlpbcards.com.br" || host.endsWith(".vercel.app"))
  ) {
    return NextResponse.redirect(`https://${MAIN}${req.nextUrl.pathname}${req.nextUrl.search}`, 308);
  }

  const res = NextResponse.next();
  const sid = req.cookies.get(COOKIE)?.value;
  if (sid && isGet && (host === "mlpbcards.com.br" || host.endsWith(".mlpbcards.com.br"))) {
    res.cookies.set(COOKIE, sid, { httpOnly: true, sameSite: "lax", secure: true, path: "/", domain: ".mlpbcards.com.br", maxAge: 30 * 86400 });
  }
  return res;
}

export const config = {
  // páginas do site (não arquivos estáticos, imagens nem o service worker)
  matcher: ["/((?!_next/|api/|icons/|sw.js|manifest.webmanifest|favicon|.*\\.(?:png|jpg|jpeg|webp|svg|gif|ico|js|css|txt|xml)$).*)"],
};
