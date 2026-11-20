"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { cancelLabel, createLabel, payLabel, printLabels, refreshLabel, type Sender } from "@/lib/labels";

export async function saveSenderAction(s: Sender) {
  await requireAdmin();
  const clean: Sender = {
    name: s.name.trim(),
    document: s.document.replace(/\D/g, ""),
    street: s.street.trim(),
    number: s.number.trim(),
    complement: s.complement.trim(),
    neighborhood: s.neighborhood.trim(),
    city: s.city.trim(),
    state: s.state.trim().toUpperCase().slice(0, 2),
    cep: s.cep.replace(/\D/g, ""),
    email: s.email.trim(),
  };
  if (clean.cep.length !== 8) return { error: "CEP do remetente inválido." };
  await db.setting.upsert({ where: { key: "senderJson" }, create: { key: "senderJson", value: JSON.stringify(clean) }, update: { value: JSON.stringify(clean) } });
  await logActivity("sender_updated", "Remetente das etiquetas atualizado");
  revalidatePath("/admin/envios");
  return { ok: "Remetente salvo ✔" };
}

type Cmd = "criar" | "pagar" | "atualizar" | "imprimir" | "cancelar";

export async function labelAction(kind: "box" | "order", id: string, cmd: Cmd, service = "1"): Promise<{ ok?: string; error?: string; url?: string }> {
  await requireAdmin();
  const t = { kind, id };
  try {
    let msg = "";
    if (cmd === "criar") {
      const r = await createLabel(t, { service });
      msg = `Etiqueta gerada ✔${r.tracking ? ` Rastreio ${r.tracking}` : ""}`;
      if (kind === "box") await db.box.update({ where: { id }, data: { status: "EM_SEPARACAO" } }).catch(() => {});
    }
    if (cmd === "pagar") msg = `Etiqueta paga ✔ ${(await payLabel(t)).tracking}`;
    if (cmd === "atualizar") {
      const r = await refreshLabel(t);
      msg = `Status: ${r.status || "?"}${r.tracking ? ` · rastreio ${r.tracking}` : ""}`;
    }
    if (cmd === "cancelar") {
      await cancelLabel(t);
      msg = "Etiqueta cancelada (o valor volta para o saldo da SuperFrete).";
    }
    if (cmd === "imprimir") {
      const row = kind === "box" ? await db.box.findUnique({ where: { id } }) : await db.order.findUnique({ where: { id } });
      if (!row?.sfOrderId) return { error: "Sem etiqueta." };
      return { url: await printLabels([row.sfOrderId]) };
    }
    await logActivity("label_command", `${kind === "box" ? "Caixa" : "Pedido"} ${id.slice(-6)}: etiqueta ${cmd}`);
    revalidatePath("/admin/envios");
    return { ok: msg };
  } catch (e) {
    revalidatePath("/admin/envios");
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function printManyAction(ids: string[]) {
  await requireAdmin();
  try {
    return { url: await printLabels(ids) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function setAutoLabelAction(on: boolean) {
  await requireAdmin();
  await db.setting.upsert({ where: { key: "autoLabel" }, create: { key: "autoLabel", value: on ? "1" : "0" }, update: { value: on ? "1" : "0" } });
  await logActivity("label_command", `Etiqueta automática ${on ? "ligada" : "desligada"}`);
  revalidatePath("/admin/envios");
  return { ok: true };
}
