# Mappa keyword SEO — PatchLab by Euroricami

Keyword indicative in italiano, da validare con uno strumento di ricerca (Search Console, Semrush, Ahrefs) prima della pubblicazione definitiva.

## Home (index.html)
- **Primaria**: patch personalizzate per enti e aziende
- Secondarie: patch personalizzate su misura, patch ricamate velcro woven pvc, PatchLab Euroricami, patch per associazioni e moto club
- Intento: navigazionale/commerciale, utente che confronta fornitori

## Patch Ricamate (patch-ricamate.html)
- **Primaria**: patch ricamate personalizzate
- Secondarie: toppe ricamate su misura, patch ricamo 3D, stemmi ricamati personalizzati, produzione toppe ricamate
- Intento: commerciale, ricerca tecnica sulla lavorazione

## Patch Velcro (patch-velcro.html)
- **Primaria**: patch velcro personalizzate
- Secondarie: toppe velcro su misura, patch removibili velcro, distintivi velcro militari, patch velcro forze dell'ordine
- Intento: commerciale, spesso B2B/settore divise

## Patch Woven HD (it/patch-woven/)
- **Primaria**: patch woven personalizzate
- Secondarie: patch woven HD personalizzate, toppe tessute su misura, patch woven alta definizione, etichette woven personalizzate
- Intento: commerciale, target moda/sportswear
- Nota: "Woven HD" è denominazione editoriale (title/H1), la keyword storica resta "patch woven personalizzate"

## Patch PVC (patch-pvc.html)
- **Primaria**: patch pvc personalizzate
- Secondarie: toppe gomma pvc su misura, patch 3D pvc, distintivi pvc impermeabili, patch pvc outdoor
- Intento: commerciale, target outdoor/tattico

## Patch Sublimatiche (it/patch-sublimatiche/)
- **Primaria**: patch sublimatiche personalizzate
- Secondarie: patch sublimatiche piccole tirature, patch stampate a sublimazione, toppe sublimatiche personalizzate
- Intento: commerciale, target eventi/sport/merchandising sensibile al costo

## Patch Termosaldabili (it/patch-termosaldabili/)
- **Primaria**: patch termosaldabili personalizzate
- Secondarie: toppe termosaldabili personalizzate, patch termoadesive su misura, patch con retro termoadesivo
- Intento: commerciale/informazionale — pagina guida sul sistema di applicazione, collega ricamate, woven HD e sublimatiche

## Portfolio (portfolio.html)
- **Primaria**: portfolio patch personalizzate
- Secondarie: esempi patch su misura, lavori patch ricamate aziende
- Intento: informazionale/prova sociale, supporto alla conversione

## Preventivo (preventivo.html)
- **Primaria**: preventivo patch personalizzate
- Secondarie: richiedi preventivo toppe personalizzate, ordinare patch su misura, preventivo patch aziendali
- Intento: transazionale — pagina di conversione, non va posizionata su volumi ma su chiarezza per chi arriva già convinto

## Knowledge Platform — cluster informazionale (dal 2026-07-27)

Le pagine sopra coprono query **commerciali e transazionali** ("patch ricamate personalizzate", "preventivo patch"). Dal 2026-07-27 il sito copre anche l'intento **informazionale**, con una base di conoscenza dedicata: la mappa completa dei cluster, dei volumi attesi e delle priorità vive in `euroricami-ai-os` (`integrations/patchlab/PATCHLAB_SEO_ARCHITECTURE.md`). Qui restano solo le keyword delle pagine effettivamente pubblicate.

### Hub guide (`/it/guide/`, `/guides/`)
- **Primaria IT**: guide patch personalizzate
- Secondarie IT: come funzionano le patch personalizzate, informazioni tecniche patch, base di conoscenza patch
- **Primaria EN**: custom patch guides
- Intento: informazionale/navigazionale — pagina di smistamento, non da posizionare su una singola query ad alto volume

### Pillar 1 — Come scegliere la patch giusta (`/it/guide/scegliere-la-patch-giusta/`, `/guides/choosing-the-right-patch/`)
- **Primaria IT**: come scegliere la patch giusta
- Secondarie IT: differenza tra patch ricamata e woven, quale patch scegliere per divise, patch ricamata o sublimatica, dimensione minima patch ricamata, quanti colori per una patch ricamata
- **Primaria EN**: how to choose the right patch
- Secondarie EN: embroidered vs woven patches, difference between woven and embroidered patch, minimum patch size for text
- Intento: informazionale con **alto valore commerciale** — intercetta chi deve ancora decidere la lavorazione, cioè chi non ha ancora scelto il fornitore
- Nota: è la pagina che risponde alla query storicamente segnalata come opportunità in questo file ("differenza tra patch ricamata e woven")

### Glossario (`/it/glossario/`, `/glossary/`)
- **Primaria IT**: glossario patch personalizzate
- Secondarie IT: cos'è il twill, cos'è la punchatura, bordo merrow cos'è, differenza hook e loop, cos'è una patch woven
- **Primaria EN**: custom patch glossary
- Secondarie EN: what is twill, what is digitising embroidery, what is a merrow border, hook vs loop
- Intento: informazionale a coda lunga — 34 voci, ognuna con un proprio anchor `#id` linkabile, marcate come `DefinedTermSet`/`DefinedTerm` in JSON-LD

## Note generali
- Ogni pagina ha un solo H1 coerente con la keyword primaria e H2 per le sotto-sezioni.
- Title e meta description sono già impostati in ogni file HTML: da rivedere in base ai dati reali di ricerca prima del lancio.
- Gli alt text delle immagini reali descrivono il soggetto specifico (es. "Guardia Svizzera Pontificia", "Italia Team") invece di ripetere solo la keyword generica: aiuta sia l'accessibilità sia la ricerca per immagini.
- ~~Valutare in futuro contenuti di supporto (blog/guide) su query informazionali~~ — **avviato il 2026-07-27** con la Knowledge Platform (sezione sopra). L'espansione segue la roadmap editoriale in `euroricami-ai-os`, non un calendario a scadenza fissa.
- **Dati strutturati**: presenti solo sulle 6 pagine di conoscenza (`Article`, `CollectionPage`, `DefinedTermSet`, `BreadcrumbList`, `Organization`). Le 24 route precedenti restano senza JSON-LD: estenderlo a pagine tecnica e portfolio è un lavoro aperto e separato.
- Tutte le keyword di questo file restano **da validare** con dati reali (Search Console/Semrush/Ahrefs): nessun volume di ricerca è stato misurato.
