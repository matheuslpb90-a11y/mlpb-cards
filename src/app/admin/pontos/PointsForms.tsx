"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { PointsConfig } from "@/lib/points";
import { launchPointsAction, redemptionAction, savePointsConfigAction } from "./actions";

export function RedemptionButtons({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (cmd: "entregue" | "recusar", ask: string) =>
    confirm(ask) && start(async () => { const r = await redemptionAction(id, cmd); if ("error" in r && r.error) alert(r.error); router.refresh(); });
  const b = "rounded-lg border px-2 py-1 text-xs hover:border-brand disabled:opacity-40";
  return (
    <div className="flex gap-1">
      <button disabled={pending} className={`${b} border-green-700 text-green-300`} onClick={() => run("entregue", "Marcar como entregue? O cliente recebe aviso no WhatsApp.")}>✔ Entregue</button>
      <button disabled={pending} className={`${b} text-red-300`} onClick={() => run("recusar", "Recusar? Os pontos voltam para o cliente.")}>Recusar</button>
    </div>
  );
}

export function LaunchForm() {
  const [f, setF] = useState({ phone: "", name: "", kind: "LEILOMANIA" as "LEILOMANIA" | "PONTOS", value: "", note: "" });
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>();
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <section className="card space-y-2 p-5 text-sm">
      <h2 className="text-lg font-bold">➕ Lançar pontos</h2>
      <div className="flex gap-2">
        {(["LEILOMANIA", "PONTOS"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setF({ ...f, kind: k })} className={`rounded-lg border px-3 py-1 text-xs ${f.kind === k ? "border-brand text-brand-amber" : "text-slate-500"}`}>
            {k === "LEILOMANIA" ? "Compra no Leilomania (R$)" : "Pontos avulsos (+/−)"}
          </button>
        ))}
      </div>
      <input className="input" placeholder="WhatsApp com DDD (ex.: 61999999999)" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
      <input className="input" placeholder="Nome (opcional)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <input className="input" placeholder={f.kind === "LEILOMANIA" ? "Valor da compra em R$ (ex.: 120)" : "Pontos (ex.: 50 ou -50)"} value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} />
      <input className="input" placeholder="Observação (opcional)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      {msg?.error && <p className="text-red-300">{msg.error}</p>}
      {msg?.ok && <p className="text-green-300">{msg.ok}</p>}
      <button className="btn-primary w-full" disabled={pending} onClick={() => start(async () => { const r = await launchPointsAction(f); setMsg(r); if (r.ok) { setF({ ...f, value: "", note: "" }); router.refresh(); } })}>
        {pending ? "Lançando…" : "Lançar"}
      </button>
    </section>
  );
}

export function PointsConfigForm({ initial }: { initial: PointsConfig }) {
  const [c, setC] = useState(initial);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>();
  const [pending, start] = useTransition();
  const num = (k: keyof PointsConfig, label: string, hint = "") => (
    <label className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span>{label} {hint && <span className="text-xs text-slate-500">{hint}</span>}</span>
      <input type="number" className="input w-28" value={c[k] as number} onChange={(e) => setC({ ...c, [k]: Number(e.target.value) })} />
    </label>
  );
  return (
    <section className="card space-y-3 p-5">
      <h2 className="text-lg font-bold">⚙️ Regras do programa</h2>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-[#ff7a00]" checked={c.enabled} onChange={(e) => setC({ ...c, enabled: e.target.checked })} />
        <strong>MLPB Points ligado</strong>
      </label>
      <div className="grid gap-2 md:grid-cols-2">
        {num("perReal", "Pontos por R$ 1 em compras/arremates")}
        {num("gameDailyCap", "Máximo de pontos por dia em jogos")}
        {num("reviewPoints", "Avaliar alguém com provas")}
        {num("referralStay", "Indicação: amigo ficou 7 dias")}
        {num("referralPurchase", "Indicação: amigo fez a 1ª compra")}
        {num("expiryMonths", "Pontos vencem em (meses)", "0 = nunca")}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        Bônus do ranking do mês (1º / 2º / 3º):
        {[0, 1, 2].map((i) => (
          <input key={i} type="number" className="input w-24" value={c.ranking[i] ?? 0} onChange={(e) => { const r = [...c.ranking]; r[i] = Number(e.target.value); setC({ ...c, ranking: r }); }} />
        ))}
      </div>
      <div className="space-y-2">
        <p className="label">Prêmios</p>
        {c.rewards.map((r, i) => (
          <div key={i} className="flex gap-2">
            <input className="input flex-1" value={r.name} onChange={(e) => { const rw = [...c.rewards]; rw[i] = { ...r, name: e.target.value }; setC({ ...c, rewards: rw }); }} />
            <input type="number" className="input w-28" value={r.points} onChange={(e) => { const rw = [...c.rewards]; rw[i] = { ...r, points: Number(e.target.value) }; setC({ ...c, rewards: rw }); }} />
            <button type="button" className="rounded-lg border px-2 text-xs text-red-300" onClick={() => setC({ ...c, rewards: c.rewards.filter((_, j) => j !== i) })}>✕</button>
          </div>
        ))}
        <button type="button" className="btn-outline text-sm" onClick={() => setC({ ...c, rewards: [...c.rewards, { key: `premio${Date.now()}`, name: "", points: 100 }] })}>+ Prêmio</button>
      </div>
      {msg?.error && <p className="text-sm text-red-300">{msg.error}</p>}
      {msg?.ok && <p className="text-sm text-green-300">{msg.ok}</p>}
      <button className="btn-primary w-full" disabled={pending} onClick={() => start(async () => setMsg(await savePointsConfigAction(c)))}>{pending ? "Salvando…" : "Salvar regras"}</button>
    </section>
  );
}
