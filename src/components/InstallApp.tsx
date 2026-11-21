"use client";

import { useEffect, useState } from "react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const KEY = "mlpb_install_dismissed";

function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
function isIos() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

/** Registra o service worker e mostra, no celular, o convite para instalar o app. */
export function InstallApp() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [show, setShow] = useState(false);
  const [steps, setSteps] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (isStandalone()) return;
    let dismissed = false;
    try {
      dismissed = Number(localStorage.getItem(KEY) || 0) > Date.now() - 14 * 86400_000; // volta a aparecer depois de 14 dias
    } catch {}
    const mobile = window.matchMedia?.("(max-width: 820px)").matches;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
      if (!dismissed && mobile) setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const openSteps = () => { setShow(true); setSteps(false); };
    window.addEventListener("mlpb:install", openSteps);
    if (isIos()) {
      setIos(true);
      if (!dismissed && mobile) setTimeout(() => setShow(true), 4000);
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("mlpb:install", openSteps);
    };
  }, []);

  const close = () => {
    setShow(false);
    setSteps(false);
    try { localStorage.setItem(KEY, String(Date.now())); } catch {}
  };
  const install = async () => {
    if (evt) {
      await evt.prompt();
      await evt.userChoice.catch(() => null);
      setEvt(null);
      close();
    } else setSteps(true);
  };

  if (!show) return null;
  return (
    <div className="fixed inset-x-3 bottom-3 z-50 rounded-2xl border border-brand/60 bg-[#141414]/95 p-4 text-sm shadow-2xl backdrop-blur">
      <button type="button" onClick={close} aria-label="Fechar" className="absolute right-3 top-2 text-xl text-slate-500">✕</button>
      <div className="flex items-center gap-3 pr-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" className="h-12 w-12 rounded-xl" />
        <div>
          <p className="font-bold">Instale o app da MLPB Cards</p>
          <p className="text-xs text-slate-500">Acesse a loja e os leilões direto da tela inicial do celular.</p>
        </div>
      </div>
      {steps && ios ? (
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-slate-300">
          <li>Toque em <strong>Compartilhar</strong> <span className="inline-block rounded border border-slate-500 px-1">⬆︎</span> na barra do Safari</li>
          <li>Role e toque em <strong>Adicionar à Tela de Início</strong></li>
          <li>Toque em <strong>Adicionar</strong> ✅</li>
        </ol>
      ) : steps ? (
        <p className="mt-3 text-slate-300">Abra o menu do navegador <strong>⋮</strong> e toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</p>
      ) : (
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={install} className="btn-primary flex-1">📲 Instalar</button>
          <button type="button" onClick={close} className="btn-outline">Agora não</button>
        </div>
      )}
    </div>
  );
}

/** Link "Instalar app" (rodapé) que abre o convite a qualquer momento. */
export function InstallAppLink({ className = "" }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event("mlpb:install"))}>
      📲 Instalar app
    </button>
  );
}
