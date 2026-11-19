import { db } from "@/lib/db";
import { ACTIVITY_LABELS } from "@/lib/activity";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type SP = Promise<{ q?: string; acao?: string; de?: string; ate?: string; usuario?: string }>;

export default async function ActivityPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const where: Prisma.ActivityLogWhereInput = {};
  if (sp.q) where.description = { contains: sp.q, mode: "insensitive" };
  if (sp.acao) where.action = sp.acao;
  if (sp.usuario) where.userName = sp.usuario;
  if (sp.de || sp.ate)
    where.createdAt = {
      ...(sp.de ? { gte: new Date(`${sp.de}T00:00:00-03:00`) } : {}),
      ...(sp.ate ? { lte: new Date(`${sp.ate}T23:59:59-03:00`) } : {}),
    };
  const [logs, users] = await Promise.all([
    db.activityLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 300 }),
    db.activityLog.findMany({ distinct: ["userName"], select: { userName: true } }),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Logs de atividade</h1>
      <form className="card grid gap-2 p-3 sm:grid-cols-5">
        <input name="q" defaultValue={sp.q} className="input" placeholder="Buscar na descrição…" />
        <select name="usuario" defaultValue={sp.usuario ?? ""} className="input">
          <option value="">Todos os usuários</option>
          {users.map((u) => <option key={u.userName}>{u.userName}</option>)}
        </select>
        <select name="acao" defaultValue={sp.acao ?? ""} className="input">
          <option value="">Todas as ações</option>
          {Object.entries(ACTIVITY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <input type="date" name="de" defaultValue={sp.de} className="input" />
        <div className="flex gap-2"><input type="date" name="ate" defaultValue={sp.ate} className="input" /><button className="btn-primary">Filtrar</button></div>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="p-3">Data/hora</th><th className="p-3">Usuário</th><th className="p-3">Ação</th><th className="p-3">Descrição</th><th className="p-3">IP</th></tr></thead>
          <tbody className="divide-y">
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap p-3 text-slate-500">{l.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}</td>
                <td className="p-3 font-semibold">{l.userName}</td>
                <td className="p-3"><span className="rounded-full bg-blue-950/60 px-2 py-0.5 text-xs text-blue-300">{ACTIVITY_LABELS[l.action] ?? l.action}</span></td>
                <td className="p-3">{l.description}</td>
                <td className="p-3 text-xs text-slate-500">{l.ip}</td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-500">Nenhuma atividade registrada.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
