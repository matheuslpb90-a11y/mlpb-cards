"use client";

/* eslint-disable @next/next/no-img-element */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { deleteExternalAuctionAction, saveExternalAuctionAction, saveLeilomaniaProfileAction, type ExtInput } from "./actions";

const empty: ExtInput = { title: "", description: "", url: "", imageUrl: "", startsAt: "", endsAt: "", visible: true };

export function ExternalAuctionsEditor({ items, profileUrl }: { items: ExtInput[]; profileUrl: string }) {
  const [f, setF] = useState<ExtInput>(empty);
  const [profile, setProfile] = useState(profileUrl);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>();
  const [pending, start] = useTransition();
  const router = useRouter();
  const set = (k: keyof ExtInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="space-y-4">
      <section className="card space-y-2 p-5">
        <label className="label">Link do seu perfil/loja na Leilomania (aparece como botão na aba Leilões)</label>
        <div className="flex gap-2">
          <input className="input" placeholder="https://www.leilomania.com.br/…" value={profile} onChange={(e) => setProfile(e.target.value)} />
          <button className="btn-outline" disabled={pending} onClick={() => start(async () => { setMsg(await saveLeilomaniaProfileAction(profile)); router.refresh(); })}>Salvar</button>
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">{f.id ? "Editar leilão" : "Novo leilão na Leilomania"}</h2>
        <input className="input" placeholder="Nome do leilão (ex.: Leilão de sexta — Escarlate e Violeta)" value={f.title} onChange={set("title")} />
        <input className="input" placeholder="Link do leilão na Leilomania" value={f.url} onChange={set("url")} />
        <textarea className="input min-h-16" placeholder="Descrição (opcional): destaques, quantidade de cartas…" value={f.description} onChange={set("description")} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label">Início</label><input type="datetime-local" className="input" value={f.startsAt} onChange={set("startsAt")} /></div>
          <div><label className="label">Fim</label><input type="datetime-local" className="input" value={f.endsAt} onChange={set("endsAt")} /></div>
        </div>
        <ImageUploadField name="imageUrl" label="Imagem de capa (opcional)" value={f.imageUrl} onChange={(x) => setF({ ...f, imageUrl: x })} maxSide={1000} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#ff7a00]" checked={f.visible} onChange={(e) => setF({ ...f, visible: e.target.checked })} /> Mostrar no site</label>
        {msg?.error && <p className="text-sm text-red-300">{msg.error}</p>}
        {msg?.ok && <p className="text-sm text-green-300">{msg.ok}</p>}
        <div className="flex gap-2">
          <button className="btn-primary" disabled={pending} onClick={() => start(async () => { const r = await saveExternalAuctionAction(f); setMsg(r); if (r.ok) { setF(empty); router.refresh(); } })}>
            {pending ? "Salvando…" : "Salvar leilão"}
          </button>
          {f.id && <button className="btn-outline" onClick={() => setF(empty)}>Cancelar edição</button>}
        </div>
      </section>

      <section className="space-y-2">
        {items.length === 0 && <div className="card p-6 text-center text-slate-500">Nenhum leilão da Leilomania cadastrado.</div>}
        {items.map((a) => (
          <div key={a.id} className="card flex flex-wrap items-center gap-3 p-3 text-sm">
            {a.imageUrl && <img src={a.imageUrl} alt="" className="h-14 w-14 rounded object-cover" />}
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{a.title} {!a.visible && <span className="text-xs text-slate-500">(oculto)</span>}</p>
              <p className="text-xs text-slate-500">{a.startsAt.replace("T", " ")} → {a.endsAt.replace("T", " ")}</p>
            </div>
            <a href={a.url} target="_blank" rel="noreferrer" className="rounded-lg border px-2 py-1 text-xs">Abrir ↗</a>
            <button className="rounded-lg border px-2 py-1 text-xs" onClick={() => { setF(a); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Editar</button>
            <button className="rounded-lg border px-2 py-1 text-xs text-red-300" onClick={() => confirm("Excluir este leilão?") && start(async () => { await deleteExternalAuctionAction(a.id!); router.refresh(); })}>Excluir</button>
          </div>
        ))}
      </section>
    </div>
  );
}
