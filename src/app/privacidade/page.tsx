import type { Metadata } from "next";
import Link from "next/link";
import { whatsappLink } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Política de Privacidade" };

export default function Privacidade() {
  return (
    <article className="mx-auto max-w-3xl space-y-4 leading-relaxed">
      <h1 className="text-2xl font-bold">Política de Privacidade</h1>
      <p className="text-sm text-slate-500">Última atualização: novembro de 2026</p>
      <p>A MLPB Cards respeita sua privacidade e trata seus dados conforme a Lei Geral de Proteção de Dados (LGPD – Lei 13.709/2018).</p>

      <h2 className="text-lg font-bold">1. Quais dados coletamos</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li><b>Cadastro:</b> nome, e-mail, telefone/WhatsApp, CPF e endereço de entrega.</li>
        <li><b>Login com Google:</b> apenas nome, e-mail e o identificador da sua conta Google. Não temos acesso à sua senha do Google.</li>
        <li><b>Pedidos e leilões:</b> itens comprados, lances, faturas e status de pagamento.</li>
        <li><b>Minha coleção:</b> as cartas que você marca como suas ou desejadas.</li>
        <li><b>Grupo do WhatsApp:</b> número de telefone e mensagens enviadas ao bot (comandos, avisos e denúncias).</li>
      </ul>
      <p>As fotos usadas na <b>Pré-avaliação</b> ficam só no seu aparelho e não são enviadas para nós.</p>

      <h2 className="text-lg font-bold">2. Para que usamos</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Processar pedidos, pagamentos e entregas (o CPF e o endereço são exigidos para emitir o frete).</li>
        <li>Identificar você nos leilões, enviar faturas e avisos que você pediu (ex.: “Me avise”).</li>
        <li>Manter a segurança da loja e do grupo (prevenção de golpes e fraudes).</li>
      </ul>

      <h2 className="text-lg font-bold">3. Com quem compartilhamos</h2>
      <p>Somente com os serviços necessários para funcionar: processador de pagamento (InfinitePay), transportadora/plataforma de frete (SuperFrete/Correios), envio de mensagens no WhatsApp e a hospedagem do site e do banco de dados. <b>Não vendemos seus dados.</b></p>

      <h2 className="text-lg font-bold">4. Segurança e prazo</h2>
      <p>Senhas são guardadas com criptografia (hash) e o site usa conexão segura (HTTPS). Guardamos os dados enquanto sua conta estiver ativa ou pelo tempo exigido por lei (ex.: registros de vendas).</p>

      <h2 className="text-lg font-bold">5. Seus direitos</h2>
      <p>Você pode pedir a qualquer momento para ver, corrigir ou excluir seus dados, ou cancelar o login com Google. Basta falar com a gente pelo{" "}
        <a href={whatsappLink("Olá! Quero falar sobre meus dados pessoais (LGPD).")} target="_blank" rel="noreferrer" className="text-brand underline">WhatsApp da loja</a>.
      </p>

      <p className="text-sm text-slate-500">Veja também os <Link href="/termos" className="underline">Termos de Uso</Link>.</p>
    </article>
  );
}
