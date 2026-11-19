"use client";

import { useState, useTransition } from "react";
import { botGroupsAction, botTestAction, saveBotGroupAction } from "../leiloes/actions";

export function BotSetup({ current }: { current: { id: string; name: string } }) {
  const [groups, setGroups] = useState<{ phone: string; name: string }[]>([]);
  const [sel, setSel] = useState(current);
  const [manual, setManual] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [pending, start] = useTransition();

  const save = (id: string, name: string) =>
    start(async () => {
      const r = await saveBotGroupAction(id, name);
      if (r?.error) { setErr(r.error); return; }
      setErr("");
      setSel({ id, name });
      setMsg(`Grupo salvo ✔ (${name || id}). Agora clique em “Enviar mensagem de teste”.`);
    });

  return (
    <section className="card space-y-3 p-5 text-sm">
      <h2 className="text-lg font-bold">4. Grupo do leilão</h2>
      <p>Grupo atual: <strong>{/http/.test(sel.id) ? "inválido — escolha de novo" : sel.name || sel.id || "nenhum"}</strong>{sel.id && <span className="ml-2 font-mono text-xs text-slate-500">{sel.id}</span>}</p>
      <div className="flex flex-wrap gap-2">
        <button className="btn-outline" disabled={pending} onClick={() => start(async () => {
          setMsg("Carregando grupos…"); setErr("");
          const r = await botGroupsAction();
          setGroups(r.groups ?? []);
          setLoaded(true);
          setErr(r.error ?? "");
          setMsg(`${r.status?.connected ? "WhatsApp conectado ✔" : `WhatsApp: ${r.status?.detail}`} · ${r.groups?.length ?? 0} grupo(s) encontrado(s)`);
        })}>Carregar grupos do WhatsApp</button>
        <button className="btn-outline" disabled={pending || !sel.id} onClick={() => start(async () => {
          setErr("");
          const r = await botTestAction();
          if (r.error) setErr(r.error); else setMsg("Mensagem de teste enviada ao grupo ✔ — confira no WhatsApp.");
        })}>Enviar mensagem de teste</button>
      </div>
      {msg && <p className="text-slate-600">{msg}</p>}
      {err && <p className="break-all rounded bg-red-950/60 p-2 text-xs text-red-300">Resposta da Z-API: {err}</p>}

      {groups.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase text-slate-500">Escolha o grupo</p>
          {groups.map((g) => (
            <button key={g.phone} disabled={pending} onClick={() => save(g.phone, g.name)}
              className={`flex w-full items-center justify-between rounded-lg border p-3 text-left hover:border-brand ${sel.id === g.phone ? "border-brand bg-brand/10" : ""}`}>
              <span className="font-semibold">{g.name || "(sem nome)"}</span>
              <span className="font-mono text-xs text-slate-500">{g.phone}</span>
            </button>
          ))}
        </div>
      )}

      {loaded && groups.length === 0 && (
        <div className="space-y-1 rounded-lg bg-amber-950/50 p-3 text-amber-300">
          <p><strong>Nenhum grupo encontrado pela Z-API.</strong> Faça assim:</p>
          <p>1) Mande qualquer mensagem no grupo (pelo seu celular). 2) Espere 10 segundos. 3) Clique de novo em “Carregar grupos do WhatsApp” — o grupo aparece pelas mensagens recebidas.</p>
        </div>
      )}

      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-slate-600">Colar o ID do grupo manualmente</summary>
        <div className="mt-2 flex gap-2">
          <input className="input flex-1 font-mono text-xs" value={manual} onChange={(e) => setManual(e.target.value.trim())} placeholder="ex.: 120363012345678901-group" />
          <button className="btn-primary" disabled={!manual || pending} onClick={() => save(manual, "")}>Salvar</button>
        </div>
        <p className="mt-1 text-xs text-slate-500">O ID aparece no Registro do bot (campo “phone” das mensagens do grupo) ou no painel da Z-API.</p>
      </details>
    </section>
  );
}
