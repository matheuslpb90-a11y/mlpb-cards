"use client";

/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from "react";

// Mede a centralização pela foto: 4 linhas na borda de fora da carta e 4 na borda de dentro
// (onde começa a arte/moldura). Margem esquerda × direita e de cima × de baixo viram "55/45".
type Lines = { oL: number; oR: number; oT: number; oB: number; iL: number; iR: number; iT: number; iB: number };
type Key = keyof Lines;

const START: Lines = { oL: 4, oR: 96, oT: 3, oB: 97, iL: 10, iR: 90, iT: 7, iB: 93 };
const LABEL: Record<Key, string> = {
  oL: "fora · esquerda", oR: "fora · direita", oT: "fora · topo", oB: "fora · base",
  iL: "dentro · esquerda", iR: "dentro · direita", iT: "dentro · topo", iB: "dentro · base",
};

export type Centering = { lr: [number, number]; tb: [number, number]; worst: number };

export function measure(l: Lines): Centering | null {
  const left = l.iL - l.oL, right = l.oR - l.iR, top = l.iT - l.oT, bottom = l.oB - l.iB;
  if (left <= 0 || right <= 0 || top <= 0 || bottom <= 0) return null;
  const lr = Math.round((left / (left + right)) * 100);
  const tb = Math.round((top / (top + bottom)) * 100);
  const pair = (x: number): [number, number] => [Math.max(x, 100 - x), Math.min(x, 100 - x)];
  const a = pair(lr), b = pair(tb);
  return { lr: [lr, 100 - lr], tb: [tb, 100 - tb], worst: Math.max(a[0], b[0]) };
}

export function CenterMeter({ side, onResult }: { side: "frente" | "verso"; onResult: (c: Centering | null) => void }) {
  const [src, setSrc] = useState("");
  const [lines, setLines] = useState<Lines>(START);
  const [sel, setSel] = useState<Key>("oL");
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<Key | null>(null);

  const update = (next: Lines) => {
    setLines(next);
    onResult(measure(next));
  };

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setSrc(URL.createObjectURL(f));
    update(START);
  }

  function pos(e: React.PointerEvent, k: Key) {
    const r = box.current!.getBoundingClientRect();
    const vertical = k.endsWith("L") || k.endsWith("R");
    const v = vertical ? ((e.clientX - r.left) / r.width) * 100 : ((e.clientY - r.top) / r.height) * 100;
    return Math.max(0, Math.min(100, Math.round(v * 10) / 10));
  }

  const nudge = (d: number) => update({ ...lines, [sel]: Math.max(0, Math.min(100, Math.round((lines[sel] + d) * 10) / 10)) });
  const c = measure(lines);

  return (
    <div className="space-y-2">
      <label className="btn-outline inline-flex cursor-pointer">
        📷 {src ? `Trocar foto ${side === "frente" ? "da frente" : "do verso"}` : `Foto ${side === "frente" ? "da frente" : "do verso"} da carta`}
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      </label>
      {!src && <p className="text-xs text-slate-500">Dica: foto de cima, bem reta, com a carta inteira e um fundo escuro. Sem sleeve brilhante.</p>}
      {src && (
        <>
          <div
            ref={box}
            className="relative mx-auto w-full max-w-sm touch-none select-none"
            onPointerMove={(e) => drag.current && update({ ...lines, [drag.current]: pos(e, drag.current) })}
            onPointerUp={() => (drag.current = null)}
            onPointerLeave={() => (drag.current = null)}
          >
            <img src={src} alt="" className="block w-full rounded" draggable={false} />
            {(Object.keys(lines) as Key[]).map((k) => {
              const vertical = k.endsWith("L") || k.endsWith("R");
              const outer = k.startsWith("o");
              const color = outer ? "#22d3ee" : "#ff7a00";
              return (
                <div
                  key={k}
                  onPointerDown={(e) => {
                    drag.current = k;
                    setSel(k);
                    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                  }}
                  className="absolute"
                  style={vertical
                    ? { left: `calc(${lines[k]}% - 10px)`, top: 0, bottom: 0, width: 20, cursor: "ew-resize" }
                    : { top: `calc(${lines[k]}% - 10px)`, left: 0, right: 0, height: 20, cursor: "ns-resize" }}
                >
                  <div style={vertical
                    ? { position: "absolute", left: 9, top: 0, bottom: 0, width: sel === k ? 3 : 2, background: color, opacity: 0.95 }
                    : { position: "absolute", top: 9, left: 0, right: 0, height: sel === k ? 3 : 2, background: color, opacity: 0.95 }} />
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="text-slate-400">Ajuste fino — <b style={{ color: sel.startsWith("o") ? "#22d3ee" : "#ff7a00" }}>{LABEL[sel]}</b>:</span>
            <button type="button" className="rounded border px-3 py-1" onClick={() => nudge(-0.2)}>−</button>
            <button type="button" className="rounded border px-3 py-1" onClick={() => nudge(0.2)}>+</button>
          </div>
          <p className="text-center text-xs text-slate-500">
            <span style={{ color: "#22d3ee" }}>Azul</span> = borda de fora da carta · <span style={{ color: "#ff7a00" }}>Laranja</span> = onde termina a borda e começa a moldura/arte. Arraste as linhas.
          </p>
          {c ? (
            <p className="text-center text-sm">
              Esquerda/direita <b>{c.lr[0]}/{c.lr[1]}</b> · Cima/baixo <b>{c.tb[0]}/{c.tb[1]}</b>
            </p>
          ) : (
            <p className="text-center text-sm text-amber-300">As linhas laranja precisam ficar por dentro das azuis.</p>
          )}
        </>
      )}
    </div>
  );
}
