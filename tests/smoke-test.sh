#!/usr/bin/env bash
# Test funzionale minimo per api/invia-preventivo.php, senza inviare alcuna
# email reale (nessuna credenziale SMTP presente in questo ambiente, né in
# CI né in locale, per costruzione).
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
#
# ============================================================================
# Semantica dei test: cosa è un PASS, cosa è un FAIL
# ============================================================================
#
# In questo ambiente (locale o CI) config/patchlab-mail.php NON esiste MAI:
# è escluso da .gitignore e non viene mai creato automaticamente. Questo è
# INTENZIONALE: l'endpoint, in assenza di configurazione, deve rispondere
# con un HTTP 500 controllato e onesto ("Servizio temporaneamente non
# disponibile"), non con un invio reale (che qui non potrebbe comunque
# avvenire) né con un errore incontrollato.
#
# Per il test "dati validi ma configurazione SMTP assente":
#   PASS = HTTP 500 + risposta JSON pulita, senza fughe di informazioni
#   FAIL = qualunque di questi, indipendentemente dal codice HTTP:
#     - il corpo della risposta non è JSON valido
#     - il corpo è vuoto (sintomo tipico di un crash/fatal error PHP)
#     - il corpo contiene uno stack trace o un messaggio di errore PHP grezzo
#     - il corpo contiene un frammento di credenziale (es. "smtp_password")
#     - il codice HTTP non è quello atteso per QUEL test specifico
#
# La stessa logica si applica a ogni altro test di questo script: ognuno ha
# un proprio codice HTTP atteso (405, 400, 429 o 500 a seconda del caso), e
# il PASS richiede sia il codice corretto sia una risposta pulita.

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

# is_valid_json BODY -> 0 se JSON valido e non vuoto, 1 altrimenti
is_valid_json() {
  php -r '
    $raw = stream_get_contents(STDIN);
    if ($raw === false || trim($raw) === "") {
        exit(1);
    }
    $decoded = json_decode($raw, true);
    exit(json_last_error() === JSON_ERROR_NONE && is_array($decoded) ? 0 : 1);
  ' <<< "$1"
}

# Pattern che non devono MAI comparire in una risposta pubblica, in nessun
# test: indicano una fuga di informazioni interne o un errore non gestito
# dal codice applicativo (che invece cattura sempre le eccezioni e risponde
# con un messaggio generico tramite respond()).
contains_suspicious_string() {
  local body="$1"
  echo "$body" | grep -qiE \
    "smtp_password|smtp_user|Password['\"]?\s*=|Fatal error|Uncaught|Stack trace|Warning:|Deprecated:|Notice:|Parse error| on line [0-9]|\.php:[0-9]"
}

# check DESCRIZIONE EXPECTED_STATUS ACTUAL_STATUS BODY
#
# PASS solo se: il codice HTTP è esattamente quello atteso per questo test,
# la risposta è JSON valido e non vuoto, e non contiene nessun pattern
# sospetto. Un HTTP 500 "controllato" (es. configurazione SMTP assente) è
# un PASS legittimo quando è ESPLICITAMENTE il codice atteso per quel test:
# non viene mai trattato come fallimento solo perché è un 5xx.
check() {
  local description="$1"
  local expected_status="$2"
  local actual_status="$3"
  local body="$4"

  local failure_reasons=()

  if [ -z "$actual_status" ]; then
    failure_reasons+=("nessuna risposta HTTP ricevuta (connessione fallita o server non raggiungibile)")
  elif [ "$actual_status" != "$expected_status" ]; then
    failure_reasons+=("codice HTTP errato: atteso $expected_status, ricevuto $actual_status")
  fi

  if [ -z "$body" ]; then
    failure_reasons+=("corpo della risposta vuoto (possibile fatal error PHP)")
  elif ! is_valid_json "$body"; then
    failure_reasons+=("corpo della risposta non è JSON valido: $body")
  fi

  if [ -n "$body" ] && contains_suspicious_string "$body"; then
    failure_reasons+=("la risposta contiene un pattern sospetto (stack trace, warning o credenziale)")
  fi

  if [ "${#failure_reasons[@]}" -eq 0 ]; then
    echo "PASS  $description (HTTP $actual_status)"
    PASS=$((PASS + 1))
  else
    echo "FAIL  $description"
    for reason in "${failure_reasons[@]}"; do
      echo "        - $reason"
    done
    if [ -n "$body" ]; then
      echo "        corpo ricevuto: $body"
    fi
    FAIL=$((FAIL + 1))
  fi
}

old_ts=$(( $(now_ms) - 600000 )) # 10 minuti fa: passa il controllo timing

# 1. GET -> 405 (metodo non consentito)
status=$(curl -s -o /tmp/smoke-body.$$ -w "%{http_code}" -X GET "$ENDPOINT")
body=$(cat /tmp/smoke-body.$$ 2>/dev/null); rm -f /tmp/smoke-body.$$
check "GET non consentito" "405" "$status" "$body"

# 2. POST vuoto (nessun campo obbligatorio) -> 400
status=$(curl -s -o /tmp/smoke-body.$$ -w "%{http_code}" -X POST "$ENDPOINT" \
  -F "sito-web=" -F "ts_apertura=$old_ts")
body=$(cat /tmp/smoke-body.$$ 2>/dev/null); rm -f /tmp/smoke-body.$$
check "POST senza campi obbligatori" "400" "$status" "$body"

# 3. Email non valida -> 400
status=$(curl -s -o /tmp/smoke-body.$$ -w "%{http_code}" -X POST "$ENDPOINT" \
  -F "sito-web=" -F "ts_apertura=$old_ts" \
  -F "nome=Mario Rossi" -F "email=non-e-una-email" \
  -F "tipo-patch=ricamata" -F "quantita=100 pezzi")
body=$(cat /tmp/smoke-body.$$ 2>/dev/null); rm -f /tmp/smoke-body.$$
check "Email non valida" "400" "$status" "$body"

# 4. Campo troppo lungo -> 400 (nome oltre 150 caratteri)
long_name=$(printf 'A%.0s' $(seq 1 200))
status=$(curl -s -o /tmp/smoke-body.$$ -w "%{http_code}" -X POST "$ENDPOINT" \
  -F "sito-web=" -F "ts_apertura=$old_ts" \
  -F "nome=$long_name" -F "email=cliente@example.com" \
  -F "tipo-patch=ricamata" -F "quantita=100 pezzi")
body=$(cat /tmp/smoke-body.$$ 2>/dev/null); rm -f /tmp/smoke-body.$$
check "Campo nome troppo lungo" "400" "$status" "$body"

# 5. Honeypot compilato -> 429
status=$(curl -s -o /tmp/smoke-body.$$ -w "%{http_code}" -X POST "$ENDPOINT" \
  -F "sito-web=spam" -F "ts_apertura=$old_ts" \
  -F "nome=Mario Rossi" -F "email=cliente@example.com" \
  -F "tipo-patch=ricamata" -F "quantita=100 pezzi")
body=$(cat /tmp/smoke-body.$$ 2>/dev/null); rm -f /tmp/smoke-body.$$
check "Honeypot compilato" "429" "$status" "$body"

# 6. Invio troppo rapido -> 429 (ts_apertura = adesso)
recent_ts=$(now_ms)
status=$(curl -s -o /tmp/smoke-body.$$ -w "%{http_code}" -X POST "$ENDPOINT" \
  -F "sito-web=" -F "ts_apertura=$recent_ts" \
  -F "nome=Mario Rossi" -F "email=cliente@example.com" \
  -F "tipo-patch=ricamata" -F "quantita=100 pezzi")
body=$(cat /tmp/smoke-body.$$ 2>/dev/null); rm -f /tmp/smoke-body.$$
check "Invio troppo rapido" "429" "$status" "$body"

# 7. Dati validi, ma nessuna configurazione SMTP presente in questo ambiente
#    -> 500 CONTROLLATO. Questo è il comportamento CORRETTO e ATTESO: in
#    CI/locale config/patchlab-mail.php non esiste per costruzione (nessuna
#    credenziale reale in questo repository). Il test verifica che
#    l'assenza di configurazione produca un errore pulito — non un crash,
#    non uno stack trace, non un tentativo di invio — non che l'invio
#    riesca (impossibile senza credenziali, e non è lo scopo di questo test).
status=$(curl -s -o /tmp/smoke-body.$$ -w "%{http_code}" -X POST "$ENDPOINT" \
  -F "sito-web=" -F "ts_apertura=$old_ts" \
  -F "nome=Mario Rossi" -F "azienda=ACME Srl" -F "email=cliente@example.com" \
  -F "telefono=+39 333 1234567" -F "tipo-patch=ricamata" -F "applicazione=velcro" \
  -F "quantita=100 pezzi" -F "note=Progetto di prova, nessun invio reale.")
body=$(cat /tmp/smoke-body.$$ 2>/dev/null); rm -f /tmp/smoke-body.$$
check "Dati validi, configurazione SMTP assente (500 atteso e corretto)" "500" "$status" "$body"

echo ""
echo "Risultato: $PASS superati, $FAIL falliti."
[ "$FAIL" -eq 0 ]
