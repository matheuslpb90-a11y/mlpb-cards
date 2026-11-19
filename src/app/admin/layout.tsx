import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="space-y-6">
      <nav className="card flex flex-wrap gap-1 p-2 text-sm font-medium">
        <Link href="/admin" className="rounded-lg px-3 py-2 hover:bg-slate-100">Resumo</Link>
        <Link href="/admin/cartas?tipo=cartas" className="rounded-lg px-3 py-2 hover:bg-slate-100">Cartas</Link>
        <Link href="/admin/cartas?tipo=produtos" className="rounded-lg px-3 py-2 hover:bg-slate-100">Produtos</Link>
        <Link href="/admin/cartas/nova" className="rounded-lg px-3 py-2 hover:bg-slate-100">+ Nova carta</Link>
        <Link href="/admin/cartas/nova?tipo=produto" className="rounded-lg px-3 py-2 hover:bg-slate-100">+ Novo produto</Link>
        <Link href="/admin/importar" className="rounded-lg px-3 py-2 hover:bg-slate-100">Importar CSV</Link>
        <Link href="/admin/pedidos" className="rounded-lg px-3 py-2 hover:bg-slate-100">Pedidos</Link>
      </nav>
      {children}
    </div>
  );
}
