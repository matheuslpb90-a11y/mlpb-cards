// Cálculo de frete por tabela regional (pelo 1º dígito do CEP de destino).
// Ajuste os valores abaixo conforme a sua realidade. Para cotação em tempo real,
// esta função pode ser substituída por uma integração com Melhor Envio / Correios.

export type ShippingMethod = "PAC" | "SEDEX" | "ACUMULAR";

export type ShippingOption = {
  method: ShippingMethod;
  label: string;
  description: string;
  priceCents: number;
};

// índice = primeiro dígito do CEP (0..9)
const PAC_CENTS = [1800, 1800, 2200, 2200, 2800, 3200, 3800, 3000, 2400, 2600];
const SEDEX_CENTS = [2500, 2500, 3500, 3500, 4800, 5500, 6500, 5000, 3800, 4200];
const PAC_DAYS = ["3 a 5", "3 a 5", "4 a 7", "4 a 7", "6 a 9", "7 a 10", "8 a 12", "6 a 9", "4 a 7", "5 a 8"];
const SEDEX_DAYS = ["1 a 2", "1 a 2", "2 a 3", "2 a 3", "3 a 5", "3 a 5", "4 a 6", "3 a 5", "2 a 3", "2 a 4"];

// Adicional por carta a partir da 21ª (envios grandes ficam mais pesados)
const EXTRA_PER_CARD_CENTS = 10;
const FREE_CARDS = 20;

export function shippingOptions(cep: string, totalCards: number): ShippingOption[] {
  const digits = cep.replace(/\D/g, "");
  const region = digits.length === 8 ? Number(digits[0]) : 9;
  const extra = Math.max(0, totalCards - FREE_CARDS) * EXTRA_PER_CARD_CENTS;
  return [
    {
      method: "PAC",
      label: "PAC",
      description: `Entrega em ${PAC_DAYS[region]} dias úteis`,
      priceCents: PAC_CENTS[region] + extra,
    },
    {
      method: "SEDEX",
      label: "SEDEX",
      description: `Entrega em ${SEDEX_DAYS[region]} dias úteis`,
      priceCents: SEDEX_CENTS[region] + extra,
    },
    {
      method: "ACUMULAR",
      label: "Acumular pedido",
      description:
        "Pague só as cartas agora. Elas ficam guardadas na loja e você paga um único frete quando pedir o envio.",
      priceCents: 0,
    },
  ];
}

export function shippingFor(cep: string, totalCards: number, method: ShippingMethod): ShippingOption {
  const opt = shippingOptions(cep, totalCards).find((o) => o.method === method);
  if (!opt) throw new Error("Forma de envio inválida");
  return opt;
}
