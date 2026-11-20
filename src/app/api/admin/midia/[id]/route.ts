import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { whapiDownloadMedia } from "@/lib/whapi";

// Mostra no painel uma imagem recebida pelo WhatsApp (ex.: provas das avaliações). Só para admin.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await params;
  try {
    const m = await whapiDownloadMedia(id);
    return new NextResponse(m.body, { headers: { "Content-Type": m.type, "Cache-Control": "private, max-age=86400" } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 404 });
  }
}
