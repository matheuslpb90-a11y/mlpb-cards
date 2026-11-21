/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  // fotos enviadas pelo painel (já reduzidas no navegador) passam por server actions
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};
export default nextConfig;
