# PatchLab — Analytics Measurement Plan

Questo documento resta nel repository ma **non viene mai pubblicato online**: è un file `.md`, escluso per costruzione dal deploy (whitelist esplicita in `.github/workflows/deploy-production.yml`, con verifica dedicata che blocca il deploy se un `.md` finisse in `_release/`).

## Stato: SPECIFICA, NESSUNO STRUMENTO IMPLEMENTATO

Al 2026-07-23, nessuna piattaforma di misurazione (Google Analytics, Google Tag Manager, Plausible, Matomo, Cloudflare Web Analytics o altra) è approvata o configurata per PatchLab — verificato: nessun riferimento a queste piattaforme in nessun file HTML/JS del repository, nessuna decisione documentata in `DEPLOY_SETUP.md`/`FORM_SETUP.md`/`docs/SMTP_SETUP.md`. Questo documento è quindi **solo una specifica tecnica tracciabile degli eventi**: nessuno script esterno è stato introdotto in questo intervento. Se in futuro la direzione approva una piattaforma, l'implementazione dovrà rispettare esattamente questi eventi e questi divieti, aggiornando lo stato da `not implemented` a `implemented` evento per evento.

## Principio vincolante

**Nessun dato personale o contenuto della richiesta viene mai inviato a uno strumento di misurazione**, oggi o in futuro, salvo un nuovo documento che riveda esplicitamente questo principio con approvazione della direzione. Vietato in ogni evento, senza eccezioni:

- nome
- email
- telefono
- azienda
- note / contenuto della richiesta
- indirizzo IP applicativo
- qualunque identificatore che permetta di risalire a una persona fisica

Gli eventi descrivono **comportamento**, non **identità**.

## Eventi

| Evento | Trigger | Pagina | Parametri ammessi | Dati vietati | Finalità | Priorità | Stato |
|---|---|---|---|---|---|---|---|
| `page_view` | Caricamento di qualunque pagina reale | Tutte | `path`, `lang` (en/it) | Tutti quelli sopra | Misurare traffico e provenienza per pagina/lingua | Alta | not implemented |
| `quote_cta_click` | Click su un pulsante "Request a quote"/"Richiedi preventivo" (header, hero, CTA finale, card prodotto) | Tutte le pagine con CTA | `path` (pagina di origine), `cta_location` (es. `header`, `hero`, `final-cta`) | Tutti quelli sopra | Capire quali punti di ingresso generano più intenzione di conversione | Alta | not implemented |
| `quote_form_view` | Caricamento di `/quote/` o `/it/preventivo/` | `quote/`, `it/preventivo/` | `lang` | Tutti quelli sopra | Base per il tasso di conversione del form (view → submit) | Alta | not implemented |
| `quote_form_start` | Primo focus su un campo del form (`focusin` sul primo campo interagito) | `quote/`, `it/preventivo/` | `lang` | Tutti quelli sopra | Distinguere chi vede il form da chi inizia davvero a compilarlo | Media | not implemented |
| `quote_form_submit` | `submit` del form **prima** della risposta del server (tentativo di invio) | `quote/`, `it/preventivo/` | `lang` | Tutti quelli sopra, incluso qualunque campo del form | Misurare i tentativi di invio, incluso chi fallisce dopo | Alta | not implemented |
| `quote_form_success` | Risposta server `{"ok": true}` (successo confermato, non solo submit) | `quote/`, `it/preventivo/` | `lang` | Tutti quelli sopra | Misurare la conversione reale (unico evento che conta come lead acquisito) | Alta | not implemented |
| `quote_form_error` | Risposta server `{"ok": false}` o errore di rete/timeout | `quote/`, `it/preventivo/` | `lang`, `error_kind` (es. `validation`, `server`, `network` — mai il messaggio testuale restituito dal server, che potrebbe in futuro cambiare formato) | Tutti quelli sopra, incluso il messaggio di errore testuale | Individuare punti di attrito tecnico nel funnel | Alta | not implemented |
| `language_switch` | Click sul link EN/IT nell'header | Tutte | `from_lang`, `to_lang` | Tutti quelli sopra | Misurare l'uso reale del bilinguismo | Bassa | not implemented |
| `mailto_click` | Click su un link `mailto:info@patchlab.net` (footer o altrove) | Tutte | `path` (pagina di origine) | Tutti quelli sopra | Misurare il canale di contatto alternativo al form | Bassa | not implemented |

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
