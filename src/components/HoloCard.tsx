"use client";
import { useRef, type ReactNode, type PointerEvent } from "react";
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";

// Carta que inclina acompanhando o mouse/dedo, com reflexo de luz.
// holo = brilho de arco-íris por cima (para cartas Foil, Reverse Foil e Promo).
export function HoloCard({ children, holo = false, max = 10, className }: { children: ReactNode; holo?: boolean; max?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  // posição do ponteiro na carta, de 0 a 1 (0.5 = centro)
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const mola = { stiffness: 220, damping: 22, mass: 0.6 };
  const sx = useSpring(px, mola);
  const sy = useSpring(py, mola);
  const rotateY = useTransform(sx, [0, 1], [-max, max]);
  const rotateX = useTransform(sy, [0, 1], [max, -max]);
  const brilho = useMotionValue(0);
  const opacidade = useSpring(brilho, { stiffness: 200, damping: 30 });

  const gx = useTransform(sx, (v) => `${v * 100}%`);
  const gy = useTransform(sy, (v) => `${v * 100}%`);
  const glare = useMotionTemplate`radial-gradient(circle at ${gx} ${gy}, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.12) 30%, rgba(255,255,255,0) 60%)`;
  const faixa = useTransform(sx, [0, 1], ["0%", "100%"]);
  const arcoIris = useMotionTemplate`linear-gradient(115deg, rgba(255,0,128,0) 20%, rgba(255,0,128,0.22) 35%, rgba(255,214,0,0.22) 45%, rgba(0,255,170,0.22) 55%, rgba(0,170,255,0.22) 65%, rgba(170,0,255,0) 80%) ${faixa} 50% / 250% 250%`;

  function mover(e: PointerEvent<HTMLDivElement>) {
    if (reduce || e.pointerType === "touch" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
    brilho.set(1);
  }
  function sair() {
    px.set(0.5);
    py.set(0.5);
    brilho.set(0);
  }

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <div className={className} style={{ perspective: 900 }}>
      <motion.div
        ref={ref}
        onPointerMove={mover}
        onPointerLeave={sair}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="relative overflow-hidden rounded-lg will-change-transform"
      >
        {children}
        {holo && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-lg mix-blend-color-dodge"
            style={{ background: arcoIris, opacity: opacidade }}
          />
        )}
        <motion.div aria-hidden className="pointer-events-none absolute inset-0 rounded-lg mix-blend-overlay" style={{ background: glare, opacity: opacidade }} />
      </motion.div>
    </div>
  );
}
