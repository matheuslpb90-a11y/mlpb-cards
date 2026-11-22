"use client";
import { useRef, type ReactNode, type PointerEvent } from "react";

// Carta que inclina acompanhando o mouse, com reflexo de luz.
// holo = brilho de arco-íris (cartas Foil, Reverse Foil e Promo).
// Feito com CSS + poucas linhas de JS (sem biblioteca), para não pesar no site.
// No celular (toque) e com "reduzir movimento" ligado, a carta fica parada.
export function HoloCard({ children, holo = false, max = 10, className }: { children: ReactNode; holo?: boolean; max?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  function mover(e: PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el || e.pointerType === "touch") return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.setProperty("--rx", `${((0.5 - y) * 2 * max).toFixed(2)}deg`);
      el.style.setProperty("--ry", `${((x - 0.5) * 2 * max).toFixed(2)}deg`);
      el.style.setProperty("--gx", `${(x * 100).toFixed(1)}%`);
      el.style.setProperty("--gy", `${(y * 100).toFixed(1)}%`);
      el.style.setProperty("--brilho", "1");
    });
  }
  function sair() {
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(frame.current);
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--brilho", "0");
  }

  return (
    <div className={`holo-wrap ${className ?? ""}`}>
      <div ref={ref} onPointerMove={mover} onPointerLeave={sair} className="holo-card">
        {children}
        {holo && <div aria-hidden className="holo-arco" />}
        <div aria-hidden className="holo-luz" />
      </div>
    </div>
  );
}
