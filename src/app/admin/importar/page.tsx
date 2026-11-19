import { CSV_COLUMNS } from "@/lib/csv";
import { ImportForm } from "./ImportForm";

const example = [
  CSV_COLUMNS.join(";"),
  "Pikachu;Pokémon;Escarlate e Violeta 151;025/165;Comum;NM;Português;4,90;3;https://exemplo.com/pikachu.jpg;",
  "Charizard ex;Pokémon;Obsidiana em Chamas;125/197;Rara Dupla;NM;Português;89,90;1;;Carta com leve marca na borda",
].join("\n");

export default function ImportPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Importar cartas por planilha (CSV)</h1>
      <div className="card space-y-2 p-5 text-sm">
        <p>Use para migrar o catálogo do site antigo de uma vez. Exporte ou monte uma planilha no Excel/Google Planilhas com as colunas abaixo (a primeira linha deve ser o cabeçalho) e salve como <strong>CSV</strong>.</p>
        <p>Obrigatórias: <code>nome</code> e <code>preco</code>. As demais são opcionais. Separador <code>;</code> ou <code>,</code>.</p>
        <pre className="overflow-x-auto rounded bg-slate-100 p-3 text-xs">{example}</pre>
        <a download="modelo-cartas.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent("﻿" + example)}`} className="btn-outline text-xs">Baixar modelo</a>
      </div>
      <ImportForm />
    </div>
  );
}
