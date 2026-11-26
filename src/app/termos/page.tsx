import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Termos de Uso" };

export default function Termos() {
  return (
    <article className="mx-auto max-w-3xl space-y-4 leading-relaxed">
      <h1 className="text-2xl font-bold">Termos de Uso</h1>
      <p className="text-sm text-slate-500">Última atualização: novembro de 2026</p>
      <p>Ao usar o site da MLPB Cards você concorda com estes termos.</p>

      <h2 className="text-lg font-bold">1. Conta</h2>
      <p>Você é responsável pelos dados informados no cadastro e por manter sua senha em segredo. Contas usadas para fraude, golpe ou abuso podem ser bloqueadas.</p>

      <h2 className="text-lg font-bold">2. Compras</h2>
      <p>Preços e estoque podem mudar sem aviso até a finalização do pedido. O pedido só é confirmado após a aprovação do pagamento. O estado de conservação de cada carta é informado no anúncio.</p>

      <h2 className="text-lg font-bold">3. Leilões</h2>
      <p>Lances são compromissos de compra. Quem arremata recebe uma fatura e deve pagá-la no prazo informado; o não pagamento pode levar ao bloqueio nos próximos leilões e no grupo.</p>

      <h2 className="text-lg font-bold">4. Ferramentas gratuitas</h2>
      <p>A <b>Minha coleção</b> e a <b>Pré-avaliação</b> são gratuitas. A pré-avaliação é apenas uma estimativa e não garante a nota dada pela PSA ou por qualquer outra empresa de graduação.</p>

      <h2 className="text-lg font-bold">5. Trocas e devoluções</h2>
      <p>Seguimos o Código de Defesa do Consumidor. Em caso de problema com o pedido, fale com a gente pelo WhatsApp da loja.</p>

      <h2 className="text-lg font-bold">6. Marcas</h2>
      <p>Pokémon e seus nomes e imagens são marcas da Nintendo, Creatures Inc. e GAME FREAK inc. A MLPB Cards é uma loja independente, sem vínculo oficial com essas empresas.</p>

      <p className="text-sm text-slate-500">Veja também a <Link href="/privacidade" className="underline">Política de Privacidade</Link>.</p>
    </article>
  );
}
