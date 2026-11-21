"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { GameKind, GameSlot, GamesConfig } from "@/lib/games";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const KINDS: [GameSlot["kind"], string][] = [["POKEMON", "❓ Quem é esse Pokémon?"], ["PRECO", "💰 Adivinhe o preço"], ["POKEBOLA", "🔴 Pokébola"], ["SURPRESA", "🎲 Surpresa (sorteia um)"]];
import { saveGamesAction, startGameNowAction } from "./actions";

export function GamesForm({ initial }: { initial: GamesConfig }) {
  const [c, setC] = useState(initial);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>();
  const [pending, start] = useTransition();
  const router = useRouter();
  const n = (v: number, on: (x: number) => void, w = "w-20") => <input type="number" className={`input ${w}`} value={v} onChange={(e) => on(Number(e.target.value))} />;
  const now = (k: GameKind) => confirm("Começar esse jogo no grupo agora?") && start(async () => { setMsg(await startGameNowAction(k)); router.refresh(); });
  const game = (k: "pokemon" | "preco" | "pokebola", kind: GameKind, title: string, desc: string) => (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" className="h-4 w-4 accent-[#ff7a00]" checked={c[k].enabled} onChange={(e) => setC({ ...c, [k]: { ...c[k], enabled: e.target.checked } })} />
          {title}
        </label>
        <button type="button" disabled={pending} className="rounded-lg border px-2 py-1 text-xs hover:border-brand" onClick={() => now(kind)}>▶ Começar agora</button>
      </div>
      <p className="text-xs text-slate-500">{desc}</p>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {c.mode === "aleatorio" && <span>Por dia {n(c[k].perDay, (x) => setC({ ...c, [k]: { ...c[k], perDay: x } }))}</span>}
        <span>Pontos {n(c[k].points, (x) => setC({ ...c, [k]: { ...c[k], points: x } }))}</span>
        {k === "pokebola" && (
          <>
            <span>Shiny: pontos {n(c.pokebola.shinyPoints, (x) => setC({ ...c, pokebola: { ...c.pokebola, shinyPoints: x } }))}</span>
            <span>chance (%) {n(c.pokebola.shinyChance, (x) => setC({ ...c, pokebola: { ...c.pokebola, shinyChance: x } }))}</span>
          </>
        )}
      </div>
    </div>
  );
  return (
    <section className="card space-y-3 p-5">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-[#ff7a00]" checked={c.enabled} onChange={(e) => setC({ ...c, enabled: e.target.checked })} />
        <strong>Jogos automáticos ligados</strong> <span className="text-xs text-slate-500">(o “Começar agora” funciona mesmo desligado)</span>
      </label>
      <div className="space-y-2 rounded-lg border p-3 text-sm">
        <p className="font-semibold">📅 Dias com jogos</p>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d, i) => (
            <button key={d} type="button" onClick={() => setC({ ...c, days: c.days.includes(i) ? c.days.filter((x) => x !== i) : [...c.days, i].sort() })}
              className={`rounded-full border px-3 py-1 ${c.days.includes(i) ? "border-brand bg-brand font-bold text-black" : "border-slate-200"}`}>{d}</button>
          ))}
        </div>
        <p className="pt-2 font-semibold">⏰ Horários</p>
        <div className="flex flex-wrap gap-2">
          {([["aleatorio", "🎲 Aleatórios (o bot sorteia)"], ["fixo", "📌 Fixos (eu escolho)"]] as const).map(([m, label]) => (
            <button key={m} type="button" onClick={() => setC({ ...c, mode: m })}
              className={`rounded-lg border px-3 py-1.5 ${c.mode === m ? "border-brand bg-brand font-bold text-black" : "border-slate-200"}`}>{label}</button>
          ))}
        </div>
        {c.mode === "fixo" && (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">Em cada dia marcado, o jogo começa no horário escolhido (horário de Brasília).</p>
            {c.slots.map((s, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input type="time" className="input w-32" value={s.time} onChange={(e) => setC({ ...c, slots: c.slots.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)) })} />
                <select className="input w-auto" value={s.kind} onChange={(e) => setC({ ...c, slots: c.slots.map((x, j) => (j === i ? { ...x, kind: e.target.value as GameSlot["kind"] } : x)) })}>
                  {KINDS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
                <button type="button" className="rounded-lg border px-2 py-1 text-xs text-red-300" onClick={() => setC({ ...c, slots: c.slots.filter((_, j) => j !== i) })}>Remover</button>
              </div>
            ))}
            <button type="button" className="btn-outline text-sm" onClick={() => setC({ ...c, slots: [...c.slots, { time: "20:00", kind: "SURPRESA" }] })}>+ Adicionar horário</button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {c.mode === "aleatorio" && <span>Das {n(c.startHour, (x) => setC({ ...c, startHour: x }))}h às {n(c.endHour, (x) => setC({ ...c, endHour: x }))}h</span>}
        {c.mode === "aleatorio" && <span>Intervalo mínimo {n(c.minGapMinutes, (x) => setC({ ...c, minGapMinutes: x }))} min</span>}
        <span>Tempo para responder {n(c.roundMinutes, (x) => setC({ ...c, roundMinutes: x }))} min</span>
        <span>Pokémon até o nº {n(c.maxDex, (x) => setC({ ...c, maxDex: x }), "w-24")} <span className="text-xs text-slate-500">(151 = só a 1ª geração)</span></span>
      </div>
      {game("pokemon", "POKEMON", "❓ Quem é esse Pokémon?", "O bot posta a silhueta; o primeiro a mandar o nome certo ganha. Depois revela a imagem.")}
      {game("preco", "PRECO", "💰 Adivinhe o preço", "O bot mostra uma carta do seu estoque; vale o 1º palpite de cada um; quem chegar mais perto ganha. No fim, o link para comprar.")}
      {game("pokebola", "POKEBOLA", "🔴 Pokébola", "Um Pokémon selvagem aparece; o primeiro a digitar !captura leva para a Pokédex (!pokedex). Shiny é raro e vale mais.")}
      {msg?.error && <p className="text-sm text-red-300">{msg.error}</p>}
      {msg?.ok && <p className="text-sm text-green-300">{msg.ok}</p>}
      <button className="btn-primary w-full" disabled={pending} onClick={() => start(async () => setMsg(await saveGamesAction(c)))}>{pending ? "Salvando…" : "Salvar jogos"}</button>
    </section>
  );
}
