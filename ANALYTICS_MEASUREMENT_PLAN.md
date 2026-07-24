# PatchLab — Analytics Measurement Plan

Questo documento resta nel repository ma **non viene mai pubblicato online**: è un file `.md`, escluso per costruzione dal deploy (whitelist esplicita in `.github/workflows/deploy-production.yml`, con verifica dedicata che blocca il deploy se un `.md` finisse in `_release/`).

## Stato: IMPLEMENTATO (Plausible Analytics)

Dal 2026-07-23 (MODE 6B), **Plausible Analytics** è integrato su tutte le 24 route reali del sito: script `<script defer data-domain="patchlab.net" src="https://plausible.io/js/script.js">` in ogni `<head>`, eventi custom cablati in `main.js` (funzioni `trackEvent()`, `initInteractionTracking()`, e la logica dentro `initQuoteForm()`). Dettaglio operativo completo (installazione, configurazione, manutenzione, estensione futura): [`docs/PLAUSIBLE_SETUP.md`](docs/PLAUSIBLE_SETUP.md). Questo documento resta il **contratto degli eventi**: cosa si misura, perché, e cosa è vietato — la fonte di verità sul *cosa*, non sul *come*.

**Prerequisito operativo non eseguibile da questa sessione**: il dominio `patchlab.net` deve essere registrato come sito in un account Plausible (Cloud o self-hosted) perché gli eventi vengano effettivamente ricevuti e visibili in una dashboard — l'integrazione lato codice è completa e corretta indipendentemente da questo, ma senza un account Plausible configurato lo script si carica e le chiamate `plausible()` avvengono silenziosamente senza che nessuno le veda (nessun errore, nessuna rottura del sito — vedi `trackEvent()` in `main.js`, progettata per degradare in sicurezza). Stesso pattern già visto per `config/patchlab-mail.php` (SMTP): il codice è pronto, un passaggio account/configurazione resta da completare da chi ha accesso a quel servizio.

## Principio vincolante

**Nessun dato personale o contenuto della richiesta viene mai inviato a uno strumento di misurazione**, oggi o in futuro, salvo un nuovo documento che riveda esplicitamente questo principio con approvazione della direzione. Vietato in ogni evento, senza eccezioni:

- nome
- email
- telefono
- azienda
- data di utilizzo indicativa (campo `data-utilizzo`, aggiunto al form nel MODE 6C)
- note / contenuto della richiesta
- indirizzo IP applicativo
- qualunque identificatore che permetta di risalire a una persona fisica

Gli eventi descrivono **comportamento**, non **identità**.

## Eventi

La pagina di origine **non è quasi mai passata come parametro custom**: Plausible la registra nativamente per ogni pageview e per ogni evento custom (la sua dashboard segmenta automaticamente per URL) — ripeterla come `props` sarebbe ridondante, non un requisito mancato. L'unica eccezione è `mailto_click`, dove `path` identifica esplicitamente da quale punto della pagina è partito il click (non il visitatore), scelta motivata riga per riga sotto.

| Evento | Trigger | Pagina | Parametri effettivi (`props`) | Dati vietati | Finalità | Priorità | Stato | Implementazione |
|---|---|---|---|---|---|---|---|---|
| `page_view` | Caricamento di qualunque pagina reale | Tutte (24) | Nessuno — evento **nativo** di Plausible, non un `plausible()` custom | Tutti quelli sopra | Misurare traffico e provenienza per pagina/lingua (lingua desumibile dal path: root = EN, `/it/...` = IT) | Alta | **implemented** | Solo il tag `<script>` in ogni `<head>`; nessun codice in `main.js` |
| `quote_cta_click` | Click su un link verso `quote/` o `preventivo/` (delega su `document`) | Tutte le pagine con CTA | `cta_location` (`header`, `hero`, `final-cta`, `footer`, `other`), `lang` | Tutti quelli sopra | Capire quali punti di ingresso generano più intenzione di conversione | Alta | **implemented** | `main.js`, `initInteractionTracking()` |
| `quote_form_view` | Caricamento di `/quote/` o `/it/preventivo/` | `quote/`, `it/preventivo/` | `lang` | Tutti quelli sopra | Base per il tasso di conversione del form (view → submit) | Alta | **implemented** | `main.js`, inizio di `initQuoteForm()` |
| `quote_form_start` | Primo `focusin` su un campo qualunque del form | `quote/`, `it/preventivo/` | `lang` | Tutti quelli sopra | Distinguere chi vede il form da chi inizia davvero a compilarlo | Media | **implemented** | `main.js`, `initQuoteForm()`, listener `{ once: true }` |
| `quote_form_submit` | `submit` del form **dopo** la validazione client, **prima** della risposta del server (tentativo reale di invio) | `quote/`, `it/preventivo/` | `lang` | Tutti quelli sopra, incluso qualunque campo del form | Misurare i tentativi di invio, incluso chi fallisce dopo | Alta | **implemented** | `main.js`, `initQuoteForm()`, dopo `setSubmitting(true)` |
| `quote_form_success` | Risposta server `{"ok": true}` | `quote/`, `it/preventivo/` | `lang` | Tutti quelli sopra | Misurare la conversione reale (unico evento che conta come lead acquisito) | Alta | **implemented** | `main.js`, `initQuoteForm()`, ramo di successo |
| `quote_form_error` | Risposta server con `ok: false`/HTTP non-2xx (`error_kind: "server"`) oppure eccezione `fetch`/timeout (`error_kind: "network"`) | `quote/`, `it/preventivo/` | `lang`, `error_kind` (solo `server` o `network` — **mai** `validation`: un fallimento della validazione client blocca l'invio prima che questo evento possa scattare, per progettazione; mai il messaggio testuale del server) | Tutti quelli sopra, incluso il messaggio di errore testuale | Individuare punti di attrito tecnico nel funnel | Alta | **implemented** | `main.js`, `initQuoteForm()`, ramo di errore e blocco `.catch()` |
| `language_switch` | Click su un link dentro `.lang-switch` (header, delega su `document`) | Tutte | `from_lang`, `to_lang` | Tutti quelli sopra | Misurare l'uso reale del bilinguismo | Bassa | **implemented** | `main.js`, `initInteractionTracking()` |
| `mailto_click` | Click su un link `href="mailto:..."` (delega su `document`) | Tutte | `path` (`window.location.pathname` della pagina corrente — qui sì incluso perché identifica *dove* si trova il link cliccato, non il visitatore) | Tutti quelli sopra | Misurare il canale di contatto alternativo al form | Bassa | **implemented** | `main.js`, `initInteractionTracking()` |

## Cosa questo piano NON copre

- Session recording o replay di sessione: non incluso, incompatibile con "nessun dato personale" se non configurato con mascheramento totale dei campi — da rivalutare separatamente se mai proposto.
- Consent mode/cookie banner: non necessario oggi (nessun cookie non tecnico); se una futura piattaforma approvata richiedesse cookie non tecnici, questo piano dovrà essere esteso con un meccanismo di consenso coerente con `privacy/index.html`/`it/privacy/index.html`.
- Deliverability email: fuori perimetro di questo piano (riguarda il comportamento del sito, non la consegna email — vedi `docs/SMTP_SETUP.md` per lo stato della deliverability).

## Monitoraggio del form (server-side, non analytics)

Il logging tecnico dell'esito dell'invio esiste già ed è valutato **adeguato allo stato attuale**, senza necessità di aggiungere complessità:

- `api/invia-preventivo.php` chiama `log_internal_error($context, $detail)` su ogni percorso di fallimento (honeypot, timing, configurazione mailer assente, validazione campi, errore SMTP), scrivendo su `error_log()` del server con un identificatore di contesto breve — **mai** il corpo del messaggio del cliente, **mai** l'email del richiedente per intero nei log di errore di validazione.
- Non esiste un log di **successo** strutturato (nessuna riga scritta quando l'invio riesce): è una scelta implicita del codice attuale, non una lacuna segnalata come bloccante da questo piano. Se in futuro servisse un conteggio storico degli invii riusciti, la soluzione minima coerente con questo documento sarebbe un log applicativo che registri solo `timestamp`, `esito` (successo/errore + tipologia), `lingua`, `route` — mai contenuto personale — senza introdurre un database.
- Nessun log permanente è stato aggiunto al repository in questo intervento (nessun file di log tracciato in Git, coerente con `.gitignore` che esclude già `logs/`).

## Divieti operativi permanenti

1. Nessuno script di terze parti (analytics, tag manager, pixel pubblicitari) va aggiunto senza una decisione esplicita della direzione, registrata come aggiornamento di questo documento.
2. Nessun evento include mai un campo del form o un suo derivato diretto (incluse concatenazioni, hash reversibili o troncamenti prevedibili).
3. Qualunque implementazione futura di questi eventi deve essere testabile senza inviare un form reale in produzione (ambiente di test/staging o mock).
