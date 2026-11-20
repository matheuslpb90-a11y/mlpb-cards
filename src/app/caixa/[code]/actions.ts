"use server";

import { db } from "@/lib/db";
import { quoteShipping, type ShippingOption } from "@/lib/shipping";
import { boxBalance, boxItemCount, freeShippingCents } from "@/lib/boxes";
import { createCheckoutLink, infinitePayEnabled } from "@/lib/infinitepay";
import { siteUrl } from "@/lib/orders";
import { onlyDigits } from "@/lib/money";

export type Address = { name: string; cep: string; street: string; number: string; complement: string; neighborhood: string; city: string; state: string };

async function load(code: number, token: string) {
  const box = await db.box.findUnique({ where: { code }, include: { orders: true, invoices: true } });
  if (!box || box.token !== token) throw new Error("Caixa não encontrada.");
  return box;
}

export async function quoteBoxAction(code: number, token: string, cep: string): Promise<{ options?: ShippingOption[]; error?: string }> {
  try {
    const box = await load(code, token);
    if (onlyDigits(cep).length !== 8) return { error: "Informe um CEP válido." };
    const options = await quoteShipping(cep, await boxItemCount(box.id), boxBalance(box), { accumulate: false });
    return { options };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Não foi possível calcular o frete." };
  }
}

export async function requestBoxShippingAction(
  code: number,
  token: string,
  choice: { kind: "envio"; optionId: string; address: Address } | { kind: "retirada" },
): Promise<{ url?: string; done?: boolean; error?: string }> {
  try {
    const box = await load(code, token);
    if (box.status !== "PENDENTE") return { error: "O envio desta caixa já foi solicitado." };
    if (choice.kind === "retirada") {
      await db.box.update({ where: { id: box.id }, data: { status: "FRETE_SOLICITADO", shippingMethod: "RETIRADA", requestedAt: new Date() } });
      return { done: true };
    }
    const a = choice.address;
    if (!a.name.trim() || onlyDigits(a.cep).length !== 8 || !a.street.trim() || !a.number.trim() || !a.city.trim() || a.state.trim().length !== 2)
      return { error: "Preencha o endereço completo." };
    const balance = boxBalance(box);
    const options = await quoteShipping(a.cep, await boxItemCount(box.id), balance, { accumulate: false });
    const opt = options.find((o) => o.id === choice.optionId);
    if (!opt) return { error: "Forma de envio indisponível. Calcule de novo." };
    const free = opt.priceCents === 0 || balance >= (await freeShippingCents());
    await db.box.update({
      where: { id: box.id },
      data: {
        addressJson: JSON.stringify(a),
        name: box.name || a.name,
        shippingMethod: free ? "GRATIS" : opt.label,
        shippingCents: free ? 0 : opt.priceCents,
        ...(free ? { status: "FRETE_SOLICITADO", shippingPaid: true, requestedAt: new Date() } : {}),
      },
    });
    if (free) {
      // envio grátis: não há pagamento — gera a etiqueta na hora
      const { autoLabel } = await import("@/lib/labels");
      await autoLabel({ kind: "box", id: box.id });
      return { done: true };
    }
    if (!infinitePayEnabled()) return { error: "Pagamento online indisponível. Fale com a loja pelo WhatsApp." };
    const url = await createCheckoutLink({
      orderNsu: `B${box.code}`,
      items: [{ description: `Frete ${opt.label} — caixa #${box.code}`, quantity: 1, priceCents: opt.priceCents }],
      customer: { name: a.name, phone: box.phone },
      address: { cep: a.cep, number: a.number, complement: a.complement },
      redirectUrl: `${siteUrl()}/pagamento/retorno`,
      webhookUrl: `${siteUrl()}/api/webhooks/infinitepay`,
    });
    return { url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Não foi possível solicitar o envio." };
  }
}
