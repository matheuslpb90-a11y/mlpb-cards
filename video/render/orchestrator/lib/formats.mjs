// Formatos de saída: horizontal (YouTube) e vertical (TikTok/Shorts).
// Renderizados ao mesmo tempo a partir da mesma edição.

export const FORMATOS = {
  youtube: { nome: "youtube", apelidos: ["yt", "horizontal", "16:9"], w: 1920, h: 1080, w4k: 3840, h4k: 2160 },
  tiktok: { nome: "tiktok", apelidos: ["shorts", "reels", "vertical", "9:16", "tik"], w: 1080, h: 1920, w4k: 2160, h4k: 3840 },
};

/** Resolve "shorts", "9:16" etc. para um formato conhecido. */
export function resolverFormato(nome) {
  const n = String(nome).toLowerCase().trim();
  for (const f of Object.values(FORMATOS)) {
    if (f.nome === n || f.apelidos.includes(n)) return f;
  }
  throw new Error(`Formato desconhecido: "${nome}". Use youtube, tiktok ou shorts.`);
}

/** Tamanho final (leva 4K em conta). */
export function tamanho(formato, quatroK) {
  return quatroK ? { w: formato.w4k, h: formato.h4k } : { w: formato.w, h: formato.h };
}
