# PatchLab Plausible Setup

Documento di riferimento operativo per l'integrazione di Plausible Analytics su PatchLab. Scritto per chi dovrà intervenire su questo sistema senza aver seguito la sua storia.

Questo file resta nel repository ma **non viene mai pubblicato online**: è un file `.md`, escluso per costruzione dal deploy (whitelist esplicita in `.github/workflows/deploy-production.yml`, con verifica dedicata che blocca il deploy se un `.md` finisse in `_release/`).

Documento correlato, più orientato al *contratto* degli eventi (cosa si misura, perché, cosa è vietato): [`ANALYTICS_MEASUREMENT_PLAN.md`](../ANALYTICS_MEASUREMENT_PLAN.md). Questo documento si concentra sul *come*: installazione, configurazione, manutenzione, estensione futura.

Decisione a monte (non presa qui): Plausible è stato scelto dalla direzione dopo un confronto neutro di 6 strumenti candidati, documentato nel repository `euroricami-ai-os` (`integrations/patchlab/PATCHLAB_MEASUREMENT_STRATEGY.md` §6). Questo documento implementa quella decisione, non la ridiscute.

---

## 1. Cos'è stato installato

Un solo tag script, identico su tutte le 24 route reali del sito (le 8 pagine legacy di redirect in root **non** lo includono, per scelta: non fanno parte del funnel misurato, sono già escluse dall'indicizzazione via `robots.txt`):

```html
<script defer data-domain="patchlab.net" src="https://plausible.io/js/script.js"></script>
```

Caratteristiche di questo script (comportamento di Plausible per progettazione, non una configurazione nostra):
- **Cookieless**: non imposta alcun cookie, non usa `localStorage` per identificare il visitatore tra sessioni.
- **Nessun fingerprinting persistente**: Plausible calcola un identificatore giornaliero non riconducibile a un individuo (hash di IP + user agent + dominio + salt che ruota ogni giorno), mai salvato, mai esposto.
- **`defer`**: il caricamento non blocca il rendering della pagina (nessun impatto percepibile sulle performance o sul Core Web Vital LCP).
- **Pageview automatico**: ogni caricamento di pagina con questo script genera un evento `pageview` nativo in Plausible, senza bisogno di codice aggiuntivo — per questo `page_view` (RFC eventi) non ha alcuna implementazione in `main.js` (vedi `ANALYTICS_MEASUREMENT_PLAN.md`).

## 2. Prerequisito operativo — NON eseguito da questa sessione

**Il dominio `patchlab.net` deve essere registrato come sito in un account Plausible** (piano Cloud su plausible.io, oppure un'istanza self-hosted — la decisione tra le due resta della direzione, il tag script sopra funziona identico in entrambi i casi cambiando solo, se self-hosted, l'URL `src`) prima che gli eventi vengano effettivamente ricevuti e visibili in una dashboard.

Questo passaggio richiede credenziali di un account che non sono disponibili in questa sessione — esattamente come la creazione di `config/patchlab-mail.php` per l'SMTP (`FORM_SETUP.md`). Finché non è completato:
- Il sito **continua a funzionare normalmente**: lo script si carica, le chiamate a `window.plausible(...)` vengono eseguite dal codice, ma non hanno alcun effetto visibile (Plausible scarta silenziosamente gli eventi per un dominio non registrato, o — se lo script stesso non risponde — la funzione `trackEvent()` in `main.js` verifica `typeof window.plausible !== "function"` e non fa nulla).
- **Nessun errore JavaScript** viene generato in nessuno dei due casi.

### Procedura di attivazione (da eseguire da chi ha accesso a un account Plausible)

1. Creare (o usare) un account su [plausible.io](https://plausible.io) o predisporre un'istanza self-hosted.
2. Aggiungere un nuovo sito con dominio esatto `patchlab.net`.
3. Non è necessaria alcuna modifica al codice: lo script è già in produzione dal deploy di questo intervento (verificare comunque che l'URL `src` corrisponda al piano scelto — `plausible.io/js/script.js` per il Cloud, un URL diverso se self-hosted, vedi §5).
4. Verificare nella dashboard Plausible, entro pochi minuti da una visita reale al sito, che compaiano: un pageview e — visitando `/quote/` o `/it/preventivo/` e interagendo col form — gli eventi custom elencati in `ANALYTICS_MEASUREMENT_PLAN.md`.
5. Se si usa il piano gratuito/Community o un tier senza breakdown delle proprietà personalizzate degli eventi, leggere la nota di copertura KPI in §6 prima di considerare "risolti" tutti i KPI del piano di misurazione.

## 3. Eventi custom — dove vivono nel codice

Tutta la logica è in `main.js` (nessuna dipendenza esterna, nessun bundler):

| Funzione | Cosa fa | Eventi generati |
|---|---|---|
| `trackEvent(name, props)` | Wrapper unico verso `window.plausible()`; guardia silenziosa se lo script non è disponibile | — (helper) |
| `initInteractionTracking()` | Un solo listener `click` delegato su `document`, registrato una volta all'avvio | `quote_cta_click`, `language_switch`, `mailto_click` |
| `initQuoteForm()` (già esistente, solo estesa) | Logica del form preventivo | `quote_form_view`, `quote_form_start`, `quote_form_submit`, `quote_form_success`, `quote_form_error` |

**Perché un solo listener delegato per le interazioni** (`initInteractionTracking`), invece di un listener per elemento: un sito senza build system e senza template engine ripete header/footer identici in ogni file HTML — attaccare un listener a ogni singolo link CTA/lingua/mailto richiederebbe ripetere selettori in ogni pagina e rischierebbe di dimenticarne uno in una pagina futura. Un listener delegato sul `document`, con `event.target.closest(...)`, funziona automaticamente su qualunque nuova pagina che segua lo stesso pattern HTML, senza codice aggiuntivo.

**Perché nessun evento può scattare due volte per la stessa azione dell'utente** (requisito esplicito):
- `quote_cta_click` / `language_switch` / `mailto_click`: un solo listener globale, registrato una sola volta in `DOMContentLoaded`; ogni click passa attraverso una cascata di `if` con `return` immediato al primo match — un click non può mai soddisfare più di una categoria.
- `quote_form_view`: `initQuoteForm()` gira una sola volta per caricamento pagina (esce subito se `#quote-form` non esiste); l'evento è la prima riga eseguita dopo quel controllo.
- `quote_form_start`: listener `focusin` registrato con l'opzione nativa `{ once: true }` — il browser stesso lo rimuove dopo il primo trigger, non serve un flag manuale.
- `quote_form_submit` / `quote_form_success` / `quote_form_error`: vivono dentro l'unico gestore `submit` del form, già protetto dal flag `isSubmitting` esistente (impediva già il doppio invio prima di questo intervento) — un nuovo submit non può partire finché il precedente non si è concluso.

## 4. Cosa NON è mai inviato a Plausible

Vincolo assoluto, verificato riga per riga in `main.js` durante questo intervento: nessuna chiamata a `trackEvent()` referenzia mai `nome`, `azienda`, `email`, `telefono`, `note`, il contenuto di `tipo-patch`/`applicazione`/`quantita`, o l'indirizzo IP del visitatore. Gli unici valori passati come `props` in tutto il codice sono: `lang`/`from_lang`/`to_lang` (`"en"`/`"it"`), `cta_location` (una stringa fissa tra `header`/`hero`/`final-cta`/`footer`/`other`), `error_kind` (`"server"`/`"network"`), `path` (solo per `mailto_click`, il percorso della pagina — mai un dato del visitatore). Nessun valore proviene da un campo del form.

## 5. Manutenzione

- **Aggiornare la versione dello script**: Plausible versiona il proprio script lato server; l'URL `src="https://plausible.io/js/script.js"` punta sempre alla versione corrente, non serve aggiornarla manualmente lato PatchLab.
- **Rotazione verso self-hosted**: se in futuro si migrasse da Plausible Cloud a un'istanza self-hosted, l'unica modifica necessaria è l'URL `src` nelle 24 pagine (stesso meccanismo di ricerca-e-sostituzione già usato in questo intervento per aggiungere il tag) e, se l'istanza self-hosted usa un dominio diverso da quello di default, l'attributo `data-api` (non necessario con la configurazione attuale).
- **Nuova pagina reale aggiunta al sito**: aggiungere lo stesso tag `<script>` nel suo `<head>`, seguendo esattamente il pattern delle altre 24 pagine (nessuna variazione per profondità di percorso: l'URL dello script è assoluto).
- **Il tag NON va aggiunto** alle pagine di redirect legacy (`patch-pvc.html` e affini in root): non fanno parte del funnel misurato.

## 6. Copertura KPI — verifica onesta, nessun workaround inventato

Verifica di ciascun KPI proposto in `PATCHLAB_MEASUREMENT_STRATEGY.md` (repository `euroricami-ai-os`) contro ciò che questa implementazione può realmente calcolare:

| KPI | Calcolabile con questa implementazione? | Nota |
|---|---|---|
| Lead Conversion Rate | **Sì, in forma aggregata** | `quote_form_success` ÷ visitatori unici di periodo. Un'attribuzione rigorosa "stessa sessione" richiede la funzione **Funnels** di Plausible (add-on a pagamento sui piani superiori) o l'API Stats; senza, il rapporto resta un tasso aggregato di periodo, non un funnel per-sessione — comunque un numero valido e utile, con questo limite dichiarato |
| Intent Rate | Sì, in forma aggregata | Stesso limite di cui sopra (`quote_form_view` ÷ page_view di periodo) |
| Form Completion Rate | **Sì, direttamente** | `quote_form_submit` ÷ `quote_form_start`: entrambi eventi custom, rapporto diretto, non richiede attribuzione cross-pagina |
| Form Success Rate | **Sì, direttamente** | `quote_form_success` ÷ `quote_form_submit`, stesso motivo |
| Page Conversion Rate (per pagina tecnica) | **Parzialmente — limite reale, non un workaround** | Plausible, per progettazione privacy-first, non espone il percorso individuale di un singolo visitatore tra pagine diverse (nessun ID persistente). Attribuire una conversione avvenuta su `/quote/` a una specifica pagina tecnica visitata prima richiede la funzione Funnels (che modella sequenze di pagine su base statistica aggregata, non un vero join per-visitatore) o l'esportazione via Stats API con logica di sessione personalizzata. **Senza queste, il KPI così come definito in astratto non è calcolabile con precisione**: l'unico dato robusto disponibile è il traffico per pagina (nativo) incrociato con gli eventi CTA/form in modo aggregato temporale, non attribuito |
| CTA Click-Through Rate per posizione | **Sì, con un limite di piano** | `quote_cta_click` con prop `cta_location` è implementato e funzionante; la *scomposizione* per valore di proprietà personalizzata (vedere il breakdown per `header` vs `hero` vs `final-cta` nella dashboard) è disponibile nei piani Plausible con supporto alle "custom properties" (non nel piano Community/free più essenziale) — da verificare al momento della scelta del piano |
| Trend pre/post modifica | **Sì, pienamente** | Nessun limite: è un confronto temporale sullo stesso KPI aggregato, che Plausible mostra nativamente per intervallo di date; la correlazione con i deploy avviene tramite la Deployment Timeline (repository `euroricami-ai-os`, `observability/deployment-timeline/`), non tramite Plausible stesso |
| Proxy efficacia foto | Sì, pienamente | Stesso meccanismo del trend pre/post — era già definito come proxy, non come misura diretta |
| LCR per lingua | **Sì, pienamente** | Le pagine EN e IT vivono su percorsi distinti (root vs `/it/...`); Plausible segmenta nativamente per URL, nessuna proprietà custom necessaria |
| Mix di canale | **Sì, pienamente** | Plausible traccia nativamente i referrer/le sorgenti di traffico (funzionalità core, non un add-on) |
| Device split | **Sì, pienamente** | Plausible traccia nativamente il tipo di dispositivo (funzionalità core) |

**Sintesi onesta**: 8 KPI su 10 sono pienamente calcolabili con l'implementazione attuale. 2 (Lead Conversion Rate e Intent Rate) sono calcolabili solo in forma aggregata, non come vero funnel per-sessione, per un limite architetturale intenzionale di Plausible (privacy-first, nessun ID persistente) — non un difetto di questa implementazione. 1 (Page Conversion Rate) ha una limitazione reale e dichiarata: non è attribuibile con precisione senza un add-on a pagamento o un'integrazione con la Stats API, entrambi fuori dal perimetro di questo intervento (nessuna spesa aggiuntiva né sviluppo custom è stata autorizzata). **Nessun workaround è stato inventato per aggirare questi limiti**: sono documentati qui perché la direzione ne sia consapevole prima di aspettarsi un numero che oggi non è ottenibile senza un investimento ulteriore.

## 7. Punti di estensione futuri

- **Plausible Funnels** (piano a pagamento): risolverebbe l'attribuzione per-sessione di Lead Conversion Rate, Intent Rate e Page Conversion Rate — valutare se il volume di traffico di PatchLab giustifica il costo, prima di introdurlo.
- **Plausible Stats API**: permetterebbe di costruire la dashboard ideale a 6 pannelli descritta in `PATCHLAB_MEASUREMENT_STRATEGY.md` §4 come vista personalizzata, incluso il pannello "Annotazioni di deploy" che oggi richiede di guardare Plausible e la Deployment Timeline separatamente.
- **UTM/campagne**: se in futuro si avviassero campagne a pagamento, i parametri UTM standard funzionano già nativamente con Plausible senza modifiche al codice.
- **Ulteriori eventi**: nessuno è proposto in questa fase (coerente con il principio "misurare solo ciò che serve" — vedi `PATCHLAB_MEASUREMENT_STRATEGY.md` §3, "nessun evento aggiuntivo è proposto"). Se emergesse un bisogno reale, va prima progettato in `euroricami-ai-os` (aggiornando la strategia canonica), poi implementato qui — mai il contrario.
