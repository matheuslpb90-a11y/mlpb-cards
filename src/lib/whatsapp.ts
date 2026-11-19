import { formatBRL } from "./money";

export const WHATSAPP_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5561992242345").replace(/\D/g, "");

export type WhatsItem = { name: string; setName?: string; quantity: number; priceCents: number };

export function whatsappLink(text: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

export function cartMessage(items: WhatsItem[], customerName?: string): string {
  const lines = items.map(
    (i) =>
      `• ${i.quantity}x ${i.name}${i.setName ? ` (${i.setName})` : ""} — ${formatBRL(i.priceCents * i.quantity)}`,
  );
  const total = items.reduce((s, i) => s + i.priceCents * i.quantity, 0);
  return [
    `Olá, MLPB Cards! ${customerName ? `Sou ${customerName} e ` : ""}gostaria de comprar estas cartas:`,
    "",
    ...lines,
    "",
    `Total das cartas: ${formatBRL(total)}`,
    "",
    "Podemos combinar o pagamento e o envio?",
  ].join("\n");
}

/** Link para a loja falar com um cliente específico. */
export function whatsappLinkTo(phone: string, text: string): string {
  const d = phone.replace(/\D/g, "");
  return `https://wa.me/${d.startsWith("55") ? d : `55${d}`}?text=${encodeURIComponent(text)}`;
}
