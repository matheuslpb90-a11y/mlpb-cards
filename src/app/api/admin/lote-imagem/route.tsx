/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text */
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

// Gera a arte de spoiler de um lote do leilão: logo + nome do leilão + lote + as cartas em grade.
// Monta no servidor (busca as fotos de qualquer site), salva como imagem e devolve o endereço.
export const runtime = "nodejs";
export const maxDuration = 60;

type Item = { code: string; name: string; image: string; images?: string[]; price?: string };
type Body = { auctionName: string; lotNumber: number; lotTitle: string; items: Item[] };

const W = 1080;
const H = 1350;

/** Baixa uma imagem (de qualquer site) e devolve em PNG (data URL), já reduzida. */
async function toDataUrl(src: string, origin: string, width: number) {
  if (!src) return "";
  try {
    const url = src.startsWith("http") ? src : `${origin}${src.startsWith("/") ? "" : "/"}${src}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { "User-Agent": "MLPBCards/1.0" } });
    if (!r.ok) return "";
    const png = await sharp(Buffer.from(await r.arrayBuffer())).rotate().resize({ width, withoutEnlargement: false }).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return "";
  }
}

/** Melhor grade para N cartas: a que deixa cada carta maior dentro da área. */
function layout(n: number, areaW: number, areaH: number) {
  let best = { cols: 1, rows: n, cardW: 0, gap: 0, labelH: 0 };
  for (let cols = 1; cols <= Math.min(n, 6); cols++) {
    const rows = Math.ceil(n / cols);
    const gap = n > 6 ? 22 : 34;
    const labelH = n > 9 ? 50 : 72;
    const cardW = Math.floor(Math.min((areaW - gap * (cols - 1)) / cols, ((areaH - gap * (rows - 1)) / rows - labelH) * (63 / 88)));
    if (cardW > best.cardW) best = { cols, rows, cardW, gap, labelH };
  }
  return best;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return NextResponse.json({ error: "Sem permissão" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Body | null;
  const items = (body?.items ?? []).map((i) => ({ ...i, images: [...new Set([...(i.images ?? []), i.image].filter(Boolean))] })).filter((i) => i.images.length).slice(0, 20);
  if (!body || !items.length) return NextResponse.json({ error: "Adicione cartas com imagem ao lote antes de gerar." }, { status: 400 });

  const origin = new URL(req.url).origin;
  const areaW = W - 120;
  const areaH = H - 250 - 100;
  const { cols, cardW, gap } = layout(items.length, areaW, areaH);
  const cardH = Math.round(cardW * (88 / 63));
  const rowsOfItems: { it: Item; i: number }[][] = [];
  items.forEach((it, i) => {
    if (i % cols === 0) rowsOfItems.push([]);
    rowsOfItems[rowsOfItems.length - 1].push({ it, i });
  });

  // cada carta: tenta as fotos em ordem (imagem da busca, depois as fotos enviadas em "Mídias")
  const firstOk = async (urls: string[]) => {
    for (const u of urls) {
      const d = await toDataUrl(u, origin, Math.min(700, cardW * 2));
      if (d) return d;
    }
    return "";
  };
  const [logo, ...imgs] = await Promise.all([toDataUrl("/logo.png", origin, 220), ...items.map((i) => firstOk(i.images))]);
  const missing = items.filter((_, i) => !imgs[i]).map((i) => i.code);
  const small = items.length > 9;

  const res = new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", flexDirection: "column", background: "#0a0a0a", position: "relative", fontFamily: "Noto Sans" }}>
        {/* brilho laranja de fundo */}
        <div style={{ position: "absolute", top: -260, left: 140, width: 800, height: 800, borderRadius: 800, background: "radial-gradient(circle, rgba(255,122,0,0.35) 0%, rgba(255,122,0,0) 70%)", display: "flex" }} />
        <div style={{ position: "absolute", bottom: -300, right: -200, width: 700, height: 700, borderRadius: 700, background: "radial-gradient(circle, rgba(255,176,32,0.18) 0%, rgba(255,176,32,0) 70%)", display: "flex" }} />

        {/* topo */}
        <div style={{ display: "flex", alignItems: "center", padding: "46px 60px 20px", gap: 28 }}>
          {logo ? <img src={logo} width={130} height={130} style={{ borderRadius: 130 }} /> : null}
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", fontSize: 24, color: "#ffb020", letterSpacing: 3 }}>{(body.auctionName || "LEILÃO MLPB CARDS").toUpperCase().slice(0, 52)}</div>
            <div style={{ display: "flex", fontSize: 62, color: "#ffffff", marginTop: 4 }}>{`LOTE ${body.lotNumber}`}</div>
            {body.lotTitle && body.lotTitle !== `Lote ${body.lotNumber}` ? <div style={{ display: "flex", fontSize: 30, color: "#cfcfcf" }}>{body.lotTitle.slice(0, 60)}</div> : null}
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#0a0a0a", background: "#ff7a00", padding: "10px 22px", borderRadius: 40 }}>{`${items.length} ${items.length > 1 ? "cartas" : "carta"}`}</div>
        </div>

        {/* cartas */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap, padding: "0 60px", flex: 1 }}>
          {rowsOfItems.map((row, r) => (
          <div key={r} style={{ display: "flex", justifyContent: "center", gap }}>
          {row.map(({ it, i }) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: cardW }}>
              <div style={{ display: "flex", position: "relative", width: cardW, height: cardH, borderRadius: Math.round(cardW * 0.05), overflow: "hidden", boxShadow: "0 0 40px rgba(255,122,0,0.35)", background: "#1a1a1a" }}>
                {imgs[i] ? <img src={imgs[i]} width={cardW} height={cardH} style={{ objectFit: "cover" }} /> : <div style={{ display: "flex", width: cardW, height: cardH, alignItems: "center", justifyContent: "center", color: "#666", fontSize: 28 }}>sem foto</div>}
                <div style={{ position: "absolute", top: 10, left: 10, display: "flex", fontSize: small ? 18 : 24, color: "#0a0a0a", background: "#ffb020", padding: "2px 12px", borderRadius: 20 }}>{it.code}</div>
              </div>
              <div style={{ display: "flex", fontSize: small ? 18 : 24, color: "#ffffff", marginTop: 8, maxWidth: cardW, overflow: "hidden", whiteSpace: "nowrap" }}>{it.name.slice(0, 26)}</div>
              {it.price ? <div style={{ display: "flex", fontSize: small ? 16 : 21, color: "#ffb020" }}>{it.price}</div> : null}
            </div>
          ))}
          </div>
          ))}
        </div>

        {/* rodapé */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 60px 44px", fontSize: 26, color: "#9a9a9a" }}>
          <div style={{ display: "flex" }}>Lances por enquete no grupo</div>
          <div style={{ display: "flex", color: "#ff9a3c" }}>mlpbcards.com.br</div>
        </div>
      </div>
    ),
    { width: W, height: H },
  );

  const jpg = await sharp(Buffer.from(await res.arrayBuffer())).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
  const img = await db.image.create({ data: { mime: "image/jpeg", data: jpg } });
  return NextResponse.json({ url: `/api/imagens/${img.id}`, missing });
}
