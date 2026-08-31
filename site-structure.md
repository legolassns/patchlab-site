# Struttura del sito — PatchLab by Euroricami

> Ultimo aggiornamento: 2026-08-31 (fondazione tecnica per una terza lingua; le versioni precedenti di questo file erano rimaste indietro rispetto al codice).

Sito statico (HTML + CSS + JS vanilla, nessun framework, nessun build system), una pagina per file. Progetto verticale di Euroricami dedicato esclusivamente alle patch personalizzate. Bilingue: **inglese alla radice**, **italiano sotto `it/`**, parità 1:1 con `hreflang` reciproco.

**Terza lingua (francese): prevista dall'architettura, non pubblicata.** Dal 2026-08-31 il codice condiviso (`main.js`, `api/invia-preventivo.php`, workflow di deploy) regge una terza lingua senza ulteriori refactor. **La cartella `fr/` non esiste, nessuna pagina francese è online, nessun `hreflang="fr"` è dichiarato e il sitemap non contiene URL francesi.** Le route pubbliche restano **30**. Dettaglio dei punti predisposti nella sezione "Predisposizione FR" in fondo.

## Route reali: 30 (15 EN + 15 IT)

```
Radice = INGLESE                          it/ = ITALIANO
────────────────────                      ──────────────
/                                         /it/                          Home
/patch-embroidered/                       /it/patch-ricamate/           Lavorazione
/patch-woven/                             /it/patch-woven/              Lavorazione
/patch-pvc/                               /it/patch-pvc/                Lavorazione
/patch-sublimated/                        /it/patch-sublimatiche/       Lavorazione
/patch-hook-and-loop/                     /it/patch-velcro/             Supporto
/patch-iron-on/                           /it/patch-termosaldabili/     Supporto
/portfolio/                               /it/portfolio/                Prova sociale
/how-we-work/                             /it/come-lavoriamo/           Metodo
/laboratory/                              /it/laboratorio/              Autorevolezza
/quote/                                   /it/preventivo/               CONVERSIONE (form)
/privacy/                                 /it/privacy/                  Legale
/guides/                                  /it/guide/                    Knowledge hub
/guides/choosing-the-right-patch/         /it/guide/scegliere-la-patch-giusta/   Pillar guide
/glossary/                                /it/glossario/                Glossario (34 voci)
```

## Altri file pubblici

```
style.css          Foglio di stile unico (design system, token CSS in :root)
main.js            Menu mobile, link attivo in nav, form preventivo, eventi Plausible
robots.txt         Consente le route reali, esclude /api/ e gli 8 stub legacy
sitemap.xml        30 route reali, hreflang reciproco per coppia
                   (x-default = URL EN dello stesso cluster, vedi Note tecniche)
api/invia-preventivo.php    Unico endpoint applicativo (invio preventivo via SMTP Zoho)
vendor/phpmailer/  PHPMailer vendorizzato (nessun Composer)
assets/img/        Fotografie reali di prodotto + loghi/favicon in assets/img/logo/
```

**Stub legacy** in root (`patch-pvc.html`, `patch-ricamate.html`, `patch-sublimatiche.html`, `patch-termosaldabili.html`, `patch-velcro.html`, `patch-woven.html`, `portfolio.html`, `preventivo.html`): redirect via `<meta http-equiv="refresh">` verso l'equivalente `it/`, pre-esistenti al lancio EN/IT. Esclusi dall'indicizzazione via `robots.txt`, non in navigazione, non contati tra le 30 route reali.

## Documentazione interna (mai pubblicata online)

```
DEPLOY_SETUP.md              Deploy FTPS su DominiOK, secrets, rollback, GitHub Pages
FORM_SETUP.md                Modulo preventivo: campi, validazione, anti-spam, SMTP
ANALYTICS_MEASUREMENT_PLAN.md 9 eventi di misurazione, implementati
docs/SMTP_SETUP.md           Configurazione Zoho (autoritativo: 587/STARTTLS)
docs/PLAUSIBLE_SETUP.md      Integrazione Plausible, copertura KPI e suoi limiti
docs/KNOWLEDGE_PLATFORM.md   Come aggiungere una pagina di conoscenza (checklist)
site-structure.md            Questo file
seo-keywords.md              Mappa keyword per pagina
copy-home.md                 Testi della home in formato editabile
```

Il workflow di deploy usa una **whitelist esplicita**: la documentazione `.md` non finisce mai online, ed è presente una verifica di sicurezza che interrompe il deploy se trova Markdown in `_release/`.

## Note tecniche

- **Header e footer sono ripetuti identici in ogni pagina HTML** (nessun template engine): per modificarli va aggiornato ogni file. Il footer ha 5 colonne — brand, Lavorazioni, Supporti, **Conoscenza**, Contatti.
- Il logo è composto da due parti: "PatchLab" (classe `.logo`) e "by Euroricami" (classe `.logo-sub`), definite in `style.css`.
- La **navigazione principale** è: Patch Ricamate, Woven HD, Patch PVC, Sublimatiche, Portfolio, Come lavoriamo (+ CTA preventivo + switch EN/IT). Velcro, termosaldabili, guide e glossario sono raggiungibili dal footer, dalla home e dai link contestuali — **non** dalla nav principale: aggiungere una settima voce va verificato prima su un browser reale (c'è un precedente di wrap del menu con le etichette inglesi, documentato in `style.css` §`.header-actions`).
- Le immagini reali vivono in `assets/img/`, con nomi file SEO-friendly (`patch-<lavorazione>-<soggetto>.jpg`). Le fotografie reali di patch velcro e sublimatica **esistono** (`patch-velcro-ricamata-pannello-loop.jpg`, `patch-sublimatica-lupebasket-dettaglio.jpg`, aggiunte il 2026-07-22): le versioni precedenti di questo file le dichiaravano erroneamente ancora assenti.
- **Il form preventivo è attivo e funzionante**: invia email reali a `info@patchlab.net` via SMTP autenticato Zoho (porta 587/STARTTLS), con honeypot, controllo di timing, rate limiting per IP e validazione whitelist lato server. Le versioni precedenti di questo file lo dichiaravano erroneamente ancora solo lato client.
- Colori, spaziature e font sono definiti come variabili CSS in cima a `style.css` (`:root`): da lì si modifica la palette in un punto solo.
- **Misurazione (dal 2026-07-23)**: ogni pagina reale include il tag di Plausible Analytics (cookieless, nessun dato personale) e `main.js` genera gli eventi custom del funnel di conversione. Dettaglio: `docs/PLAUSIBLE_SETUP.md` e `ANALYTICS_MEASUREMENT_PLAN.md`.
- **`x-default` (uniformato il 2026-08-31)**: punta sempre alla **pagina inglese dello stesso cluster**, non alla home. Prima convivevano due convenzioni — le 8 route di conoscenza/privacy seguivano già questa regola, le altre 22 puntavano tutte a `https://patchlab.net/`. La regola era già quella scritta in `docs/KNOWLEDGE_PLATFORM.md`, ma non era applicata ovunque. Vale identica nei `<head>` e in `sitemap.xml`.
- **Knowledge Platform (dal 2026-07-27)**: le 6 pagine di conoscenza sono le sole del sito con dati strutturati JSON-LD e sono costruite riusando esclusivamente componenti CSS già esistenti (nessuna riga aggiunta a `style.css`). Regole e checklist di pubblicazione: `docs/KNOWLEDGE_PLATFORM.md`.

## Predisposizione FR (2026-08-31) — architettura pronta, nessun contenuto pubblicato

Interventi eseguiti sul **codice condiviso**, senza creare alcuna pagina francese. Servono a evitare che l'aggiunta di una terza lingua richieda un refactor a valle, quando sarebbe più rischioso.

| Punto | Prima | Ora |
|---|---|---|
| `main.js` — lingua corrente | `lang === "en" ? "en" : "it"`: qualunque lingua non inglese diventava "it" | `getCurrentLang()` valida contro `SUPPORTED_LANGUAGES` (`en`/`it`/`fr`) e degrada su `en` |
| `main.js` — messaggi del form | Ternario a due rami | Lookup `QUOTE_FORM_MESSAGES` a tre chiavi (le stringhe FR sono provvisorie) |
| `main.js` — messaggio dal server | Mostrato a chiunque non fosse EN | Mostrato solo se la pagina è IT (il server risponde in italiano) |
| `main.js` — CTA preventivo | `quote/`, `preventivo/` | `quote/`, `preventivo/`, `devis/` |
| `main.js` — `language_switch` | `to_lang` dedotto per inversione | `to_lang` letto da `hreflang` sul link cliccato; valore ignoto → `unknown` |
| Switcher EN/IT | Link senza `hreflang` | Link con `hreflang="en"` / `hreflang="it"`. **Visivamente invariato: resta `EN \| IT`** |
| Form EN/IT | Nessun campo lingua | Campo nascosto `lingua` (`en`/`it`), validato server-side |
| `api/invia-preventivo.php` | Provenienza fissa `(it/preventivo/)`, falsa per le richieste EN | Riga "Lingua richiesta" nell'email + provenienza derivata; whitelist `LINGUE_AMMESSE` già comprensiva di `fr` |
| Deploy | Solo `it/` copiata | Blocco condizionale `fr/` speculare: non fa nulla finché la cartella non esiste |

**Non fatto di proposito**: nessuna cartella `fr/`, nessuna pagina FR, nessun `hreflang="fr"`, nessun URL FR nel sitemap, nessuna terza voce nello switcher, nessuna modifica a nav, footer, CSS, immagini o slug.

## Prossimi passi suggeriti

1. Pagina "Chi siamo"/About per rafforzare autorevolezza ed E-E-A-T (non ancora presente; `how-we-work/` e `laboratory/` ne coprono già in parte la funzione).
2. Testimonianze o case study pubblicati — richiede il consenso di pubblicazione dei clienti.
3. Estendere i dati strutturati JSON-LD alle pagine tecnica e al portfolio (oggi solo sulle pagine di conoscenza).
4. Ottimizzazione immagini: formati moderni (WebP/AVIF) e `srcset` responsive; oggi diverse foto superano i 300 KB.
5. Espandere la Knowledge Platform seguendo la roadmap editoriale in `euroricami-ai-os`, non un calendario a scadenza fissa.
6. Disattivare GitHub Pages: il sito è live su due infrastrutture in parallelo. Procedura manuale in `DEPLOY_SETUP.md` §21a.
