// Backend AWS LAMBDA (opcional): usa o @remotion/lambda para renderizar a
// camada Remotion em paralelo, em muitas Lambdas. Serve para 4K pesado quando
// você tem conta AWS. É pago por uso; por isso fica como opção, não o padrão.
//
// Pré-requisitos (uma vez, no seu PC com a conta AWS configurada):
//   npm i @remotion/lambda
//   npx remotion lambda functions deploy
//   npx remotion lambda sites create src/index.ts --site-name=mlpb
//
// Depois, defina no ambiente: REMOTION_AWS_ACCESS_KEY_ID / REMOTION_AWS_SECRET_ACCESS_KEY.
//
// Observação: a Lambda renderiza a CAMADA REMOTION (gráficos/identidade visual).
// A junção multicâmera + FFmpeg roda no backend local ou no GitHub Actions; a
// Lambda entra quando a parte Remotion é o gargalo (muitos gráficos em 4K).

export async function renderLambda() {
  throw new Error(
    "Backend 'lambda' ainda não está ligado neste projeto.\n" +
    "Para usar: instale o @remotion/lambda, faça o deploy da função e do site " +
    "(veja os comentários em lambda.mjs) e me avise que eu conecto este backend " +
    "ao fluxo. Enquanto isso, use 'local' (grátis) ou 'github' (baixo custo).",
  );
}
