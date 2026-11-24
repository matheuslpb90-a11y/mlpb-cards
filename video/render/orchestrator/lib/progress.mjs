// Barra de progresso simples numa linha (monitoramento da renderização).
export function barra(rotulo) {
  let ultimo = -1;
  return (fracao) => {
    const pct = Math.round(fracao * 100);
    if (pct === ultimo) return;
    ultimo = pct;
    const cheio = Math.round(fracao * 24);
    const barra = "█".repeat(cheio) + "░".repeat(24 - cheio);
    process.stdout.write(`\r  ${rotulo} ${barra} ${String(pct).padStart(3)}%`);
    if (pct >= 100) process.stdout.write("\n");
  };
}
