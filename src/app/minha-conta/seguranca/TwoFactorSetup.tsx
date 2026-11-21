"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { confirm2faAction, disable2faAction, start2faAction } from "@/app/security-actions";

export function TwoFactorSetup({ enabled, recoveryLeft }: { enabled: boolean; recoveryLeft: number }) {
  const [step, setStep] = useState<{ qr?: string; secret?: string; recovery?: string[] }>({});
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  if (step.recovery)
    return (
      <div className="space-y-3">
        <p className="rounded bg-green-950/60 p-3 text-green-300">✅ Verificação em duas etapas ativada!</p>
        <p className="font-semibold">Guarde estes códigos de recuperação num lugar seguro (print, papel, gerenciador de senhas).</p>
        <p className="text-slate-500">Se você perder o celular, cada código permite entrar uma vez. Eles não aparecem de novo.</p>
        <div className="grid grid-cols-2 gap-2 rounded-lg border p-3 font-mono text-base">{step.recovery.map((c) => <span key={c}>{c}</span>)}</div>
        <button className="btn-primary" onClick={() => router.refresh()}>Já guardei</button>
      </div>
    );

  if (enabled)
    return (
      <div className="space-y-3">
        <p className="rounded bg-green-950/60 p-3 text-green-300">✅ Ativada. Códigos de recuperação restantes: {recoveryLeft}.</p>
        <details>
          <summary className="cursor-pointer text-slate-500">Desativar</summary>
          <div className="mt-2 flex gap-2">
            <input className="input w-40" placeholder="Código" value={code} onChange={(e) => setCode(e.target.value)} />
            <button
              className="btn-outline text-red-300"
              disabled={pending}
              onClick={() => start(async () => { const r = await disable2faAction(code); if (r.error) setErr(r.error); else router.refresh(); })}
            >
              Desativar
            </button>
          </div>
        </details>
        {err && <p className="text-red-300">{err}</p>}
      </div>
    );

  if (!step.qr)
    return (
      <div className="space-y-2">
        <p className="text-amber-300">Desativada.</p>
        <ol className="list-decimal space-y-1 pl-5 text-slate-500">
          <li>Instale no celular o <strong>Google Authenticator</strong> (ou Authy / Microsoft Authenticator).</li>
          <li>Clique em ativar e leia o QR Code com o aplicativo.</li>
          <li>Digite o código que aparecer no aplicativo.</li>
        </ol>
        <button className="btn-primary" disabled={pending} onClick={() => start(async () => { const r = await start2faAction(); if ("error" in r && r.error) setErr(r.error); else setStep(r as { qr: string; secret: string }); })}>
          Ativar verificação em duas etapas
        </button>
        {err && <p className="text-red-300">{err}</p>}
      </div>
    );

  return (
    <div className="space-y-3">
      <p>1. Leia este QR Code no aplicativo autenticador:</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={step.qr} alt="QR Code" className="h-52 w-52 rounded-lg bg-white p-2" />
      <p className="text-xs text-slate-500">Não consegue ler? Digite esta chave no aplicativo: <span className="break-all font-mono">{step.secret}</span></p>
      <p>2. Digite o código de 6 dígitos que aparece no aplicativo:</p>
      <div className="flex gap-2">
        <input className="input w-40 text-center text-xl tracking-widest" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} placeholder="000000" />
        <button
          className="btn-primary"
          disabled={pending || code.length < 6}
          onClick={() => start(async () => { const r = await confirm2faAction(code); if (r.error) setErr(r.error); else setStep({ recovery: r.recovery }); })}
        >
          Confirmar
        </button>
      </div>
      {err && <p className="text-red-300">{err}</p>}
    </div>
  );
}
