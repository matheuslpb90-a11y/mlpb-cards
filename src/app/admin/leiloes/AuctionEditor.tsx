"use client";

/* eslint-disable @next/next/no-img-element */
import { ligaUrl } from "@/lib/price-links";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { CONDITIONS, FINISHES, LANGUAGES } from "@/lib/catalog";
import { formatBRL } from "@/lib/money";
import { priceItem } from "@/lib/auction-pricing";
import { centsToReais, emptyItem, emptyLot, reaisToCents, type AuctionDraft, type ItemDraft, type LotDraft } from "@/lib/auction-draft";
import { MediaUploader, uploadMedia } from "@/components/admin/MediaUploader";
import { ScheduleFields } from "@/components/admin/ScheduleFields";
import type { LookupCard } from "@/app/api/admin/buscar-carta/route";
import { saveAuctionAction, searchStockAction } from "./actions";

type Stock = Awaited<ReturnType<typeof searchStockAction>>[number];

export function AuctionEditor({ initial, blobEnabled, locked }: { initial: AuctionDraft; blobEnabled: boolean; locked: boolean }) {
  const [d, setD] = useState<AuctionDraft>(initial);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const set = <K extends keyof AuctionDraft>(k: K, v: AuctionDraft[K]) => setD((p) => ({ ...p, [k]: v }));
  const setLot = (i: number, l: LotDraft) => setD((p) => ({ ...p, lots: p.lots.map((x, j) => (j === i ? l : x)) }));
  const rules = { initialPct: Number(d.initialPct) || 0, buyoutPct: Number(d.buyoutPct) || 0, defaultStepCents: reaisToCents(d.defaultStep), oneReal: d.oneReal };
  const totalItems = d.lots.reduce((s, l) => s + l.items.length, 0);

  function save() {
    setErr("");
    start(async () => {
      const r = await saveAuctionAction(d);
      if (r.error) return setErr(r.error);
      router.push("/admin/leiloes");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5 pb-24">
      {locked && <p className="rounded bg-amber-950/50 p-3 text-sm text-amber-300">Este leilão já começou ou terminou — não pode mais ser editado.</p>}

      <Section title="Dados básicos">
        <Field label="Nome do leilão *"><input className="input" value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: 7º LEILÃO DE MLPB Cards" /></Field>
        <Field label="Descrição do banner"><input className="input" value={d.description} onChange={(e) => set("description", e.target.value)} placeholder="Ex.: Participe ao vivo no YouTube e vote no grupo do WhatsApp" /></Field>
        <ScheduleFields disabled={locked} defaultMinutes={120}
          value={{ startDate: d.startDate, startTime: d.startTime, endDate: d.endDate, endTime: d.endTime }}
          onChange={(v) => setD((p) => ({ ...p, ...v }))} />
        <div className="max-w-xs">
          <Field label="Prazo de pagamento (dias) *"><input type="number" min={1} className="input" value={d.paymentDays} onChange={(e) => set("paymentDays", Number(e.target.value))} /></Field>
        </div>
        <p className="text-xs text-slate-500">Horários de Brasília. No início o bot posta as enquetes no grupo; no fim ele encerra e envia os invoices.</p>
        <ImageField label="Imagem de capa (opcional)" value={d.imageUrl} onChange={(v) => set("imageUrl", v)} blobEnabled={blobEnabled} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.visible} onChange={(e) => set("visible", e.target.checked)} /> Mostrar na página “Leilões” do site</label>
      </Section>

      <Section title="Fórmulas">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Lance inicial (% abaixo do mercado)"><input type="number" className="input" value={d.initialPct} onChange={(e) => set("initialPct", Number(e.target.value))} /></Field>
          <Field label="Arremate (% acima do mercado)"><input type="number" className="input" value={d.buyoutPct} onChange={(e) => set("buyoutPct", Number(e.target.value))} /></Field>
          <Field label="Incremento padrão (R$)"><input className="input" value={d.defaultStep} onChange={(e) => set("defaultStep", e.target.value)} placeholder="vazio = automático" /></Field>
        </div>
        <p className="rounded-lg bg-slate-100 p-3 text-sm">
          <strong>Exemplo:</strong> carta com mercado R$ 100,00 → inicial{" "}
          <span className="font-bold text-green-300">{formatBRL(priceItem(10000, rules).startCents)}</span> → arremate{" "}
          <span className="font-bold text-brand">{formatBRL(priceItem(10000, rules).buyoutCents)}</span>
          {" "}· incremento {formatBRL(priceItem(10000, rules).stepCents)}
        </p>
        <Toggle checked={d.oneReal} onChange={(v) => set("oneReal", v)} label="Leilão de R$ 1" hint="Todas as cartas começam em R$ 1,00 (valores manuais por carta ainda prevalecem)." />
      </Section>

      <Section title="Pagamento">
        <Field label="Receber em outra conta InfinitePay (opcional)">
          <input className="input" value={d.infinitepayHandle} onChange={(e) => set("infinitepayHandle", e.target.value)} placeholder="vazio = conta padrão da loja ($mlpbcards)" />
        </Field>
      </Section>

      <Section title={`Lotes (${d.lots.length}) · ${totalItems} carta(s)`}>
        <p className="text-sm text-slate-500">Lotes e cartas saem no grupo na ordem em que aparecem aqui. Cada carta tem um código (ex.: 1.2) — com a Omni os lances são por mensagem (“1.2 $55”); com a Z-API clássica, cada carta vira uma enquete.</p>
        {d.lots.map((lot, li) => (
          <LotEditor
            key={li}
            auctionName={d.name}
            n={li + 1}
            lot={lot}
            rules={rules}
            blobEnabled={blobEnabled}
            onChange={(l) => setLot(li, l)}
            onRemove={() => confirm("Remover este lote?") && setD((p) => ({ ...p, lots: p.lots.filter((_, j) => j !== li) }))}
          />
        ))}
        <button type="button" className="btn bg-green-700 text-white hover:bg-green-600" onClick={() => setD((p) => ({ ...p, lots: [...p.lots, emptyLot(p.lots.length + 1)] }))}>+ Novo lote</button>
      </Section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-black/90 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          {err && <p className="flex-1 text-sm text-red-300">{err}</p>}
          <button className="btn-primary ml-auto px-8 py-3" disabled={pending || locked} onClick={save}>{pending ? "Salvando…" : "Salvar leilão"}</button>
        </div>
      </div>
    </div>
  );
}

function LotEditor({ n, auctionName, lot, rules, blobEnabled, onChange, onRemove }: {
  n: number; auctionName: string; lot: LotDraft; rules: Parameters<typeof priceItem>[1]; blobEnabled: boolean; onChange: (l: LotDraft) => void; onRemove: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [picking, setPicking] = useState(false);
  const setItem = (i: number, it: ItemDraft) => onChange({ ...lot, items: lot.items.map((x, j) => (j === i ? it : x)) });
  const [art, setArt] = useState("");
  const [withPrice, setWithPrice] = useState(true);
  /** Gera a arte do lote com as fotos das cartas e coloca como imagem spoiler. */
  async function generateArt() {
    const items = lot.items
      .map((it, i) => {
        const p = priceItem(reaisToCents(it.market) ?? 0, rules, lot.oneReal, { start: reaisToCents(it.start), buyout: reaisToCents(it.buyout), step: reaisToCents(it.step) });
        return {
          code: `${n}.${i + 1}`,
          name: it.name || "Carta",
          number: it.number,
          image: it.imageUrl || it.media.find((m) => m.type === "image")?.url || "",
          images: [it.imageUrl, ...it.media.filter((m) => m.type === "image").map((m) => m.url)].filter(Boolean),
          price: withPrice && reaisToCents(it.market) ? `Inicial ${formatBRL(p.startCents)}` : "",
        };
      })
      .filter((x) => x.image || x.name !== "Carta");
    if (!items.length) return setArt("Busque as cartas do lote (com imagem) antes de gerar.");
    setArt("Gerando a imagem do lote…");
    try {
      const r = await fetch("/api/admin/lote-imagem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auctionName, lotNumber: n, lotTitle: lot.title, items }) });
      const j = (await r.json()) as { url?: string; error?: string; missing?: string[]; problems?: string[] };
      if (!j.url) return setArt(j.error ?? "Não consegui gerar a imagem.");
      onChange({ ...lot, imageUrl: j.url });
      setArt(
        j.missing?.length
          ? `⚠️ Imagem gerada, mas a foto de ${j.missing.join(", ")} não abriu. Detalhe: ${(j.problems ?? []).join(" | ") || "—"}`
          : "✔ Imagem gerada e colocada como spoiler do lote. Salve o leilão.",
      );
    } catch {
      setArt("Não consegui gerar a imagem agora. Tente de novo.");
    }
  }
  return (
    <div className="rounded-2xl border border-brand/30 bg-black/30">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand font-bold text-gray-950">{n}</span>
        <button type="button" onClick={() => setOpen(!open)} className="px-1 text-slate-500">{open ? "▲" : "▼"}</button>
        <input className="input max-w-sm flex-1" value={lot.title} onChange={(e) => onChange({ ...lot, title: e.target.value })} />
        <Toggle small checked={lot.oneReal} onChange={(v) => onChange({ ...lot, oneReal: v })} label="R$1" />
        <Toggle small checked={lot.hideMarket} onChange={(v) => onChange({ ...lot, hideMarket: v })} label="Ocultar mercado" />
        <Toggle small checked={lot.hideBuyout} onChange={(v) => onChange({ ...lot, hideBuyout: v })} label="Ocultar arremate" />
        <button type="button" onClick={onRemove} className="ml-auto text-red-300" title="Remover lote">🗑</button>
      </div>
      {open && (
        <div className="space-y-3 p-3">
          <ImageField label="Imagem spoiler do lote" value={lot.imageUrl} onChange={(v) => onChange({ ...lot, imageUrl: v })} blobEnabled={blobEnabled} />
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <button type="button" className="btn bg-brand text-sm font-bold text-black" onClick={generateArt} disabled={art.startsWith("Gerando")}>🎨 Gerar imagem do lote</button>
            <label className="flex items-center gap-1 text-xs text-slate-400"><input type="checkbox" className="accent-[#ff7a00]" checked={withPrice} onChange={(e) => setWithPrice(e.target.checked)} /> mostrar lance inicial</label>
            {lot.imageUrl && <a href={lot.imageUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-300 underline">ver grande ↗</a>}
            {art && <span className="text-xs text-slate-400">{art}</span>}
          </div>
          {lot.items.map((it, i) => (
            <ItemEditor
              key={i}
              label={`${n}.${i + 1}`}
              it={it}
              rules={rules}
              lotOneReal={lot.oneReal}
              blobEnabled={blobEnabled}
              onChange={(x) => setItem(i, x)}
              onRemove={() => onChange({ ...lot, items: lot.items.filter((_, j) => j !== i) })}
            />
          ))}
          {picking && (
            <StockPicker
              onPick={(c) => {
                onChange({
                  ...lot,
                  items: [...lot.items, emptyItem({
                    cardId: c.id, name: c.name, number: c.number, condition: c.condition === "D" ? "DMG" : c.condition, language: c.language,
                    finish: c.finish, market: centsToReais(c.priceCents), imageUrl: c.imageUrl,
                  })],
                });
              }}
              onClose={() => setPicking(false)}
            />
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button type="button" className="btn bg-blue-700 text-white hover:bg-blue-600" onClick={() => setPicking(true)}>📦 Do estoque</button>
            <button type="button" className="btn bg-purple-700 text-white hover:bg-purple-600" onClick={() => onChange({ ...lot, items: [...lot.items, emptyItem()] })}>+ Carta manual</button>
            <span className="ml-auto text-xs text-slate-500">{lot.items.length} carta(s)</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemEditor({ label, it, rules, lotOneReal, blobEnabled, onChange, onRemove }: {
  label: string; it: ItemDraft; rules: Parameters<typeof priceItem>[1]; lotOneReal: boolean; blobEnabled: boolean; onChange: (i: ItemDraft) => void; onRemove: () => void;
}) {
  const [code, setCode] = useState(it.number);
  const [nameQ, setNameQ] = useState(it.name);
  const [results, setResults] = useState<LookupCard[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState(Boolean(it.name));
  const f = <K extends keyof ItemDraft>(k: K) => ({ value: it[k] as string, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => onChange({ ...it, [k]: e.target.value }) });
  const p = priceItem(reaisToCents(it.market) ?? 0, rules, lotOneReal, { start: reaisToCents(it.start), buyout: reaisToCents(it.buyout), step: reaisToCents(it.step) });

  const [myp, setMyp] = useState("");
  /** Valor de mercado no Brasil (MYP Cards) para esta carta: nome + número + idioma + variante. */
  async function mypMarket(x: ItemDraft = it) {
    if (!x.name.trim()) return setMyp("Preencha o nome da carta.");
    setMyp("Buscando preço na MYP…");
    try {
      const q = new URLSearchParams({ myp: x.name, num: x.number, idioma: x.language, finish: x.finish });
      const r = await fetch(`/api/admin/buscar-carta?${q}`);
      const j = (await r.json()) as { results?: { name: string; setName: string; number: string; link: string; price: { cents: number; basis: string } | null }[]; message?: string };
      const best = (j.results ?? []).find((c) => c.price);
      if (!best?.price) return setMyp(j.message ?? "A MYP não tem oferta dessa carta agora.");
      onChange({ ...x, market: (best.price.cents / 100).toFixed(2).replace(".", ",") });
      setMyp(`✔ R$ ${(best.price.cents / 100).toFixed(2).replace(".", ",")} — ${best.price.basis} · ${best.name} ${best.number} (${best.setName}) · fonte: MYP Cards`);
    } catch {
      setMyp("Erro ao consultar a MYP.");
    }
  }

  async function lookup() {
    if (!code.trim() && nameQ.trim().length < 2) return setMsg("Digite o nome do Pokémon, o código ou os dois.");
    setBusy(true); setMsg("Buscando…"); setResults([]);
    try {
      // nome (com ou sem código) busca na MYP (com preço) + TCGdex; só o código busca pelo número
      const url = nameQ.trim()
        ? `/api/admin/buscar-carta?q=${encodeURIComponent(nameQ.trim())}&num=${encodeURIComponent(code.trim())}&idioma=${encodeURIComponent(it.language)}`
        : `/api/admin/buscar-carta?codigo=${encodeURIComponent(code.trim())}&idioma=${encodeURIComponent(it.language)}`;
      const r = await fetch(url);
      const j = (await r.json()) as { results?: LookupCard[]; message?: string };
      setResults(j.results ?? []);
      setMsg(j.results?.length ? "Clique na carta certa:" : j.message ?? "Nada encontrado.");
    } catch {
      setMsg("Erro ao buscar.");
    } finally {
      setBusy(false);
    }
  }

  if (!found)
    return (
      <div className="space-y-3 rounded-xl border p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-blue-300">🔍 Buscar carta por nome e/ou código — {label}</p>
          <button type="button" onClick={onRemove} className="text-red-300">🗑</button>
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          <Field label="Nome do Pokémon"><input className="input" value={nameQ} onChange={(e) => setNameQ(e.target.value)} placeholder="Charizard ex" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), lookup())} /></Field>
          <Field label="Código"><input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="074/063 ou SVP053" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), lookup())} /></Field>
          <Field label="Condição"><select className="input" {...f("condition")}>{CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.value}</option>)}</select></Field>
          <Field label="Idioma"><select className="input" {...f("language")}>{LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.short}</option>)}</select></Field>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn bg-sky-700 text-white" onClick={lookup} disabled={busy}>🔍 Buscar</button>
          <button type="button" className="btn bg-teal-700 text-white" onClick={() => { onChange({ ...it, name: nameQ || it.name, number: code }); setFound(true); }}>✏️ Manual</button>
          {(nameQ.trim() || code.trim()) && (
            <a href={ligaUrl(nameQ, code, it.finish === "Promo")} target="_blank" rel="noreferrer" className="btn border border-amber-500 text-amber-300">🔎 Ver na Liga ↗</a>
          )}
        </div>
        <p className="text-xs text-slate-500">Pode buscar só pelo nome, só pelo código ou pelos dois (o mais certeiro). Resultados com 💰 já trazem o preço da MYP.</p>
        {msg && <p className="text-sm text-slate-500">{msg}</p>}
        {results.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {results.map((c) => (
              <button type="button" key={c.key} className="rounded p-1 text-left hover:bg-brand/20"
                onClick={() => {
                  const fromMyp = c.priceCents ? (c.priceCents / 100).toFixed(2).replace(".", ",") : "";
                  const x = { ...it, name: c.name, number: c.number || code, imageUrl: c.imageLarge, market: it.market || fromMyp };
                  onChange(x);
                  setFound(true);
                  if (fromMyp) setMyp(`✔ R$ ${fromMyp} — ${c.priceBasis ?? "MYP"} · fonte: MYP Cards`);
                  else if (!it.market) mypMarket(x); // já traz o valor de mercado brasileiro
                }}>
                <img src={c.imageSmall} alt={c.name} className="w-full rounded" />
                <span className="block truncate text-[11px]">{c.name}</span>
                <span className="block truncate text-[10px] text-slate-500">{c.number} · {c.setName}</span>
                {c.priceCents ? <span className="block text-[10px] font-bold text-green-300">💰 {formatBRL(c.priceCents)}</span> : null}
              </button>
            ))}
          </div>
        )}
      </div>
    );

  return (
    <div className="space-y-3 rounded-xl border p-3">
      <div className="flex gap-3">
        <div className="w-20 shrink-0 space-y-1 text-center">
          {it.imageUrl ? <img src={it.imageUrl} alt="" className="w-full rounded" /> : <div className="flex aspect-[63/88] items-center justify-center rounded bg-slate-100 text-2xl">🃏</div>}
          <button type="button" className="text-[11px] text-blue-300" onClick={() => setFound(false)}>↺ Buscar outra</button>
          <button type="button" className="block w-full text-[11px] text-red-300" onClick={onRemove}>Remover</button>
        </div>
        <div className="grid flex-1 gap-2 sm:grid-cols-6">
          <div className="sm:col-span-2"><Field label={`Nome — ${label}${it.cardId ? " · do estoque" : ""}`}><input className="input" {...f("name")} /></Field></div>
          <Field label="Código"><input className="input" {...f("number")} /></Field>
          <Field label="Variante"><select className="input" {...f("finish")}>{FINISHES.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Condição"><select className="input" {...f("condition")}>{CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.value}</option>)}</select></Field>
          <Field label="Idioma"><select className="input" {...f("language")}>{LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.short}</option>)}</select></Field>
          <div className="sm:col-span-6 flex items-center gap-1 text-sm">
            <span className="mr-2 text-xs font-bold uppercase text-slate-500">Tipo</span>
            <button type="button" onClick={() => onChange({ ...it, graded: false })} className={`rounded-l-lg border px-3 py-1 ${!it.graded ? "bg-brand text-white" : ""}`}>Raw</button>
            <button type="button" onClick={() => onChange({ ...it, graded: true })} className={`rounded-r-lg border px-3 py-1 ${it.graded ? "bg-brand text-white" : ""}`}>💎 Graduada</button>
          </div>
          <div className="sm:col-span-6"><Field label="Ref. (opcional)"><input className="input" {...f("note")} placeholder="Ref.: valor slab USA, eBay/ALT, riscos…" /></Field></div>
          <Field label="Custo (opc.)"><input className="input" {...f("cost")} placeholder="0,00" /></Field>
          <Field label="Valor de mercado">
            <div className="flex gap-1">
              <input className="input min-w-0" {...f("market")} placeholder="0,00" />
              <button type="button" title="Buscar valor de mercado no Brasil (MYP Cards)" className="rounded-lg border px-2 text-xs hover:border-brand" onClick={() => mypMarket()}>💰 MYP</button>
            </div>
          </Field>
          <Field label="Inicial (opc.)"><input className="input" {...f("start")} placeholder="auto" /></Field>
          <Field label="Arremate (opc.)"><input className="input" {...f("buyout")} placeholder="auto" /></Field>
          <Field label="Incremento"><input className="input" {...f("step")} placeholder="auto" /></Field>
          <div className="flex flex-col justify-end gap-1">
            <Toggle small checked={it.hideMarket} onChange={(v) => onChange({ ...it, hideMarket: v })} label="Ocultar mercado" />
            <Toggle small checked={it.hideBuyout} onChange={(v) => onChange({ ...it, hideBuyout: v })} label="Ocultar arremate" />
          </div>
          <p className="sm:col-span-6 text-xs text-slate-500">
            {myp && <>{myp} · </>}
            {it.name && <a href={ligaUrl(it.name, it.number, it.finish === "Promo")} target="_blank" rel="noreferrer" className="inline-block rounded border border-amber-500 px-2 py-0.5 font-semibold text-amber-300">🔎 Ver preço na Liga ↗</a>}
          </p>
          <p className="sm:col-span-6 rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">
            Valores: inicial {formatBRL(p.startCents)} · incremento {formatBRL(p.stepCents)} · arremate {formatBRL(p.buyoutCents)}
            <span className="block text-slate-500">Enquete ({p.options.length} lances): {p.options.map((c) => formatBRL(c)).join(" · ")}</span>
          </p>
        </div>
      </div>
      <MediaUploader value={it.media} onChange={(m) => onChange({ ...it, media: m })} blobEnabled={blobEnabled} />
    </div>
  );
}

function StockPicker({ onPick, onClose }: { onPick: (c: Stock) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [list, setList] = useState<Stock[] | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    setList(await searchStockAction(q));
  }
  useEffect(() => {
    searchStockAction("").then(setList);
  }, []);
  return (
    <div className="space-y-2 rounded-xl border border-blue-700/50 p-3">
      <form onSubmit={search} className="flex gap-2">
        <input className="input flex-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar no estoque por nome, número ou coleção…" />
        <button className="btn-outline">Buscar</button>
        <button type="button" className="btn-outline" onClick={onClose}>Fechar</button>
      </form>
      <div className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-6">
        {(list ?? []).map((c) => (
          <button type="button" key={c.id} onClick={() => { onPick(c); setAdded([...added, c.id]); }} className={`rounded p-1 text-left hover:bg-brand/20 ${added.includes(c.id) ? "ring-2 ring-green-500" : ""}`}>
            {c.imageUrl ? <img src={c.imageUrl} alt="" className="w-full rounded" /> : <div className="flex aspect-[63/88] items-center justify-center rounded bg-slate-100">🃏</div>}
            <span className="block truncate text-[11px]">{c.name}</span>
            <span className="block truncate text-[10px] text-slate-500">{c.number} · {c.condition} · {formatBRL(c.priceCents)}</span>
          </button>
        ))}
        {list?.length === 0 && <p className="col-span-6 text-sm text-slate-500">Nenhuma carta em estoque encontrada.</p>}
      </div>
    </div>
  );
}

function ImageField({ label, value, onChange, blobEnabled }: { label: string; value: string; onChange: (v: string) => void; blobEnabled: boolean }) {
  const [msg, setMsg] = useState("");
  return (
    <div className="space-y-1">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <div className="flex items-center gap-3">
        {value ? <img src={value} alt="" className="h-20 rounded" /> : null}
        <label className="cursor-pointer rounded-lg border border-dashed px-4 py-3 text-sm text-slate-500 hover:border-brand">
          ⬆ Escolher imagem
          <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
            const file = e.target.files?.[0]; if (!file) return;
            setMsg("Enviando…");
            try { onChange((await uploadMedia(file, blobEnabled)).url); setMsg(""); } catch (er) { setMsg(er instanceof Error ? er.message : "Falha"); }
            e.target.value = "";
          }} />
        </label>
        {value && <button type="button" className="text-sm text-red-300" onClick={() => onChange("")}>Remover</button>}
        {msg && <span className="text-xs text-slate-500">{msg}</span>}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-3 p-5">
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}
function Toggle({ checked, onChange, label, hint, small }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; small?: boolean }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className={`flex items-center gap-2 rounded-lg border px-2 py-1 text-left ${small ? "text-xs" : "w-full p-3"} ${checked ? "border-brand/60" : ""}`}>
      <span className={`relative inline-block h-5 w-9 shrink-0 rounded-full transition ${checked ? "bg-brand" : "bg-slate-300"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${checked ? "left-4" : "left-0.5"}`} />
      </span>
      <span>
        <span className="font-semibold">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </button>
  );
}
