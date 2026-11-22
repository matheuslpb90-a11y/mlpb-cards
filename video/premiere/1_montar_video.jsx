// ============================================================
//  MLPB Cards: 1) MONTAR VÍDEO
//  Escolha a pasta com as gravações. O script:
//   - importa os vídeos (em ordem alfabética do nome do arquivo)
//   - cria a sequência: INTRO + gravações + OUTRO
//   - põe a logo da MLPB como marca d'água na trilha V2 do começo ao fim
//   - põe a música de fundo na trilha A2 (em loop, volume baixo)
//  Dica: rode antes o python/cortar_silencio.py --video na pasta
//  para já montar com os silêncios cortados.
// ============================================================
#include "lib.jsx"

(function () {
    try {
        if (!app.project) { alert("Abra um projeto no Premiere primeiro."); return; }

        var pasta = Folder.selectDialog("MLPB: escolha a pasta com as gravações do vídeo");
        if (!pasta) return;

        var arquivos = listarVideos(pasta);
        if (!arquivos.length) { alert("Nenhum vídeo encontrado em:\n" + pasta.fsName); return; }

        var nome = prompt("Nome do vídeo (vira o nome da sequência):", decodeURI(pasta.name));
        if (!nome) return;

        var bin = app.project.rootItem.createBin(nome);
        var clipes = importarArquivos(arquivos, bin);
        var intro = importarUm(caminhoAsset(CONFIG.INTRO), bin);
        var outro = importarUm(caminhoAsset(CONFIG.OUTRO), bin);

        var lista = [];
        if (intro) lista.push(intro);
        for (var i = 0; i < clipes.length; i++) lista.push(clipes[i]);
        if (outro) lista.push(outro);

        var seq = app.project.createNewSequenceFromClips(nome, lista, bin);
        if (!seq) throw new Error("O Premiere não conseguiu criar a sequência.");
        app.project.openSequence(seq.sequenceID);

        var fim = fimDaSequencia(seq);
        var avisos = [];

        // ---- Logo na V2 ----
        var logo = importarUm(caminhoLogo(), bin);
        if (logo && seq.videoTracks.numTracks > 1) {
            var v2 = seq.videoTracks[1];
            v2.overwriteClip(logo, 0);
            var clipLogo = ultimoClipe(v2);
            if (clipLogo) {
                clipLogo.end = tempo(fim);
                try {
                    var mov = acharComponente(clipLogo, "AE.ADBE Motion");
                    mov.properties[0].setValue(CONFIG.LOGO_POSICAO, true); // Posição
                    mov.properties[1].setValue(CONFIG.LOGO_ESCALA, true);  // Escala
                    var opa = acharComponente(clipLogo, "AE.ADBE Opacity");
                    opa.properties[0].setValue(CONFIG.LOGO_OPACIDADE, true);
                } catch (e) { avisos.push("Logo: ajuste posição/tamanho à mão (" + e.message + ")"); }
            }
        } else if (!logo) avisos.push("Logo não encontrada.");

        // ---- Música na A2, em loop até o fim ----
        var musica = importarUm(caminhoAsset(CONFIG.MUSICA), bin);
        if (musica && seq.audioTracks.numTracks > 1) {
            var a2 = seq.audioTracks[1];
            var pos = 0, voltas = 0;
            while (pos < fim - 0.05 && voltas < 200) {
                a2.overwriteClip(musica, pos);
                var c = ultimoClipe(a2);
                if (!c || c.end.seconds <= pos) break;
                if (c.end.seconds > fim) c.end = tempo(fim);
                ajustarVolume(c, CONFIG.MUSICA_DB, avisos);
                pos = c.end.seconds;
                voltas++;
            }
        }

        var msg = "Pronto! Sequência \"" + nome + "\" montada com " + clipes.length + " gravação(ões)" +
            (intro ? " + intro" : "") + (outro ? " + outro" : "") + (musica ? " + música" : "") + ".\n\n" +
            "Próximo passo: revise e aperte M nos momentos dos hits (nome do marcador começando com \"" +
            CONFIG.PREFIXO_HIT + "\") e nos capítulos.";
        if (avisos.length) msg += "\n\nAvisos:\n- " + avisos.join("\n- ");
        alert(msg);
    } catch (err) {
        alert("Erro: " + err.message + (err.line ? " (linha " + err.line + ")" : ""));
    }

    // O nível de volume do Premiere não é em dB: valor = 10^((dB - 15) / 20).
    function ajustarVolume(clip, db, avisos) {
        try {
            var vol = null;
            for (var i = 0; i < clip.components.numItems; i++) {
                var mn = clip.components[i].matchName;
                if (/volume/i.test(mn) && !/channel/i.test(mn)) { vol = clip.components[i]; break; }
            }
            if (!vol) vol = clip.components[0];
            var nivel = null;
            for (var p = 0; p < vol.properties.numItems; p++) {
                if (/^(level|n[ií]vel)$/i.test(vol.properties[p].displayName)) nivel = vol.properties[p];
            }
            if (!nivel) nivel = vol.properties[1];
            nivel.setValue(Math.pow(10, (db - 15) / 20), true);
        } catch (e) {
            if (avisos.join("").indexOf("Música") < 0) avisos.push("Música: ajuste o volume à mão (" + e.message + ")");
        }
    }
})();
