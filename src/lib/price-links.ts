// Links para conferir o preço atualizado em outros sites (usados no painel).

/** Busca da carta na Liga Pokémon (preços do mercado brasileiro).
 *  A Liga nomeia as cartas como "Charizard ex (199/165)": com o número, a busca cai na impressão certa. */
export const ligaUrl = (name: string, number = "") => {
  const n = number.trim();
  return `https://www.ligapokemon.com.br/?view=cards/search&card=${encodeURIComponent(`${name.trim()}${n ? ` (${n})` : ""}`)}`;
};

/** Busca da carta na MYP Cards. */
export const mypSearchUrl = (name: string) => `https://mypcards.com/pokemon?ProdutoSearch%5Bquery%5D=${encodeURIComponent(name.trim())}`;
