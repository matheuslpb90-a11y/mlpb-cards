"use client";

import { useState } from "react";
import { CenterMeter, type Centering } from "./CenterMeter";
import { GRADE_NAME, QUESTIONS, centeringCap } from "@/lib/grading";
import { whatsappLink } from "@/lib/whatsapp";

export function Grader() {
  const [front, setFront] = useState<Centering | null>(null);
  const [back, setBack] = useState<Centering | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const answered = QUESTIONS.every((q) => answers[q.key] !== undefined);

  const centerCap = centeringCap(front?.worst ?? null, back?.worst ?? null);
  const caps = [
    { what: "Centralização", cap: front || back ? centerCap : 10 },
    ...QUESTIONS.map((q) => ({ what: q.title, cap: answers[q.key] !== undefined ? q.options[answers[q.key]].cap : 10 })),
  ];
  const grade = Math.min(...caps.map((c) => c.cap));
  const limiting = caps.filter((c) => c.cap === grade && grade < 10).map((c) => c.what);
  // se só a superfície é "perfeita" e todo o resto é 10, PSA 10 é possível mas raro: mostra 9–10
  const range = grade === 10 ? "9 a 10" : grade === 9 ? "8 a 9" : `${Math.max(1, grade - 1)} a ${grade}`;

  return (
    <div className="space-y-6">
      <section className="card space-y-4 p-5">
        <h2 className="text-lg font-bold">1. Centralização <span className="text-sm font-normal text-slate-500">(pela foto)</span></h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-1">
            <p className="font-semibold">Frente</p>
            <CenterMeter side="frente" onResult={setFront} />
          </div>
          <div className="space-y-1">
            <p className="font-semibold">Verso <span className="text-xs font-normal text-slate-500">(opcional, mas ajuda)</span></p>
            <CenterMeter side="verso" onResult={setBack} />
          </div>
        </div>
        <p className="text-xs text-slate-500">Referência PSA: para nota 10, a frente precisa estar até 55/45 e o verso até 75/25. Para 9, frente até 60/40.</p>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="text-lg font-bold">2. Estado da carta <span className="text-sm font-normal text-slate-500">(olhe com boa luz)</span></h2>
        {QUESTIONS.map((q) => (
          <div key={q.key} className="space-y-2">
            <p className="font-semibold">{q.title}</p>
            <p className="text-xs text-slate-500">{q.help}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {q.options.map((o, i) => (
                <button key={o.label} type="button" onClick={() => setAnswers({ ...answers, [q.key]: i })}
                  className={`rounded-lg border p-2 text-left text-sm ${answers[q.key] === i ? "border-brand bg-brand/15 font-semibold" : "border-slate-200 hover:border-brand"}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="card space-y-3 border-brand/60 p-5 text-center">
        <h2 className="text-lg font-bold">3. Resultado</h2>
        {!answered && !front ? (
          <p className="text-slate-500">Meça a centralização e responda as perguntas para ver a estimativa.</p>
        ) : (
          <>
            <p className="text-sm text-slate-500">Estimativa de nota (estilo PSA)</p>
            <p className="text-5xl font-black text-brand">PSA {range}</p>
            <p className="text-white">Mais provável: <b>PSA {grade}</b> — {GRADE_NAME[grade]}</p>
            {limiting.length > 0 && <p className="text-sm text-amber-300">O que limitou a nota: {limiting.join(", ")}.</p>}
            {!answered && <p className="text-xs text-slate-500">Responda todas as perguntas para uma estimativa completa.</p>}
            <div className="mx-auto grid max-w-md grid-cols-2 gap-1 text-left text-sm sm:grid-cols-4">
              {caps.map((c) => (
                <div key={c.what} className="rounded bg-slate-100 p-2"><p className="text-[11px] text-slate-500">{c.what}</p><p className="font-bold">até {c.cap}</p></div>
              ))}
            </div>
            <a href={whatsappLink("Olá! Fiz a pré-avaliação no site e queria conversar sobre graduar/vender minha carta.")} target="_blank" rel="noreferrer" className="btn-primary inline-flex">Falar com a MLPB sobre essa carta</a>
          </>
        )}
        <p className="text-[11px] text-slate-500">
          ⚠️ É só uma estimativa, feita no seu próprio aparelho (nada é enviado). Não substitui a avaliação oficial da PSA, que analisa a carta com equipamentos e pode encontrar detalhes que a foto e o olho não mostram.
        </p>
      </section>
    </div>
  );
}
