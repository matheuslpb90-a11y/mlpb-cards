import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { log } from "@/lib/zapi";
import { registerTextBid, registerVote, runSchedule } from "@/lib/auctions";

// Recebe eventos da Z-API (configure em Webhooks → "Ao receber").
// Votos de enquete chegam com um campo de "pollVote"; os nomes variam entre versões,
// por isso a leitura é tolerante e tudo fica registrado em Painel → Bot WhatsApp.
export async function POST(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  const saved = (await db.setting.findUnique({ where: { key: "botWebhookKey" } }))?.value;
  if (!saved || key !== saved) return NextResponse.json({ ok: false }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false }, { status: 400 });

  const poll = (body.pollVote ?? body.poll_vote ?? body.pollUpdate) as Record<string, unknown> | undefined;
  if (poll) {
    const optionsRaw = (poll.options ?? poll.selectedOptions ?? poll.votes ?? []) as unknown[];
    const options = optionsRaw.map((o) => (typeof o === "string" ? o : String((o as Record<string, unknown>)?.name ?? (o as Record<string, unknown>)?.optionName ?? "")));
    const pollMessageId = String(poll.pollMessageId ?? poll.messageId ?? body.referenceMessageId ?? "");
    const phone = String(body.participantPhone ?? body.participant ?? body.senderPhone ?? body.phone ?? "");
    const name = String(body.senderName ?? body.chatName ?? body.participantName ?? "");
    const res = await registerVote({ pollMessageId, phone, name, options });
    await log("voto", { pollMessageId, phone, name, options, res });
  } else {
    await log("evento", body);
    // lance por mensagem no grupo (modo TEXT): "1.2 $55"
    const text = (body.text as Record<string, unknown> | undefined)?.message ?? body.body ?? body.message;
    const group = String(body.phone ?? body.chatId ?? "");
    const isGroup = body.isGroup === true || group.includes("-group") || group.includes("@g.us");
    if (typeof text === "string" && isGroup && body.fromMe !== true) {
      const res: { ok: boolean; reason?: string } = await registerTextBid({
        group,
        phone: String(body.participantPhone ?? body.participant ?? ""),
        name: String(body.senderName ?? ""),
        text,
      }).catch((e) => ({ ok: false, reason: String(e) }));
      if (res.ok || res.reason !== "não é lance") await log("lance", { text, res });
    }
  }
  // aproveita para rodar o agendador (abre/encerra leilões no horário)
  runSchedule().catch(() => {});
  return NextResponse.json({ ok: true });
}
