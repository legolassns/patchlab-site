# DEPLOY_SETUP — Pipeline di produzione PatchLab

Questo documento resta nel repository ma **non viene mai pubblicato online**: è escluso esplicitamente dal deploy (vedi `.github/workflows/deploy-production.yml`, whitelist di `_release/`, che copia solo i file pubblici del sito e non include alcun file `.md`).

Non contiene valori reali di secrets, password o token: solo nomi, percorsi e procedure.

---

## 1. Scopo del sistema

Automatizzare la pubblicazione di PatchLab dal repository GitHub (`legolassns/patchlab-site`, branch `main`) verso l'hosting di produzione DominiOK, sostituendo il deploy manuale e il deploy temporaneo su GitHub Pages come destinazione definitiva.

## 2. Architettura

```
Sviluppo locale (Claude Code / editor)
        │
        │ git commit
        ▼
git push origin main
        │
        ▼
GitHub Actions — .github/workflows/deploy-production.yml
        │  1. checkout del commit esatto
        │  2. setup PHP reale + lint (php -l) su tutti i file .php del progetto
        │  3. test funzionale dell'endpoint (php -S, nessun invio email reale)
        │  4. verifica presenza dei secrets richiesti
        │  5. costruzione di _release/ (whitelist esplicita dei file pubblici, incluso vendor/PHPMailer)
        │  6. rimozione dei file .gitkeep da _release/ (vedi sezione 24a)
        │  7. verifica di sicurezza su _release/ (niente .md, niente .gitkeep, niente PATCHLAB_MASTER, niente .github/.git/.claude, niente config/, niente credenziali SMTP hardcoded)
        │  8. upload di _release/ via FTPS esplicito
        ▼
DominiOK — cPanel — account FTP deploy@patchlab.net → public_html/
        ▼
https://patchlab.net/
```

GitHub Pages (`https://legolassns.github.io/patchlab-site/`) resta attivo in parallelo finché non si decide di disattivarlo: i due deploy sono indipendenti e non si influenzano a vicenda. Vedi sezione 21.

## 3. Prerequisiti

- Account FTP dedicato `deploy@patchlab.net`, creato in cPanel, con home directory **limitata a `public_html/`** (non l'account cPanel principale).
- **Verificato (Sprint 11.1, test reale in FileZilla con TLS esplicito)**: l'account `deploy@patchlab.net` è già radicato in `/home/patch864/public_html`. La directory remota nel workflow resta quindi `server-dir: ./`, confermata corretta — non è più un'assunzione da verificare.
- **Verificato (Sprint 11.1)**: il server DominiOK supporta FTPS esplicito sulla porta 21 (login, ingresso in `/`, EPSV e comando dati confermati nei log del primo deploy reale). Il fallimento osservato non riguardava protocollo/porta/percorso: vedi sezione 24a.

## 4. Account FTP dedicato

- Username: `deploy@patchlab.net`
- Host: `ftp.patchlab.net`
- Porta: `21`
- Protocollo: FTPS esplicito (fallback a FTP semplice solo se il server non supporta realmente FTPS — verificare prima di derogare)
- Permessi: lettura/scrittura limitata a `public_html/` e sue sottocartelle. Non usare le credenziali principali cPanel.

## 5. GitHub Secrets necessari

Da creare in **Settings → Secrets and variables → Actions**, nell'environment `production` (vedi sezione 6):

| Nome secret | Valore atteso |
|---|---|
| `PATCHLAB_FTP_SERVER` | `ftp.patchlab.net` |
| `PATCHLAB_FTP_USERNAME` | `deploy@patchlab.net` |
| `PATCHLAB_FTP_PASSWORD` | password dell'account FTP dedicato |
| `PATCHLAB_FTP_PORT` | `21` |

Nessun valore reale è scritto in questo file, nel workflow o altrove nel repository. Il workflow legge questi secrets solo a runtime tramite `${{ secrets.NOME }}`.

## 6. Configurazione dell'environment `production`

Il workflow è associato all'environment GitHub `production` (`environment: production` nel job). Creare questo environment in **Settings → Environments** permette di:
- scoping dei secrets solo a questo environment (non visibili in altri contesti);
- aggiungere in futuro regole di approvazione manuale prima del deploy, se Stefano lo riterrà utile;
- vedere lo storico dei deploy in un'unica vista.

Se l'environment non viene creato, i secrets possono essere aggiunti come "Repository secrets" generali: il workflow funziona comunque, ma senza gli scoping/approvazioni sopra descritti.

## 7. Funzionamento del workflow

File: `.github/workflows/deploy-production.yml`.

Trigger:
- ogni `push` su `main`;
- avvio manuale (`workflow_dispatch`), con un input opzionale `dry_run` (booleano, default `false`) che prepara e verifica `_release/` senza caricare nulla sul server — utile per il primo test della pipeline.

Concorrenza: un solo deploy di produzione alla volta (`group: production-deploy`). Un deploy avviato mentre un altro è in corso **attende** in coda, non lo annulla: interrompere un trasferimento FTP a metà lascerebbe il server in uno stato incoerente.

Permessi: `contents: read` — il minimo indispensabile per fare checkout del codice. Nessun permesso di scrittura sul repository.

Passaggi:
1. **Checkout** del commit esatto che ha attivato il workflow (`persist-credentials: false`, nessuna credenziale Git persistita inutilmente).
2. **Verifica dei secrets**: se anche uno solo dei quattro secrets richiesti manca, il workflow fallisce subito con un messaggio esplicito (`::error::`) che indica quale secret manca e rimanda a questo documento. Non tenta mai un deploy parziale o silenzioso.
3. **Costruzione di `_release/`**: una whitelist esplicita di file e cartelle viene copiata in una directory temporanea generata durante il workflow (non committata nel repository). Vedi sezione 8.
4. **Verifica di sicurezza su `_release/`**: controlla che esista `index.html`, che non ci siano file `.md`, che non compaia `PATCHLAB_MASTER` in nessuna forma, che non siano presenti `.github/`, `.git/`, `.claude/`. Se una di queste condizioni fallisce, il workflow si interrompe **prima** di qualsiasi upload.
5. **Deploy via FTPS esplicito**: usa l'azione `SamKirkland/FTP-Deploy-Action@v4.3.5` (versione fissata, non `@master`), con `protocol: ftps`, `local-dir: ./_release/`, `server-dir: ./`. Questo step viene saltato se `dry_run` è `true`.
6. **Step di dry run**: se `dry_run` è `true`, conferma che `_release/` è stata generata e verificata senza alcun upload.

## 8. File pubblicati

Whitelist esplicita usata nello step "Prepara `_release/`" (aggiornarla qui e nel workflow insieme, se cambia):

- `index.html` (landing internazionale in inglese)
- `patch-pvc.html`, `patch-ricamate.html`, `patch-sublimatiche.html`, `patch-termosaldabili.html`, `patch-velcro.html`, `patch-woven.html`, `portfolio.html`, `preventivo.html` (stub di redirect legacy verso `it/...`)
- `style.css`
- `main.js`
- `assets/` (intera cartella, immagini incluse)
- `it/` (intera cartella, tutte le pagine italiane)
- `api/` (endpoint PHP del modulo preventivo — solo codice, mai credenziali: vedi `FORM_SETUP.md`)
- `vendor/` (PHPMailer ufficiale vendorizzato — solo codice sorgente e licenza, vedi `FORM_SETUP.md` sezione PHPMailer per provenienza e verifica di integrità)
- `privacy/` (pagina privacy EN, aggiunta a `EN_PAGE_DIRS` il 2026-07-23 — MODE 6); `it/privacy/` è già inclusa automaticamente dalla copia integrale di `it/`
- `robots.txt`, `sitemap.xml`, `CNAME` — inclusi **solo se già presenti** nel repository (dal 2026-07-23 `robots.txt` e `sitemap.xml` esistono e sono quindi pubblicati automaticamente da questa regola, senza bisogno di modificare il workflow; `CNAME` resta assente)

Dal 2026-07-23 (MODE 6B), ogni pagina HTML pubblicata (24 route reali, whitelist sopra) include anche il tag di Plausible Analytics nel proprio `<head>` — non è un file separato da aggiungere alla whitelist, è già parte del contenuto di ciascun file HTML. Nessuna modifica al workflow di deploy è stata necessaria. Dettaglio: `docs/PLAUSIBLE_SETUP.md`.

## 9. File esclusi

Per costruzione (whitelist, non blacklist): tutto ciò che non è elencato al punto 8 resta fuori da `_release/`, incluso ma non limitato a:

- `.git/`, `.github/`, `.claude/`, `.vscode/`
- `PATCHLAB_MASTER/` (non esiste comunque nel repository pubblico)
- `config/` (template e — se mai finisse per errore nel repository — configurazione reale del mailer: non serve al sito pubblico, vive solo sul server fuori da `public_html/`, vedi `FORM_SETUP.md`)
- `copy-home.md`, `seo-keywords.md`, `site-structure.md`, `DEPLOY_SETUP.md`, `FORM_SETUP.md`, qualsiasi altro `*.md`
- `README*`, `LICENSE*`
- file temporanei, di log, backup, ZIP, RAW, PSD, AI, EPS
- eventuali future cartelle `node_modules/`, `backup/`, `temp/`

La verifica di sicurezza (step "Verifica di sicurezza su `_release/`") controlla attivamente l'assenza di `.md`, `.gitkeep`, `PATCHLAB_MASTER`, `.github/.git/.claude`, `config/` in `_release/`, oltre a un controllo per pattern di credenziali SMTP hardcoded nei file `.php` pubblicati — come rete di sicurezza aggiuntiva, non come unico meccanismo di esclusione.

## 10. Primo deploy

1. Verificare i prerequisiti (sezione 3), in particolare la directory remota reale vista dall'account FTP.
2. Creare i quattro secrets (sezione 5) nell'environment `production`.
3. Avviare il workflow manualmente con `dry_run: true` per un primo controllo senza upload (vedi sezione 24 nel report di sprint / istruzioni fornite a Stefano).
4. Controllare nei log dello step "Verifica di sicurezza su `_release/`" che il contenuto elencato corrisponda alle aspettative.
5. Avviare di nuovo il workflow manualmente, questa volta con `dry_run: false` (o senza specificarlo), per il primo upload reale.
6. Verificare `https://patchlab.net/` (quando il DNS del dominio punterà a DominiOK) o direttamente l'esito nei log FTP dell'azione.

## 11. Deploy automatici futuri

Dopo il primo deploy riuscito, ogni `git push origin main` attiva automaticamente il workflow e aggiorna il sito in produzione, senza intervento manuale. Il flusso operativo per i prossimi sprint resta identico a quello già in uso (`git commit` → `git push origin main`); l'unica differenza è che ora anche DominiOK si aggiorna, non solo GitHub Pages.

## 12. Deploy manuale

Da GitHub: **Actions → Deploy PatchLab to Production → Run workflow**, scegliendo il branch `main` e, se utile, `dry_run: true` per un controllo preventivo. Utile per: rieseguire un deploy dopo un fallimento temporaneo, testare la pipeline dopo una modifica ai secrets, o forzare un aggiornamento senza un nuovo commit.

## 13. Verifica post-deploy

Dopo ogni deploy (automatico o manuale):
- controllare l'esito del workflow in Actions (verde = riuscito);
- aprire `https://patchlab.net/` e `https://patchlab.net/it/` e controllare che le pagine rispondano e che i contenuti corrispondano all'ultimo commit;
- controllare che CSS e JS si carichino (nessun errore 404 in console);
- controllare un paio di pagine profonde (es. `/it/patch-sublimatiche/`) per escludere problemi di sotto-cartelle;
- se qualcosa non torna, vedere la sezione 14 (rollback).

## 14. Rollback

Il deploy è sempre una copia 1:1 dello stato del repository al momento del push. Per tornare a una versione precedente:

1. Identificare il commit buono precedente con `git log --oneline`.
2. Creare un nuovo commit che riporta i file allo stato di quel commit (es. `git revert` del commit problematico, oppure un commit che ripristina i file specifici) — **non riscrivere la cronologia** con `git reset --hard` + force push.
3. Push su `main`: il workflow rifà automaticamente il deploy con lo stato corretto.

In alternativa, per un rollback immediato senza aspettare un nuovo commit: **Actions → Deploy PatchLab to Production → Run workflow**, scegliendo di eseguire il workflow su un commit precedente specifico (GitHub permette di scegliere il ref al momento dell'avvio manuale).

Non esiste un rollback "automatico a un click" oltre a questo: è una scelta deliberata per restare semplici e trasparenti, coerente con la cronologia Git come unica fonte di verità.

## 15. Clean deploy controllato

Il deploy normale (sezione 7) **non cancella mai** file presenti sul server che non sono nella whitelist: carica e aggiorna, non sincronizza in modo distruttivo. Questo evita di cancellare per errore file cPanel, configurazioni email, certificati o altro materiale non legato al sito.

Se in futuro serve davvero ripulire `public_html/` da file obsoleti (es. vecchi tentativi di pubblicazione manuale, file di test):

1. **Non eseguire mai questa pulizia dentro il workflow automatico.**
2. Fare prima un controllo manuale via client FTP di cosa c'è realmente in `public_html/` che non corrisponde alla whitelist della sezione 8.
3. Verificare esplicitamente che non si tratti di: file di sistema cPanel, cartelle email, configurazioni SSL, cartelle nascoste del provider, o altro materiale non riconducibile a PatchLab.
4. Solo dopo questa verifica manuale, procedere con una cancellazione mirata (via client FTP o, in un secondo momento, con una modalità dedicata del workflow esplicitamente approvata da Stefano — non ancora implementata in questo sprint).

Questa modalità "clean deploy" resta **procedura manuale documentata**, non automatizzata: coerente con il principio "il deploy deve fallire in sicurezza", non cancellare in sicurezza.

## 16. Disaster recovery

Se il server DominiOK diventa irraggiungibile o il contenuto di `public_html/` viene compromesso da un intervento esterno al workflow:

1. Il codice sorgente autorevole resta sempre su GitHub (`main`), indipendentemente da cosa succede sul server: nessuna perdita di codice è possibile lato repository.
2. Ripristinare l'accesso FTP/cPanel con il supporto DominiOK.
3. Una volta ripristinato l'accesso, rilanciare manualmente il workflow (sezione 12): ricostruisce `_release/` dallo stato attuale di `main` e la ripubblica per intero.
4. Se le credenziali dell'account `deploy@patchlab.net` sono compromesse, vedere sezione 17 (revoca) prima di rilanciare qualunque deploy.

## 17. Revoca account FTP

Se necessario revocare l'accesso dell'account `deploy@patchlab.net` (sospetto di compromissione, fine collaborazione, cambio hosting):

1. Da cPanel DominiOK, eliminare o disabilitare l'account FTP `deploy@patchlab.net`.
2. Rimuovere i quattro secrets da GitHub (Settings → Secrets and variables → Actions).
3. Il workflow, al prossimo tentativo di deploy, fallirà in modo comprensibile allo step "Verifica presenza dei GitHub Secrets richiesti" — nessun deploy silenzioso con credenziali invalide.
4. Se serve riattivare il deploy, creare un nuovo account FTP dedicato (mai riusare credenziali potenzialmente compromesse) e ripetere la configurazione dei secrets.

## 18. Rotazione password

Buona pratica: ruotare la password dell'account FTP dedicato periodicamente (es. ogni 6-12 mesi) o immediatamente in caso di sospetto.

1. Cambiare la password dell'account `deploy@patchlab.net` da cPanel.
2. Aggiornare **solo** il secret `PATCHLAB_FTP_PASSWORD` su GitHub con il nuovo valore (Settings → Secrets and variables → Actions → production).
3. Non serve alcuna modifica al workflow o al codice: il secret è letto a runtime.
4. Verificare con un deploy manuale (`workflow_dispatch`, eventualmente con `dry_run: true` prima) che la nuova password funzioni.

## 19. Troubleshooting

| Sintomo | Causa probabile | Azione |
|---|---|---|
| Workflow fallisce allo step "Verifica presenza dei GitHub Secrets richiesti" | Uno o più secrets mancanti o rinominati | Controllare i nomi esatti in Settings → Secrets, confrontare con la sezione 5 |
| Workflow fallisce allo step "Verifica di sicurezza su `_release/`" | Un file pubblico atteso manca (es. `it/` non trovato) o un file da escludere è finito nella whitelist per errore | Controllare l'elenco stampato nei log dello step precedente, verificare la whitelist nel workflow |
| Deploy "riuscito" ma il sito non cambia | Cache del browser o CDN; oppure la directory remota (`server-dir`) non è quella corretta (vedi sezione 3) | Forzare refresh, verificare con un client FTP dove sono davvero finiti i file |
| Deploy fallisce con errore di connessione FTP | Server, porta o protocollo errati, oppure firewall DominiOK | Verificare i valori dei secrets, testare la stessa connessione con un client FTP esterno |
| Deploy fallisce con errore di autenticazione | Password errata o account disabilitato | Verificare/ruotare la password (sezione 18), controllare che l'account non sia stato revocato (sezione 17) |
| Il workflow non parte affatto dopo un push | Il file YAML ha un errore di sintassi, oppure il push non è su `main` | Controllare la tab Actions per errori di parsing, verificare il branch |

## 20. Riutilizzo sui futuri siti verticali Euroricami

Questo pattern (checkout → whitelist esplicita in `_release/` → verifica di sicurezza → FTPS esplicito con secrets dedicati) è pensato per essere copiato su altri siti verticali:

1. Duplicare `.github/workflows/deploy-production.yml` nel nuovo repository.
2. Aggiornare la whitelist dei file pubblici (sezione 8) in base alla struttura del nuovo sito.
3. Creare un nuovo account FTP dedicato sul relativo hosting (mai riusare `deploy@patchlab.net` per un altro dominio).
4. Creare secrets con nomi analoghi ma prefissati al nuovo progetto (es. `NUOVOSITO_FTP_SERVER`, ecc.), per evitare ambiguità se in futuro più repository condividono un'organizzazione GitHub.
5. Copiare la struttura di questo documento, adattando dominio, account e whitelist.

## 21. Differenza tra GitHub Pages e produzione DominiOK

- **GitHub Pages** (`https://legolassns.github.io/patchlab-site/`): deploy temporaneo usato durante gli Sprint precedenti, attivato automaticamente da GitHub sulla base del branch pubblicato nelle impostazioni Pages del repository. Resta attivo e continuerà ad aggiornarsi ad ogni push, in parallelo, finché non verrà disattivato esplicitamente nelle impostazioni del repository.
- **DominiOK** (`https://patchlab.net/`): ambiente di produzione definitivo, aggiornato dal workflow descritto in questo documento. Dal 2026-07-23 la deliverability email è verificata operativa su questo ambiente (vedi sezione 24), rafforzando la sua idoneità come unica destinazione pubblica.
- Le due destinazioni sono indipendenti: un fallimento del deploy FTPS non impedisce l'aggiornamento di GitHub Pages, e viceversa.
- **Decisione strategica (2026-07-23, MODE 6)**: DominiOK (`patchlab.net`) deve diventare l'**unica fonte pubblica**; GitHub resta solo repository e CI/CD. La disattivazione di GitHub Pages **non è eseguibile da codice**: nessun file di questo repository controlla la pubblicazione Pages (verificato — nessun workflow dedicato, nessun branch `gh-pages` separato: `git ls-remote --heads origin` restituisce solo `main`). La pubblicazione è configurata esclusivamente in **Settings → Pages** del repository GitHub, un'area di impostazioni non modificabile da un intervento sul codice.

### 21a. Procedura di disattivazione di GitHub Pages (da eseguire manualmente da chi ha accesso alle impostazioni del repository)

1. Vai su `https://github.com/legolassns/patchlab-site` → tab **Settings** → sezione **Pages** (menu laterale, sotto "Code and automation").
2. In **Build and deployment → Source**, seleziona **None** al posto di "Deploy from a branch" (oppure, se l'opzione disponibile è "disconnect"/rimuovi il branch pubblicato, usa quella).
3. Salva. GitHub interrompe la pubblicazione automatica su `https://legolassns.github.io/patchlab-site/`; l'URL smette di rispondere (tipicamente entro pochi minuti, talvolta con un breve periodo di cache CDN residua).
4. **Verifica post-disattivazione**: richiedi `https://legolassns.github.io/patchlab-site/` (es. `curl -I`) e conferma che non risponda più con `200`/`Server: GitHub.com` (atteso: 404 o nessuna risposta).
5. **Controllo che `patchlab.net` resti online**: richiedi `https://patchlab.net/` e conferma `200 OK` — la disattivazione di Pages non deve avere alcun effetto su DominiOK, essendo le due destinazioni indipendenti per costruzione (vedi sopra).
6. **Search Console (se applicabile)**: se `https://legolassns.github.io/patchlab-site/` risultasse indicizzato in passato, valutare in Google Search Console una richiesta di rimozione temporanea dell'URL o attendere la deindicizzazione naturale a seguito del 404; non è un passaggio bloccante.

Questa procedura **non è stata eseguita** in questo intervento: nessun accesso alle impostazioni GitHub è stato usato o presupposto. Resta un'azione manuale in capo a chi amministra il repository.

## 22. Gestione del dominio

Il puntamento DNS di `patchlab.net` verso DominiOK non è stato modificato in questo sprint (nessuna modifica DNS è stata eseguita, come da vincolo). La pipeline di deploy è pronta e testabile indipendentemente dal DNS (un deploy FTP funziona anche prima che il dominio pubblico punti al server, semplicemente il sito non sarà ancora raggiungibile da `patchlab.net` finché il DNS non è aggiornato). Le eventuali modifiche DNS restano una decisione separata di Stefano.

## 23. Gestione del form

Vedi `FORM_SETUP.md` per lo stato del modulo preventivo. Il form invia realmente le richieste via `api/invia-preventivo.php`, usando PHPMailer ufficiale (vendorizzato in `vendor/phpmailer/phpmailer/`, tag `v7.1.1`) per il canale SMTP verso Zoho — nessun client SMTP proprietario resta in produzione. L'unico passaggio operativo mancante è creare sul server il file `config/patchlab-mail.php` con le credenziali reali (`FORM_SETUP.md`, sezioni C-F) — finché non esiste, l'endpoint risponde con un errore controllato, mai un invio simulato.

## 24. Rischi e limitazioni note

- ~~La directory remota (`server-dir: ./`) è configurata assumendo che l'account FTP entri già in `public_html/`~~ — **verificato in Sprint 11.1**: confermato, `deploy@patchlab.net` è radicato in `/home/patch864/public_html`. Nessuna azione necessaria.
- ~~Il supporto FTPS esplicito sulla porta 21 da parte di DominiOK non è stato verificato~~ — **verificato in Sprint 11.1**: login, EPSV e apertura della connessione dati confermati nei log del primo deploy reale.
- L'azione `SamKirkland/FTP-Deploy-Action` è una dipendenza di terze parti pinnata a `v4.4.0` (aggiornata in Sprint 11.1 da `v4.3.5`): eventuali aggiornamenti futuri vanno valutati e testati (idealmente con `dry_run: true`) prima di cambiare la versione pinnata.
- ~~Il modulo preventivo non invia ancora email reali~~ — **attivato**: invia via SMTP Zoho autenticato tramite `api/invia-preventivo.php`. Il file di configurazione con le credenziali reali è presente e operativo sul server (vedi `FORM_SETUP.md`).
- ~~Deliverability email (SPF/DKIM/DMARC per `info@patchlab.net`) non è stata verificata~~ — **verificata operativamente dalla Direzione il 2026-07-23**: invio, ricezione, SPF, DKIM, DMARC e configurazione Zoho tutti confermati funzionanti (vedi `docs/SMTP_SETUP.md` §Verifica operativa end-to-end e `FORM_SETUP.md`, sezione 11). Verifica puntuale, non un monitoraggio continuo: da ripetere in caso di modifiche future a DNS, hosting o Zoho.
- ~~Il client SMTP di `api/invia-preventivo.php` è scritto ad hoc (non PHPMailer)~~ — **sostituito integralmente da PHPMailer ufficiale** (tag `v7.1.1`, provenienza e integrità verificate: vedi `FORM_SETUP.md`, sezione PHPMailer). Nessun protocollo SMTP proprietario resta in produzione.
- ~~Non è stato possibile eseguire test PHP reali~~ — **risolto**: il workflow ora esegue `php -l` su tutti i file PHP e un test funzionale dell'endpoint (`tests/smoke-test.sh`) con un interprete PHP reale (`shivammathur/setup-php@2.37.2`) prima di ogni deploy, che lo interrompe se falliscono.
- Il test funzionale in CI copre GET→405, campi mancanti/non validi→400, honeypot→429, invio troppo rapido→429, configurazione SMTP assente→500 controllato. **Non copre** — e non può coprire senza credenziali reali — l'invio effettivo tramite PHPMailer verso `smtp.zoho.eu`: quel percorso resta da verificare con il test end-to-end di `FORM_SETUP.md` sezione H, una volta creato il file di configurazione reale sul server.
- Vedi sezione 24a per un incidente noto e risolto sul primo deploy reale, e la relativa strategia di fallback se il sintomo dovesse ripresentarsi su un file reale.

## 24a. Incidente Sprint 11.1 — fallimento sul primo upload FTPS

**Osservato**: nel primo deploy reale (fine Sprint 11), il dry run era stato completato correttamente. Il deploy reale raggiungeva il server, effettuava il login, entrava nella directory remota `/`, attivava EPSV, riceveva `150 Accepted data connection` — ma falliva al primissimo file trasferito, `assets/img/.gitkeep`, con l'errore:

```
Server sent FIN packet unexpectedly, closing connection.
```

**Causa tecnica più probabile**: `assets/img/.gitkeep` è un file da **0 byte**. Serve solo a Git per tracciare la cartella `assets/img/` quando altrimenti sarebbe vuota nel repository: non ha alcuna funzione una volta che la cartella contiene già le immagini reali, e non deve mai finire online. Alcuni server/implementazioni FTPS (incluso, con ogni evidenza, quello di DominiOK) chiudono la connessione dati in modo anomalo su un upload STOR di un file a lunghezza zero subito dopo l'apertura del canale dati — comportamento non standard ma non raro con determinate combinazioni client/server TLS. Non era né un problema di credenziali, né di percorso, né di protocollo: tutti e tre erano già confermati corretti (vedi sezione 3).

**Correzione applicata (Sprint 11.1, 2026-07-20)**:
1. Nuovo step "Rimuovi i file `.gitkeep` da `_release/`" (`find _release -type f -name ".gitkeep" -delete`), eseguito dopo la copia di `assets/` e `it/` e prima della verifica di sicurezza.
2. La "Verifica di sicurezza su `_release/`" ora fallisce esplicitamente se un qualsiasi `.gitkeep` fosse comunque rimasto.
3. L'`exclude` dello step di deploy FTP è stato rafforzato con `**/.gitkeep`, `**/.git*`, `**/.git*/**` come rete di sicurezza aggiuntiva (la whitelist e lo step di rimozione restano il meccanismo primario).
4. Azione di deploy aggiornata a `SamKirkland/FTP-Deploy-Action@v4.4.0` (dalla `v4.3.5`), versione stabile corrente, senza cambiare protocollo, porta o directory remota.

**Procedura di test successiva**: al prossimo push su `main`, il workflow si attiva automaticamente. Verificare nei log dello step "Deploy via FTPS esplicito" che il primo file trasferito sia ora un file reale (es. un `.jpeg` o `index.html`), non più `.gitkeep`, e che l'upload prosegua oltre il primo file senza l'errore FIN.

**Strategia di fallback (solo documentale, non ancora attivata)**: se dopo questa correzione il deploy fallisce di nuovo con lo stesso errore FIN su un file **reale** e non vuoto (non più `.gitkeep`), non vanno tentate altre correzioni casuali sul workflow attuale. La linea d'azione prevista è aprire uno **Sprint 11.2** dedicato per sostituire `SamKirkland/FTP-Deploy-Action` con uno script basato su `lftp`, mantenendo: FTPS esplicito, modalità passiva, verifica del certificato, sincronizzazione a specchio (mirror) che non cancella file remoti esterni alla release. In quello scenario andranno preservati obbligatoriamente `zohoverify/`, `.well-known/` e `cgi-bin/` — non toccarli mai, né con lo script attuale né con un eventuale mirror lftp futuro.
- GitHub Pages resta attivo in parallelo (sezione 21): due copie del sito esisteranno finché non si deciderà diversamente.
