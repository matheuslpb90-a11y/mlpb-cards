# MLPB Cards

Loja online de cartas colecionáveis da **MLPB Cards** (www.mlpbcards.com.br).

## O que o app faz

**Para o cliente**
- Catálogo com busca e filtros por jogo, coleção e preço.
- Carrinho de compras (fica salvo no navegador).
- Checkout com **duas opções**:
  1. **Pagar pelo site**: o cliente cria o cadastro, escolhe o frete (PAC, SEDEX ou **Acumular pedido**) e paga com a **InfinitePay** (Pix ou cartão).
  2. **Finalizar pelo WhatsApp**: sem cadastro. Abre o WhatsApp da loja com a lista das cartas e o total já escritos.
- Área "Minha conta": pedidos, status, rastreio e botão para **pedir o envio dos pedidos acumulados**.

**Para a loja (painel `/admin`)**
- Adicionar, editar, **retirar ou voltar uma carta ao catálogo** e excluir cartas.
- **Busca de cartas Pokémon** (TCGdex): digite o nome, clique na carta certa e o sistema preenche imagem, coleção, número e raridade.
- **Importação por planilha CSV**, para migrar o catálogo antigo de uma vez.
- Pedidos: filtrar por status, mudar o status, informar o código de rastreio e chamar o cliente no WhatsApp.

## Como rodar localmente

```bash
npm install
cp .env.example .env      # edite os valores
npm run setup             # cria o banco e o usuário admin
npm run dev               # http://localhost:3000
```

Entre em `/entrar` com `ADMIN_EMAIL` e `ADMIN_PASSWORD` definidos no `.env`. O botão **Painel** aparece no topo do site.
O setup cria 3 cartas de exemplo, que você pode apagar pelo painel. Para não criá-las, use `SEED_SAMPLE_CARDS=0`.

## Configuração (`.env`)

| Variável | Para que serve |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Endereço público do site (ex.: `https://www.mlpbcards.com.br`). Usado no retorno do pagamento. |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | WhatsApp da loja (padrão: `5561992242345`). |
| `SUPERFRETE_TOKEN` | Token da SuperFrete. **Vazio = tabela de frete de teste.** |
| `STORE_ORIGIN_CEP` | CEP de onde a loja envia (padrão: `70675827`). |
| `SUPERFRETE_SERVICES` | Serviços cotados: `1` PAC, `2` SEDEX, `17` Mini Envios (padrão: todos). |
| `SUPERFRETE_SANDBOX` | `1` para usar o ambiente de testes da SuperFrete. |
| `INFINITEPAY_HANDLE` | InfiniteTag da loja, sem o `$` (padrão: `mlpbcards`). Use `""` para o modo demonstração. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Administrador criado pelo `npm run db:seed`. |
| `DATABASE_URL` | Banco de dados. |

## Pagamento (InfinitePay)

A integração usa o **Checkout Integrado** da InfinitePay (`src/lib/infinitepay.ts`):
1. Ao pagar, o pedido é criado, o estoque é reservado e o cliente vai para o link de pagamento da InfinitePay.
2. A InfinitePay devolve o cliente para `/pagamento/retorno` e avisa o webhook `/api/webhooks/infinitepay`.
3. Antes de marcar o pedido como pago, o sistema **confere o pagamento na API da InfinitePay**. Pedidos com frete "Acumular" ficam como *Pago — acumulado na loja*.

> ⚠️ Antes de começar a vender, faça uma compra de teste de valor baixo com sua InfinitePay real e confira se os nomes dos campos batem com a documentação atual (veja `src/lib/infinitepay.ts`).

Se o pagamento não for concluído, o pedido continua como *Aguardando pagamento* com o estoque reservado. Ao cancelar o pedido pelo painel, as cartas voltam ao estoque.

## Frete (SuperFrete)

Com `SUPERFRETE_TOKEN` e `STORE_ORIGIN_CEP` configurados, o checkout cota o frete **em tempo real na SuperFrete** usando o CEP do cliente. São mostrados PAC, SEDEX e Mini Envios, do mais barato para o mais caro, além da opção **Acumular pedido**.
- O token é gerado no painel da SuperFrete, em **Integrações**.
- O valor do frete é sempre recalculado no servidor na hora de criar o pedido. O navegador não consegue alterá-lo.
- O peso e o tamanho da embalagem ficam em `src/lib/shipping.ts` (`PACKAGE_BASE_KG`, `KG_PER_CARD`, medidas em cm). Ajuste-os à embalagem que você usa.
- Sem token, o checkout usa uma tabela de valores estimados por região, apenas para testes.

> ⚠️ A integração foi feita conforme a API pública da SuperFrete (`POST /api/v0/calculator`). Antes de vender, faça uma cotação de teste com seu token, de preferência com `SUPERFRETE_SANDBOX=1` primeiro.

## Publicar (produção)

Opção sugerida, de baixo custo: **Vercel** (site) + **Neon** ou **Supabase** (Postgres). Os dois têm planos gratuitos.
1. Em `prisma/schema.prisma`, troque `provider = "sqlite"` por `provider = "postgresql"`.
2. Configure as variáveis acima no painel da hospedagem, com `DATABASE_URL` apontando para o Postgres.
3. Rode `npx prisma db push && npx prisma db seed` uma vez, apontando para o banco de produção.
4. Aponte o domínio `www.mlpbcards.com.br` para a hospedagem.

## Migrar o catálogo do site antigo

Em **Painel → Importar CSV** há um modelo para baixar. Colunas aceitas:
`nome; jogo; colecao; numero; raridade; condicao; idioma; preco; estoque; imagem; descricao`. Apenas `nome` e `preco` são obrigatórias.
