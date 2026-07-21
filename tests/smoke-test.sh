#!/usr/bin/env bash
# Test funzionale minimo per api/invia-preventivo.php, senza inviare alcuna
# email reale (nessuna credenziale SMTP presente in questo ambiente).
#
# Uso: tests/smoke-test.sh [base_url]
#   base_url di default: http://127.0.0.1:8000
#
# Pensato per girare contro il server integrato di PHP:
#   PATCHLAB_RATE_LIMIT_SECONDS=0 php -S 127.0.0.1:8000 &
#   tests/smoke-test.sh
#
# PATCHLAB_RATE_LIMIT_SECONDS=0 disabilita il cooldown per IP, altrimenti
# le richieste consecutive di questo script (tutte dallo stesso IP locale)
# si bloccherebbero a vicenda dopo la prima.

set -u

BASE_URL="${1:-http://127.0.0.1:8000}"
ENDPOINT="$BASE_URL/api/invia-preventivo.php"

PASS=0
FAIL=0

# Verifica che php sia disponibile per validare il JSON delle risposte.
if ! command -v php >/dev/null 2>&1; then
  echo "ERRORE: php non trovato, impossibile validare le risposte JSON." >&2
  exit 1
fi

now_ms() {
  php -r 'echo (int) (microtime(true) * 1000);'
}

# is_valid_json BODY -> 0 se valido, 1 altrimenti
is_valid_json() {
  php -r '
    $raw = stream_get_contents(STDIN);
    $decoded = json_decode($raw, true);
    exit(json_last_error() === JSON_ERROR_NONE && is_array($decoded) ? 0 : 1);
  ' <<< "$1"
}

contains_suspicious_string() {
  local body="$1"
  echo "$body" | grep -qiE "smtp_password|Fatal error|Stack trace|Warning:|Notice:| on line [0-9]"
}

check() {
  local description="$1"
  local expected_status="$2"
  local actual_status="$3"
  local body="$4"

  local ok=1

  if [ "$actual_status" != "$expected_status" ]; then
    echo "FAIL  $description — atteso HTTP $expected_status, ricevuto $actual_status"
    ok=0
  fi

  if ! is_valid_json "$body"; then
    echo "FAIL  $description — risposta non è JSON valido: $body"
    ok=0
  fi

  if contains_suspicious_string "$body"; then
    echo "FAIL  $description — la risposta contiene un pattern sospetto (credenziale/stack trace)"
    ok=0
  fi

  if [ "$ok" -eq 1 ]; then
    echo "PASS  $description (HTTP $actual_status)"
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
  fi
}

old_ts=$(( $(now_ms) - 600000 )) # 10 minuti fa: passa il controllo timing

# 1. GET -> 405
status=$(curl -s -o /tmp/smoke-body.$$ -w "%{http_code}" -X GET "$ENDPOINT")
body=$(cat /tmp/smoke-body.$$); rm -f /tmp/smoke-body.$$
check "GET non consentito" "405" "$status" "$body"

# 2. POST vuoto (nessun campo) -> 400
status=$(curl -s -o /tmp/smoke-body.$$ -w "%{http_code}" -X POST "$ENDPOINT" \
  -F "sito-web=" -F "ts_apertura=$old_ts")
body=$(cat /tmp/smoke-body.$$); rm -f /tmp/smoke-body.$$
check "POST senza campi obbligatori" "400" "$status" "$body"

# 3. Email non valida -> 400
status=$(curl -s -o /tmp/smoke-body.$$ -w "%{http_code}" -X POST "$ENDPOINT" \
  -F "sito-web=" -F "ts_apertura=$old_ts" \
  -F "nome=Mario Rossi" -F "email=non-e-una-email" \
  -F "tipo-patch=ricamata" -F "quantita=100 pezzi")
body=$(cat /tmp/smoke-body.$$); rm -f /tmp/smoke-body.$$
check "Email non valida" "400" "$status" "$body"

# 4. Campo troppo lungo -> 400 (nome oltre 150 caratteri)
long_name=$(printf 'A%.0s' $(seq 1 200))
status=$(curl -s -o /tmp/smoke-body.$$ -w "%{http_code}" -X POST "$ENDPOINT" \
  -F "sito-web=" -F "ts_apertura=$old_ts" \
  -F "nome=$long_name" -F "email=cliente@example.com" \
  -F "tipo-patch=ricamata" -F "quantita=100 pezzi")
body=$(cat /tmp/smoke-body.$$); rm -f /tmp/smoke-body.$$
check "Campo nome troppo lungo" "400" "$status" "$body"

# 5. Honeypot compilato -> 429
status=$(curl -s -o /tmp/smoke-body.$$ -w "%{http_code}" -X POST "$ENDPOINT" \
  -F "sito-web=spam" -F "ts_apertura=$old_ts" \
  -F "nome=Mario Rossi" -F "email=cliente@example.com" \
  -F "tipo-patch=ricamata" -F "quantita=100 pezzi")
body=$(cat /tmp/smoke-body.$$); rm -f /tmp/smoke-body.$$
check "Honeypot compilato" "429" "$status" "$body"

# 6. Invio troppo rapido -> 429 (ts_apertura = adesso)
recent_ts=$(now_ms)
status=$(curl -s -o /tmp/smoke-body.$$ -w "%{http_code}" -X POST "$ENDPOINT" \
  -F "sito-web=" -F "ts_apertura=$recent_ts" \
  -F "nome=Mario Rossi" -F "email=cliente@example.com" \
  -F "tipo-patch=ricamata" -F "quantita=100 pezzi")
body=$(cat /tmp/smoke-body.$$); rm -f /tmp/smoke-body.$$
check "Invio troppo rapido" "429" "$status" "$body"

# 7. Dati validi, ma nessuna configurazione SMTP presente in questo ambiente
#    di test -> 500 controllato (mai un invio reale, nessuna credenziale
#    disponibile). Verifica anche che la risposta resti JSON pulito.
status=$(curl -s -o /tmp/smoke-body.$$ -w "%{http_code}" -X POST "$ENDPOINT" \
  -F "sito-web=" -F "ts_apertura=$old_ts" \
  -F "nome=Mario Rossi" -F "azienda=ACME Srl" -F "email=cliente@example.com" \
  -F "telefono=+39 333 1234567" -F "tipo-patch=ricamata" -F "applicazione=velcro" \
  -F "quantita=100 pezzi" -F "note=Progetto di prova, nessun invio reale.")
body=$(cat /tmp/smoke-body.$$); rm -f /tmp/smoke-body.$$
check "Dati validi, config SMTP assente" "500" "$status" "$body"

echo ""
echo "Risultato: $PASS superati, $FAIL falliti."
[ "$FAIL" -eq 0 ]
