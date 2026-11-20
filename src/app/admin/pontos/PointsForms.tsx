"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { PointsConfig } from "@/lib/points";
import { launchPointsAction, redemptionAction, savePointsConfigAction, startPointAuctionAction } from "./actions";
import { ImageUploadField } from "@/components/admin/ImageUploadField";

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
        {num("reviewPoints", "1ª avaliação da loja (!avaliar)")}
        {num("reviewRepeatPoints", "Reavaliações da loja", "máx. 1x por dia")}
        {num("referralStay", "Indicação: amigo ficou 7 dias")}
        {num("referralPurchase", "Indicação: amigo fez a 1ª compra")}
        {num("boxBonus", "Bônus quando a caixa chega no frete grátis (R$ 500)", "1x por caixa")}
        {num("expiryMonths", "Pontos vencem em (meses)", "0 = nunca")}
        {num("spendWindowDays", "Janela da compra mínima (dias)")}
        {num("auctionMinSpend", "Compra mínima (R$) para vencer Leilão de Pontos", "0 = sem exigência")}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        Bônus do ranking do mês (1º / 2º / 3º):
        {[0, 1, 2].map((i) => (
          <input key={i} type="number" className="input w-24" value={c.ranking[i] ?? 0} onChange={(e) => { const r = [...c.ranking]; r[i] = Number(e.target.value); setC({ ...c, ranking: r }); }} />
        ))}
      </div>
      <div className="space-y-2">
        <p className="label">Prêmios <span className="text-xs font-normal text-slate-500">(nome · pontos · compra mínima em R$ na janela — 0 = qualquer um troca)</span></p>
        {c.rewards.map((r, i) => (
          <div key={i} className="flex gap-2">
            <input className="input flex-1" value={r.name} onChange={(e) => { const rw = [...c.rewards]; rw[i] = { ...r, name: e.target.value }; setC({ ...c, rewards: rw }); }} />
            <input type="number" className="input w-24" title="pontos" value={r.points} onChange={(e) => { const rw = [...c.rewards]; rw[i] = { ...r, points: Number(e.target.value) }; setC({ ...c, rewards: rw }); }} />
            <input type="number" className="input w-24" title="compra mínima (R$)" placeholder="R$ mín." value={r.minSpend ?? 0} onChange={(e) => { const rw = [...c.rewards]; rw[i] = { ...r, minSpend: Number(e.target.value) }; setC({ ...c, rewards: rw }); }} />
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

export function PointAuctionForm() {
  const [f, setF] = useState({ title: "", imageUrl: "", start: "100", step: "50", count: "10", minutes: "30" });
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>();
  const [pending, start] = useTransition();
  const router = useRouter();
  const opts = Array.from({ length: Math.min(Math.max(Number(f.count) || 10, 2), 12) }, (_, i) => (Number(f.start) || 0) + i * (Number(f.step) || 0));
  const field = (k: keyof typeof f, label: string, w = "w-24") => (
    <label className="flex items-center gap-2 text-sm">{label}<input type="number" className={`input ${w}`} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>
  );
  return (
    <section className="card space-y-3 p-5">
      <h2 className="text-lg font-bold">🔨 Leilão de Pontos</h2>
      <p className="text-xs text-slate-500">Posta uma enquete no grupo com lances em pontos. Vence o maior lance de quem tiver saldo no encerramento; os pontos são descontados e o prêmio aparece em “Trocas para entregar”.</p>
      <input className="input" placeholder="Prêmio (ex.: Charizard V promo, lote de 20 bulk…)" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <ImageUploadField name="imageUrl" label="Foto do prêmio (opcional)" value={f.imageUrl} onChange={(x) => setF({ ...f, imageUrl: x })} maxSide={1000} />
      <div className="flex flex-wrap gap-3">
        {field("start", "Lance inicial")}
        {field("step", "Aumento")}
        {field("count", "Opções", "w-20")}
        {field("minutes", "Duração (min)", "w-20")}
      </div>
      <p className="text-xs text-slate-500">Enquete: {opts.map((o) => `${o} pts`).join(" · ")}</p>
      {msg?.error && <p className="text-sm text-red-300">{msg.error}</p>}
      {msg?.ok && <p className="text-sm text-green-300">{msg.ok}</p>}
      <button className="btn-primary w-full" disabled={pending} onClick={() => confirm("Postar o Leilão de Pontos no grupo agora?") && start(async () => { const r = await startPointAuctionAction(f); setMsg(r); if (r.ok) { setF({ ...f, title: "", imageUrl: "" }); router.refresh(); } })}>
        {pending ? "Postando…" : "Iniciar Leilão de Pontos"}
      </button>
    </section>
  );
}
