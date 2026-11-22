import "server-only";
import { db } from "./db";
import { normalizePhone, sendText, zapiEnabled, log } from "./zapi";
import { siteUrl } from "./orders";

// Avisa o cliente pelo WhatsApp a cada etapa do pedido.
// Nunca atrapalha o fluxo: sem WhatsApp configurado ou com erro, só registra e segue.

const MENSAGENS: Record<string, (p: { code: number; nome: string; link: string; rastreio: string }) => string | null> = {
  PAGO: ({ code, nome, link }) =>
    `✅ Oi, ${nome}! Recebemos o pagamento do seu pedido *#${code}* na MLPB Cards.\n\nAgora vamos separar suas cartas com cuidado e te avisamos aqui assim que forem postadas.\n\nAcompanhe: ${link}`,
  ACUMULANDO: ({ code, nome, link }) =>
    `✅ Oi, ${nome}! Pagamento do pedido *#${code}* confirmado.\n\nComo você escolheu *acumular*, suas cartas ficam guardadas na sua caixa na loja. Quando quiser receber tudo, é só pedir o envio na sua conta.\n\nAcompanhe: ${link}`,
  ENVIADO: ({ code, nome, link, rastreio }) =>
    `📦 Oi, ${nome}! Seu pedido *#${code}* foi postado!${rastreio ? `\n\nCódigo de rastreio: *${rastreio}*` : ""}\n\nAcompanhe: ${link}\n\nObrigado por comprar na MLPB Cards 🧡`,
  CANCELADO: ({ code, nome }) =>
    `Oi, ${nome}. O pedido *#${code}* foi cancelado. Se você já tinha pago, o estorno é feito pela InfinitePay. Qualquer dúvida, é só responder esta mensagem.`,
};

/** Envia a mensagem do status atual do pedido. Chame só quando o status mudar (ou o rastreio for informado). */
export async function notifyOrderStatus(orderId: string) {
  try {
    if (!zapiEnabled()) return;
    const order = await db.order.findUnique({ where: { id: orderId }, include: { user: { select: { name: true, phone: true } } } });
    if (!order?.user?.phone) return;
    const montar = MENSAGENS[order.status];
    if (!montar) return;
    const texto = montar({
      code: order.code,
      nome: (order.user.name || "").split(" ")[0] || "tudo bem",
      link: `${siteUrl()}/pedido/${order.code}`,
      rastreio: order.trackingCode,
    });
    if (texto) await sendText(normalizePhone(order.user.phone), texto);
  } catch (e) {
    await log("erro-aviso-pedido", { orderId, erro: e instanceof Error ? e.message : String(e) }).catch(() => {});
  }
}
