// ============================================================
//  MLPB Cards: funções comuns dos scripts (não precisa editar)
// ============================================================
#include "config.jsx"

function log(msg) { $.writeln("[MLPB] " + msg); }

// Pasta "video/" do repositório (pai da pasta "premiere/").
function pastaVideo() { return File($.fileName).parent.parent; }

function pastaAssets() {
    return CONFIG.ASSETS ? Folder(CONFIG.ASSETS) : Folder(pastaVideo().fsName + "/assets");
}

// Resolve um asset: vazio = não usar; caminho absoluto; ou nome dentro da pasta ASSETS.
function caminhoAsset(nome) {
    if (!nome) return null;
    var f = File(nome);
    if (!f.exists) f = File(pastaAssets().fsName + "/" + nome);
    if (!f.exists) { log("Asset não encontrado (pulando): " + nome); return null; }
    return f;
}

function caminhoLogo() {
    if (CONFIG.LOGO) return caminhoAsset(CONFIG.LOGO);
    var f = File(pastaVideo().parent.fsName + "/marca/logo-mlpb-cards-1235px.png");
    return f.exists ? f : null;
}

function pastaSaida(subpasta) {
    var base;
    if (CONFIG.SAIDA) base = Folder(CONFIG.SAIDA);
    else {
        if (!app.project.path) throw new Error("Salve o projeto (.prproj) antes de exportar.");
        base = Folder(File(app.project.path).parent.fsName + "/saida");
    }
    var p = subpasta ? Folder(base.fsName + "/" + subpasta) : base;
    if (!p.exists) p.create();
    return p;
}

function nomeSeguro(s) {
    return String(s).replace(/[\\\/:\*\?"<>\|]/g, "").replace(/\s+/g, "_").substring(0, 60) || "sem_nome";
}

function doisDigitos(n) { return (n < 10 ? "0" : "") + n; }

// 75.4 -> "01:15"; 3725 -> "1:02:05" (formato dos capítulos do YouTube)
function formatarTempo(seg) {
    seg = Math.floor(seg);
    var h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = seg % 60;
    return h > 0 ? h + ":" + doisDigitos(m) + ":" + doisDigitos(s) : doisDigitos(m) + ":" + doisDigitos(s);
}

function tempo(seg) { var t = new Time(); t.seconds = seg; return t; }

function escreverTexto(caminho, texto) {
    var f = File(caminho);
    f.encoding = "UTF-8";
    f.open("w");
    f.write(texto);
    f.close();
}

// ---------- Projeto ----------

function normalizar(caminho) { return File(caminho).fsName.toLowerCase(); }

function acharItemPorCaminho(pasta, caminho) {
    var alvo = normalizar(caminho);
    for (var i = 0; i < pasta.children.numItems; i++) {
        var it = pasta.children[i];
        if (it.type === ProjectItemType.BIN) {
            var r = acharItemPorCaminho(it, caminho);
            if (r) return r;
        } else {
            var p = it.getMediaPath ? it.getMediaPath() : "";
            if (p && normalizar(p) === alvo) return it;
        }
    }
    return null;
}

// Importa arquivos (File[]) para o bin e devolve os ProjectItems na mesma ordem.
function importarArquivos(arquivos, bin) {
    var faltando = [];
    for (var i = 0; i < arquivos.length; i++) {
        if (!acharItemPorCaminho(app.project.rootItem, arquivos[i].fsName)) faltando.push(arquivos[i].fsName);
    }
    if (faltando.length) app.project.importFiles(faltando, true, bin, false);
    var itens = [];
    for (var j = 0; j < arquivos.length; j++) {
        var it = acharItemPorCaminho(app.project.rootItem, arquivos[j].fsName);
        if (it) itens.push(it); else log("Falha ao importar: " + arquivos[j].fsName);
    }
    return itens;
}

function importarUm(arquivo, bin) {
    if (!arquivo) return null;
    var r = importarArquivos([arquivo], bin);
    return r.length ? r[0] : null;
}

function listarVideos(pasta) {
    var re = new RegExp("\\.(" + CONFIG.EXTENSOES.join("|") + ")$", "i");
    var arquivos = pasta.getFiles(function (f) { return f instanceof File && re.test(f.name); });
    arquivos.sort(function (a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; });
    return arquivos;
}

// ---------- Timeline ----------

function ultimoClipe(track) { return track.clips.numItems ? track.clips[track.clips.numItems - 1] : null; }

// Fim (em segundos) do último clipe da trilha V1.
function fimDaSequencia(seq) {
    var c = ultimoClipe(seq.videoTracks[0]);
    return c ? c.end.seconds : 0;
}

function acharComponente(clip, matchName) {
    for (var i = 0; i < clip.components.numItems; i++) {
        if (clip.components[i].matchName === matchName) return clip.components[i];
    }
    return null;
}

// Lê os marcadores da sequência, em ordem de tempo.
function lerMarcadores(seq) {
    var lista = [];
    var m = seq.markers.getFirstMarker();
    while (m) {
        lista.push({ nome: m.name || "", comentario: m.comments || "", inicio: m.start.seconds, fim: m.end.seconds });
        m = seq.markers.getNextMarker(m);
    }
    lista.sort(function (a, b) { return a.inicio - b.inicio; });
    return lista;
}

// ---------- Exportação ----------

function acharPreset() {
    var candidatos = [];
    if (CONFIG.PRESET_EPR) candidatos.push(CONFIG.PRESET_EPR);
    var pastaApp = app.path ? File(app.path).fsName : "";
    if (pastaApp) {
        var nomes = ["Match Source - Adaptive High Bitrate.epr", "Match Source - High bitrate.epr"];
        var bases = [pastaApp, pastaApp + "/Contents"];
        for (var b = 0; b < bases.length; b++)
            for (var n = 0; n < nomes.length; n++)
                candidatos.push(bases[b] + "/MediaIO/systempresets/4E49434B_48323634/" + nomes[n]);
    }
    for (var i = 0; i < candidatos.length; i++) {
        if (File(candidatos[i]).exists) return File(candidatos[i]).fsName;
    }
    var escolhido = File.openDialog("Escolha um preset de exportação (.epr). Dica: salve o caminho em PRESET_EPR no config.jsx", "*.epr");
    if (!escolhido) throw new Error("Nenhum preset de exportação escolhido.");
    return escolhido.fsName;
}

function sequenciaAtiva() {
    var seq = app.project.activeSequence;
    if (!seq) throw new Error("Abra (ative) a sequência na timeline antes de rodar o script.");
    return seq;
}
