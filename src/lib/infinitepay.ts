import "server-only";

// Integração com o Checkout Integrado da InfinitePay (link de pagamento por API).
// Fluxo:
//  1. createCheckoutLink() gera o link e o cliente paga no ambiente da InfinitePay.
//  2. A InfinitePay redireciona para /pagamento/retorno e também chama o webhook.
//  3. Em ambos os casos o pagamento é CONFIRMADO via checkPayment() antes de
//     marcar o pedido como pago — nunca confiamos só nos parâmetros recebidos.
//
// Valores sempre em centavos.
// IMPORTANTE: confira os nomes dos campos com a documentação atual da InfinitePay
// (www.infinitepay.io/checkout-integrado) antes de ir para produção.

const API = "https://api.infinitepay.io/invoices/public/checkout";

export const INFINITEPAY_HANDLE = (process.env.INFINITEPAY_HANDLE ?? "").replace(/^\$/, "").trim();

export function infinitePayEnabled() {
  return INFINITEPAY_HANDLE.length > 0;
}

export type CheckoutInput = {
  orderNsu: string;
  items: { description: string; quantity: number; priceCents: number }[];
  customer: { name: string; email: string; phone: string };
  address: { cep: string; number: string; complement: string };
  redirectUrl: string;
  webhookUrl: string;
};

export async function createCheckoutLink(input: CheckoutInput): Promise<string> {
  const phoneDigits = input.customer.phone.replace(/\D/g, "");
  const body = {
    handle: INFINITEPAY_HANDLE,
    order_nsu: input.orderNsu,
    redirect_url: input.redirectUrl,
    webhook_url: input.webhookUrl,
    items: input.items.map((i) => ({
      quantity: i.quantity,
      price: i.priceCents,
      description: i.description.slice(0, 100),
    })),
    customer: {
      name: input.customer.name,
      email: input.customer.email,
      phone_number: phoneDigits.startsWith("55") ? `+${phoneDigits}` : `+55${phoneDigits}`,
    },
    address: {
      cep: input.address.cep.replace(/\D/g, ""),
      number: input.address.number,
      complement: input.address.complement,
    },
  };

  const res = await fetch(`${API}/links`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`InfinitePay recusou a criação do link (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as { url?: string; link?: string };
  const url = data.url ?? data.link;
  if (!url) throw new Error("InfinitePay não retornou a URL de pagamento");
  return url;
}

export type PaymentCheck = { paid: boolean; paidAmountCents?: number };

export async function checkPayment(params: {
  orderNsu: string;
  transactionNsu: string;
  slug: string;
}): Promise<PaymentCheck> {
  const res = await fetch(`${API}/payment_check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      handle: INFINITEPAY_HANDLE,
      order_nsu: params.orderNsu,
      transaction_nsu: params.transactionNsu,
      slug: params.slug,
    }),
    cache: "no-store",
  });
  if (!res.ok) return { paid: false };
  const data = (await res.json()) as { success?: boolean; paid?: boolean; paid_amount?: number; amount?: number };
  return {
    paid: Boolean(data.success !== false && data.paid),
    paidAmountCents: data.paid_amount ?? data.amount,
  };
}
