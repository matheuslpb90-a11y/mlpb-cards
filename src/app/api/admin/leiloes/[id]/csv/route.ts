import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

// Planilha dos arremates de um leilão (abre no Excel)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return new Response("Acesso negado", { status: 403 });
  const { id } = await params;
  const a = await db.auction.findUnique({ where: { id }, include: { lots: { orderBy: { position: "asc" }, include: { items: { orderBy: { position: "asc" } } } }, invoices: true } });
  if (!a) return new Response("Não encontrado", { status: 404 });
  const paidBy = new Map(a.invoices.map((i) => [i.phone, i.status]));
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const money = (c: number | null) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));
  const rows = [["lote", "carta", "codigo", "condicao", "idioma", "mercado", "arremate", "arrematador", "telefone", "status"]];
  for (const l of a.lots)
    for (const it of l.items)
      rows.push([`${l.position}.${it.position}`, it.name, it.number, it.condition, it.language, money(it.marketCents), money(it.winningCents), it.winnerName, it.winnerPhone,
        it.winningCents == null ? "sem lance" : paidBy.get(it.winnerPhone) === "PAGO" ? "pago" : "pendente"]);
  const csv = "﻿" + rows.map((r) => r.map(esc).join(";")).join("\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="leilao-${a.code}.csv"` } });
}
