import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { siteUrl } from "@/lib/orders";
import { diagnostics, zapiEnabled } from "@/lib/zapi";
import { fmtDate } from "@/lib/auctions";
import { BotSetup } from "./BotSetup";

export const dynamic = "force-dynamic";

export default async function BotPage() {
  let key = (await db.setting.findUnique({ where: { key: "botWebhookKey" } }))?.value;
  if (!key) {
    key = randomBytes(16).toString("hex");
    await db.setting.create({ data: { key: "botWebhookKey", value: key } });
  }
  const group = await db.setting.findMany({ where: { key: { in: ["botGroupId", "botGroupName"] } } });
  const logs = await db.botLog.findMany({ orderBy: { createdAt: "desc" }, take: 40 });
  const webhook = `${siteUrl()}/api/webhooks/zapi?key=${key}`;
  const diag = await diagnostics();

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Bot WhatsApp (Z-API)</h1>

      <section className="card space-y-2 p-5 text-sm">
        <h2 className="text-lg font-bold">1. Conectar a Z-API</h2>
        {zapiEnabled() ? (
          <p className="text-green-300">✔ Credenciais da Z-API configuradas na Vercel.</p>
        ) : (
          <p className="text-amber-300">
            Falta configurar na Vercel (Settings → Environment Variables): <code>ZAPI_INSTANCE_ID</code>, <code>ZAPI_TOKEN</code> e <code>ZAPI_CLIENT_TOKEN</code>, depois Redeploy.
          </p>
        )}
        <p className="text-slate-500">Na Z-API, conecte o WhatsApp da loja escaneando o QR Code da instância.</p>
        <div className="space-y-1 rounded-lg border p-3">
          <p className="font-semibold">Conferência da instância</p>
          <p>
            ID configurado na Vercel (<code>ZAPI_INSTANCE_ID</code>): <code>{diag.configured.instance || "—"}</code> ({diag.configured.instanceLength} caracteres) · token{" "}
            <code>{diag.configured.token || "—"}</code> ({diag.configured.tokenLength} caracteres) · client-token {diag.configured.clientToken}
          </p>
          {diag.configured.rawHadSpaces && <p className="text-amber-300">Havia espaços/aspas sobrando nos valores — já foram ignorados automaticamente.</p>}
          {diag.seen.length === 0 ? (
            <p className="text-slate-500">Ainda não chegou nenhum evento com ID de instância. Mande uma mensagem para o WhatsApp da loja e recarregue esta página.</p>
          ) : (
            diag.seen.map((x) => (
              <p key={x.id} className={x.matches ? "text-green-300" : "text-red-300"}>
                ID que a Z-API envia nos eventos: <code className="select-all font-bold">{x.id}</code>{x.phone ? ` (WhatsApp ${x.phone})` : ""} —{" "}
                {x.matches ? "✔ confere com o configurado" : "✘ diferente do configurado: copie este ID para ZAPI_INSTANCE_ID na Vercel e faça Redeploy"}
              </p>
            ))
          )}
        </div>
      </section>

      <section className="card space-y-2 p-5 text-sm">
        <h2 className="text-lg font-bold">2. Webhook (para receber os votos)</h2>
        <p>Na Z-API, em <strong>Webhooks</strong>, cole este endereço no campo <strong>“Ao receber”</strong>:</p>
        <code className="block break-all rounded bg-slate-100 p-3 text-brand">{webhook}</code>
      </section>

      <section className="card space-y-2 p-5 text-sm">
        <h2 className="text-lg font-bold">3. Relógio dos leilões (abre e encerra no horário)</h2>
        <p>Crie uma conta grátis em <strong>cron-job.org</strong> → <strong>Create cronjob</strong> → cole o endereço abaixo e escolha <strong>“Every minute”</strong>:</p>
        <code className="block break-all rounded bg-slate-100 p-3 text-brand">{`${siteUrl()}/api/cron/leiloes?key=${key}`}</code>
        <p className="text-slate-500">Sem isso, o leilão também abre/fecha quando chega um voto ou alguém abre a página de leilões — e você sempre pode usar “Iniciar agora” / “Encerrar agora”.</p>
      </section>

      <BotSetup current={{ id: group.find((g) => g.key === "botGroupId")?.value ?? "", name: group.find((g) => g.key === "botGroupName")?.value ?? "" }} />

      <section className="card space-y-2 p-5">
        <h2 className="text-lg font-bold">Registro do bot</h2>
        <p className="text-sm text-slate-500">Últimas mensagens que a Z-API enviou ao site e erros de envio. Útil para conferir os primeiros testes.</p>
        <div className="max-h-[28rem] space-y-1 overflow-y-auto text-xs">
          {logs.map((l) => (
            <details key={l.id} className="rounded border p-2">
              <summary className="cursor-pointer"><span className={l.kind.startsWith("erro") ? "text-red-300" : "text-slate-600"}>{l.kind}</span> · {fmtDate(l.createdAt)}</summary>
              <pre className="mt-1 whitespace-pre-wrap break-all text-slate-500">{l.payload}</pre>
            </details>
          ))}
          {logs.length === 0 && <p className="text-slate-500">Nada registrado ainda.</p>}
        </div>
      </section>
    </div>
  );
}
