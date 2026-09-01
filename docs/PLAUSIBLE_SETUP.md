# PatchLab Plausible Setup

Documento di riferimento operativo per l'integrazione di Plausible Analytics su PatchLab. Scritto per chi dovrà intervenire su questo sistema senza aver seguito la sua storia.

Questo file resta nel repository ma **non viene mai pubblicato online**: è un file `.md`, escluso per costruzione dal deploy (whitelist esplicita in `.github/workflows/deploy-production.yml`, con verifica dedicata che blocca il deploy se un `.md` finisse in `_release/`).

Documento correlato, più orientato al *contratto* degli eventi (cosa si misura, perché, cosa è vietato): [`ANALYTICS_MEASUREMENT_PLAN.md`](../ANALYTICS_MEASUREMENT_PLAN.md). Questo documento si concentra sul *come*: installazione, configurazione, manutenzione, estensione futura.

Decisione a monte (non presa qui): Plausible è stato scelto dalla direzione dopo un confronto neutro di 6 strumenti candidati, documentato nel repository `euroricami-ai-os` (`integrations/patchlab/PATCHLAB_MEASUREMENT_STRATEGY.md` §6). Questo documento implementa quella decisione, non la ridiscute.

---

## 1. Cos'è stato installato

Uno **snippet unico, identico su tutte le 42 route reali** del sito. È lo snippet ufficiale fornito da Plausible al momento della registrazione del sito, e sostituisce integralmente l'integrazione precedente — un singolo tag `<script defer>` che caricava il file generico di Plausible e identificava il sito con l'attributo `data-domain`. Quel tag **non è più presente in nessun file del repository**.

```html
<!-- Privacy-friendly analytics by Plausible -->
<script async src="https://plausible.io/js/pa-GZufIkbU_YAkYX2J4B55w.js"></script>
<script>
  window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};
  plausible.init()
</script>
```

### 1.1 Regole di installazione — non negoziabili

1. **Una sola volta per pagina.** Lo snippet comprende *due* `<script>`: il caricamento del file remoto e l'inizializzazione. Vanno insieme, e la coppia va inserita una volta sola. Due copie sullo stesso documento significano due pageview per visita, cioè un denominatore gonfiato su ogni KPI di conversione.
2. **Immediatamente prima di `</head>`.** Non a metà dell'`<head>`, non accodato alla riga del CSS, non in fondo al `<body>`. La posizione uniforme è ciò che rende verificabile con un solo controllo automatico che tutte le pagine siano tracciate allo stesso modo.
3. **Mai l'attributo `data-domain`.** Non serve e non va aggiunto: il sito è già identificato dall'ID dentro il nome del file (`pa-GZufIkbU_YAkYX2J4B55w.js`). Se trovi un tag Plausible con l'attributo `data-domain`, è un residuo della vecchia integrazione e va rimosso.
4. **Mai sulle pagine legacy con meta refresh** (`patch-pvc.html`, `patch-ricamate.html`, `patch-sublimatiche.html`, `patch-termosaldabili.html`, `patch-velcro.html`, `patch-woven.html`, `portfolio.html`, `preventivo.html` in root). Non è una dimenticanza: quelle pagine rimandano via `<meta http-equiv="refresh">` alla pagina reale. Tracciarle produrrebbe **due pageview per una sola visita** — uno per lo stub, uno per la destinazione — falsando il denominatore del Lead Conversion Rate, il KPI più importante del sito. Sono inoltre già escluse dall'indicizzazione via `robots.txt` e non fanno parte del funnel misurato.

### 1.2 Caratteristiche dello snippet

- **ID specifico del sito**: il nome del file (`pa-GZufIkbU_YAkYX2J4B55w.js`) identifica *questo* sito nell'account Plausible. **Non è riutilizzabile su un altro dominio**: copiarlo altrove attribuirebbe quel traffico a PatchLab. Un nuovo sito richiede un nuovo snippet generato da Plausible.
- **`async`**: il caricamento non blocca il rendering della pagina (nessun impatto percepibile sulle performance o sul Core Web Vital LCP).
- **Coda degli eventi**: il secondo `<script>` definisce `window.plausible` come funzione che accumula le chiamate in `plausible.q` finché il file remoto non è caricato. Conseguenza pratica: un evento generato prima del caricamento **non viene perso**, viene accodato e inviato dopo. È un miglioramento rispetto all'integrazione precedente, dove un evento anticipato veniva scartato.
- **Pageview automatico**: la chiamata `plausible.init()` nello snippet attiva il tracciamento automatico del pageview. Per questo `page_view` non ha alcuna implementazione in `main.js` (vedi `ANALYTICS_MEASUREMENT_PLAN.md`).
- **Cookieless**: non imposta alcun cookie, non usa `localStorage` per identificare il visitatore tra sessioni.
- **Nessun fingerprinting persistente**: Plausible calcola un identificatore giornaliero non riconducibile a un individuo (hash di IP + user agent + dominio + salt che ruota ogni giorno), mai salvato, mai esposto.

## 2. Prerequisito operativo — COMPLETATO

**Il dominio `patchlab.net` è stato registrato come sito in un account Plausible** (dichiarazione della Direzione, 2026-07-27). Lo snippet di §1 è quello generato da Plausible al termine di quella registrazione: l'ID nel nome del file è la prova che il sito esiste nell'account. Questo chiude il prerequisito che era rimasto aperto dal MODE 6B.

Cronologia, perché resti leggibile a chi arriva dopo:

| Data | Stato |
|---|---|
| 2026-07-23 (MODE 6B) | Tag generico con attributo `data-domain` installato sulle 24 route allora esistenti. **Nessun account Plausible registrato**: gli eventi partivano e venivano scartati |
| 2026-07-27 (MODE 6D) | Route portate a 30, script generico presente anche sulle 6 pagine nuove |
| 2026-07-27 (questo intervento) | Sito registrato in Plausible; **snippet generico sostituito** su tutte e 30 le route con lo snippet specifico del sito. Da qui i dati arrivano davvero in dashboard |

### Verifica di attivazione (da eseguire alla prima visita reale dopo il deploy)

1. Aprire la dashboard Plausible del sito `patchlab.net`.
2. Visitare una pagina qualunque del sito pubblico e verificare che il **pageview** compaia entro pochi minuti.
3. Visitare `/quote/` o `/it/preventivo/` e interagire col form: verificare che compaiano gli eventi custom elencati in `ANALYTICS_MEASUREMENT_PLAN.md` (`quote_form_view`, `quote_form_start`, e — su un invio reale — `quote_form_submit` e `quote_form_success`).
4. Verificare che il conteggio dei pageview **non sia doppio** su una singola visita: sarebbe il sintomo di uno snippet duplicato in pagina (§1.1, regola 1) o del tracciamento erroneo di una pagina legacy (regola 4).
5. Se il piano attivo non include il breakdown delle proprietà personalizzate degli eventi, leggere la nota di copertura KPI in §6 prima di considerare "risolti" tutti i KPI del piano di misurazione.

Se un giorno lo script non fosse raggiungibile (blocco pubblicitario, rete, disservizio), il sito **continua a funzionare normalmente**: `trackEvent()` in `main.js` degrada in sicurezza e non genera alcun errore JavaScript. Nota: con il nuovo snippet la guardia `typeof window.plausible !== "function"` è soddisfatta già prima del caricamento del file remoto (lo stub di coda è una funzione), quindi gli eventi vengono accodati invece che scartati — vedi §1.2.

## 3. Eventi custom — dove vivono nel codice

Tutta la logica è in `main.js` (nessuna dipendenza esterna, nessun bundler):

**La logica degli eventi custom non è cambiata con la migrazione dello snippet**: `main.js` non è stato modificato. Continua a chiamare `window.plausible(name, { props })`, che è l'interfaccia esposta identica dal nuovo snippet — l'unica differenza è che ora le chiamate anticipate vengono accodate invece che perse (§1.2).

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

Vincolo assoluto, verificato riga per riga in `main.js` durante questo intervento: nessuna chiamata a `trackEvent()` referenzia mai `nome`, `azienda`, `email`, `telefono`, `note`, il contenuto di `tipo-patch`/`applicazione`/`quantita`, o l'indirizzo IP del visitatore. Gli unici valori passati come `props` in tutto il codice sono: `lang`/`from_lang`/`to_lang` (`"en"`/`"it"`/`"fr"`/`"es"`, più `"unknown"` per il solo `to_lang` se il link dello switcher è privo di `hreflang` valido — vedi `ANALYTICS_MEASUREMENT_PLAN.md`, sezione "Lingua negli eventi"; `"es"` è previsto dal codice ma non ancora osservabile, nessuna pagina spagnola è pubblicata), `cta_location` (una stringa fissa tra `header`/`hero`/`mid-page`/`final-cta`/`footer`/`other`), `error_kind` (`"server"`/`"network"`), `path` (solo per `mailto_click`, il percorso della pagina — mai un dato del visitatore). Nessun valore proviene da un campo del form.

## 5. Manutenzione

- **Aggiornare la versione dello script**: non serve. Plausible versiona il proprio script lato server; l'URL punta sempre alla versione corrente per questo sito.
- **Nuova pagina reale aggiunta al sito**: copiare lo snippet di §1 **integralmente** (entrambi i `<script>`) nel suo `<head>`, immediatamente prima di `</head>`, rispettando le quattro regole di §1.1. Nessuna variazione per profondità di percorso: l'URL dello script è assoluto, quindi lo snippet è identico in `index.html` e in `it/guide/scegliere-la-patch-giusta/index.html`.
- **Lo snippet NON va aggiunto** alle pagine di redirect legacy (`patch-pvc.html` e affini in root): §1.1, regola 4.
- **Non aggiungere `data-domain`**: §1.1, regola 3. Il sito è identificato dall'ID nel nome del file.
- **Non riusare questo snippet su un altro sito**: l'ID è specifico di `patchlab.net`; su un dominio diverso attribuirebbe quel traffico a PatchLab. Un nuovo sito richiede uno snippet nuovo generato da Plausible.
- **Rotazione verso self-hosted**: se in futuro si migrasse da Plausible Cloud a un'istanza self-hosted, servirebbe rigenerare lo snippet dall'istanza e sostituirlo su tutte e 42 le pagine (stesso meccanismo di ricerca-e-sostituzione già usato in questo intervento), non una semplice modifica dell'URL.
- **Verifica automatica dopo qualunque modifica allo snippet**: controllare su tutte le route reali che l'ID del sito compaia **una sola volta**, che `plausible.init()` compaia **una sola volta**, che lo snippet sia **immediatamente prima di `</head>`**, e che non esista alcun residuo del vecchio file generico di Plausible né dell'attributo `data-domain`.

## 6. Copertura KPI — verifica onesta, nessun workaround inventato

Verifica di ciascun KPI proposto in `PATCHLAB_MEASUREMENT_STRATEGY.md` (repository `euroricami-ai-os`) contro ciò che questa implementazione può realmente calcolare:

| KPI | Calcolabile con questa implementazione? | Nota |
|---|---|---|
| Lead Conversion Rate | **Sì, in forma aggregata** | `quote_form_success` ÷ visitatori unici di periodo. Un'attribuzione rigorosa "stessa sessione" richiede la funzione **Funnels** di Plausible (add-on a pagamento sui piani superiori) o l'API Stats; senza, il rapporto resta un tasso aggregato di periodo, non un funnel per-sessione — comunque un numero valido e utile, con questo limite dichiarato |
| Intent Rate | Sì, in forma aggregata | Stesso limite di cui sopra (`quote_form_view` ÷ page_view di periodo) |
| Form Completion Rate | **Sì, direttamente** | `quote_form_submit` ÷ `quote_form_start`: entrambi eventi custom, rapporto diretto, non richiede attribuzione cross-pagina |
| Form Success Rate | **Sì, direttamente** | `quote_form_success` ÷ `quote_form_submit`, stesso motivo |
| Page Conversion Rate (per pagina tecnica) | **Parzialmente — limite reale, non un workaround** | Plausible, per progettazione privacy-first, non espone il percorso individuale di un singolo visitatore tra pagine diverse (nessun ID persistente). Attribuire una conversione avvenuta su `/quote/` a una specifica pagina tecnica visitata prima richiede la funzione Funnels (che modella sequenze di pagine su base statistica aggregata, non un vero join per-visitatore) o l'esportazione via Stats API con logica di sessione personalizzata. **Senza queste, il KPI così come definito in astratto non è calcolabile con precisione**: l'unico dato robusto disponibile è il traffico per pagina (nativo) incrociato con gli eventi CTA/form in modo aggregato temporale, non attribuito |
| CTA Click-Through Rate per posizione | **Sì, con un limite di piano** | `quote_cta_click` con prop `cta_location` è implementato e funzionante; la *scomposizione* per valore di proprietà personalizzata (vedere il breakdown per `header` vs `hero` vs `mid-page` vs `final-cta` nella dashboard) è disponibile nei piani Plausible con supporto alle "custom properties" (non nel piano Community/free più essenziale) — da verificare al momento della scelta del piano |
| Trend pre/post modifica | **Sì, pienamente** | Nessun limite: è un confronto temporale sullo stesso KPI aggregato, che Plausible mostra nativamente per intervallo di date; la correlazione con i deploy avviene tramite la Deployment Timeline (repository `euroricami-ai-os`, `observability/deployment-timeline/`), non tramite Plausible stesso |
| Proxy efficacia foto | Sì, pienamente | Stesso meccanismo del trend pre/post — era già definito come proxy, non come misura diretta |
| LCR per lingua | **Sì, pienamente** | Le pagine EN, IT e FR vivono su percorsi distinti (root, `/it/...`, `/fr/...`); Plausible segmenta nativamente per URL, nessuna proprietà custom necessaria. Vale identico per una futura quarta lingua sotto `/es/...`: nessuna configurazione da aggiungere |
| Mix di canale | **Sì, pienamente** | Plausible traccia nativamente i referrer/le sorgenti di traffico (funzionalità core, non un add-on) |
| Device split | **Sì, pienamente** | Plausible traccia nativamente il tipo di dispositivo (funzionalità core) |

**Sintesi onesta**: 8 KPI su 10 sono pienamente calcolabili con l'implementazione attuale. 2 (Lead Conversion Rate e Intent Rate) sono calcolabili solo in forma aggregata, non come vero funnel per-sessione, per un limite architetturale intenzionale di Plausible (privacy-first, nessun ID persistente) — non un difetto di questa implementazione. 1 (Page Conversion Rate) ha una limitazione reale e dichiarata: non è attribuibile con precisione senza un add-on a pagamento o un'integrazione con la Stats API, entrambi fuori dal perimetro di questo intervento (nessuna spesa aggiuntiva né sviluppo custom è stata autorizzata). **Nessun workaround è stato inventato per aggirare questi limiti**: sono documentati qui perché la direzione ne sia consapevole prima di aspettarsi un numero che oggi non è ottenibile senza un investimento ulteriore.

## 7. Punti di estensione futuri

- **Plausible Funnels** (piano a pagamento): risolverebbe l'attribuzione per-sessione di Lead Conversion Rate, Intent Rate e Page Conversion Rate — valutare se il volume di traffico di PatchLab giustifica il costo, prima di introdurlo.
- **Plausible Stats API**: permetterebbe di costruire la dashboard ideale a 6 pannelli descritta in `PATCHLAB_MEASUREMENT_STRATEGY.md` §4 come vista personalizzata, incluso il pannello "Annotazioni di deploy" che oggi richiede di guardare Plausible e la Deployment Timeline separatamente.
- **UTM/campagne**: se in futuro si avviassero campagne a pagamento, i parametri UTM standard funzionano già nativamente con Plausible senza modifiche al codice.
- **Ulteriori eventi**: nessuno è proposto in questa fase (coerente con il principio "misurare solo ciò che serve" — vedi `PATCHLAB_MEASUREMENT_STRATEGY.md` §3, "nessun evento aggiuntivo è proposto"). Se emergesse un bisogno reale, va prima progettato in `euroricami-ai-os` (aggiornando la strategia canonica), poi implementato qui — mai il contrario.
