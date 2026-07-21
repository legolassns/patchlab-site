# FORM_SETUP — Modulo Preventivo PatchLab

Questo documento resta nel repository ma **non viene mai pubblicato online** (escluso dal deploy, whitelist esplicita in `.github/workflows/deploy-production.yml`).

---

## 0. Stato attuale: ATTIVO (dallo sprint di attivazione SMTP)

Il modulo preventivo invia realmente le richieste a `info@patchlab.net` tramite SMTP autenticato su Zoho Mail Europa. Non è più nello stato "solo lato client" degli sprint precedenti.

**Perché non serve prima abilitare nulla lato codice**: tutto il codice (endpoint PHP, JS, HTML, CSS) è già pronto e pubblicato. L'unico passaggio mancante è **operativo**: creare sul server il file di configurazione reale con le credenziali SMTP (sezione C). Finché quel file non esiste, l'endpoint risponde con un errore 500 controllato e onesto ("Servizio temporaneamente non disponibile") — non finge mai un invio riuscito.

---

## A. File creati e modificati

**Creati**:
- `api/invia-preventivo.php` — endpoint pubblico, riceve il POST del form e invia l'email tramite **PHPMailer** (vedi sezione "PHPMailer" sotto).
- `config/patchlab-mail.example.php` — template di configurazione, **senza credenziali reali**, tracciato nel repository come riferimento. Mai deployato (vedi sezione D).
- `.gitignore` — esclude `config/patchlab-mail.php` (il file reale con le credenziali) dal tracking Git.
- `vendor/phpmailer/phpmailer/src/{Exception,PHPMailer,SMTP}.php` + `vendor/phpmailer/phpmailer/LICENSE` — PHPMailer ufficiale vendorizzato (vedi sezione "PHPMailer").
- `tests/smoke-test.sh` — test funzionale dell'endpoint (nessun invio email reale), eseguito in CI prima del deploy (vedi sezione "Test PHP in CI").

**Modificati**:
- `it/preventivo/index.html` — `method="post"` + `action="/api/invia-preventivo.php"` sul form (fallback se JS non esegue); campo honeypot (`sito-web`, visivamente nascosto ma presente nell'albero di accessibilità); campo nascosto `ts_apertura` (timestamp anti-bot); contenitore unico `#form-feedback` per i messaggi di successo/errore; testo privacy essenziale; corretta l'incoerenza che parlava di "file allegato" nella sezione "Cosa succede dopo l'invio" (il form non gestisce allegati in questa fase).
- `main.js` — `initQuoteForm()` riscritta: validazione client (campi obbligatori + formato email), invio via `fetch` con `FormData`, timeout di rete, bottone disabilitato con testo "Invio in corso…" durante l'invio, nessun reset del form prima di una conferma reale dal server, messaggi di successo/errore distinti, prevenzione doppio invio, rimozione dinamica degli errori visivi quando l'utente corregge un campo, focus sul messaggio di esito.
- `style.css` — nuovi token `--color-danger-bg`/`--color-danger-border`; `.form-success` sostituita da `.form-feedback` con varianti `.form-feedback--success`/`.form-feedback--error` (riuso dei token `--color-success-*` già presenti e finora inutilizzati); stile per bottone disabilitato. Il campo honeypot riusa l'utility `.u-sr-only` già esistente, nessuna nuova classe per quello.
- `.github/workflows/deploy-production.yml` — `api/` e `vendor/` aggiunte alla whitelist di `_release/`; verifica esplicita che `config/` non compaia mai in `_release/`; controllo pattern per credenziali SMTP hardcoded nei file PHP pubblicati; nuovi step "Setup PHP", lint PHP (`php -l`) e test funzionale dell'endpoint eseguiti **prima** del deploy, che lo interrompono se falliscono.

## B. Come creare una password per applicazione Zoho

Zoho Mail richiede una "password per applicazione" dedicata per l'accesso SMTP autenticato (non la password personale dell'account):

1. Accedi a [Zoho Mail](https://mail.zoho.eu) con l'account `info@patchlab.net`.
2. Vai su **Impostazioni account** (icona profilo) → **Sicurezza** → **Password per applicazioni** (in inglese: "Application-Specific Passwords").
3. Genera una nuova password per applicazione, dandole un nome riconoscibile (es. "PatchLab form preventivo — DominiOK").
4. Copia la password generata **subito**: Zoho la mostra una sola volta.
5. Questa è la password da inserire come `smtp_password` nel file di configurazione reale (sezione C) — **mai** la password di accesso alla casella.

Se in futuro serve revocare l'accesso, la stessa pagina Zoho permette di eliminare la password per applicazione senza toccare la password principale dell'account.

## C. Come creare sul server il file reale di configurazione

Il template senza credenziali è `config/patchlab-mail.example.php` nel repository. Il file **reale**, con le credenziali vere, va creato **manualmente sul server**, non nel repository:

1. Connettiti al server DominiOK (FTP/FTPS con l'account principale, o File Manager di cPanel — non l'account FTP dedicato `deploy@patchlab.net`, che è limitato a `public_html/`).
2. Crea la cartella `config/` **fuori da `public_html/`** (vedi sezione D per il percorso esatto).
3. Crea al suo interno un file `patchlab-mail.php` con questo contenuto, sostituendo i valori segnaposto:

```php
<?php
return [
    'smtp_host' => 'smtp.zoho.eu',
    'smtp_port' => 465,
    'smtp_user' => 'info@patchlab.net',
    'smtp_password' => 'INCOLLA_QUI_LA_PASSWORD_PER_APPLICAZIONE',
    'recipient' => 'info@patchlab.net',
    'from_name' => 'PatchLab',
];
```

4. Salva il file. Non condividerlo, non incollarlo in chat, non committarlo nel repository (il `.gitignore` lo esclude già se per errore finisse dentro la cartella del progetto).

## D. Dove posizionarlo rispetto a public_html

Su cPanel/DominiOK, `DOCUMENT_ROOT` è tipicamente `/home/USERNAME/public_html` (per PatchLab: confermato `/home/patch864/public_html` nello Sprint 11.1). L'endpoint risolve il percorso della configurazione così:

1. Se la variabile d'ambiente `PATCHLAB_MAIL_CONFIG` è impostata (vedi sezione E), usa quel percorso assoluto, qualunque esso sia.
2. Altrimenti usa `dirname($_SERVER['DOCUMENT_ROOT']) . '/config/patchlab-mail.php'`, che per PatchLab risolve a:

```
/home/patch864/config/patchlab-mail.php
```

cioè un livello sopra `public_html/`, **non raggiungibile via browser** — nessun rischio che il file di configurazione venga servito pubblicamente per errore.

Il file va quindi creato esattamente in `/home/patch864/config/patchlab-mail.php`. La cartella `config/` va creata se non esiste già (di norma non esiste, va creata al primo setup).

## E. Come indicare il percorso all'endpoint (solo se il default non va bene)

Il comportamento di default (sezione D) funziona senza alcuna configurazione aggiuntiva, finché `DOCUMENT_ROOT` è effettivamente `.../public_html`. Se in futuro l'hosting cambiasse struttura, o si preferisse un percorso diverso, si può impostare la variabile d'ambiente `PATCHLAB_MAIL_CONFIG` con il percorso assoluto del file — su cPanel questo si fa tipicamente da **Software → Setup PHP** (variabili d'ambiente per il dominio) o in un `.htaccess`/`.user.ini` con `env[PATCHLAB_MAIL_CONFIG] = /percorso/scelto/patchlab-mail.php` a seconda di cosa il pannello DominiOK espone. Non necessario per il setup iniziale.

## F. Permessi consigliati del file

- `config/patchlab-mail.php`: permessi **600** (lettura/scrittura solo per il proprietario del file, cioè l'utente cPanel `patch864`). Da impostare via File Manager (proprietà file) o FTP (`chmod 600`).
- La cartella `config/`: permessi **700** (accesso solo al proprietario), sufficiente e coerente.
- Verificare che l'utente con cui gira PHP (tipicamente lo stesso utente cPanel su hosting condiviso con PHP-FPM/suPHP) corrisponda al proprietario del file, altrimenti l'endpoint non riuscirà a leggerlo nonostante i permessi.

## G. Come effettuare un test end-to-end

1. Verifica che `config/patchlab-mail.php` esista sul server con le credenziali corrette (sezioni C-F).
2. Apri `https://patchlab.net/it/preventivo/` (o l'URL temporaneo attivo) e compila il form con dati di prova realistici, **senza** compilare il campo honeypot (invisibile, non farlo apparire manualmente).
3. Invia. Il bottone deve mostrare "Invio in corso…" e disabilitarsi brevemente.
4. Deve comparire il messaggio "Grazie, abbiamo ricevuto la tua richiesta..." e il form deve svuotarsi.
5. Controlla la casella `info@patchlab.net` (sezione H) per la ricezione effettiva.

Se qualcosa fallisce, il messaggio mostrato è sempre generico ("Non siamo riusciti a inviare la richiesta...") — il dettaglio tecnico va cercato nei log del server (vedi sezione Troubleshooting in `DEPLOY_SETUP.md`), mai nella risposta al browser.

## H. Come verificare

- **Ricezione su info@patchlab.net**: dopo il test in sezione G, l'email deve arrivare con oggetto "Nuova richiesta preventivo PatchLab — [Nome o Azienda]" e tutti i campi leggibili (data/ora, nome, azienda, email, telefono, tipologia, applicazione, quantità, note).
- **Reply-To corretto**: rispondendo all'email ricevuta, il destinatario della risposta deve essere l'email inserita nel form dal cliente di prova, non `info@patchlab.net`.
- **Mancato ingresso nello spam**: controllare la cartella spam di `info@patchlab.net` nei primi test. Se l'email finisce in spam, il problema è quasi certamente di deliverability (SPF/DKIM/DMARC) — vedi sezione 11 sotto e la nota nel Decision Log privato: non è un problema del codice del form.
- **Gestione errori**: prova a inviare con `config/patchlab-mail.php` temporaneamente rinominato (o assente) — deve arrivare l'errore generico via JSON, HTTP 500, senza stack trace nella risposta; nei log del server (`error_log`) deve comparire il dettaglio tecnico.
- **Blocco honeypot**: da browser non è visibile né compilabile normalmente; per testarlo serve simulare una richiesta diretta all'endpoint con il campo `sito-web` valorizzato (es. con uno strumento come `curl` o Postman) — deve rispondere HTTP 429 senza inviare alcuna email.
- **Blocco invio troppo veloce**: con lo stesso tipo di richiesta diretta, inviando `ts_apertura` con un valore di pochi millisecondi fa, deve rispondere HTTP 429.
- **Doppio click**: cliccando rapidamente due volte "Invia richiesta", deve partire una sola richiesta (il bottone si disabilita immediatamente al primo click).
- **Form da mobile**: verificare che il form sia compilabile e leggibile su schermi stretti (già coperto dal responsive esistente, non modificato in questo intervento) e che il messaggio di esito sia visibile senza scroll orizzontale.

## I. Procedura di rollback

Se il form attivo causa problemi (es. troppe email di spam, errori ricorrenti):

1. **Rollback rapido, senza toccare il codice**: rinominare o spostare `config/patchlab-mail.php` sul server (fuori dalla cartella `config/`). L'endpoint tornerà a rispondere con l'errore controllato 500 "Servizio temporaneamente non disponibile" — il form smette di inviare email reali ma il sito resta funzionante e onesto (nessun invio simulato). Il fallback `mailto:info@patchlab.net` in ogni pagina resta comunque disponibile.
2. **Rollback completo del codice**: `git revert` del commit che ha introdotto l'endpoint, poi `git push origin main` — il prossimo deploy automatico rimuove `api/` da `_release/` e il form torna al comportamento precedente (nessun endpoint, nessun invio). Non modifica il file di configurazione reale sul server, che resta lì ma diventa inutilizzato.
3. In entrambi i casi, nessuna azione distruttiva sul server è necessaria: il file di configurazione può restare dov'è senza rischio, dato che non è mai raggiungibile via browser (sezione D).

## Antispam e limiti tecnici

- **Honeypot**: campo `sito-web`, invisibile e fuori dal tab-order (`tabindex="-1"`, utility `.u-sr-only`). Se compilato, l'endpoint risponde 429 senza inviare nulla.
- **Timing**: campo nascosto `ts_apertura` (timestamp client in millisecondi, impostato da `main.js` all'apertura del form). L'endpoint rifiuta con 429 le richieste arrivate a meno di 3 secondi dall'apertura — soglia euristica, basata sull'orologio del server: eventuali scostamenti di orologio client/server possono rendere il controllo leggermente impreciso, accettabile per un filtro di secondo livello.
- **Rate limiting per IP**: un file JSON privato (`patchlab-mail-ratelimit.json`, nella stessa cartella del file di configurazione) registra l'hash SHA-256 dell'IP e l'ultimo invio accettato; un nuovo invio dallo stesso IP prima di 20 secondi riceve 429. Se il file non è scrivibile, il controllo viene saltato silenziosamente (loggato) senza bloccare il form: non è la barriera principale, lo sono honeypot e timing.
- **Validazione campi**: whitelist esplicita di 8 campi (nome, azienda, email, telefono, tipo-patch, applicazione, quantita, note), ciascuno con limite di lunghezza, tipo atteso ed enumerazione dove pertinente (tipo-patch, applicazione). Nessun campo arbitrario viene mai accettato o inoltrato.
- **Header injection**: ogni campo usato per comporre header email (Subject, Reply-To) viene ripulito da `\r`/`\n` e caratteri di controllo prima dell'uso.

## Allegati

Non implementati in questa fase, per scelta esplicita (vedi vincoli). Il form non ha campo di upload; il testo della pagina che parlava di "file allegato" è stato corretto per non descrivere una funzione inesistente (vedi sezione A).

## Privacy

Il form raccoglie dati identificativi (nome, azienda, email, telefono, note) e li invia via email a `info@patchlab.net` per la sola finalità di rispondere alla richiesta di preventivo. Un testo essenziale in tal senso è stato aggiunto vicino al bottone di invio. Una eventuale informativa privacy dedicata più estesa resta una decisione da valutare con Stefano, non introdotta autonomamente in questo intervento.

## 11. Deliverability

Non modificato in questo intervento (nessuna modifica DNS/MX/SPF/DKIM/DMARC). Ora che il form invia realmente tramite SMTP Zoho, questo punto diventa più urgente da verificare con Stefano prima di considerare il canale pienamente affidabile in produzione:

- record MX per `patchlab.net` (deve puntare a Zoho, se la casella è lì ospitata);
- SPF che autorizzi `smtp.zoho.eu` come mittente per il dominio `patchlab.net`;
- DKIM configurato per il dominio su Zoho;
- DMARC coerente con SPF/DKIM;
- test reale di arrivo in inbox (non spam) da più provider destinatari diversi (Gmail, Outlook, ecc.), non solo verso `info@patchlab.net` stesso.

Questa parte resta esplicitamente demandata a una decisione/verifica separata di Stefano.

## 12. Evoluzioni future

1. Messaggi di errore per-campo più dettagliati lato client (oggi solo stato visivo `.field-error` sul campo, messaggio generico nel box di esito).
2. Eventuale gestione allegati, solo dopo una progettazione dedicata (dimensione, MIME type, quarantena — vedi vincoli di sicurezza già discussi in sprint precedenti).
3. Verifica e rafforzamento della deliverability (sezione 11).
4. Eventuale adozione di Composer se in futuro il progetto crescesse oltre PHPMailer (oggi non necessario: vedi sezione PHPMailer).

## PHPMailer — provenienza, versione, integrità, aggiornamento

**Storia**: la prima versione del form (prima dell'hardening) usava un client SMTP scritto ad hoc (socket TLS, AUTH LOGIN manuale, MIME manuale), motivato all'epoca dall'assenza di Composer e dall'impossibilità di verificare l'integrità byte-per-byte di una libreria di terze parti con gli strumenti disponibili in quella sessione. **Quel client è stato completamente rimosso** e sostituito da PHPMailer ufficiale, su richiesta esplicita: non si mantiene in produzione un protocollo SMTP proprietario quando è disponibile una libreria consolidata.

**Provenienza**: repository ufficiale [`PHPMailer/PHPMailer`](https://github.com/PHPMailer/PHPMailer) su GitHub. Nessun codice copiato da blog, snippet, fork o risposte generate.

**Versione fissata**: tag `v7.1.1`, commit `1bc1716a507a65e039d4ac9d9adebbbd0d346e15`. Compatibile PHP ≥5.5 (dichiarato nel `composer.json` ufficiale del tag), quindi senza rischio di incompatibilità con la versione PHP di DominiOK (non nota con certezza, ma qualunque versione moderna è coperta).

**Come è stato verificato l'integrità**: i file sono stati ottenuti con `git clone --depth 1 --branch v7.1.1 https://github.com/PHPMailer/PHPMailer.git` (clone diretto via protocollo Git, non tramite strumenti che riassumono/processano il contenuto). L'hash del commit clonato (`git rev-parse HEAD`) è stato confrontato con quello riportato dalla API pubblica di GitHub per lo stesso tag (`api.github.com/repos/PHPMailer/PHPMailer/tags`) — **identico**. I 3 file runtime necessari e la licenza sono stati copiati dal clone verificato senza alcuna modifica: un diff tra i file nel repository PatchLab e quelli nel clone risulta vuoto.

**File pubblicati** (whitelist esplicita nel workflow, esattamente questi e nessun altro):
```
vendor/phpmailer/phpmailer/LICENSE
vendor/phpmailer/phpmailer/src/Exception.php
vendor/phpmailer/phpmailer/src/PHPMailer.php
vendor/phpmailer/phpmailer/src/SMTP.php
```
Nessun file di esempio, test, documentazione (`README`, `CHANGELOG`), `composer.json` o file di sviluppo del repository PHPMailer è stato incluso: solo le 3 classi runtime richieste (`Exception`, `PHPMailer`, `SMTP`, namespace `PHPMailer\PHPMailer`) più la licenza LGPL-2.1 (inclusa per correttezza di attribuzione, dato che il codice viene ridistribuito).

**Come viene incluso nell'endpoint** (nessun autoloader Composer, `require_once` diretti — pattern ufficialmente supportato da PHPMailer per chi non usa Composer):
```php
require_once __DIR__ . '/../vendor/phpmailer/phpmailer/src/Exception.php';
require_once __DIR__ . '/../vendor/phpmailer/phpmailer/src/PHPMailer.php';
require_once __DIR__ . '/../vendor/phpmailer/phpmailer/src/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as PHPMailerException;
```

**Configurazione SMTP usata** (invariata rispetto a prima, solo il meccanismo di invio è cambiato):
- `isSMTP()`, `Host = smtp.zoho.eu`, `SMTPAuth = true`, `SMTPSecure = PHPMailer::ENCRYPTION_SMTPS` (TLS implicito), `Port = 465`
- `CharSet = PHPMailer::CHARSET_UTF8`, `Timeout = 15`, `SMTPKeepAlive = false`
- `SMTPDebug = 0` e `Debugoutput` impostato a una funzione vuota: nessun dettaglio di protocollo o credenziale può mai comparire in output o nei log
- `Username`/`Password` letti esclusivamente da `$mailConfig` (file esterno al repository, vedi sezioni C-F)
- `setFrom(info@patchlab.net, 'PatchLab')`, `addAddress(info@patchlab.net)` (destinatario fisso), `addReplyTo($email cliente validata)`
- `isHTML(true)`, `Body` (HTML) e `AltBody` (testo) entrambi impostati
- Eccezioni di PHPMailer (`PHPMailerException`) catturate e rilanciate come `SmtpException` interna, con messaggio generico al pubblico (mai `getMessage()` di PHPMailer esposto direttamente nella risposta JSON)

**Cosa è stato rimosso** da `api/invia-preventivo.php`: le funzioni `smtp_read_response()`, `smtp_command()`, `smtp_dot_stuff()`, `wrap_base64()`, `encode_mime_header()`, e tutto il corpo socket/AUTH LOGIN/MIME manuale precedentemente dentro `send_quote_email()`. Tutto il resto (whitelist campi, honeypot, timing, rate limit, validazione, risposte JSON, codici HTTP) è rimasto invariato.

**Test PHP in CI**: il workflow (`.github/workflows/deploy-production.yml`) esegue, prima di qualunque preparazione del deploy:
1. Setup di un interprete PHP reale (`shivammathur/setup-php@2.37.2`, versione fissata, PHP 8.2).
2. `php -l` su ogni file `.php` del progetto (`api/invia-preventivo.php`, `config/patchlab-mail.example.php`, i 3 file vendorizzati di PHPMailer). Il deploy si interrompe se un solo file non passa il lint.
3. Un test funzionale (`tests/smoke-test.sh`) che avvia il server integrato di PHP (`php -S`) e verifica via richieste HTTP reali: GET→405, campi mancanti→400, email non valida→400, campo troppo lungo→400, honeypot→429, invio troppo rapido→429, dati validi ma configurazione SMTP assente→500 controllato. **Nessuna email viene mai inviata realmente**: in questo ambiente di test `config/patchlab-mail.php` non esiste (non è mai stato creato, non ha credenziali), quindi il percorso di invio reale non viene mai raggiunto — è testato solo fino al punto in cui l'assenza di configurazione produce l'errore 500 corretto.

**Procedura di aggiornamento futuro**: per aggiornare PHPMailer a una versione più recente, ripetere la stessa procedura di verifica (clone al tag ufficiale desiderato, confronto hash con l'API GitHub, copia dei soli file runtime necessari), aggiornare il numero di versione in questo documento, e rilanciare i test in CI prima di considerare l'aggiornamento completo. Non sostituire mai i file di `vendor/phpmailer/phpmailer/` con una copia non verificata.
