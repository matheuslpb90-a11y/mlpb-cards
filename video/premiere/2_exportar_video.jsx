// ============================================================
//  MLPB Cards: 2) EXPORTAR VÍDEO + CAPÍTULOS
//  Com a sequência aberta na timeline:
//   - gera saida/<sequência>/capitulos.txt a partir dos marcadores
//     (cole na descrição do YouTube)
//   - manda o vídeo inteiro para o Media Encoder e começa a renderizar
//  Marcadores de HIT (e marcadores com duração) não viram capítulo.
// ============================================================
#include "lib.jsx"

(function () {
    try {
        var seq = sequenciaAtiva();
        var pasta = pastaSaida(nomeSeguro(seq.name));

        // ---- Capítulos ----
        var marcadores = lerMarcadores(seq);
        var caps = [];
        for (var i = 0; i < marcadores.length; i++) {
            var m = marcadores[i];
            var ehHit = m.nome.toUpperCase().indexOf(CONFIG.PREFIXO_HIT.toUpperCase()) === 0;
            var temDuracao = m.fim - m.inicio > 0.5;
            if (ehHit || temDuracao) continue;
            caps.push({ t: m.inicio, nome: m.nome || m.comentario || ("Parte " + (caps.length + 1)) });
        }
        if (!caps.length || caps[0].t >= 1) caps.unshift({ t: 0, nome: "Início" });

        var linhas = [];
        for (var c = 0; c < caps.length; c++) linhas.push(formatarTempo(caps[c].t) + " " + caps[c].nome);
        var avisoCap = "";
        if (caps.length < 3) avisoCap = "\n(O YouTube só mostra capítulos com 3 ou mais. Aperte M e dê nome aos marcadores.)";
        for (var k = 1; k < caps.length; k++) {
            if (caps[k].t - caps[k - 1].t < 10) { avisoCap += "\n(Capítulos precisam ter 10s ou mais: veja \"" + caps[k].nome + "\".)"; break; }
        }
        escreverTexto(pasta.fsName + "/capitulos.txt", linhas.join("\n") + "\n");

        // ---- Vídeo inteiro no Media Encoder ----
        var preset = acharPreset();
        var saida = pasta.fsName + "/" + nomeSeguro(seq.name) + ".mp4";
        app.encoder.launchEncoder();
        var job = app.encoder.encodeSequence(seq, saida, preset, app.encoder.ENCODE_ENTIRE, 0);
        app.encoder.startBatch();

        alert("Capítulos salvos em:\n" + pasta.fsName + "/capitulos.txt\n\n" + linhas.join("\n") + avisoCap +
            "\n\nVídeo enviado ao Media Encoder" + (job ? "" : " (confira a fila do Media Encoder)") + ":\n" + saida);
    } catch (err) {
        alert("Erro: " + err.message + (err.line ? " (linha " + err.line + ")" : ""));
    }
})();
