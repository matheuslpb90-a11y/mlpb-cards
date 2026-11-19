"use client";

import { useActionState, useState } from "react";
import { saveSettingsAction } from "../actions";
import { ImageUploadField } from "@/components/admin/ImageUploadField";

type S = Record<"logoUrl" | "heroImageUrl" | "heroTitle" | "heroText" | "whatsappGroupUrl" | "youtubeUrl" | "youtubeVideoUrl" | "tiktokUrl", string>;

export function SettingsForm({ initial }: { initial: S }) {
  const [state, action, pending] = useActionState(saveSettingsAction, undefined);
  const [v, setV] = useState(initial);
  const bind = (k: keyof S) => ({ name: k, value: v[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value }) });

  return (
    <form action={action} className="space-y-6">
      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">Imagens</h2>
        <ImageUploadField name="logoUrl" label="Logo (aparece no topo e no rodapé). PNG com fundo transparente fica melhor." value={v.logoUrl} onChange={(x) => setV({ ...v, logoUrl: x })} maxSide={400} />
        <ImageUploadField name="heroImageUrl" label="Imagem do banner da tela de início (ex.: arte do Charizard e Mewtwo)" value={v.heroImageUrl} onChange={(x) => setV({ ...v, heroImageUrl: x })} maxSide={1000} />
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">Textos da tela de início</h2>
        <div><label className="label">Título</label><input className="input" {...bind("heroTitle")} /></div>
        <div><label className="label">Texto de apresentação</label><textarea className="input min-h-24" {...bind("heroText")} /></div>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">Links</h2>
        <div><label className="label">Link de convite do grupo do WhatsApp (botão “Entre no grupo”)</label><input className="input" placeholder="https://chat.whatsapp.com/…" {...bind("whatsappGroupUrl")} /></div>
        <div><label className="label">Link do canal do YouTube</label><input className="input" placeholder="https://www.youtube.com/@seucanal" {...bind("youtubeUrl")} /></div>
        <div><label className="label">Vídeo em destaque na tela de início (link de um vídeo do YouTube)</label><input className="input" placeholder="https://www.youtube.com/watch?v=…" {...bind("youtubeVideoUrl")} /></div>
        <div><label className="label">Link do perfil no TikTok</label><input className="input" placeholder="https://www.tiktok.com/@seuperfil" {...bind("tiktokUrl")} /></div>
        <p className="text-xs text-slate-500">O WhatsApp da loja (para pedidos) é o 61 99224-2345.</p>
      </section>

      {state?.error && <p className="rounded bg-red-950/60 p-2 text-sm text-red-300">{state.error}</p>}
      {state?.ok && <p className="rounded bg-green-950/60 p-2 text-sm text-green-300">{state.ok}</p>}
      <button className="btn-primary w-full py-3" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</button>
    </form>
  );
}
