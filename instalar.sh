#!/bin/bash
# Instala lo que necesita la app de edición de 6 Grados en este Mac y la deja lista.
#   bash instalar.sh            instala y abre la app
#   bash instalar.sh --sin-abrir  solo instala (para pruebas)
# Necesita Homebrew. Si no está, se para y dice cómo ponerlo (pide la contraseña del Mac: la escribe la persona).
set -e
cd "$(dirname "$0")"
ok() { printf '  ✔ %s\n' "$1"; }
mal() { printf '  ✘ %s\n' "$1"; exit 1; }

echo "Instalando la app de edición de 6 Grados…"
[ "$(uname)" = "Darwin" ] || mal "Esta app es para Mac."

if ! command -v brew >/dev/null 2>&1; then
  for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do [ -x "$b" ] && eval "$("$b" shellenv)" && break; done
fi
command -v brew >/dev/null 2>&1 || mal "Falta Homebrew. Abre la app Terminal, pega esto y escribe la contraseña de tu Mac cuando te la pida:
     /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"
     Cuando termine, vuelve a lanzar: bash instalar.sh"
ok "Homebrew"

for p in node ffmpeg whisper-cpp; do
  if brew list --formula "$p" >/dev/null 2>&1 || { [ "$p" = node ] && command -v node >/dev/null 2>&1; } || { [ "$p" = ffmpeg ] && command -v ffmpeg >/dev/null 2>&1; }; then
    ok "$p"
  else
    echo "  … instalando $p (puede tardar unos minutos)"
    brew install "$p" >/dev/null || mal "No se ha podido instalar $p"
    ok "$p"
  fi
done
command -v whisper-cli >/dev/null 2>&1 || command -v whisper-cpp >/dev/null 2>&1 || mal "whisper-cpp está instalado pero no encuentro su orden (whisper-cli)."

# El modelo para transcribir (~470 MB), una sola vez: así la primera transcripción no espera.
MODELO="${EDICION_MODELO:-small}"; CACHE="$HOME/.cache/6g-edicion"; mkdir -p "$CACHE"
if [ ! -s "$CACHE/ggml-$MODELO.bin" ]; then
  echo "  … bajando el modelo de transcripción ($MODELO, solo esta vez)"
  curl -fL --progress-bar -o "$CACHE/ggml-$MODELO.bin.tmp" "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-$MODELO.bin" \
    && [ -s "$CACHE/ggml-$MODELO.bin.tmp" ] && mv "$CACHE/ggml-$MODELO.bin.tmp" "$CACHE/ggml-$MODELO.bin" || mal "No se ha podido bajar el modelo."
fi
ok "modelo de transcripción"

mkdir -p datos/videos
chmod +x "Abrir edición.command"
node --check servidor.mjs && ok "app"

if [ "$1" != "--sin-abrir" ]; then
  nohup node servidor.mjs >/dev/null 2>&1 &
  sleep 1; open "http://localhost:${EDICION_PUERTO:-4710}"
  echo "Lista: http://localhost:${EDICION_PUERTO:-4710} (la próxima vez, doble clic en «Abrir edición.command»)."
else
  echo "Instalada. Para abrirla: doble clic en «Abrir edición.command»."
fi
