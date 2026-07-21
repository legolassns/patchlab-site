# FORM_SETUP — Modulo Preventivo PatchLab

Questo documento resta nel repository ma **non viene mai pubblicato online** (escluso dal deploy, vedi `DEPLOY_SETUP.md` sezione 9).

---

## 1. Stato attuale del form (Sprint 11)

File: `it/preventivo/index.html` + `main.js`.

Audit eseguito in questo sprint:

- Il `<form>` (`id="quote-form"`) **non ha attributi `action` né `method`**: non punta a nessun endpoint, né proprio né esterno.
- `main.js` (`initQuoteForm()`) intercetta il submit con `event.preventDefault()`, valida solo lato client i campi `required` (aggiungendo/rimuovendo la classe `.field-error`), e — se la validazione passa — mostra il blocco `#form-success` già presente nell'HTML e resetta il form.
- **Nessuna chiamata di rete viene effettuata**: nessun `fetch`, nessuna `XMLHttpRequest`, nessun invio reale dei dati, in nessun punto del codice.
- Il messaggio mostrato nel blocco `#form-success` è già onesto: dichiara esplicitamente che l'invio automatico non è ancora attivo e invita a scrivere direttamente all'indirizzo email ufficiale (aggiornato in questo sprint a `info@patchlab.net`).
- Campi presenti: nome, azienda/ente (opzionale), email, telefono (opzionale), tipologia di patch, tipo di applicazione (opzionale), quantità indicativa, note libere. Nessun campo di upload/allegato.

Conclusione dell'audit: il form oggi **non simula un invio che non avviene** — è già nello stato onesto richiesto come base minima. Questo sprint doveva decidere se è possibile fare di più (endpoint reale) o se questo stato va solo migliorato/documentato.

## 2. Soluzione adottata: Opzione 3 — form non ancora attivo, con fallback trasparente

Non è stato implementato nessun endpoint PHP in questo sprint. Motivazione:

- Non è stato possibile verificare da questa sessione (nessun accesso al pannello DominiOK) se PHP è effettivamente disponibile e configurato sull'hosting, né se `mail()` o un SMTP autenticato sono utilizzabili in modo affidabile.
- L'Opzione 2 (servizio esterno tipo Formspree/Basin/Getform) richiede approvazione esplicita preventiva di Stefano, non ancora data.
- Costruire un endpoint "per tentativi" senza aver verificato l'ambiente reale rischierebbe di introdurre un sistema che sembra sicuro ma non lo è (validazione insufficiente, invio che fallisce silenziosamente, o peggio un vettore di spam/header injection non testato).

Di conseguenza si è scelta l'Opzione 3, esplicitamente prevista per questo scenario: non simulare l'invio, mantenere il messaggio trasparente, garantire un fallback `mailto:` evidente, documentare cosa manca.

Modifiche fatte in questo sprint (non strutturali, solo di identità di contatto):

- Il destinatario di riferimento in tutti i testi e nei link `mailto:` del sito è ora `info@patchlab.net` (era `info@euroricami.it`).
- Il messaggio post-submit continua a indicare chiaramente che l'invio automatico non è attivo e rimanda all'email diretta.

## 3. Destinatario

`info@patchlab.net` — indicato ovunque nel sito (footer di ogni pagina, messaggio post-submit del form) come recapito commerciale ufficiale di PatchLab.

## 4. Fallback

Ogni pagina ha in footer un link `mailto:info@patchlab.net`. Il messaggio post-submit del form (`#form-success`) ribadisce lo stesso indirizzo con testo esplicito, invitando a scrivere direttamente indicando le informazioni di progetto già elencate nella pagina.

Non sono stati aggiunti altri indirizzi email nel sito: un'unica identità di contatto commerciale, coerente con il principio "una sola identità commerciale coerente".

## 5. Test richiesti prima di un'eventuale attivazione futura

Se in un prossimo sprint si deciderà di attivare un endpoint reale (PHP interno o servizio esterno approvato):

- verificare concretamente la disponibilità di PHP e delle funzioni di invio email sull'hosting DominiOK (non assumerla dal solo fatto che l'hosting sia cPanel);
- testare l'invio end-to-end con un indirizzo di test prima di puntare a `info@patchlab.net`;
- verificare la deliverability (non finire in spam) prima di considerare il form "attivo" a tutti gli effetti;
- testare la validazione sia lato client sia lato server (mai fidarsi solo del JS, che l'utente può disabilitare o bypassare);
- testare il comportamento con campi vuoti, campi con caratteri speciali, tentativi di header injection nel campo email/nome.

## 6. Gestione errori (stato attuale)

Lato client: se un campo obbligatorio è vuoto, riceve la classe `.field-error` e il blocco di successo non viene mostrato. Non esiste oggi un messaggio di errore testuale esplicito per il singolo campo (solo lo stato visivo `.field-error`) — miglioria possibile ma non affrontata in questo sprint, perché non richiesta e perché il form non invia comunque dati da nessuna parte.

Lato server: non applicabile, non esiste un server destinatario dei dati del form.

## 7. Eventuale endpoint (non implementato)

Se in futuro l'audit confermerà che un endpoint PHP interno è sicuro e realizzabile (vedi FASE 12 dello Sprint 11, non eseguita in questa sessione perché la condizione abilitante — "l'audit conferma che è una soluzione sicura" — non è stata soddisfatta), i requisiti minimi da rispettare al momento dell'implementazione sono:

- accettare solo `POST`, rifiutare `GET`;
- validare e sanitizzare ogni campo con una lista esplicita di campi accettati (mai `$_POST` non filtrato);
- validare il formato email;
- limitare la lunghezza di ogni campo;
- impedire header injection (niente newline nei campi usati per header email);
- honeypot anti-spam + controllo minimo sul tempo di compilazione;
- messaggi di errore generici verso il pubblico, nessun dettaglio tecnico o stack trace esposto;
- log senza dati personali sensibili;
- nessuna credenziale nel file dell'endpoint;
- destinatario fisso `info@patchlab.net`, mittente coerente con il dominio PatchLab (mai l'indirizzo del cliente come `From`), `Reply-To` impostato sull'email del cliente dopo validazione;
- nessun allegato finché non è possibile garantirne la sicurezza (verifica dimensione, MIME type, estensione, quarantena/cancellazione dei file temporanei).

## 8. Protezione spam

Non applicabile oggi (nessun endpoint attivo). Requisiti minimi futuri elencati al punto 7 (honeypot, tempo di compilazione minimo, rate limiting se realizzabile lato hosting).

## 9. Allegati

Non previsti oggi (il form non ha campo di upload). Se richiesti in futuro, vedi i vincoli di sicurezza al punto 7: da non implementare "superficialmente".

## 10. Privacy

Il form raccoglie dati identificativi (nome, azienda, email, telefono, note libere) ma oggi **non li trasmette e non li salva da nessuna parte**: restano solo nel browser dell'utente fino al reset del form. Quando verrà attivato un invio reale, andrà valutata (con Stefano, non autonomamente) l'eventuale necessità di un'informativa privacy dedicata, coerente con il trattamento dati effettivamente introdotto.

## 11. Deliverability

Non modificato in questo sprint (nessuna modifica DNS/MX/SPF/DKIM/DMARC, per vincolo esplicito dello Sprint 11). Prima di un lancio definitivo con invio reale verso `info@patchlab.net`, andranno verificati con Stefano:

- record MX per `patchlab.net`;
- SPF che autorizzi correttamente il mittente usato (hosting DominiOK e/o servizio di invio scelto);
- DKIM configurato per il dominio;
- DMARC coerente con SPF/DKIM;
- comportamento se la casella `info@patchlab.net` è ospitata su un provider diverso da quello che invierà le email del form (es. Zoho vs. casella cPanel) — non assumere che coesistano senza configurazione DNS esplicita.

Questa parte è esplicitamente demandata a una decisione separata di Stefano, come indicato nel brief dello sprint.

## 12. Evoluzioni future

In ordine di probabilità/priorità, non decise in questo sprint:

1. Verifica reale delle capacità PHP/SMTP di DominiOK → eventuale endpoint interno (Opzione 1), se l'audit sarà positivo.
2. In alternativa, adozione di un servizio esterno (Opzione 2), solo dopo approvazione esplicita di Stefano su quale servizio, quali dati vengono affidati a terzi e a quali condizioni di privacy.
3. Miglioramento dei messaggi di errore lato client (per-campo, non solo stato visivo).
4. Eventuale gestione allegati, solo dopo che la sicurezza del canale base è stata validata.
