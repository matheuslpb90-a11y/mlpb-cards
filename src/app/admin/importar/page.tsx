import { CSV_COLUMNS } from "@/lib/csv";
import { ImportForm } from "./ImportForm";

const example = [
  CSV_COLUMNS.join(";"),
  "carta;Pikachu;;nao;Pokémon;Escarlate e Violeta 151;025/165;Comum;NM;Português;4,90;3;https://exemplo.com/pikachu.jpg;",
  "carta;Charizard ex;;sim;Pokémon;Obsidiana em Chamas;125/197;Rara Dupla;SP;Inglês;89,90;1;;Leve marca na borda",
  "produto;Booster Fagulhas Impetuosas;Booster;nao;Pokémon;Fagulhas Impetuosas;;;;Português;29,90;10;;",
].join("\n");

export default function ImportPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Importar cartas por planilha (CSV)</h1>
      <div className="card space-y-2 p-5 text-sm">
        <p>Use para migrar o catálogo do site antigo de uma vez. Exporte ou monte uma planilha no Excel/Google Planilhas com as colunas abaixo (a primeira linha deve ser o cabeçalho) e salve como <strong>CSV</strong>.</p>
        <p>Obrigatórias: <code>nome</code> e <code>preco</code>. As demais são opcionais. Separador <code>;</code> ou <code>,</code>.</p>
        <p><code>tipo</code>: carta ou produto · <code>condicao</code>: NM, SP, MP, HP ou DMG · <code>idioma</code>: Português, Inglês, Japonês ou Chinês · <code>destaque</code>: sim ou não.</p>
        <pre className="overflow-x-auto rounded bg-slate-100 p-3 text-xs">{example}</pre>
        <a download="modelo-cartas.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent("﻿" + example)}`} className="btn-outline text-xs">Baixar modelo</a>
      </div>
      <ImportForm />
    </div>
  );
}
