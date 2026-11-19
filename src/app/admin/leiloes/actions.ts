"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { priceItem } from "@/lib/auction-pricing";
import { brt, reaisToCents, type AuctionDraft } from "@/lib/auction-draft";
import { closeAuction, markInvoicePaid, sendInvoice, startAuction } from "@/lib/auctions";
import { listGroups, groupsFromLogs, sendText, connectionStatus, probeOmni } from "@/lib/zapi";
import { logActivity } from "@/lib/activity";

export async function saveAuctionAction(d: AuctionDraft): Promise<{ id?: string; error?: string }> {
  await requireAdmin();
  if (!d.name.trim()) return { error: "Informe o nome do leilão." };
  if (!d.startDate || !d.startTime || !d.endDate || !d.endTime) return { error: "Informe data e horário de início e fim." };
  const startsAt = brt(d.startDate, d.startTime);
  const endsAt = brt(d.endDate, d.endTime);
  if (!(endsAt > startsAt)) return { error: "O fim precisa ser depois do início." };
  if (d.lots.every((l) => l.items.length === 0)) return { error: "Adicione pelo menos uma carta em algum lote." };
  for (const [li, l] of d.lots.entries())
    for (const [ii, it] of l.items.entries()) if (!it.name.trim()) return { error: `Lote ${li + 1}, carta ${ii + 1}: informe o nome.` };

  const rules = {
    initialPct: Math.max(0, Math.min(95, Number(d.initialPct) || 0)),
    buyoutPct: Math.max(0, Math.min(500, Number(d.buyoutPct) || 0)),
    defaultStepCents: reaisToCents(d.defaultStep),
    oneReal: d.oneReal,
  };

  if (d.id) {
    const cur = await db.auction.findUnique({ where: { id: d.id } });
    if (!cur) return { error: "Leilão não encontrado." };
    if (cur.status !== "AGENDADO") return { error: "Este leilão já começou — só dá para editar antes do início." };
  }

  const base = {
    name: d.name.trim(),
    description: d.description.trim(),
    imageUrl: d.imageUrl,
    startsAt,
    endsAt,
    paymentDays: Math.max(1, Number(d.paymentDays) || 3),
    initialPct: rules.initialPct,
    buyoutPct: rules.buyoutPct,
    defaultStepCents: rules.defaultStepCents,
    oneReal: d.oneReal,
    infinitepayHandle: d.infinitepayHandle.trim().replace(/^\$/, ""),
    visible: d.visible,
  };

  const id = await db.$transaction(async (tx) => {
    let auctionId = d.id;
    if (auctionId) {
      await tx.auction.update({ where: { id: auctionId }, data: base });
      await tx.auctionLot.deleteMany({ where: { auctionId } });
    } else {
      const last = await tx.auction.findFirst({ orderBy: { code: "desc" }, select: { code: true } });
      auctionId = (await tx.auction.create({ data: { ...base, code: (last?.code ?? 0) + 1 } })).id;
    }
    for (const [li, l] of d.lots.entries()) {
      if (l.items.length === 0) continue;
      await tx.auctionLot.create({
        data: {
          auctionId,
          position: li + 1,
          title: l.title.trim() || `Lote ${li + 1}`,
          imageUrl: l.imageUrl,
          oneReal: l.oneReal,
          hideMarket: l.hideMarket,
          hideBuyout: l.hideBuyout,
          items: {
            create: l.items.map((it, ii) => {
              const market = reaisToCents(it.market) ?? 0;
              const p = priceItem(market, rules, l.oneReal, { start: reaisToCents(it.start), buyout: reaisToCents(it.buyout), step: reaisToCents(it.step) });
              return {
                position: ii + 1,
                cardId: it.cardId || null,
                name: it.name.trim(),
                number: it.number.trim(),
                finish: it.finish,
                condition: it.condition,
                language: it.language,
                graded: it.graded,
                note: it.note.trim(),
                costCents: reaisToCents(it.cost),
                marketCents: market,
                startOverride: reaisToCents(it.start),
                buyoutOverride: reaisToCents(it.buyout),
                stepOverride: reaisToCents(it.step),
                hideMarket: it.hideMarket,
                hideBuyout: it.hideBuyout,
                imageUrl: it.imageUrl,
                mediaJson: JSON.stringify(it.media),
                startCents: p.startCents,
                stepCents: p.stepCents,
                buyoutCents: p.buyoutCents,
                optionsJson: JSON.stringify(p.options),
              };
            }),
          },
        },
      });
    }
    return auctionId;
  });
  await logActivity("auction_saved", `${d.id ? "Editou" : "Criou"} o leilão "${d.name}"`);
  revalidatePath("/admin/leiloes");
  revalidatePath("/leiloes");
  return { id };
}

export async function searchStockAction(q: string) {
  await requireAdmin();
  return db.card.findMany({
    where: {
      kind: "CARTA",
      active: true,
      stock: { gt: 0 },
      ...(q.trim()
        ? { OR: [{ name: { contains: q.trim(), mode: "insensitive" } }, { number: { contains: q.trim() } }, { setName: { contains: q.trim(), mode: "insensitive" } }] }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 40,
    select: { id: true, name: true, number: true, setName: true, condition: true, language: true, finish: true, priceCents: true, imageUrl: true, stock: true },
  });
}

export async function auctionCommandAction(id: string, cmd: "iniciar" | "encerrar" | "cancelar" | "excluir" | "visivel" | "duplicar") {
  await requireAdmin();
  const a = await db.auction.findUnique({ where: { id } });
  if (!a) return { error: "Leilão não encontrado." };
  try {
    if (cmd === "iniciar") {
      if (a.status === "AGENDADO" && a.startsAt > new Date()) await db.auction.update({ where: { id }, data: { startsAt: new Date() } });
      await startAuction(id);
    }
    if (cmd === "encerrar") {
      if (a.status === "ATIVO" && a.endsAt > new Date()) await db.auction.update({ where: { id }, data: { endsAt: new Date() } });
      await closeAuction(id);
    }
    if (cmd === "cancelar") await db.auction.update({ where: { id }, data: { status: "CANCELADO" } });
    if (cmd === "excluir") await db.auction.delete({ where: { id } });
    if (cmd === "visivel") await db.auction.update({ where: { id }, data: { visible: !a.visible } });
    if (cmd === "duplicar") {
      const full = await db.auction.findUnique({ where: { id }, include: { lots: { include: { items: true } } } });
      const last = await db.auction.findFirst({ orderBy: { code: "desc" }, select: { code: true } });
      const week = 7 * 24 * 60 * 60 * 1000;
      await db.auction.create({
        data: {
          code: (last?.code ?? 0) + 1,
          name: `${full!.name} (cópia)`, description: full!.description, imageUrl: full!.imageUrl,
          startsAt: new Date(full!.startsAt.getTime() + week), endsAt: new Date(full!.endsAt.getTime() + week),
          paymentDays: full!.paymentDays, initialPct: full!.initialPct, buyoutPct: full!.buyoutPct,
          defaultStepCents: full!.defaultStepCents, oneReal: full!.oneReal, infinitepayHandle: full!.infinitepayHandle, visible: false,
          lots: {
            create: full!.lots.map((l) => ({
              position: l.position, title: l.title, imageUrl: l.imageUrl, oneReal: l.oneReal, hideMarket: l.hideMarket, hideBuyout: l.hideBuyout,
              items: {
                create: l.items.map(({ id: _i, lotId: _l, pollMessageId: _p, winnerPhone: _w, winnerName: _n, winningCents: _c, ...it }) => it),
              },
            })),
          },
        },
      });
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  await logActivity("auction_command", `Leilão "${a.name}": ${cmd}`);
  revalidatePath("/admin/leiloes");
  revalidatePath("/leiloes");
  return { ok: true };
}

export async function invoiceCommandAction(id: string, cmd: "reenviar" | "pago" | "cancelar") {
  await requireAdmin();
  try {
    if (cmd === "reenviar") await sendInvoice(id);
    if (cmd === "pago") {
      const inv = await db.invoice.findUnique({ where: { id } });
      if (inv) await markInvoicePaid(inv.code, { transactionNsu: "MANUAL" });
    }
    if (cmd === "cancelar") await db.invoice.update({ where: { id }, data: { status: "CANCELADO" } });
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  await logActivity("invoice_command", `Invoice ${id.slice(-6)}: ${cmd}`);
  revalidatePath("/admin/faturas");
  return { ok: true };
}

export async function botGroupsAction() {
  await requireAdmin();
  const status = await connectionStatus();
  const fromLogs = await groupsFromLogs().catch(() => []);
  try {
    const groups = await listGroups();
    const all = [...groups, ...fromLogs.filter((g) => !groups.some((x) => x.phone === g.phone))];
    return { groups: all, status };
  } catch (e) {
    return { groups: fromLogs, status, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function saveBotGroupAction(groupId: string, groupName: string) {
  await requireAdmin();
  const id = groupId.trim();
  if (/http|\s/i.test(id) || !/^[\d-]{10,}(-group|@g\.us)?$/.test(id))
    return { error: "Isso não é um ID de grupo. O ID tem só números e termina em “-group” (ex.: 120363012345678901-group)." };
  for (const [key, value] of [["botGroupId", groupId], ["botGroupName", groupName]])
    await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  await logActivity("bot_group_updated", `Grupo do bot: ${groupName || id}`);
  revalidatePath("/admin/bot");
  return { ok: true };
}

export async function botTestAction() {
  await requireAdmin();
  const g = await db.setting.findUnique({ where: { key: "botGroupId" } });
  if (!g?.value) return { error: "Escolha o grupo primeiro." };
  try {
    await sendText(g.value, "🤖 Teste do bot da MLPB Cards — tudo funcionando!");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function botProbeAction() {
  await requireAdmin();
  const g = await db.setting.findUnique({ where: { key: "botGroupId" } });
  return probeOmni(g?.value ?? "");
}
