"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { uploadImageAction } from "@/app/admin/actions";

/** Reduz a imagem no navegador antes de enviar. Mantém PNG (transparência) quando for PNG. */
export async function shrinkImage(file: File, maxSide = 1000): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  const keepAlpha = file.type === "image/png" || file.type === "image/webp";
  if (!keepAlpha) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return keepAlpha ? canvas.toDataURL("image/webp", 0.9) : canvas.toDataURL("image/jpeg", 0.85);
}

export function ImageUploadField({ name, label, value, onChange, maxSide }: { name: string; label: string; value: string; onChange: (v: string) => void; maxSide?: number }) {
  const [msg, setMsg] = useState("");
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg("Enviando…");
    try {
      const res = await uploadImageAction(await shrinkImage(file, maxSide));
      if (res.url) {
        onChange(res.url);
        setMsg("Enviada ✓ — clique em Salvar");
      } else setMsg(res.error ?? "Falha ao enviar");
    } catch {
      setMsg("Não foi possível ler essa imagem. Use JPG ou PNG.");
    }
    e.target.value = "";
  }
  return (
    <div className="space-y-2">
      <label className="label">{label}</label>
      <input type="hidden" name={name} value={value} />
      <div className="flex flex-wrap items-center gap-3">
        {value ? <img src={value} alt="" className="h-20 w-auto rounded bg-slate-100 p-1" /> : <div className="flex h-20 w-20 items-center justify-center rounded bg-slate-100 text-xs text-slate-500">sem imagem</div>}
        <label className="btn-outline cursor-pointer text-sm">
          📷 Escolher imagem
          <input type="file" accept="image/*" className="hidden" onChange={onFile} />
        </label>
        {value && <button type="button" className="text-sm text-red-300 hover:underline" onClick={() => onChange("")}>Remover</button>}
        {msg && <span className="text-sm text-slate-600">{msg}</span>}
      </div>
    </div>
  );
}
