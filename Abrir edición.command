#!/bin/bash
# Doble clic: arranca la app de edición de 6 Grados y la abre en el navegador. Cierra esta ventana para apagarla.
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Falta Node.js. Pídele a Claude: «instálame Node.js»."
  read -r -p "Pulsa Intro para cerrar."; exit 1
fi
PUERTO="${EDICION_PUERTO:-4710}"
( sleep 1; open "http://localhost:$PUERTO" ) &
exec node servidor.mjs
