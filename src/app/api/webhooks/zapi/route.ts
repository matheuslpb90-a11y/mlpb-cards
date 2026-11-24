import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { log } from "@/lib/zapi";
import { whapiPhone } from "@/lib/whapi";
import { moderateMessage, onParticipantsAdded, parseWhapiMessage } from "@/lib/moderation";
import { registerTextBid, registerVote, runSchedule } from "@/lib/auctions";

// Recebe eventos da Z-API (configure em Webhooks → "Ao receber").
// Votos de enquete chegam com um campo de "pollVote"; os nomes variam entre versões,
// por isso a leitura é tolerante e tudo fica registrado em Painel → Bot WhatsApp.
// apagar fotos pode precisar de algumas tentativas (até ~20s)
export const maxDuration = 60;

export async function POST(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  const saved = (await db.setting.findUnique({ where: { key: "botWebhookKey" } }))?.value;
  if (!saved || key !== saved) return NextResponse.json({ ok: false }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false }, { status: 400 });

  // ---- Whapi: { messages: [...] }, { messages_updates: [...] }, { groups_participants: [...] } ----
  const participantEvents = Object.entries(body)
    .filter(([k, v]) => /participants/i.test(k) && Array.isArray(v))
    .flatMap(([, v]) => v as Record<string, unknown>[]);
  if (Array.isArray(body.messages) || Array.isArray(body.messages_updates) || participantEvents.length) {
    const msgs = (Array.isArray(body.messages) ? body.messages : []) as Record<string, unknown>[];
    // Só registra o que interessa (votos, enquetes, entradas no grupo, privado). Mensagens comuns de grupo
    // não vão para o Registro do bot, senão ele lota.
    const relevant =
      Array.isArray(body.messages_updates) ||
      participantEvents.length > 0 ||
      msgs.some((m) => m.type === "action" || !String(m.chat_id ?? "").includes("@g.us"));
    if (relevant) await log("evento", body);

    // entrada de participantes: boas-vindas e bloqueio de DDI estrangeiro
    for (const ev of participantEvents) {
      if (!/add|join|invite/i.test(String(ev.action ?? ev.type ?? ""))) continue;
      const group = String(ev.group_id ?? ev.chat_id ?? ev.id ?? "");
      const people = ((ev.participants ?? []) as unknown[]).map(whapiPhone);
      await onParticipantsAdded(group, people).catch((e) => log("erro-moderacao", { acao: "entrada", error: String(e) }));
    }

    // moderação e comandos (!ban, !regras...) nos grupos moderados
    for (const m of msgs) {
      if (m.type === "action" || m.source === "api" || !String(m.chat_id ?? "").endsWith("@g.us")) continue;
      const done = await moderateMessage(parseWhapiMessage(m)).catch(async (e) => {
        await log("erro-moderacao", { acao: "mensagem", error: String(e) });
        return null;
      });
      if (done) await log("moderacao", { acao: done, de: m.from_name ?? m.from, texto: String((m.text as Record<string, unknown> | undefined)?.body ?? m.type).slice(0, 200) });
    }

    for (const m of msgs) {
      if (m.from_me === true) continue;
      const action = m.action as Record<string, unknown> | undefined;
      const from = String(m.phone ?? "") || whapiPhone(m.from);
      const name = String(m.from_name ?? "");
      if (m.type === "action" && action && /vote/i.test(String(action.type ?? ""))) {
        const votes = ((action.votes ?? action.selected ?? []) as unknown[]).map((v) => (typeof v === "string" ? v : String((v as Record<string, unknown>)?.name ?? (v as Record<string, unknown>)?.id ?? "")));
        const res = await registerVote({ pollMessageId: String(action.target ?? ""), phone: from, name, options: votes });
        await log("voto", { poll: action.target, from, name, votes, res });
      } else if (m.type === "text") {
        const text = String((m.text as Record<string, unknown> | undefined)?.body ?? "");
        const chat = String(m.chat_id ?? "");
        if (text && chat.includes("@g.us")) {
          const res: { ok: boolean; reason?: string } = await registerTextBid({ group: chat, phone: from, name, text }).catch((e) => ({ ok: false, reason: String(e) }));
          if (res.ok || res.reason !== "não é lance") await log("lance", { text, res });
        }
      }
    }
    // atualizações de enquete com a lista de quem votou em cada opção
    const updates = (Array.isArray(body.messages_updates) ? body.messages_updates : []) as Record<string, unknown>[];
    for (const u of updates) {
      const after = (u.after_update ?? u.message ?? u) as Record<string, unknown>;
      const pollObj = after.poll as Record<string, unknown> | undefined;
      const results = (pollObj?.results ?? []) as Record<string, unknown>[];
      for (const r of results)
        for (const voter of (r.voters ?? []) as unknown[]) {
          const res = await registerVote({ pollMessageId: String(after.id ?? u.id ?? ""), phone: whapiPhone(voter), name: "", options: [String(r.name ?? "")] });
          await log("voto", { poll: after.id ?? u.id, voter, option: r.name, res });
        }
    }
    runSchedule().catch(() => {});
    return NextResponse.json({ ok: true });
  }

  // confirmações de entrega (Whapi "statuses"): não interessam
  if (Array.isArray(body.statuses)) return NextResponse.json({ ok: true });

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
