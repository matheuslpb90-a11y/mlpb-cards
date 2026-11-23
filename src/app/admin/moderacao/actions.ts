"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { DEFAULT_MOD, saveModConfig, type ModConfig } from "@/lib/moderation";

const lines = (v: unknown) => (Array.isArray(v) ? v : String(v ?? "").split(/[\n,;]+/)).map((x) => String(x).trim()).filter(Boolean);
const days = (v: unknown) => (Array.isArray(v) ? v.map(Number).filter((d) => d >= 0 && d <= 6) : []);
const int = (v: unknown, min: number, max: number, def: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : def;
};

export async function saveModAction(json: string): Promise<{ ok?: string; error?: string }> {
  await requireAdmin();
  let c: Partial<ModConfig>;
  try {
    c = JSON.parse(json);
  } catch {
    return { error: "Dados inválidos." };
  }
  const clean: ModConfig = {
    enabled: Boolean(c.enabled),
    prefix: (String(c.prefix ?? "!").trim().slice(0, 3) || "!").replace(/[\sA-Za-z0-9]/g, "") || "!",
    groups: lines(c.groups).filter((g) => g.endsWith("@g.us")),
    adminPhones: lines(c.adminPhones).map((p) => p.replace(/\D/g, "")).filter((p) => p.length >= 10),
    notify: Boolean(c.notify),
    welcome: { enabled: Boolean(c.welcome?.enabled), text: String(c.welcome?.text ?? DEFAULT_MOD.welcome.text).slice(0, 2000) },
    rules: String(c.rules ?? "").slice(0, 4000),
    ads: { enabled: Boolean(c.ads?.enabled), maxPerDay: int(c.ads?.maxPerDay, 0, 100, 3), maxPhotos: int(c.ads?.maxPhotos, 0, 30, 3), days: days(c.ads?.days) },
    links: {
      allow: Boolean(c.links?.allow),
      whitelist: lines(c.links?.whitelist).map((d) => d.toLowerCase()),
      blocked: lines(c.links?.blocked).map((d) => d.toLowerCase()),
      startHour: int(c.links?.startHour, 0, 23, 0),
      endHour: int(c.links?.endHour, 1, 24, 24),
      days: days(c.links?.days),
    },
    words: lines(c.words),
    ddi: { blockForeign: Boolean(c.ddi?.blockForeign), whitelist: lines(c.ddi?.whitelist).map((p) => p.replace(/\D/g, "")) },
    blacklist: lines(c.blacklist).map((p) => p.replace(/\D/g, "")).filter((p) => p.length >= 10),
    warns: { max: int(c.warns?.max, 0, 20, 3) },
    reviews: { proofs: int(c.reviews?.proofs, 0, 10, 3), proofMinutes: int(c.reviews?.proofMinutes, 1, 60, 5) },
    partners: {
      phones: lines(c.partners?.phones).map((p) => p.replace(/\D/g, "")).filter((p) => p.length >= 10),
      days: days(c.partners?.days),
      startHour: int(c.partners?.startHour, 0, 23, 8),
      endHour: int(c.partners?.endHour, 1, 24, 20),
    },
  };
  if (clean.partners.endHour <= clean.partners.startHour) return { error: "Horário dos parceiros: o fim precisa ser depois do início." };
  if (clean.links.endHour <= clean.links.startHour) return { error: "Horário de links: o fim precisa ser depois do início." };
  await saveModConfig(clean);
  await logActivity("mod_updated", `Moderação ${clean.enabled ? "ligada" : "desligada"}`);
  revalidatePath("/admin/moderacao");
  return { ok: "Configuração salva ✔" };
}

export async function deleteReviewAction(id: string) {
  await requireAdmin();
  const { db } = await import("@/lib/db");
  const r = await db.review.delete({ where: { id } }).catch(() => null);
  if (r) await logActivity("review_deleted", `Avaliação removida (nota ${r.rating} para ${r.targetPhone})`);
  revalidatePath("/admin/moderacao");
  return { ok: true };
}
