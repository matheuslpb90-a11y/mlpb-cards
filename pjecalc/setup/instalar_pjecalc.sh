#!/usr/bin/env bash
# Instala e inicia o PJe-Calc Cidadão (Windows x64) em Linux, sem interface gráfica.
#
# Uso:
#   bash instalar_pjecalc.sh <instalador.exe | ID-do-arquivo-no-Google-Drive> [pasta-destino]
#
# - Aceita o caminho do pjecalc-X.Y.Z-instalador-x64.exe ou o ID de um arquivo do
#   Google Drive compartilhado como "qualquer pessoa com o link".
# - O .exe é um ZIP autoextraível: extraímos com 7z, usamos Java 8 do Linux
#   (o Java que vem no pacote é de Windows) e uma tela virtual (Xvfb), porque o
#   programa abre uma tela de abertura (splash) e falha sem display.
# - Ao final, o sistema responde em http://localhost:9257/pjecalc/
set -euo pipefail

SRC="${1:?informe o instalador .exe ou o ID do Google Drive}"
DEST="${2:-$HOME/pjecalc}"
mkdir -p "$DEST"

if ! command -v xvfb-run >/dev/null || [ ! -x /usr/lib/jvm/java-8-openjdk-amd64/bin/java ] || ! command -v 7z >/dev/null; then
  echo ">> instalando dependências (Java 8, Xvfb, 7zip)"
  (apt-get install -y -q openjdk-8-jre xvfb p7zip-full >/dev/null 2>&1) || \
  (apt-get update -q >/dev/null 2>&1 && apt-get install -y -q openjdk-8-jre xvfb p7zip-full >/dev/null)
fi

APP=$(ls -d "$DEST"/pjecalc-windows64-* 2>/dev/null | head -1 || true)
if [ -z "$APP" ]; then
  EXE="$SRC"
  if [ ! -f "$SRC" ]; then
    echo ">> baixando instalador do Google Drive"
    EXE="$DEST/instalador.exe"
    CJ="$DEST/.cookies"
    curl -sSL -c "$CJ" -o "$DEST/.first.html" "https://drive.usercontent.google.com/download?id=$SRC&export=download"
    UUID=$(grep -o 'name="uuid" value="[^"]*"' "$DEST/.first.html" | sed 's/.*value="//;s/"//' || true)
    curl -sSL -b "$CJ" -o "$EXE" "https://drive.usercontent.google.com/download?id=$SRC&export=download&confirm=t${UUID:+&uuid=$UUID}"
    rm -f "$CJ" "$DEST/.first.html"
  fi
  echo ">> extraindo"
  (cd "$DEST" && 7z x -y "$EXE" >/dev/null)
  APP=$(ls -d "$DEST"/pjecalc-windows64-* | head -1)
fi
echo ">> PJe-Calc em $APP"

if curl -s -o /dev/null http://localhost:9257/pjecalc/; then
  echo ">> já está rodando"; exit 0
fi

# Reaproveita os parâmetros de segurança do próprio iniciarPjeCalc.bat
ARGS=$(grep -o '\-Dseguranca[^ ]*' "$APP/iniciarPjeCalc.bat" | tr -d '\r' | tr '\n' ' ')
cd "$APP"
unset _JAVA_OPTIONS || true
# shellcheck disable=SC2086
nohup xvfb-run -a -s "-screen 0 1280x900x24" /usr/lib/jvm/java-8-openjdk-amd64/bin/java \
  -Duser.timezone=GMT-3 -Dfile.encoding=ISO-8859-1 $ARGS -Xms512m -Xmx2048m \
  -jar bin/pjecalc.jar > "$DEST/pjecalc.log" 2>&1 &

for i in $(seq 1 60); do
  if curl -s -o /dev/null http://localhost:9257/pjecalc/; then echo ">> PJe-Calc no ar: http://localhost:9257/pjecalc/"; exit 0; fi
  sleep 3
done
echo "!! não subiu; veja $DEST/pjecalc.log"; exit 1
