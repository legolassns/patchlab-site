# PatchLab — Analytics Measurement Plan

Questo documento resta nel repository ma **non viene mai pubblicato online**: è un file `.md`, escluso per costruzione dal deploy (whitelist esplicita in `.github/workflows/deploy-production.yml`, con verifica dedicata che blocca il deploy se un `.md` finisse in `_release/`).

## Stato: IMPLEMENTATO (Plausible Analytics)

**Plausible Analytics** è integrato su tutte le **42 route reali** del sito (15 EN + 15 IT + 12 FR). Dal 2026-07-27 lo snippet installato è quello ufficiale generato da Plausible alla registrazione del sito:

```html
<!-- Privacy-friendly analytics by Plausible -->
<script async src="https://plausible.io/js/pa-GZufIkbU_YAkYX2J4B55w.js"></script>
<script>
  window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};
  plausible.init()
</script>
```

Va inserito **una sola volta per pagina, immediatamente prima di `</head>`**, **senza** l'attributo `data-domain` (il sito è identificato dall'ID nel nome del file), e **mai** sulle 8 pagine legacy di redirect in root: tracciarle produrrebbe due pageview per una sola visita, falsando il denominatore di ogni tasso di conversione. Regole complete e motivate: [`docs/PLAUSIBLE_SETUP.md`](docs/PLAUSIBLE_SETUP.md) §1.1.

Gli eventi custom sono cablati in `main.js` (funzioni `trackEvent()`, `initInteractionTracking()`, e la logica dentro `initQuoteForm()`) e **non sono cambiati** con la migrazione dello snippet: l'interfaccia `window.plausible(name, { props })` è identica. Dettaglio operativo completo (installazione, configurazione, manutenzione, estensione futura): [`docs/PLAUSIBLE_SETUP.md`](docs/PLAUSIBLE_SETUP.md). Questo documento resta il **contratto degli eventi**: cosa si misura, perché, e cosa è vietato — la fonte di verità sul *cosa*, non sul *come*.

**Prerequisito operativo: completato.** Il dominio `patchlab.net` è registrato come sito in un account Plausible (dichiarazione della Direzione, 2026-07-27) — è la registrazione che ha generato lo snippet sopra. Dal deploy di quella modifica gli eventi arrivano davvero in dashboard. Fino a quel momento l'integrazione lato codice era completa e corretta, ma le chiamate `plausible()` avvenivano senza che nessuno le vedesse. Storico in `docs/PLAUSIBLE_SETUP.md` §2.

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
| `page_view` | Caricamento di qualunque pagina reale | Tutte (42) | Nessuno — evento **nativo** di Plausible, non un `plausible()` custom | Tutti quelli sopra | Misurare traffico e provenienza per pagina/lingua (lingua desumibile dal path: root = EN, `/it/...` = IT, `/fr/...` = FR, e in futuro `/es/...` = ES) | Alta | **implemented** | Solo lo snippet in ogni `<head>` (il pageview è attivato da `plausible.init()`); nessun codice in `main.js` |
| `quote_cta_click` | Click su un link verso `quote/`, `preventivo/`, `devis/` o `presupuesto/` (delega su `document`) | Tutte le pagine con CTA | `cta_location` (`header`, `hero`, `mid-page`, `final-cta`, `footer`, `other`), `lang` | Tutti quelli sopra | Capire quali punti di ingresso generano più intenzione di conversione | Alta | **implemented** | `main.js`, `initInteractionTracking()` |
| `quote_form_view` | Caricamento di `/quote/` o `/it/preventivo/` | `quote/`, `it/preventivo/` | `lang` | Tutti quelli sopra | Base per il tasso di conversione del form (view → submit) | Alta | **implemented** | `main.js`, inizio di `initQuoteForm()` |
| `quote_form_start` | Primo `focusin` su un campo qualunque del form | `quote/`, `it/preventivo/` | `lang` | Tutti quelli sopra | Distinguere chi vede il form da chi inizia davvero a compilarlo | Media | **implemented** | `main.js`, `initQuoteForm()`, listener `{ once: true }` |
| `quote_form_submit` | `submit` del form **dopo** la validazione client, **prima** della risposta del server (tentativo reale di invio) | `quote/`, `it/preventivo/` | `lang` | Tutti quelli sopra, incluso qualunque campo del form | Misurare i tentativi di invio, incluso chi fallisce dopo | Alta | **implemented** | `main.js`, `initQuoteForm()`, dopo `setSubmitting(true)` |
| `quote_form_success` | Risposta server `{"ok": true}` | `quote/`, `it/preventivo/` | `lang` | Tutti quelli sopra | Misurare la conversione reale (unico evento che conta come lead acquisito) | Alta | **implemented** | `main.js`, `initQuoteForm()`, ramo di successo |
| `quote_form_error` | Risposta server con `ok: false`/HTTP non-2xx (`error_kind: "server"`) oppure eccezione `fetch`/timeout (`error_kind: "network"`) | `quote/`, `it/preventivo/` | `lang`, `error_kind` (solo `server` o `network` — **mai** `validation`: un fallimento della validazione client blocca l'invio prima che questo evento possa scattare, per progettazione; mai il messaggio testuale del server) | Tutti quelli sopra, incluso il messaggio di errore testuale | Individuare punti di attrito tecnico nel funnel | Alta | **implemented** | `main.js`, `initQuoteForm()`, ramo di errore e blocco `.catch()` |
| `language_switch` | Click su un link dentro `.lang-switch` (header, delega su `document`) | Tutte | `from_lang` (lingua della pagina), `to_lang` (letto da `hreflang` sul link cliccato; `unknown` se l'attributo manca o non è una lingua supportata) | Tutti quelli sopra | Misurare l'uso reale del multilinguismo | Bassa | **implemented** | `main.js`, `initInteractionTracking()` |
| `mailto_click` | Click su un link `href="mailto:..."` (delega su `document`) | Tutte | `path` (`window.location.pathname` della pagina corrente — qui sì incluso perché identifica *dove* si trova il link cliccato, non il visitatore) | Tutti quelli sopra | Misurare il canale di contatto alternativo al form | Bassa | **implemented** | `main.js`, `initInteractionTracking()` |

## Lingua negli eventi (aggiornato 2026-08-31)

`lang`, `from_lang` e `to_lang` valgono `"en"`, `"it"`, `"fr"` o `"es"`. Fino al 2026-08-31 la lingua era dedotta con un ternario binario (`lang === "en" ? "en" : "it"`): qualunque valore diverso da `"en"` veniva riportato come `"it"`. Con una terza lingua questo non avrebbe perso dati — li avrebbe **misattribuiti**, sommando silenziosamente il funnel francese a quello italiano, senza alcun segnale d'errore in dashboard. Ora `getCurrentLang()` valida `document.documentElement.lang` contro l'elenco delle lingue supportate e degrada su `"en"` solo se il valore è assente o non riconosciuto.

`to_lang` di `language_switch` non è più dedotto per inversione ma letto dall'attributo `hreflang` del link cliccato; un link privo di `hreflang` valido produce `"unknown"`, così un difetto di markup resta visibile invece di mimetizzarsi in un valore plausibile.

`"fr"` è pubblicato dal 2026-08-31 e compare regolarmente in dashboard. **`"es"` è già ammesso nel codice (dal 2026-09-01) ma oggi non può comparire**: nessuna pagina spagnola è pubblicata. Se un evento con `lang: "es"` apparisse ora, indicherebbe un errore, non traffico reale.

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
