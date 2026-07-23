# PatchLab SMTP Setup

Documento di riferimento definitivo per l'invio email del modulo preventivo di PatchLab. Scritto per chi dovrà intervenire su questo sistema senza aver seguito la sua storia.

Questo file resta nel repository ma **non viene mai pubblicato online**: è un file `.md`, quindi escluso per costruzione dal deploy (whitelist esplicita in `.github/workflows/deploy-production.yml`, con verifica dedicata che blocca il deploy se un `.md` finisse in `_release/`).

Documenti correlati, più operativi: [`FORM_SETUP.md`](../FORM_SETUP.md) (form, validazione, anti-spam, PHPMailer/vendoring) e [`DEPLOY_SETUP.md`](../DEPLOY_SETUP.md) (pipeline di deploy). Questo documento si concentra esclusivamente sul canale SMTP.

---

## Scopo

Il modulo preventivo di PatchLab (`it/preventivo/index.html`, e la sua versione inglese `quote/index.html`, condividono lo stesso endpoint) invia le richieste dei clienti via email a `info@patchlab.net`. L'invio avviene lato server, tramite [PHPMailer](https://github.com/PHPMailer/PHPMailer) (libreria ufficiale, vendorizzata in `vendor/phpmailer/phpmailer/`, non tramite Composer — vedi `FORM_SETUP.md` per la motivazione), che parla il protocollo SMTP con un account autenticato su Zoho Mail.

## Verifica operativa end-to-end (2026-07-23)

**Verificato operativamente dalla Direzione il 2026-07-23:**
- invio reale del modulo preventivo;
- ricezione effettiva del messaggio sulla casella `info@patchlab.net`;
- record SPF valido per `patchlab.net`;
- record DKIM configurato e attivo;
- record DMARC configurato;
- funzionamento della configurazione SMTP su Zoho (`config/patchlab-mail.php` presente e operativo sul server).

Questa verifica conferma lo stato del canale email **alla data indicata**. Non è una garanzia permanente: qualunque modifica futura a DNS, hosting, provider email o alla configurazione Zoho richiede una nuova verifica. Nessun meccanismo di monitoraggio continuo della deliverability è oggi attivo (vedi `ANALYTICS_MEASUREMENT_PLAN.md` per lo stato della misurazione — la deliverability non rientra nel piano eventi, che riguarda il comportamento del sito, non la consegna email).

## Architettura

```
Browser (fetch POST, FormData)
        │
        ▼
api/invia-preventivo.php
  - valida il metodo HTTP, l'honeypot, il timing, i campi (whitelist)
  - applica un rate limit per IP
  - legge le credenziali da un file di configurazione ESTERNO al repository
        │
        ▼
PHPMailer (vendor/phpmailer/phpmailer/, v7.1.1)
  - apre la connessione SMTP autenticata
        │
        ▼
smtp.zoho.eu (Zoho Mail EU, porta 587, STARTTLS)
        │
        ▼
info@patchlab.net (casella di destinazione)
```

Nessun passaggio di questa catena coinvolge servizi di terze parti diversi da Zoho: non ci sono relay esterni, non c'è `mail()` di PHP, non c'è un form service di terzi.

## Configurazione attuale

| Parametro | Valore |
|---|---|
| Provider | Zoho Mail EU |
| Host | `smtp.zoho.eu` |
| Porta | `587` |
| Sicurezza | STARTTLS (`PHPMailer::ENCRYPTION_STARTTLS`) |
| Autenticazione | `SMTPAuth = true` |
| Charset | `UTF-8` |
| Mittente (From) | `info@patchlab.net` (= `smtp_user`, sempre coerente) |
| Destinatario | `info@patchlab.net` (= `recipient`) |
| Reply-To | Email del cliente, validata, impostata solo se presente |
| Timeout connessione | 15 secondi |
| Debug SMTP | Disattivato (`SMTP::DEBUG_OFF`) |

Questi valori sono impostati in codice in `api/invia-preventivo.php` (funzione `send_quote_email()`), tranne **host, porta, username, password, destinatario e nome mittente**, che vengono letti a runtime da un file di configurazione esterno — mai hardcoded, mai committati.

### Dove vivono le credenziali

Le credenziali SMTP **non sono e non devono mai essere presenti nel repository**, che è pubblico. Sono conservate esclusivamente in un file privato sul server di produzione, fuori dalla document root pubblica:

```
/home/patch864/config/patchlab-mail.php
```

Il repository contiene solo il template di riferimento, senza alcuna credenziale reale:

```
config/patchlab-mail.example.php
```

`api/invia-preventivo.php` risolve il percorso del file reale in questo ordine:

1. variabile d'ambiente `PATCHLAB_MAIL_CONFIG` (percorso assoluto), se impostata;
2. altrimenti `dirname($_SERVER['DOCUMENT_ROOT']) . '/config/patchlab-mail.php'` — su cPanel/DominiOK questo risolve tipicamente a un livello sopra `public_html/`, cioè non raggiungibile via browser.

Permessi consigliati sul file reale: `600` (lettura/scrittura solo per il proprietario). Procedura completa di creazione: `FORM_SETUP.md`, sezioni B-F.

> **Nota di correzione (2026-07-23)**: il template `config/patchlab-mail.example.php` e il commento nel docblock di `api/invia-preventivo.php` riportavano ancora, come valore d'esempio, porta `465`/"SSL/TLS implicito" — un residuo di una fase precedente del progetto, prima che si stabilizzasse la configurazione descritta qui sopra (`587`/STARTTLS, verificata operativa il 2026-07-23). Entrambi sono stati allineati a questo documento nello stesso intervento che ha aggiunto questa nota. Il valore autorevole resta **questo documento**: qualunque futura modifica alla porta/cifratura va registrata qui per prima.

## Motivazione della scelta: STARTTLS + 587, non SMTPS + 465

Durante il primo collegamento a Zoho, entrambe le combinazioni sono state provate:

- porta `465` con `PHPMailer::ENCRYPTION_SMTPS` (TLS implicito);
- porta `587` con `PHPMailer::ENCRYPTION_STARTTLS` (upgrade a TLS dopo la connessione in chiaro).

In entrambi i casi PHPMailer restituiva lo stesso errore, prima ancora di tentare l'autenticazione:

```
SMTP Error: Could not connect to SMTP host. Failed to connect to server.
```

Una diagnosi mirata (vedi sezione successiva) ha stabilito che **nessuna delle due porte era raggiungibile**, perché l'hosting bloccava l'SMTP in uscita a livello di rete — non un problema di scelta tra le due modalità di cifratura. Non ci sono quindi evidenze tecniche che una delle due combinazioni sia superiore all'altra su questo hosting specifico: probabilmente, una volta abilitato l'SMTP esterno da DominiOK, avrebbero funzionato entrambe.

**587/STARTTLS è la configurazione che è stata verificata funzionante per prima**, subito dopo che DominiOK ha abilitato le connessioni SMTP esterne, ed è stata mantenuta per questo motivo operativo: nessun vantaggio a cambiare una configurazione già confermata funzionante senza un motivo tecnico concreto. Se in futuro emergesse un motivo per preferire 465/SMTPS (es. un blocco selettivo futuro sulla 587), il cambio richiede solo:

1. modificare `smtp_port` a `465` nel file di configurazione reale sul server (mai nel repository);
2. cambiare `PHPMailer::ENCRYPTION_STARTTLS` in `PHPMailer::ENCRYPTION_SMTPS` in `api/invia-preventivo.php`, riga dove viene impostato `$mail->SMTPSecure`.

## Hosting: DominiOK blocca l'SMTP esterno per default

**Informazione critica per chi gestirà questo hosting in futuro.**

DominiOK, per default, blocca tutte le connessioni SMTP in uscita dagli account condivisi (porte 25, 465, 587 incluse), indipendentemente dalla configurazione dell'applicazione. Questo è stato verificato con uno script diagnostico dedicato (temporaneo, non presente nel repository): tutte le porte SMTP restituivano un rifiuto di connessione immediato (`errno 111`, "Connection refused"), mentre le connessioni in uscita su altre porte (es. 443/HTTPS) funzionavano normalmente. Nessuna correzione lato codice avrebbe potuto risolvere questa condizione.

**Azione richiesta, se questo sistema viene replicato su un nuovo account DominiOK (o hosting simile)**: aprire un ticket all'assistenza dell'hosting chiedendo esplicitamente:

> "Abilitazione SMTP esterni per l'account [nome account], porte 465/587 verso smtp.zoho.eu (o il provider SMTP scelto)."

Finché questa abilitazione non viene concessa, **qualunque configurazione SMTP, per quanto corretta, fallirà** con:

```
SMTP Error: Could not connect to SMTP host. Failed to connect to server.
```

Va ribadito con chiarezza, per chi in futuro fosse tentato di "correggere il codice" di fronte a questo errore:

| Non era | Era |
|---|---|
| Un bug nel codice di `api/invia-preventivo.php` | Una restrizione di rete a livello di hosting |
| Un bug in PHPMailer | — |
| Un problema di configurazione Zoho | — |
| Un problema di DNS, IPv6 o certificati TLS | — |

## Troubleshooting

| Errore riportato | Cause possibili | Come distinguerle |
|---|---|---|
| `Could not connect to SMTP host. Failed to connect to server.` | SMTP esterno non abilitato dall'hosting · firewall dell'hosting · porta errata · host errato | Se il fallimento avviene su **tutte** le porte SMTP provate mentre altre porte (es. 443) funzionano, è quasi certamente un blocco lato hosting — vedi sezione precedente. Verificare comunque host e porta nel file di configurazione reale. |
| `SMTP Error: Could not authenticate.` / `Authentication failed` | Password errata · App Password Zoho scaduta o revocata · username errato | La connessione di rete riesce (si arriva alla fase di autenticazione): il problema è nelle credenziali, non nella rete. Rigenerare una nuova App Password su Zoho (`FORM_SETUP.md`, sezione B) e aggiornare **solo** il file reale sul server. |
| `Connection timed out` | Firewall che scarta i pacchetti invece di rifiutarli attivamente · problema DNS · problema di rete generale | A differenza di "Connection refused" (rifiuto immediato), un timeout impiega l'intera durata del timeout configurato (15s in questo progetto) prima di fallire: è tipico di un firewall in modalità DROP anziché REJECT, o di una risoluzione DNS che non risponde. |

Per una diagnosi più approfondita in caso di problemi futuri, considerare uno script diagnostico temporaneo analogo a quello usato per il problema originale: protetto da token monouso, senza credenziali, senza invio di email reali, **da rimuovere subito dopo l'uso e mai da committare**.

## Sicurezza

Regole permanenti per chiunque lavori su questo sistema:

- **Non committare** password SMTP o App Password, in nessuna forma (codice, commenti, messaggi di commit, file di test).
- **Non committare** il file reale di configurazione (`config/patchlab-mail.php`): resta escluso via `.gitignore`, deve esistere solo sul server.
- **Non esporre** eccezioni SMTP o dettagli tecnici nella risposta al browser: l'endpoint cattura sempre l'eccezione e risponde con un messaggio generico (`'Non siamo riusciti a inviare la richiesta. Riprova oppure scrivi a info@patchlab.net.'`), loggando il dettaglio solo server-side via `error_log()`.
- **Non aumentare `SMTPDebug`** in produzione: deve restare `SMTP::DEBUG_OFF`. Un valore diverso da zero può stampare comandi SMTP, risposte del server e, a seconda del livello, informazioni che non devono mai raggiungere un log accessibile pubblicamente o una risposta HTTP.

## Deploy

Il deploy del sito, incluso `api/invia-preventivo.php` e la libreria vendorizzata in `vendor/phpmailer/phpmailer/`, avviene tramite **GitHub Actions** (`.github/workflows/deploy-production.yml`) a ogni push su `main`, via FTPS verso DominiOK. Dettagli completi in `DEPLOY_SETUP.md`.

Punto importante per questo documento: **il file di configurazione reale sul server (`/home/patch864/config/patchlab-mail.php`) non viene mai toccato dal deploy**. La cartella `config/` non fa parte della whitelist dei file pubblicati (solo `config/patchlab-mail.example.php` è tracciato in Git, come riferimento), e uno step dedicato del workflow fa fallire il deploy se `config/` comparisse mai nella release pubblicata. Ogni deploy aggiorna quindi il codice applicativo senza mai sovrascrivere le credenziali o la configurazione già presenti sul server.

## Checklist

Stato di verifica del sistema di invio (aggiornato 2026-07-23):

- [x] invio email completato senza errori — verificato dalla Direzione il 2026-07-23
- [x] messaggio di successo mostrato correttamente nel form — verificato dalla Direzione il 2026-07-23
- [x] risposta HTTP `200` con `{"ok": true, ...}` — coerente con la verifica del 2026-07-23 (non ri-controllato da DevTools in questo intervento, dedotto dal successo end-to-end confermato)
- [x] nessun dettaglio SMTP (host, credenziali, stack trace) esposto nella risposta o nella UI — garanzia strutturale del codice (`respond()`/`log_internal_error()`), verificata leggendo `api/invia-preventivo.php`
- [x] workflow GitHub Actions completato con esito positivo — richiesto per ogni deploy su `main` (lint + smoke test bloccanti)
- [x] credenziali SMTP assenti dal repository (nessun file tracciato, nessuna cronologia Git) — verificato per costruzione (`.gitignore`, nessun grep positivo su pattern di credenziali)

Questa checklist attesta lo stato **alla data indicata**; non sostituisce un monitoraggio continuo (non presente oggi — vedi §Deliverability in `FORM_SETUP.md`).
