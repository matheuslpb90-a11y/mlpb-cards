"use client";

import { useState, useTransition } from "react";
import { botGroupsAction, botTestAction, saveBotGroupAction } from "../leiloes/actions";

export function BotSetup({ current }: { current: { id: string; name: string } }) {
  const [groups, setGroups] = useState<{ phone: string; name: string }[]>([]);
  const [sel, setSel] = useState(current);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <section className="card space-y-3 p-5 text-sm">
      <h2 className="text-lg font-bold">4. Grupo do leilão</h2>
      <p>Grupo atual: <strong>{sel.name || sel.id || "nenhum"}</strong></p>
      <div className="flex flex-wrap gap-2">
        <button className="btn-outline" disabled={pending} onClick={() => start(async () => {
          setMsg("Carregando grupos…");
          const r = await botGroupsAction();
          if (r.error) return setMsg(r.error);
          setGroups(r.groups ?? []);
          setMsg(`${r.status?.connected ? "WhatsApp conectado ✔" : `WhatsApp: ${r.status?.detail}`} · ${r.groups?.length ?? 0} grupo(s)`);
        })}>Carregar grupos do WhatsApp</button>
        <button className="btn-outline" disabled={pending || !sel.id} onClick={() => start(async () => {
          const r = await botTestAction();
          setMsg(r.error ?? "Mensagem de teste enviada ao grupo ✔");
        })}>Enviar mensagem de teste</button>
      </div>
      {groups.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <select className="input max-w-md" value={sel.id} onChange={(e) => setSel({ id: e.target.value, name: groups.find((g) => g.phone === e.target.value)?.name ?? "" })}>
            <option value="">Escolha o grupo…</option>
            {groups.map((g) => <option key={g.phone} value={g.phone}>{g.name || g.phone}</option>)}
          </select>
          <button className="btn-primary" disabled={!sel.id || pending} onClick={() => start(async () => { await saveBotGroupAction(sel.id, sel.name); setMsg("Grupo salvo ✔"); })}>Salvar grupo</button>
        </div>
      )}
      {msg && <p className="text-slate-600">{msg}</p>}
    </section>
  );
}
