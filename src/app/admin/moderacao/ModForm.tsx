"use client";

import { useState, useTransition } from "react";
import type { ModConfig } from "@/lib/moderation";
import { saveModAction } from "./actions";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function DayPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {DAYS.map((d, i) => (
        <button
          key={d}
          type="button"
          onClick={() => onChange(value.includes(i) ? value.filter((x) => x !== i) : [...value, i].sort())}
          className={`rounded-lg border px-3 py-1 text-sm ${value.includes(i) ? "border-brand bg-brand/20 text-brand-amber" : "text-slate-500"}`}
        >
          {d}
        </button>
      ))}
    </div>
  );
}

const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
  <label className="flex cursor-pointer items-center gap-2 text-sm">
    <input type="checkbox" className="h-4 w-4 accent-[#ff7a00]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    {label}
  </label>
);

export function ModForm({ initial, groups, botGroup }: { initial: ModConfig; groups: { phone: string; name: string }[]; botGroup: string }) {
  const [c, setC] = useState(initial);
  const [txt, setTxt] = useState({
    adminPhones: initial.adminPhones.join("\n"),
    whitelist: initial.links.whitelist.join("\n"),
    blocked: initial.links.blocked.join("\n"),
    words: initial.words.join("\n"),
    ddi: initial.ddi.whitelist.join("\n"),
    partners: initial.partners.phones.join("\n"),
  });
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>();
  const [pending, start] = useTransition();
  const set = <K extends keyof ModConfig>(k: K, v: ModConfig[K]) => setC({ ...c, [k]: v });
  const selected = c.groups.length ? c.groups : botGroup ? [botGroup] : [];

  const save = () =>
    start(async () => {
      const payload = {
        ...c,
        groups: selected,
        adminPhones: txt.adminPhones,
        words: txt.words,
        links: { ...c.links, whitelist: txt.whitelist, blocked: txt.blocked },
        ddi: { ...c.ddi, whitelist: txt.ddi },
        partners: { ...c.partners, phones: txt.partners },
      };
      setMsg(await saveModAction(JSON.stringify(payload)));
    });

  return (
    <div className="space-y-4">
      <section className="card space-y-3 p-5">
        <Toggle checked={c.enabled} onChange={(v) => set("enabled", v)} label="Moderação ligada" />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          Símbolo dos comandos:
          <input className="input w-20 text-center" maxLength={3} value={c.prefix} onChange={(e) => set("prefix", e.target.value)} />
          <span className="text-xs text-slate-500">Padrão “!”. Enquanto a Janet estiver no grupo, use outro (ex.: “/” → /help, /ban) para os dois bots não responderem juntos.</span>
        </div>
        <Toggle checked={c.notify} onChange={(v) => set("notify", v)} label="Avisar no grupo quando apagar uma mensagem" />
        <div>
          <p className="label">Grupos moderados</p>
          {groups.length === 0 && <p className="text-sm text-slate-500">Não consegui listar os grupos agora. Será moderado o grupo do leilão.</p>}
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {groups.map((g) => (
              <Toggle
                key={g.phone}
                checked={selected.includes(g.phone)}
                onChange={(v) => set("groups", v ? [...selected, g.phone] : selected.filter((x) => x !== g.phone))}
                label={`${g.name || g.phone}${g.phone === botGroup ? " (grupo do leilão)" : ""}`}
              />
            ))}
          </div>
        </div>
        <div>
          <label className="label">Outros números com poder de admin no bot (um por linha, com DDD)</label>
          <textarea className="input min-h-16" value={txt.adminPhones} onChange={(e) => setTxt({ ...txt, adminPhones: e.target.value })} />
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">👋 Boas-vindas e regras</h2>
        <Toggle checked={c.welcome.enabled} onChange={(v) => set("welcome", { ...c.welcome, enabled: v })} label="Mandar boas-vindas para quem entrar" />
        <div>
          <label className="label">Mensagem de boas-vindas ({"{nome}"} marca a pessoa, {"{regras}"} insere as regras, {"{prefixo}"} o símbolo dos comandos)</label>
          <textarea className="input min-h-20" value={c.welcome.text} onChange={(e) => set("welcome", { ...c.welcome, text: e.target.value })} />
        </div>
        <div>
          <label className="label">Regras do grupo (comando !regras)</label>
          <textarea className="input min-h-28" value={c.rules} onChange={(e) => set("rules", e.target.value)} />
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">📸 Anúncios (fotos e vídeos de membros)</h2>
        <Toggle checked={c.ads.enabled} onChange={(v) => set("ads", { ...c.ads, enabled: v })} label="Controlar anúncios" />
        <div className="flex items-center gap-2 text-sm">
          Máximo por pessoa por dia:
          <input type="number" min={0} className="input w-24" value={c.ads.maxPerDay} onChange={(e) => set("ads", { ...c.ads, maxPerDay: Number(e.target.value) })} />
        </div>
        <div><p className="label">Dias permitidos</p><DayPicker value={c.ads.days} onChange={(v) => set("ads", { ...c.ads, days: v })} /></div>
        <p className="text-xs text-slate-500">Fotos/vídeos acima do limite ou fora dos dias são apagados.</p>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">🔗 Links</h2>
        <Toggle checked={c.links.allow} onChange={(v) => set("links", { ...c.links, allow: v })} label="Membros podem mandar links (nos dias e horários abaixo)" />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          Das
          <input type="number" min={0} max={23} className="input w-20" value={c.links.startHour} onChange={(e) => set("links", { ...c.links, startHour: Number(e.target.value) })} />
          h às
          <input type="number" min={1} max={24} className="input w-20" value={c.links.endHour} onChange={(e) => set("links", { ...c.links, endHour: Number(e.target.value) })} />
          h
        </div>
        <div><p className="label">Dias permitidos</p><DayPicker value={c.links.days} onChange={(v) => set("links", { ...c.links, days: v })} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Sempre permitidos (um domínio por linha)</label>
            <textarea className="input min-h-28" value={txt.whitelist} onChange={(e) => setTxt({ ...txt, whitelist: e.target.value })} />
          </div>
          <div>
            <label className="label">Bloqueados — apaga e dá aviso (ex.: chat.whatsapp.com)</label>
            <textarea className="input min-h-28" value={txt.blocked} onChange={(e) => setTxt({ ...txt, blocked: e.target.value })} />
          </div>
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">🤝 Parceiros (donos de outros grupos/lojas)</h2>
        <p className="text-xs text-slate-500">
          Parceiros podem divulgar links (inclusive convites de grupo) nos dias e horários abaixo, sem receber aviso. Fora do horário o link é apagado com uma
          mensagem educada. No grupo, um admin libera com <strong>{c.prefix || "!"}brother @pessoa</strong> e tira com <strong>{c.prefix || "!"}unbrother @pessoa</strong>.
        </p>
        <div><p className="label">Dias liberados para parceiros</p><DayPicker value={c.partners.days} onChange={(v) => set("partners", { ...c.partners, days: v })} /></div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          Das
          <input type="number" min={0} max={23} className="input w-20" value={c.partners.startHour} onChange={(e) => set("partners", { ...c.partners, startHour: Number(e.target.value) })} />
          h até antes das
          <input type="number" min={1} max={24} className="input w-20" value={c.partners.endHour} onChange={(e) => set("partners", { ...c.partners, endHour: Number(e.target.value) })} />
          h <span className="text-xs text-slate-500">(ex.: 8 e 20 = das 8h às 19h59)</span>
        </div>
        <div>
          <label className="label">Números dos parceiros (um por linha, com DDD)</label>
          <textarea className="input min-h-20" value={txt.partners} onChange={(e) => setTxt({ ...txt, partners: e.target.value })} />
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">⭐ Avaliações entre membros</h2>
        <p className="text-xs text-slate-500">
          Para avaliar <strong>outro membro</strong> com {c.prefix || "!"}avaliar, a pessoa precisa mandar imagens de comprovação antes da nota. Avaliar a <strong>loja</strong> não exige provas.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          Imagens exigidas:
          <input type="number" min={0} max={10} className="input w-20" value={c.reviews.proofs} onChange={(e) => set("reviews", { ...c.reviews, proofs: Number(e.target.value) })} />
          · prazo para mandar:
          <input type="number" min={1} max={60} className="input w-20" value={c.reviews.proofMinutes} onChange={(e) => set("reviews", { ...c.reviews, proofMinutes: Number(e.target.value) })} />
          minutos <span className="text-xs text-slate-500">(0 imagens = sem exigência)</span>
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">🚫 Palavras proibidas e avisos</h2>
        <div>
          <label className="label">Palavras ou frases proibidas (uma por linha) — apaga e dá aviso</label>
          <textarea className="input min-h-24" value={txt.words} onChange={(e) => setTxt({ ...txt, words: e.target.value })} />
        </div>
        <div className="flex items-center gap-2 text-sm">
          Remover do grupo ao chegar em
          <input type="number" min={0} max={20} className="input w-20" value={c.warns.max} onChange={(e) => set("warns", { max: Number(e.target.value) })} />
          avisos (0 = nunca)
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">🌎 Números estrangeiros</h2>
        <Toggle checked={c.ddi.blockForeign} onChange={(v) => set("ddi", { ...c.ddi, blockForeign: v })} label="Remover quem entrar com número de fora do Brasil (DDI diferente de +55)" />
        <div>
          <label className="label">Exceções (números estrangeiros liberados, um por linha)</label>
          <textarea className="input min-h-16" value={txt.ddi} onChange={(e) => setTxt({ ...txt, ddi: e.target.value })} />
        </div>
      </section>

      {msg?.error && <p className="rounded bg-red-950/60 p-2 text-sm text-red-300">{msg.error}</p>}
      {msg?.ok && <p className="rounded bg-green-950/60 p-2 text-sm text-green-300">{msg.ok}</p>}
      <button className="btn-primary w-full py-3" disabled={pending} onClick={save}>{pending ? "Salvando…" : "Salvar moderação"}</button>
    </div>
  );
}
