// Tela de carregamento entre páginas: uma carta da MLPB girando.
// Só HTML + CSS (nenhum JavaScript nem imagem extra), então não pesa no site.
export default function Loading() {
  return (
    <div className="mlpb-loader" role="status" aria-live="polite">
      <div className="mlpb-loader-carta" aria-hidden>
        <div className="mlpb-loader-face mlpb-loader-frente">
          <span>M</span>
        </div>
        <div className="mlpb-loader-face mlpb-loader-verso" />
      </div>
      <p className="mlpb-loader-texto">Carregando…</p>
    </div>
  );
}
