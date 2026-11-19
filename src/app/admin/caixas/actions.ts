"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { BOX_STATUS, notifyBox } from "@/lib/boxes";
import { reaisToCents } from "@/lib/auction-draft";

const CLOSED = ["ENVIADA", "PRESENCIAL", "CONCLUIDA"];

export async function setBoxStatusAction(id: string, status: string) {
  await requireAdmin();
  if (!BOX_STATUS[status]) return { error: "Status inválido" };
  const box = await db.box.findUnique({ where: { id } });
  if (!box || box.status === status) return { ok: true };
  await db.box.update({
    where: { id },
    data: {
      status,
      closedAt: CLOSED.includes(status) ? box.closedAt ?? new Date() : null,
      requestedAt: status !== "PENDENTE" ? box.requestedAt ?? new Date() : box.requestedAt,
    },
  });
  await logActivity("box_status_changed", `Caixa #${box.code}: ${BOX_STATUS[box.status]} → ${BOX_STATUS[status]}`);
  let notified = false;
  if (status === "ENVIADA") notified = await notifyBox(id, "enviada").catch(() => false);
  if (status === "EM_SEPARACAO") notified = await notifyBox(id, "separacao").catch(() => false);
  revalidatePath("/admin/caixas");
  return { ok: true, notified };
}

export async function toggleBoxShippingPaidAction(id: string) {
  await requireAdmin();
  const box = await db.box.findUnique({ where: { id } });
  if (!box) return { error: "Caixa não encontrada" };
  await db.box.update({ where: { id }, data: { shippingPaid: !box.shippingPaid } });
  await logActivity("box_shipping_paid_toggled", `Caixa #${box.code}: frete ${box.shippingPaid ? "não pago" : "pago"}`);
  revalidatePath("/admin/caixas");
  return { ok: true };
}

export async function updateBoxAction(id: string, data: { trackingCode?: string; notes?: string; shippingMethod?: string; shippingCents?: string }) {
  await requireAdmin();
  const box = await db.box.findUnique({ where: { id } });
  if (!box) return { error: "Caixa não encontrada" };
  await db.box.update({
    where: { id },
    data: {
      ...(data.trackingCode !== undefined ? { trackingCode: data.trackingCode.trim().toUpperCase() } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.shippingMethod !== undefined ? { shippingMethod: data.shippingMethod } : {}),
      ...(data.shippingCents !== undefined ? { shippingCents: reaisToCents(data.shippingCents) ?? 0 } : {}),
    },
  });
  await logActivity("box_updated", `Caixa #${box.code}: ${data.trackingCode !== undefined ? `rastreio ${data.trackingCode || "(vazio)"}` : "dados atualizados"}`);
  revalidatePath("/admin/caixas");
  return { ok: true };
}

export async function archiveBoxAction(id: string) {
  await requireAdmin();
  const box = await db.box.findUnique({ where: { id } });
  if (!box) return { error: "Caixa não encontrada" };
  await db.box.update({ where: { id }, data: { archived: !box.archived } });
  await logActivity("box_archived", `Caixa #${box.code}: ${box.archived ? "desarquivada" : "arquivada"}`);
  revalidatePath("/admin/caixas");
  return { ok: true };
}

export async function sendBoxLinkAction(id: string) {
  await requireAdmin();
  try {
    const ok = await notifyBox(id, "link");
    return ok ? { ok: true } : { error: "Bot do WhatsApp não configurado — use o botão de WhatsApp manual." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function saveFreeShippingAction(reais: string) {
  await requireAdmin();
  const cents = reaisToCents(reais);
  if (!cents) return { error: "Valor inválido" };
  await db.setting.upsert({ where: { key: "freeShippingCents" }, create: { key: "freeShippingCents", value: String(cents) }, update: { value: String(cents) } });
  await logActivity("settings_updated", `Frete grátis a partir de R$ ${reais}`);
  revalidatePath("/admin/caixas");
  return { ok: true };
}
