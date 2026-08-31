/* Euroricami — script di base, JavaScript vanilla, nessuna dipendenza */

document.addEventListener("DOMContentLoaded", function () {
  initMobileNav();
  highlightActiveNavLink();
  initQuoteForm();
  initInteractionTracking();
});

/* Lingue supportate dall'architettura del sito. L'ordine non conta: la
   lista serve solo a validare il valore letto da <html lang="...">.
   "fr" è presente perché la logica di questo file deve reggere una terza
   lingua senza altri interventi — le route /fr/ non esistono ancora e
   nessuna pagina francese è pubblicata (vedi site-structure.md). */
var SUPPORTED_LANGUAGES = ["en", "it", "fr"];

/* Lingua della pagina corrente, normalizzata e sempre sicura.
   Sostituisce la vecchia deduzione binaria (`lang === "en" ? "en" : "it"`),
   che su qualunque lingua diversa da "en" restituiva "it": con una terza
   lingua avrebbe attribuito il traffico francese al funnel italiano.

   Il valore viene normalizzato in due passaggi prima del confronto:
   minuscolo (BCP 47 non è case-sensitive: "EN" e "en" sono la stessa
   lingua) e taglio al primary language subtag, cioè tutto ciò che precede
   il primo "-" ("fr-CA" → "fr"). Senza questo, un `lang` regionale
   perfettamente valido finirebbe nel fallback e verrebbe misurato come
   inglese: la stessa classe di errore della vecchia logica binaria.
   Oggi tutte le pagine dichiarano codici puri ("en", "it"), quindi la
   normalizzazione non cambia nulla di ciò che è online — serve a non
   introdurre un difetto silenzioso se un domani una pagina dichiarasse
   "fr-FR".

   Un valore assente, vuoto o non riconosciuto degrada su "en", che è la
   lingua di default del sito (l'inglese vive alla radice). */
function getCurrentLang() {
  var lang = (document.documentElement.lang || "").toLowerCase().split("-")[0];
  if (SUPPORTED_LANGUAGES.indexOf(lang) === -1) {
    return "en";
  }
  return lang;
}

/* Invia un evento custom a Plausible (script caricato via <script defer>
   in ogni pagina, vedi docs/PLAUSIBLE_SETUP.md). Silenzioso e senza mai
   generare un errore JS se lo script non è disponibile (blocco pubblicità,
   rete lenta, dominio non ancora registrato in Plausible): l'assenza di
   misurazione non deve mai rompere il sito.
   Nessun parametro passato qui contiene mai dati personali o contenuto
   del form: solo lingua, posizione, percorso e tipo di esito — vedi
   ANALYTICS_MEASUREMENT_PLAN.md per l'elenco esaustivo degli eventi e dei
   divieti. */
function trackEvent(name, props) {
  if (typeof window.plausible !== "function") return;
  window.plausible(name, props ? { props: props } : undefined);
}

/* Menu mobile a comparsa */
function initMobileNav() {
  var header = document.querySelector(".site-header");
  var toggle = document.getElementById("nav-toggle");
  if (!header || !toggle) return;

  toggle.addEventListener("click", function () {
    var isOpen = header.classList.toggle("nav-open");
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });

  document.querySelectorAll(".nav-panel a").forEach(function (link) {
    link.addEventListener("click", function () {
      header.classList.remove("nav-open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });

  /* Esc chiude il menu aperto e riporta il focus sul bottone */
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && header.classList.contains("nav-open")) {
      header.classList.remove("nav-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.focus();
    }
  });
}

/* Evidenzia nel menu la voce corrispondente alla pagina corrente.
   Confronta i pathname risolti (link.pathname), non l'attributo href:
   così funziona con link relativi e con qualsiasi prefisso di deploy
   (patchlab.net/it/... oppure il path temporaneo di GitHub Pages). */
function highlightActiveNavLink() {
  var currentPath = window.location.pathname.replace(/index\.html$/, "");
  document.querySelectorAll(".main-nav a").forEach(function (link) {
    var linkPath = link.pathname.replace(/index\.html$/, "");
    if (linkPath === currentPath) {
      link.classList.add("active");
      if (!link.hasAttribute("aria-current")) {
        link.setAttribute("aria-current", "page");
      }
    }
  });
}

/* Tracciamento di interazione (CTA preventivo, cambio lingua, click su
   mailto): un solo listener delegato su document, registrato una volta
   sola all'avvio — non per-elemento, per evitare N listener duplicati e
   qualunque rischio di doppio invio dello stesso evento. Ogni click
   corrisponde al più a una categoria (i tre `if` sono in cascata con
   `return`), quindi non può mai generare due eventi per un solo click. */
function initInteractionTracking() {
  document.addEventListener("click", function (event) {
    /* `devis/` è la route del preventivo francese: non esiste ancora, ma
       senza questo selettore ogni click su una futura CTA FR non
       genererebbe alcun evento — una perdita silenziosa del segnale
       principale del funnel, invisibile in dashboard. */
    var quoteLink = event.target.closest('a[href$="quote/"], a[href$="preventivo/"], a[href$="devis/"]');
    if (quoteLink) {
      /* Nome deliberatamente diverso da "location" per non ombreggiare
         window.location nello scope di questa funzione (var è hoisted
         a livello di funzione, non di blocco). */
      var ctaLocation = "other";
      if (quoteLink.closest(".site-header")) {
        ctaLocation = "header";
      } else if (quoteLink.closest(".hero")) {
        ctaLocation = "hero";
      } else if (quoteLink.closest(".cta-soft")) {
        ctaLocation = "mid-page";
      } else if (quoteLink.closest(".cta-preventivo")) {
        ctaLocation = "final-cta";
      } else if (quoteLink.closest(".site-footer")) {
        ctaLocation = "footer";
      }
      trackEvent("quote_cta_click", { cta_location: ctaLocation, lang: getCurrentLang() });
      return;
    }

    var langLink = event.target.closest(".lang-switch a");
    if (langLink) {
      /* `to_lang` viene letto dall'attributo hreflang del link cliccato,
         non dedotto invertendo la lingua corrente: con due lingue
         l'inversione funzionava per caso, con tre sarebbe sempre errata.
         Un link dello switcher senza hreflang valido produce "unknown"
         invece di un valore plausibile ma sbagliato: un difetto di markup
         deve restare visibile in dashboard, non mimetizzarsi in un dato
         credibile. */
      var toLang = langLink.getAttribute("hreflang");
      if (SUPPORTED_LANGUAGES.indexOf(toLang) === -1) {
        toLang = "unknown";
      }
      trackEvent("language_switch", { from_lang: getCurrentLang(), to_lang: toLang });
      return;
    }

    var mailtoLink = event.target.closest('a[href^="mailto:"]');
    if (mailtoLink) {
      trackEvent("mailto_click", { path: window.location.pathname });
    }
  });
}

/* Form richiesta preventivo: validazione lato client + invio reale via
   fetch all'endpoint PHP (api/invia-preventivo.php). Il form non si
   considera mai "inviato" finché il server non conferma con { ok: true }.

   L'endpoint PHP risponde sempre in italiano (la lingua dei messaggi
   server-side non è stata cambiata): solo sulla pagina italiana mostriamo
   il testo restituito dal server, in ogni altra lingua usiamo la stringa
   locale corrispondente. */

/* Messaggi del form, una voce per lingua supportata. Lookup esplicita e
   non un ternario: aggiungere una lingua qui è l'unica modifica
   necessaria, e nessuna lingua può più ereditare per sbaglio i testi di
   un'altra.
   Le stringhe FR sono provvisorie e vanno riviste con il copy definitivo
   quando le pagine francesi verranno scritte: oggi non è raggiungibile
   nessuna pagina con lang="fr". */
var QUOTE_FORM_MESSAGES = {
  en: {
    sending: "Sending…",
    success: "Thank you, we've received your request. We'll get back to you after reviewing the project.",
    genericError: "We couldn't send your request. Please try again or email info@patchlab.net."
  },
  it: {
    sending: "Invio in corso…",
    success: "Grazie, abbiamo ricevuto la tua richiesta. Ti risponderemo dopo aver valutato il progetto.",
    genericError: "Non siamo riusciti a inviare la richiesta. Puoi riprovare oppure scrivere a info@patchlab.net."
  },
  fr: {
    sending: "Envoi en cours…",
    success: "Votre demande a bien été envoyée. Nous vous contacterons rapidement.",
    genericError: "Une erreur s'est produite. Veuillez réessayer ou nous écrire à info@patchlab.net."
  }
};

function initQuoteForm() {
  var form = document.getElementById("quote-form");
  if (!form) return;

  var currentLang = getCurrentLang();
  var i18n = QUOTE_FORM_MESSAGES[currentLang];

  var feedbackBox = document.getElementById("form-feedback");
  var submitButton = document.getElementById("quote-form-submit");
  var tsField = document.getElementById("ts-apertura");
  var emailField = document.getElementById("email");

  var submitButtonDefaultText = submitButton ? submitButton.textContent : "";
  var isSubmitting = false;

  /* quote_form_view: una sola volta per caricamento pagina (questa
     funzione stessa gira una sola volta per pagina, protetta dal
     `return` iniziale se #quote-form non esiste). */
  trackEvent("quote_form_view", { lang: currentLang });

  /* quote_form_start: il primo focus su un campo qualunque del form,
     una sola volta per pagina (`{ once: true }` rimuove il listener
     dopo il primo trigger, nessun flag manuale necessario). */
  form.addEventListener("focusin", function () {
    trackEvent("quote_form_start", { lang: currentLang });
  }, { once: true });

  /* Timestamp di apertura del form, usato lato server come controllo
     anti-bot (un invio arrivato dopo pochissimi secondi è sospetto). */
  if (tsField) {
    tsField.value = String(Date.now());
  }

  function isValidEmail(value) {
    /* Controllo di formato semplice, non sostitutivo della validazione
       server-side (filter_var FILTER_VALIDATE_EMAIL in PHP). */
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function clearFieldError(field) {
    field.classList.remove("field-error");
  }

  function showFeedback(kind, message) {
    if (!feedbackBox) return;
    feedbackBox.textContent = message;
    feedbackBox.classList.remove("form-feedback--success", "form-feedback--error");
    feedbackBox.classList.add(kind === "success" ? "form-feedback--success" : "form-feedback--error");
    feedbackBox.classList.add("visible");
    feedbackBox.setAttribute("tabindex", "-1");
    feedbackBox.focus();
  }

  function clearFeedback() {
    if (!feedbackBox) return;
    feedbackBox.textContent = "";
    feedbackBox.classList.remove("visible", "form-feedback--success", "form-feedback--error");
  }

  function setSubmitting(submitting) {
    isSubmitting = submitting;
    if (!submitButton) return;
    submitButton.disabled = submitting;
    submitButton.textContent = submitting ? i18n.sending : submitButtonDefaultText;
  }

  /* Rimuove lo stato di errore visivo non appena l'utente corregge il campo. */
  form.querySelectorAll("[required]").forEach(function (field) {
    field.addEventListener("input", function () {
      if (field.value.trim()) clearFieldError(field);
    });
  });
  if (emailField) {
    emailField.addEventListener("input", function () {
      if (isValidEmail(emailField.value.trim())) clearFieldError(emailField);
    });
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    if (isSubmitting) return; // impedisce doppio click / invii duplicati

    var requiredFields = form.querySelectorAll("[required]");
    var isValid = true;

    requiredFields.forEach(function (field) {
      var hasValue = !!field.value.trim();
      field.classList.toggle("field-error", !hasValue);
      if (!hasValue) isValid = false;
    });

    if (emailField) {
      var emailValid = isValidEmail(emailField.value.trim());
      emailField.classList.toggle("field-error", !emailValid);
      if (!emailValid) isValid = false;
    }

    if (!isValid) {
      clearFeedback();
      return;
    }

    setSubmitting(true);
    clearFeedback();
    trackEvent("quote_form_submit", { lang: currentLang });

    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timeoutId = controller ? setTimeout(function () { controller.abort(); }, 15000) : null;

    fetch(form.getAttribute("action") || "/api/invia-preventivo.php", {
      method: "POST",
      body: new FormData(form),
      signal: controller ? controller.signal : undefined
    })
      .then(function (response) {
        return response
          .json()
          .catch(function () {
            /* Risposta non JSON (es. errore del server prima dell'endpoint):
               trattata come errore generico, senza esporre dettagli tecnici. */
            return { ok: false };
          })
          .then(function (data) {
            return { httpOk: response.ok, data: data };
          });
      })
      .then(function (result) {
        /* Il messaggio restituito dal server è sempre in italiano: lo
           mostriamo solo sulla pagina italiana. Ogni altra lingua usa la
           propria stringa locale — prima la condizione era `isEnglish`,
           quindi qualunque lingua non inglese avrebbe ricevuto testo
           italiano. */
        var useServerMessage = currentLang === "it";
        if (result.httpOk && result.data && result.data.ok) {
          trackEvent("quote_form_success", { lang: currentLang });
          showFeedback("success", useServerMessage ? (result.data.message || i18n.success) : i18n.success);
          form.reset();
          if (tsField) tsField.value = String(Date.now());
        } else {
          trackEvent("quote_form_error", { lang: currentLang, error_kind: "server" });
          var errorMessage = (useServerMessage && result.data && result.data.message)
            ? result.data.message
            : i18n.genericError;
          showFeedback("error", errorMessage);
        }
      })
      .catch(function () {
        /* Errore di rete o timeout: il form non viene resettato, i dati
           inseriti restano compilati per un nuovo tentativo. */
        trackEvent("quote_form_error", { lang: currentLang, error_kind: "network" });
        showFeedback("error", i18n.genericError);
      })
      .finally(function () {
        if (timeoutId) clearTimeout(timeoutId);
        setSubmitting(false);
      });
  });
}
