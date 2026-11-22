"use client";
import { useEffect, useRef } from "react";

// Animação Lottie original da MLPB: círculo laranja se desenhando e o "✓" entrando.
const ease = { i: { x: [0.2], y: [1] }, o: { x: [0.4], y: [0] } };
const ease3 = { i: { x: [0.2, 0.2, 0.2], y: [1, 1, 1] }, o: { x: [0.3, 0.3, 0.3], y: [0, 0, 0] } };
const laranja = [1, 0.478, 0, 1];
const transformGrupo = { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 } };
const traco = (w: number) => ({ ty: "st", c: { a: 0, k: laranja }, o: { a: 0, k: 100 }, w: { a: 0, k: w }, lc: 2, lj: 2, nm: "traço" });
const desenhar = (de: number, ate: number) => ({ ty: "tm", s: { a: 0, k: 0 }, e: { a: 1, k: [{ t: de, s: [0], ...ease }, { t: ate, s: [100] }] }, o: { a: 0, k: 0 }, m: 1, nm: "desenho" });
const camada = (ind: number, nm: string, rot: number, shapes: object[]) => ({
  ddd: 0, ind, ty: 4, nm, sr: 1, ao: 0, ip: 0, op: 60, st: 0, bm: 0,
  ks: { o: { a: 0, k: 100 }, r: { a: 0, k: rot }, p: { a: 0, k: [60, 60, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 1, k: [{ t: 0, s: [80, 80, 100], ...ease3 }, { t: 26, s: [100, 100, 100] }] } },
  shapes,
});

const ANIMACAO = {
  v: "5.7.4", fr: 60, ip: 0, op: 60, w: 120, h: 120, nm: "mlpb-check", ddd: 0, assets: [],
  layers: [
    camada(1, "check", 0, [
      { ty: "gr", nm: "g", it: [{ ty: "sh", nm: "p", ks: { a: 0, k: { i: [[0, 0], [0, 0], [0, 0]], o: [[0, 0], [0, 0], [0, 0]], v: [[-22, 2], [-6, 18], [24, -16]], c: false } } }, traco(9), transformGrupo] },
      desenhar(22, 42),
    ]),
    camada(2, "círculo", -90, [
      { ty: "gr", nm: "g", it: [{ ty: "el", d: 1, nm: "e", s: { a: 0, k: [96, 96] }, p: { a: 0, k: [0, 0] } }, traco(8), transformGrupo] },
      desenhar(0, 28),
    ]),
  ],
};

export function SuccessCheck({ size = 96 }: { size?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let destruir = () => {};
    let ativo = true;
    import("lottie-web/build/player/lottie_light").then(({ default: lottie }) => {
      if (!ativo || !ref.current) return;
      const anim = lottie.loadAnimation({ container: ref.current, renderer: "svg", loop: false, autoplay: false, animationData: ANIMACAO });
      const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduzir) anim.goToAndStop(ANIMACAO.op - 1, true);
      else anim.play();
      destruir = () => anim.destroy();
    });
    return () => {
      ativo = false;
      destruir();
    };
  }, []);
  return <div ref={ref} role="img" aria-label="Pagamento confirmado" className="mx-auto" style={{ width: size, height: size }} />;
}
