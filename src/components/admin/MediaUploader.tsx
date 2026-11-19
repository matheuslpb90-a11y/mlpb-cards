"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { upload } from "@vercel/blob/client";
import { uploadImageAction } from "@/app/admin/actions";
import { shrinkImage } from "./ImageUploadField";

export type Media = { url: string; type: "image" | "video" };

/** Envia uma foto ou vídeo e devolve a URL. Usa o Vercel Blob quando ativo; senão, fotos vão para o banco. */
export async function uploadMedia(file: File, blobEnabled: boolean): Promise<Media> {
  const isVideo = file.type.startsWith("video/");
  if (blobEnabled) {
    const blob = await upload(`leiloes/${file.name}`, file, { access: "public", handleUploadUrl: "/api/admin/upload" });
    return { url: blob.url, type: isVideo ? "video" : "image" };
  }
  if (isVideo) throw new Error("Para enviar vídeos, ative o Vercel Blob (Storage → Blob) na Vercel.");
  const res = await uploadImageAction(await shrinkImage(file, 1400));
  if (!res.url) throw new Error(res.error ?? "Falha ao enviar a foto");
  return { url: res.url, type: "image" };
}

export function MediaUploader({ value, onChange, blobEnabled, label = "Mídias da carta" }: { value: Media[]; onChange: (m: Media[]) => void; blobEnabled: boolean; label?: string }) {
  const [msg, setMsg] = useState("");
  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const added: Media[] = [];
    for (const [i, f] of [...files].entries()) {
      setMsg(`Enviando ${i + 1}/${files.length}…`);
      try {
        added.push(await uploadMedia(f, blobEnabled));
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Falha ao enviar");
        if (added.length) onChange([...value, ...added]);
        return;
      }
    }
    onChange([...value, ...added]);
    setMsg("Enviado ✓");
  }
  return (
    <div className="space-y-2 rounded-xl border border-dashed p-3">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <div className="flex flex-wrap items-center gap-2">
        {value.map((m, i) => (
          <div key={m.url} className="relative h-20 w-16 overflow-hidden rounded bg-slate-100">
            {m.type === "video" ? <video src={m.url} className="h-full w-full object-cover" muted /> : <img src={m.url} alt="" className="h-full w-full object-cover" />}
            {m.type === "video" && <span className="absolute left-1 top-1 rounded bg-black/70 px-1 text-[10px]">▶ vídeo</span>}
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="absolute right-0.5 top-0.5 rounded bg-black/70 px-1 text-xs text-red-300">×</button>
          </div>
        ))}
        <label className="flex h-20 w-24 cursor-pointer flex-col items-center justify-center rounded border border-slate-300 text-center text-xs text-slate-500 hover:border-brand">
          ⬆<span>foto ou vídeo</span>
          <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
        </label>
        {msg && <span className="text-xs text-slate-500">{msg}</span>}
      </div>
    </div>
  );
}
