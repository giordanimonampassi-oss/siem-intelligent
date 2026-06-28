#!/bin/sh
# Genere un certificat TLS auto-signe pour le mock server local.
# A relancer par chaque dev/VM : le certificat doit couvrir l'IP a laquelle
# les agents joignent reellement le mock server (IP de l'hote sur le reseau
# Host-Only VirtualBox, ex. 192.168.6.1 -- a adapter si la tienne differe).
#
# Usage : ./generate_cert.sh [IP_HOTE]
#   ./generate_cert.sh                # utilise 192.168.6.1 par defaut
#   ./generate_cert.sh 192.168.6.X    # pour un autre reseau Host-Only

IP_HOTE="${1:-192.168.6.1}"
DOSSIER="$(dirname "$0")"

openssl req -x509 -newkey rsa:2048 \
    -keyout "$DOSSIER/mock_server.key" \
    -out "$DOSSIER/mock_server.crt" \
    -days 825 -nodes \
    -subj "/CN=${IP_HOTE}" \
    -addext "subjectAltName=IP:${IP_HOTE},IP:127.0.0.1,DNS:localhost"

echo "Certificat genere : $DOSSIER/mock_server.crt (valide pour ${IP_HOTE}, 127.0.0.1, localhost)"
