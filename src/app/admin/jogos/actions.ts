"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { saveGamesConfig, startRound, type GameKind, type GamesConfig } from "@/lib/games";

const int = (v: unknown, min: number, max: number, def: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : def;
};

export async function saveGamesAction(c: GamesConfig) {
  await requireAdmin();
  const clean: GamesConfig = {
    enabled: Boolean(c.enabled),
    startHour: int(c.startHour, 0, 23, 10),
    endHour: int(c.endHour, 1, 24, 22),
    minGapMinutes: int(c.minGapMinutes, 5, 1440, 60),
    roundMinutes: int(c.roundMinutes, 1, 60, 3),
    maxDex: int(c.maxDex, 1, 1025, 1025),
    pokemon: { enabled: Boolean(c.pokemon.enabled), perDay: int(c.pokemon.perDay, 0, 50, 3), points: int(c.pokemon.points, 0, 1000, 10) },
    preco: { enabled: Boolean(c.preco.enabled), perDay: int(c.preco.perDay, 0, 50, 2), points: int(c.preco.points, 0, 1000, 15) },
    pokebola: {
      enabled: Boolean(c.pokebola.enabled),
      perDay: int(c.pokebola.perDay, 0, 50, 3),
      points: int(c.pokebola.points, 0, 1000, 5),
      shinyPoints: int(c.pokebola.shinyPoints, 0, 10000, 50),
      shinyChance: int(c.pokebola.shinyChance, 0, 100, 5),
    },
  };
  if (clean.endHour <= clean.startHour) return { error: "O horário final precisa ser depois do inicial." };
  await saveGamesConfig(clean);
  await logActivity("games_config", `Jogos ${clean.enabled ? "ligados" : "desligados"}`);
  revalidatePath("/admin/jogos");
  return { ok: "Jogos salvos ✔" };
}

export async function startGameNowAction(kind: GameKind) {
  await requireAdmin();
  try {
    await startRound(kind);
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  revalidatePath("/admin/jogos");
  return { ok: "Jogo postado no grupo ✔" };
}
