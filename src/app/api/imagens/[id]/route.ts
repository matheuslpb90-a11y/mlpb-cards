import { db } from "@/lib/db";

// Serve as fotos enviadas pelo painel.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const img = await db.image.findUnique({ where: { id } });
  if (!img) return new Response("Imagem não encontrada", { status: 404 });
  return new Response(new Uint8Array(img.data), {
    headers: { "Content-Type": img.mime, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
