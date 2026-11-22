// ============================================================
//  MLPB Cards: 3) EXPORTAR HITS (cortes para Shorts/Reels/TikTok)
//  Com a sequência aberta na timeline, exporta um MP4 por hit:
//   - marcador cujo nome começa com "HIT" (ex.: "HIT Charizard ex"):
//     de HIT_ANTES s antes até HIT_DEPOIS s depois do marcador
//   - marcador com duração: exatamente aquele trecho
//  Os arquivos vão para saida/<sequência>/hits/. Depois rode
//  python/shorts.py nessa pasta para deixar tudo em 9:16 com a logo.
// ============================================================
#include "lib.jsx"

(function () {
    try {
        var seq = sequenciaAtiva();
        var fim = fimDaSequencia(seq);
        var marcadores = lerMarcadores(seq);
        var hits = [];
        for (var i = 0; i < marcadores.length; i++) {
            var m = marcadores[i];
            var ehHit = m.nome.toUpperCase().indexOf(CONFIG.PREFIXO_HIT.toUpperCase()) === 0;
            var temDuracao = m.fim - m.inicio > 0.5;
            if (temDuracao) hits.push({ nome: m.nome, ini: m.inicio, fim: m.fim });
            else if (ehHit) hits.push({ nome: m.nome, ini: Math.max(0, m.inicio - CONFIG.HIT_ANTES), fim: Math.min(fim, m.inicio + CONFIG.HIT_DEPOIS) });
        }
        if (!hits.length) {
            alert("Nenhum hit encontrado.\n\nAperte M no momento em que a carta aparece e dê ao marcador um nome começando com \"" +
                CONFIG.PREFIXO_HIT + "\" (ex.: \"" + CONFIG.PREFIXO_HIT + " Pikachu ex\"), ou crie marcadores com duração.");
            return;
        }
        if (!confirm("Exportar " + hits.length + " hit(s)? O Premiere fica ocupado até terminar.")) return;

        var pasta = pastaSaida(nomeSeguro(seq.name) + "/hits");
        var preset = acharPreset();
        var entradaOriginal = seq.getInPointAsTime().seconds;
        var saidaOriginal = seq.getOutPointAsTime().seconds;
        var feitos = [], falhas = [];

        for (var h = 0; h < hits.length; h++) {
            var hit = hits[h];
            var nome = doisDigitos(h + 1) + "_" + nomeSeguro(hit.nome.replace(new RegExp("^" + CONFIG.PREFIXO_HIT + "\\s*", "i"), "") || "hit");
            var arquivo = pasta.fsName + "/" + nome + ".mp4";
            seq.setInPoint(hit.ini);
            seq.setOutPoint(hit.fim);
            var r = seq.exportAsMediaDirect(arquivo, preset, app.encoder.ENCODE_IN_TO_OUT);
            if (r === "No Error" || File(arquivo).exists) feitos.push(nome + " (" + formatarTempo(hit.ini) + " - " + formatarTempo(hit.fim) + ")");
            else falhas.push(nome + ": " + r);
        }

        seq.setInPoint(entradaOriginal);
        seq.setOutPoint(saidaOriginal);

        alert("Hits exportados em:\n" + pasta.fsName + "\n\n" + feitos.join("\n") +
            (falhas.length ? "\n\nFalharam:\n" + falhas.join("\n") : "") +
            "\n\nAgora rode:\npython shorts.py \"" + pasta.fsName + "\"");
    } catch (err) {
        alert("Erro: " + err.message + (err.line ? " (linha " + err.line + ")" : ""));
    }
})();
