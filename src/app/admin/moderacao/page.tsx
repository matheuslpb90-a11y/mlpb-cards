import { getModConfig } from "@/lib/moderation";
import { whapiEnabled, whapiGroups } from "@/lib/whapi";
import { db } from "@/lib/db";
import { ModForm } from "./ModForm";
import { DeleteReview } from "./DeleteReview";

export const dynamic = "force-dynamic";

export default async function ModeracaoPage() {
  const config = await getModConfig();
  const groups = whapiEnabled() ? await whapiGroups().catch(() => []) : [];
  const botGroup = (await db.setting.findUnique({ where: { key: "botGroupId" } }))?.value ?? "";
  const reviews = await db.review.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  const recent = await db.botLog.findMany({ where: { kind: { in: ["moderacao", "erro-moderacao"] } }, orderBy: { createdAt: "desc" }, take: 30 });
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">🛡️ Moderação do grupo</h1>
      {!whapiEnabled() && <p className="card p-4 text-amber-300">A moderação funciona com a Whapi.Cloud (variável WHAPI_TOKEN na Vercel).</p>}
      <div className="card space-y-1 p-4 text-sm text-slate-500">
        <p>Para funcionar, o número da loja precisa ser <strong>admin</strong> do grupo (para apagar mensagens, remover pessoas e fechar o grupo).</p>
        <p>Para boas-vindas e bloqueio de DDI: na Whapi, em Webhooks → Eventos, ligue também <strong>grupos → PUBLICAR</strong> e <strong>grupos → CORREÇÃO</strong>.</p>
        <p>Admins do grupo não são moderados. Comandos: digite <strong>!help</strong> no grupo.</p>
      </div>
      <ModForm initial={config} groups={groups} botGroup={botGroup} />
      <section className="card space-y-2 p-5 text-sm">
        <h2 className="text-lg font-bold">⭐ Avaliações (!avaliar / !referencias)</h2>
        <p className="text-xs text-slate-500">Qualquer pessoa do grupo avalia com <strong>!avaliar 61999999999</strong> e consulta com <strong>!referencias 61999999999</strong>. Remova aqui avaliações falsas ou ofensivas.</p>
        {reviews.length === 0 && <p className="text-slate-500">Nenhuma avaliação ainda.</p>}
        {reviews.map((r) => (
          <div key={r.id} className="flex flex-wrap items-start gap-2 rounded border p-2 text-xs">
            <div className="min-w-0 flex-1">
              <p>
                <strong>{"⭐".repeat(r.rating)}</strong> para <strong>+{r.targetPhone}</strong> · por {r.raterName || "?"} (+{r.raterPhone}) ·{" "}
                {r.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
              </p>
              {r.comment && <p className="text-slate-500">“{r.comment}”</p>}
              {(() => {
                const proofs = JSON.parse(r.proofJson || "[]") as { mediaId: string }[];
                return proofs.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {proofs.map((p, i) =>
                      p.mediaId ? (
                        <a key={i} href={`/api/admin/midia/${encodeURIComponent(p.mediaId)}`} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/api/admin/midia/${encodeURIComponent(p.mediaId)}`} alt={`prova ${i + 1}`} className="h-16 w-16 rounded border object-cover" />
                        </a>
                      ) : (
                        <span key={i} className="text-slate-500">📎 prova {i + 1}</span>
                      ),
                    )}
                  </div>
                ) : null;
              })()}
            </div>
            <DeleteReview id={r.id} />
          </div>
        ))}
      </section>
      <section className="card space-y-2 p-5 text-sm">
        <h2 className="text-lg font-bold">Últimas ações da moderação</h2>
        {recent.length === 0 && <p className="text-slate-500">Nada ainda.</p>}
        {recent.map((l) => (
          <div key={l.id} className="rounded border p-2 text-xs">
            <span className={l.kind.startsWith("erro") ? "text-red-300" : "text-slate-600"}>{l.kind}</span> · {l.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
            <pre className="mt-1 whitespace-pre-wrap break-all text-slate-500">{l.payload}</pre>
          </div>
        ))}
      </section>
    </div>
  );
}
