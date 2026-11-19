import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runSchedule } from "@/lib/auctions";

// Agendador: chame a cada minuto (ex.: cron-job.org) com ?key=<chave do Painel → Bot WhatsApp>.
// Abre e encerra leilões no horário.
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  const saved = (await db.setting.findUnique({ where: { key: "botWebhookKey" } }))?.value;
  const cronSecret = process.env.CRON_SECRET;
  const authorized = (saved && key === saved) || (cronSecret && req.headers.get("authorization") === `Bearer ${cronSecret}`);
  if (!authorized) return NextResponse.json({ ok: false }, { status: 401 });
  const done = await runSchedule();
  return NextResponse.json({ ok: true, done });
}
