"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { GameKind, GamesConfig } from "@/lib/games";
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
        <span>Por dia {n(c[k].perDay, (x) => setC({ ...c, [k]: { ...c[k], perDay: x } }))}</span>
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
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span>Das {n(c.startHour, (x) => setC({ ...c, startHour: x }))}h às {n(c.endHour, (x) => setC({ ...c, endHour: x }))}h</span>
        <span>Intervalo mínimo {n(c.minGapMinutes, (x) => setC({ ...c, minGapMinutes: x }))} min</span>
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
