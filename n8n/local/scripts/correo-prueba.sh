#!/usr/bin/env bash
# Deja un correo en el buzón falso del proyecto (GreenMail) para probar #22, F4 y #28.
#
#   scripts/correo-prueba.sh <remitente> <asunto> <cuerpo> [adjunto]
#
# Ejemplos:
#   scripts/correo-prueba.sh ana.gomez@demo.test "Solicitud de supletorio" "Solicito supletorio de Cálculo II..."
#   scripts/correo-prueba.sh desconocido@otro.test "Hola" "Quiero información"
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a

remitente=${1:?remitente}; asunto=${2:?asunto}; cuerpo=${3:?cuerpo}; adjunto=${4:-}

mensaje=$(REM=$remitente DEST=$BUZON_CORREO ASU=$asunto CUE=$cuerpo ADJ=$adjunto python3 -c '
import os, mimetypes
from email.message import EmailMessage
from email.utils import make_msgid, formatdate
m = EmailMessage()
m["From"], m["To"], m["Subject"] = os.environ["REM"], os.environ["DEST"], os.environ["ASU"]
m["Date"], m["Message-ID"] = formatdate(localtime=True), make_msgid()
m.set_content(os.environ["CUE"])
if os.environ["ADJ"]:
    tipo = (mimetypes.guess_type(os.environ["ADJ"])[0] or "application/octet-stream").split("/")
    with open(os.environ["ADJ"], "rb") as f:
        m.add_attachment(f.read(), maintype=tipo[0], subtype=tipo[1], filename=os.path.basename(os.environ["ADJ"]))
print(m.as_string())')

printf '%s\n' "$mensaje" | curl -sS --url smtp://127.0.0.1:3025 \
  --mail-from "$remitente" --mail-rcpt "$BUZON_CORREO" --upload-file -
echo "Correo de $remitente dejado en $BUZON_CORREO"
