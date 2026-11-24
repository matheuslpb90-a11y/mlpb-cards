import { SetEditor } from "./SetEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cadastrar coleção — Painel" };

export default function ColecaoPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">📚 Cadastrar coleção</h1>
        <p className="text-sm text-slate-500">
          Escolha a coleção, marque as cartas e preencha idioma, tipo, estado, preço e quantidade embaixo de cada uma. Cada combinação de idioma + tipo + estado é um estoque separado:
          se a versão já existir, o site mostra o estoque atual e, ao salvar, <strong>atualiza</strong> (não duplica).
        </p>
      </div>
      <SetEditor />
    </div>
  );
}
