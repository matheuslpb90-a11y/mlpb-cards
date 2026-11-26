/** @type {import('next').NextConfig} */

// Cabeçalhos de segurança enviados em todas as páginas.
const securityHeaders = [
  // só HTTPS (o navegador nunca usa a versão sem cadeado)
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // ninguém pode colocar o site dentro de outra página (golpe de "clique aqui" / página falsa por cima)
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'" },
  // o navegador não "adivinha" o tipo de arquivo (evita executar um arquivo disfarçado)
  { key: "X-Content-Type-Options", value: "nosniff" },
  // links para outros sites não levam o endereço completo da página (que pode ter códigos secretos)
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // o site não usa câmera, microfone nem localização
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
];

const nextConfig = {
  poweredByHeader: false,
  // fotos enviadas pelo painel (já reduzidas no navegador) passam por server actions
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};
export default nextConfig;
