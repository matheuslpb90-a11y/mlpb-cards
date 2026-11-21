"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { uploadImageAction } from "@/app/admin/actions";
import { shrinkImage } from "./ImageUploadField";

/** Várias fotos: envia de uma vez, a primeira é a capa; dá para reordenar e remover. */
export function MultiImageField({ label, value, onChange, max = 12, maxSide = 1200 }: { label: string; value: string[]; onChange: (v: string[]) => void; max?: number; maxSide?: number }) {
  const [msg, setMsg] = useState("");
  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, Math.max(0, max - value.length));
    e.target.value = "";
    if (!files.length) return setMsg(`Máximo de ${max} fotos.`);
    const added: string[] = [];
    const errors: string[] = [];
    let current = value;
    for (const [i, f] of files.entries()) {
      setMsg(`Enviando ${i + 1} de ${files.length}…`);
      try {
        const r = await uploadImageAction(await shrinkImage(f, maxSide));
        if (r.url) {
          added.push(r.url);
          current = [...current, r.url];
          onChange(current); // aparece na hora, uma por uma
        } else errors.push(`foto ${i + 1}: ${r.error ?? "falha ao enviar"}`);
      } catch {
        errors.push(`foto ${i + 1}: não consegui enviar (tente de novo ou use JPG/PNG)`);
      }
    }
    setMsg([added.length ? `${added.length} foto(s) enviada(s) ✓ — clique em Salvar leilão` : "", ...errors].filter(Boolean).join(" · "));
  }
  const move = (i: number, to: number) => {
    const v = [...value];
    const [x] = v.splice(i, 1);
    v.splice(to, 0, x);
    onChange(v);
  };
  return (
    <div className="space-y-2">
      <span className="label">{label}</span>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((u, i) => (
            <div key={u + i} className="relative w-24">
              <img src={u} alt="" className={`h-24 w-24 rounded-lg object-cover ${i === 0 ? "ring-2 ring-brand" : ""}`} />
              {i === 0 && <span className="absolute left-1 top-1 rounded bg-brand px-1 text-[10px] font-bold text-black">CAPA</span>}
              <div className="mt-1 flex justify-between text-xs">
                <button type="button" title="Para a esquerda" disabled={i === 0} className="rounded border px-1.5 disabled:opacity-30" onClick={() => move(i, i - 1)}>←</button>
                {i > 0 && <button type="button" title="Usar como capa" className="rounded border px-1.5" onClick={() => move(i, 0)}>★</button>}
                <button type="button" title="Remover" className="rounded border px-1.5 text-red-300" onClick={() => onChange(value.filter((_, j) => j !== i))}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <label className={`btn-outline inline-flex cursor-pointer ${value.length >= max ? "pointer-events-none opacity-40" : ""}`}>
        📷 {value.length ? "Adicionar mais fotos" : "Escolher fotos"}
        <input type="file" accept="image/*" multiple className="hidden" onChange={onFiles} />
      </label>
      <p className="text-xs text-slate-500">{msg || `Pode selecionar várias de uma vez (até ${max}). A primeira é a capa; ★ escolhe outra capa.`}</p>
    </div>
  );
}
