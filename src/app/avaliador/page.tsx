import { Grader } from "./Grader";

export const metadata = {
  title: "Pré-avaliação de carta Pokémon (estilo PSA) — MLPB Cards",
  description: "Meça a centralização pela foto e descubra uma estimativa de nota PSA para sua carta Pokémon. Grátis.",
};

export default function GraderPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-3xl font-black">🔍 Pré-avaliação de carta</h1>
        <p className="text-slate-600">Descubra uma <strong>estimativa de nota</strong> (estilo PSA) antes de mandar graduar: meça a centralização pela foto e responda sobre cantos, bordas e superfície. Grátis e sem cadastro.</p>
      </div>
      <Grader />
    </div>
  );
}
