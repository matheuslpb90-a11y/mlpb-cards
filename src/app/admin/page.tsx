import Link from "next/link";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const [active, inactive, outOfStock, toShip, accumulated, waiting, paidAgg] = await Promise.all([
    db.card.count({ where: { active: true } }),
    db.card.count({ where: { active: false } }),
    db.card.count({ where: { active: true, stock: 0 } }),
    db.order.count({ where: { status: "PAGO" } }),
    db.order.count({ where: { status: "ACUMULANDO" } }),
    db.order.count({ where: { status: "AGUARDANDO_PAGAMENTO" } }),
    db.order.aggregate({ _sum: { totalCents: true }, where: { status: { in: ["PAGO", "ACUMULANDO", "ENVIADO"] } } }),
  ]);
  const stats: [string, string | number, string][] = [
    ["Cartas no catálogo", active, "/admin/cartas"],
    ["Fora do catálogo", inactive, "/admin/cartas?status=inativas"],
    ["Esgotadas", outOfStock, "/admin/cartas?status=esgotadas"],
    ["Pedidos para enviar", toShip, "/admin/pedidos?status=PAGO"],
    ["Pedidos acumulados", accumulated, "/admin/pedidos?status=ACUMULANDO"],
    ["Aguardando pagamento", waiting, "/admin/pedidos?status=AGUARDANDO_PAGAMENTO"],
    ["Vendido pelo site", formatBRL(paidAgg._sum.totalCents ?? 0), "/admin/pedidos"],
  ];
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {stats.map(([label, value, href]) => (
        <Link key={label} href={href} className="card p-4 hover:border-brand">
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </Link>
      ))}
    </div>
  );
}
