// Estimativa de custo antes de renderizar. Nunca é exata — serve para decidir.
import { FORMATOS } from "./formats.mjs";

/** Minutos de máquina estimados para renderizar um job. */
export function minutosDeMaquina(duracaoSeg, formatos, quatroK, custoCfg) {
  const fator = quatroK ? custoCfg.fatorRender["4k"] : custoCfg.fatorRender["1080p"];
  const minVideo = duracaoSeg / 60;
  return minVideo * fator * formatos.length;
}

export function estimar({ duracaoSeg, formatos, quatroK, backend, custoCfg }) {
  const min = minutosDeMaquina(duracaoSeg, formatos, quatroK, custoCfg);
  const linhas = [];
  let usd = 0;
  let aviso = "";

  if (backend === "local") {
    usd = 0;
    linhas.push("Backend local: sem custo em dinheiro (usa seu computador).");
  } else if (backend === "github") {
    const c = custoCfg.github;
    usd = min * c.usdPorMinPrivado;
    linhas.push(`GitHub Actions: ~${min.toFixed(0)} min de runner.`);
    linhas.push(`Repo PÚBLICO: grátis (minutos ilimitados). Repo privado: ${c.gratisPorMes} min/mês grátis, depois ~US$${c.usdPorMinPrivado}/min.`);
    linhas.push(`Se cobrado (privado acima da cota): ~US$ ${usd.toFixed(2)}.`);
    if (quatroK) aviso = "4K multicâmera num runner grátis (2 núcleos, sem GPU) é LENTO; pode estourar o limite de 6 h por job. Teste com clipes curtos primeiro.";
  } else if (backend === "lambda") {
    const c = custoCfg.lambda;
    const gbSeg = (c.memoriaMb / 1024) * (min * 60);
    usd = gbSeg * c.usdPorGbSegundo;
    linhas.push(`AWS Lambda (Remotion): ~${min.toFixed(0)} min de computação em paralelo.`);
    linhas.push(`Estimado: ~US$ ${usd.toFixed(2)} (mais o S3 do resultado). Só com conta AWS.`);
  }

  return {
    minutosMaquina: min,
    usd,
    formatos: formatos.map((f) => FORMATOS[f]?.nome || f),
    linhas,
    aviso,
  };
}
