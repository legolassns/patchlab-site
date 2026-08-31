# Knowledge Platform — implementazione tecnica

> Ultimo aggiornamento: 2026-07-27 · Ambito: **implementazione** della base di conoscenza PatchLab in questo repository.
>
> La **strategia** (tassonomia completa, topical map, keyword, roadmap editoriale 24 mesi, internal linking) vive in `euroricami-ai-os`, non qui:
> `integrations/patchlab/PATCHLAB_KNOWLEDGE_ARCHITECTURE.md`, `PATCHLAB_SEO_ARCHITECTURE.md`, `PATCHLAB_EDITORIAL_ROADMAP.md`.
> Questo file risponde a una sola domanda: **come si aggiunge correttamente una pagina di conoscenza a questo sito.**

---

## 1. Struttura delle route

| Ruolo | IT | EN |
|---|---|---|
| Hub della base di conoscenza | `/it/guide/` | `/guides/` |
| Guida (pillar o supporting) | `/it/guide/<slug-it>/` | `/guides/<slug-en>/` |
| Glossario | `/it/glossario/` | `/glossary/` |

**Massimo due livelli sotto la lingua.** Le categorie tematiche (sei, elencate nell'hub) sono un raggruppamento *editoriale e di navigazione*, **non** un livello di URL: non esistono pagine di categoria. Motivo: a questo volume di contenuti una pagina di categoria sarebbe sottile, competerebbe con l'hub per le stesse query e allungherebbe gli URL senza aggiungere informazione.

Gli slug non si traducono meccanicamente: `scegliere-la-patch-giusta` ↔ `choosing-the-right-patch`. Ogni slug è la keyword primaria della pagina nella sua lingua, coerente con la scelta già fatta per le pagine tecnica (`patch-ricamate` ↔ `patch-embroidered`).

## 2. Stato attuale (2026-07-27)

Pubblicate 6 pagine, 3 coppie EN↔IT:

| Pagina | IT | EN |
|---|---|---|
| Hub | `it/guide/index.html` | `guides/index.html` |
| Pillar 1 — scelta della lavorazione | `it/guide/scegliere-la-patch-giusta/index.html` | `guides/choosing-the-right-patch/index.html` |
| Glossario (34 voci) | `it/glossario/index.html` | `glossary/index.html` |

Route reali totali del sito: **30** (erano 24). Vedi `sitemap.xml`.

## 3. Checklist obbligatoria per ogni nuova pagina di conoscenza

Da eseguire **interamente**: saltare un punto produce una pagina che esiste in locale ma non online, o online ma non indicizzabile.

1. **Crea la coppia EN + IT.** Una pagina senza controparte rompe la parità `hreflang` del sito. Se il contenuto per una lingua non è pronto, non pubblicare nemmeno l'altra.
2. **Copia l'intero `<head>` da una pagina di conoscenza esistente** e adatta: `title`, `description`, `canonical`, i tre `hreflang` (`it`, `en`, `x-default`), gli `og:*`, i percorsi relativi di favicon/CSS.
   - `x-default` punta sempre alla pagina **inglese dello stesso cluster** — non alla home del sito (l'inglese è la lingua di default, EN vive alla radice). Le pagine di conoscenza hanno sempre seguito questa regola; dal 2026-08-31 la seguono tutte e 30 le route, uniformando le 22 che puntavano genericamente a `https://patchlab.net/`.
   - Lo snippet Plausible va incluso **integralmente** (entrambi i `<script>`), **una sola volta**, **immediatamente prima di `</head>`**, e **senza** l'attributo `data-domain`. Senza di esso la pagina è invisibile alla misurazione; duplicato, produce due pageview per visita e falsa ogni tasso di conversione. Copialo da una pagina di conoscenza esistente o da `docs/PLAUSIBLE_SETUP.md` §1 — è identico su ogni pagina, a qualunque profondità di percorso, perché l'URL dello script è assoluto:

     ```html
     <!-- Privacy-friendly analytics by Plausible -->
     <script async src="https://plausible.io/js/pa-GZufIkbU_YAkYX2J4B55w.js"></script>
     <script>
       window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};
       plausible.init()
     </script>
     ```

     Vale per le pagine reali. Le pagine legacy con `<meta http-equiv="refresh">` in root non vanno mai tracciate, perché genererebbero due pageview per una sola visita (`docs/PLAUSIBLE_SETUP.md` §1.1, regola 4).
3. **Copia header e footer** da una pagina di conoscenza dello stesso livello di profondità (i percorsi relativi cambiano con la profondità: `../`, `../../`, `../../../`) e correggi il link del `lang-switch` verso la controparte nell'altra lingua.
4. **JSON-LD**: `Article` + `BreadcrumbList` per una guida, `CollectionPage` per un hub, `DefinedTermSet` per un glossario. Riusa il nodo `Organization` con `@id` `https://patchlab.net/#organization` invece di ridefinirlo. Ogni affermazione nel markup deve corrispondere al contenuto visibile della pagina.
5. **`sitemap.xml`**: aggiungi entrambe le route, ciascuna con i tre `xhtml:link` reciproci.
6. **Deploy whitelist** — il punto che si dimentica: se la pagina è **inglese**, aggiungi la sua cartella radice a `EN_PAGE_DIRS` in `.github/workflows/deploy-production.yml`. Le sottocartelle di una radice già elencata (es. `guides/nuova-guida/`) sono coperte dalla `cp -r` e non vanno aggiunte. Le pagine **italiane** non richiedono nulla: `it/` è copiata interamente. Dal 2026-08-31 esiste un blocco condizionale speculare per `fr/`: anch'esso non richiederà nulla quando la cartella verrà creata (oggi non esiste e il blocco è inerte).
7. **Internal linking minimo** (senza questo la pagina nasce orfana):
   - dall'hub verso la nuova guida;
   - dalla nuova guida verso l'hub, il glossario e almeno una pagina tecnica pertinente;
   - da almeno una pagina esistente pertinente verso la nuova guida.
8. **Nessun `.md` dentro le cartelle pubbliche.** La verifica di sicurezza del workflow interrompe il deploy se trova Markdown in `_release/`: la documentazione vive solo in `docs/` e nella root, mai in `guides/`, `glossary/`, `it/guide/`, `it/glossario/`.
9. **Registra il deploy** nella Deployment Timeline di `euroricami-ai-os` (`observability/deployment-timeline/patchlab-site.md`), altrimenti l'effetto della pubblicazione sui KPI non sarà correlabile a niente.

## 4. Componenti da riusare (nessun CSS nuovo)

La Knowledge Platform è stata costruita **senza aggiungere una riga a `style.css`**: usa solo componenti già in produzione altrove. Continua così — un componente nuovo è una decisione di design, non un dettaglio di contenuto.

| Serve per | Componente | Dove è già usato |
|---|---|---|
| Intestazione di pagina + breadcrumb | `.page-header` + `<p class="eyebrow">` con un `.link` dentro | `privacy/`, pagine di conoscenza |
| Testo lungo | `.container-narrow.prose` | `privacy/` |
| Griglia di voci/definizioni | `.card-grid.card-grid-3` + `.card.card-simple` | home, pagine tecnica |
| Specifiche a coppie chiave/valore | `.spec-list` | pagine tecnica |
| Checklist evidenziata | `.checklist-panel` + `-title` / `-list` / `-item` / `-note` | `quote/`, `it/preventivo/` |
| Avviso o nota tecnica | `.callout.callout-info` / `.callout-attention` / `.callout-expert` | `laboratory/`, `portfolio/` |
| Errori comuni / note didattiche | `.academy-grid` + `.academy-note` | pagine tecnica |
| FAQ | `.faq-list` + `<details class="faq-item">` | home, pagine tecnica |
| CTA intermedia / finale | `.cta-soft` / `.cta-preventivo` | tutte le pagine |

## 5. Misurazione

Nessun evento nuovo è stato introdotto: le pagine di conoscenza sono misurate con i **9 eventi già approvati** (vedi `ANALYTICS_MEASUREMENT_PLAN.md` e `docs/PLAUSIBLE_SETUP.md`).

- `page_view` — nativo, per pagina: dà traffico e Page Conversion Rate per ogni guida.
- `quote_cta_click` — le CTA delle pagine di conoscenza ricadono nei valori esistenti di `cta_location`: `header`, `final-cta` (la sezione `.cta-preventivo`), `footer`. Le pagine di conoscenza **non** usano `.cta-soft`, quindi `mid-page` resta un segnale specifico della home e delle pagine tecnica: non introdurre `.cta-soft` in una guida senza tenere conto di questo effetto sulla segmentazione.
- Nessun dato personale, nessun contenuto di form: vincolo invariato e non negoziabile.

La domanda a cui questa sezione deve poter rispondere nel tempo è: *una guida genera richieste di preventivo, o solo traffico?* Si misura confrontando il Page Conversion Rate delle guide con quello delle pagine tecnica, non guardando i pageview in assoluto.

## 6. Vincoli editoriali (non stilistici — sostanziali)

Valgono per ogni pagina di conoscenza, in entrambe le lingue:

1. **Nessun dato inventato.** Nessun numero (anni di attività, pezzi prodotti, tempi garantiti, percentuali) che non sia verificabile. Dove il dato dipende dal progetto, si dichiara che dipende dal progetto.
2. **Dichiarare i limiti.** Ogni guida che raccomanda una lavorazione dice anche quando *non* va scelta e rimanda all'alternativa. È la ragione per cui queste pagine sono credibili.
3. **Nessun prezzo, nessuna marginalità, nessuna regola interna.** Confine architetturale già ratificato: questo repository non è fonte di conoscenza economica o di policy aziendale.
4. **Nessun nome di cliente non già pubblico.** Valgono solo i soggetti già visibili nel portfolio e negli alt text esistenti.
5. **Un solo `<h1>` per pagina**, coerente con la keyword primaria; `<h2>` per le sezioni.
6. **Alt text descrittivi e specifici** su ogni immagine, come già fatto nelle pagine tecnica.
