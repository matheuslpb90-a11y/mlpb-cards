import "server-only";
import { cache } from "react";
import { db } from "./db";

export const SETTING_DEFAULTS = {
  logoUrl: "/logo.png",
  heroImageUrl: "",
  heroTitle: "MLPB Cards",
  heroText:
    "A MLPB Cards nasceu para aproximar quem vive o hobby de verdade. Um espaço feito para colecionadores comprarem, venderem, trocarem e participarem de leilões de Pokémon TCG com mais conexão e comunidade.",
  whatsappGroupUrl: "",
  youtubeUrl: "",
  youtubeVideoUrl: "",
  instagramUrl: "",
};

export type Settings = typeof SETTING_DEFAULTS;
export const SETTING_KEYS = Object.keys(SETTING_DEFAULTS) as (keyof Settings)[];

export const getSettings = cache(async (): Promise<Settings> => {
  try {
    const rows = await db.setting.findMany();
    const s = { ...SETTING_DEFAULTS };
    for (const r of rows) if (r.key in s && r.value.trim()) s[r.key as keyof Settings] = r.value;
    return s;
  } catch {
    return { ...SETTING_DEFAULTS };
  }
});

/** Extrai o ID de um link do YouTube (watch, youtu.be, shorts, live, embed). */
export function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|v=|\/shorts\/|\/live\/|\/embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
