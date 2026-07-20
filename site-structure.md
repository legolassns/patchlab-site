# Struttura del sito — PatchLab by Euroricami

Sito statico (HTML + CSS + JS vanilla, nessun framework), una pagina per file. Progetto verticale di Euroricami dedicato esclusivamente alle patch personalizzate.

## File

```
patch-personalizzate-euroricami/
├── index.html            Home — hero, scegli patch, per chi lavoriamo, perché PatchLab, riordino, CTA
├── patch-ricamate.html   Scheda prodotto: patch ricamate (con foto reale)
├── patch-velcro.html     Scheda prodotto: patch velcro (in attesa di foto reale)
├── patch-woven.html      Scheda prodotto: patch woven (con foto reale)
├── patch-pvc.html        Scheda prodotto: patch PVC (con foto reale)
├── portfolio.html        Galleria lavori: 4 foto reali + 2 placeholder per lavori futuri
├── preventivo.html       Modulo di richiesta preventivo
├── style.css             Foglio di stile unico per tutto il sito
├── main.js               Menu mobile, link attivo in nav, validazione form preventivo
├── assets/
│   └── img/
│       ├── .gitkeep
│       ├── patch-ricamata-classica.jpeg          Guardia Svizzera Pontificia (ricamo classico)
│       ├── patch-pvc-personalizzata.jpeg         Patch PVC a rilievo 3D
│       ├── patch-ricamata-woven-confronto.jpeg   Italia Team (woven) + Scuola Calcio Affiliata (ricamo)
│       └── patch-woven-ricamata-confronto.jpeg   Futsal Serie A, Polizia Locale Roma Capitale, FC Bari 1908
├── site-structure.md      Questo file
├── seo-keywords.md        Mappa keyword per pagina
└── copy-home.md           Testi della home in formato editabile
```

## Note tecniche

- Header e footer sono ripetuti identici in ogni pagina HTML (nessun template engine: per modificarli va aggiornato ogni file).
- Il logo è composto da due parti: "PatchLab" (classe `.logo`) e "by Euroricami" (classe `.logo-sub`), definite in `style.css`.
- Non esiste ancora una foto reale di patch velcro: `patch-velcro.html` e la card corrispondente in home usano ancora `.image-placeholder`. Da sostituire quando sarà disponibile uno scatto dedicato.
- Le immagini reali vivono in `assets/img/` (non più `images/`): eventuali nuove foto vanno aggiunte lì, con nomi file SEO-friendly (es. `patch-<lavorazione>-<soggetto>.jpg`).
- Il form in `preventivo.html` è solo lato client: valida i campi obbligatori e mostra un messaggio di conferma, ma **non invia ancora dati a nessun servizio**. Va collegato a un endpoint reale (form-to-email, CRM, backend interno) prima della pubblicazione.
- Colori, spaziature e font sono definiti come variabili CSS in cima a `style.css` (`:root`): da lì si modifica la palette in un punto solo.

## Prossimi passi suggeriti

1. Scattare/reperire una foto reale di patch velcro per completare la card e la pagina dedicata.
2. Collegare il form preventivo a un servizio di invio reale.
3. Rivedere i testi provvisori con contenuti definitivi validati dal cliente.
4. Aggiungere pagina "Chi siamo" per rafforzare autorevolezza/E-E-A-T ai fini SEO.
5. Valutare un sitemap.xml e robots.txt prima della messa online.
