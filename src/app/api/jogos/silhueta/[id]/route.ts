import sharp from "sharp";
import { db } from "@/lib/db";
import { artwork } from "@/lib/games";

// Silhueta preta do Pokémon da rodada (o número do Pokémon não aparece no link, para ninguém "colar").
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await db.gameRound.findUnique({ where: { id } });
  if (!r || r.type !== "POKEMON") return new Response("não encontrado", { status: 404 });
  const dex = (JSON.parse(r.dataJson) as { dex: number }).dex;
  const res = await fetch(artwork(dex), { cache: "force-cache" });
  if (!res.ok) return new Response("imagem indisponível", { status: 502 });
  const src = sharp(Buffer.from(await res.arrayBuffer())).ensureAlpha();
  const { width = 475, height = 475 } = await src.metadata();
  const alpha = await src.clone().extractChannel(3).toBuffer();
  const black = await sharp({ create: { width, height, channels: 3, background: "#111111" } }).joinChannel(alpha).png().toBuffer();
  const out = await sharp({ create: { width: width + 80, height: height + 80, channels: 3, background: "#ffb21a" } })
    .composite([{ input: black, top: 40, left: 40 }])
    .jpeg({ quality: 85 })
    .toBuffer();
  return new Response(new Uint8Array(out), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600" } });
}
