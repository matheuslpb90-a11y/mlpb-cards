// Links para conferir o preço atualizado da carta em outros sites.
// Usados no painel e, para o cliente, abaixo do preço na página da carta.
// A busca usa NOME + NÚMERO impresso (ex.: "199/165", "TG12/TG30", "SVP053"):
// com os dois, cai na impressão exata. Se faltar um, usa o que tiver.

const q = (s: string) => encodeURIComponent(s.trim());

/** O que vai na busca: nome + número (os dois dão a impressão exata). */
const termo = (name: string, number = "") => `${name.trim()} ${number.trim()}`.trim();

// ---- Brasil ----

/** Busca na Liga Pokémon (mercado brasileiro). */
export const ligaUrl = (name: string, number = "") =>
  `https://www.ligapokemon.com.br/?view=cards/search&card=${q(termo(name, number))}`;

/** Busca na MYP Cards (mercado brasileiro). */
export const mypSearchUrl = (name: string, number = "") =>
  `https://mypcards.com/pokemon?ProdutoSearch%5Bquery%5D=${q(termo(name, number))}`;

// ---- Mundo ----

/** TCGplayer: maior mercado dos EUA (preços em dólar). */
export const tcgplayerUrl = (name: string, number = "") =>
  `https://www.tcgplayer.com/search/pokemon/product?q=${q(termo(name, number))}&productLineName=pokemon`;

/** Cardmarket: maior mercado da Europa (preços em euro). */
export const cardmarketUrl = (name: string, number = "") =>
  `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${q(termo(name, number))}`;

export type PriceLink = { nome: string; url: string; regiao: "BR" | "US" | "EU"; moeda: string };

/** Lista pronta de onde conferir o preço de uma carta, para montar os botões. */
export function priceLinks(name: string, number = ""): PriceLink[] {
  return [
    { nome: "MYP", url: mypSearchUrl(name, number), regiao: "BR", moeda: "R$" },
    { nome: "Liga Pokémon", url: ligaUrl(name, number), regiao: "BR", moeda: "R$" },
    { nome: "TCGplayer", url: tcgplayerUrl(name, number), regiao: "US", moeda: "US$" },
    { nome: "Cardmarket", url: cardmarketUrl(name, number), regiao: "EU", moeda: "€" },
  ];
}
