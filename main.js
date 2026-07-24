/* Euroricami — script di base, JavaScript vanilla, nessuna dipendenza */

document.addEventListener("DOMContentLoaded", function () {
  initMobileNav();
  highlightActiveNavLink();
  initQuoteForm();
  initInteractionTracking();
});

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
    var quoteLink = event.target.closest('a[href$="quote/"], a[href$="preventivo/"]');
    if (quoteLink) {
      /* Nome deliberatamente diverso da "location" per non ombreggiare
         window.location nello scope di questa funzione (var è hoisted
         a livello di funzione, non di blocco). */
      var ctaLocation = "other";
      if (quoteLink.closest(".site-header")) {
        ctaLocation = "header";
      } else if (quoteLink.closest(".hero")) {
        ctaLocation = "hero";
      } else if (quoteLink.closest(".cta-preventivo")) {
        ctaLocation = "final-cta";
      } else if (quoteLink.closest(".site-footer")) {
        ctaLocation = "footer";
      }
      trackEvent("quote_cta_click", { cta_location: ctaLocation, lang: document.documentElement.lang });
      return;
    }

    var langLink = event.target.closest(".lang-switch a");
    if (langLink) {
      var fromLang = document.documentElement.lang === "en" ? "en" : "it";
      trackEvent("language_switch", { from_lang: fromLang, to_lang: fromLang === "en" ? "it" : "en" });
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

   L'endpoint PHP risponde sempre in italiano (Sprint EN/IT non tocca la
   logica server-side): sulla pagina inglese sostituiamo il messaggio di
   invio/esito con l'equivalente inglese invece di mostrare il testo
   italiano restituito dal server. */
function initQuoteForm() {
  var form = document.getElementById("quote-form");
  if (!form) return;

  var isEnglish = document.documentElement.lang === "en";
  var i18n = {
    sending: isEnglish ? "Sending…" : "Invio in corso…",
    success: isEnglish
      ? "Thank you, we've received your request. We'll get back to you after reviewing the project."
      : "Grazie, abbiamo ricevuto la tua richiesta. Ti risponderemo dopo aver valutato il progetto.",
    genericError: isEnglish
      ? "We couldn't send your request. Please try again or email info@patchlab.net."
      : "Non siamo riusciti a inviare la richiesta. Puoi riprovare oppure scrivere a info@patchlab.net."
  };

  var feedbackBox = document.getElementById("form-feedback");
  var submitButton = document.getElementById("quote-form-submit");
  var tsField = document.getElementById("ts-apertura");
  var emailField = document.getElementById("email");

  var submitButtonDefaultText = submitButton ? submitButton.textContent : "";
  var isSubmitting = false;
  var langProp = isEnglish ? "en" : "it";

  /* quote_form_view: una sola volta per caricamento pagina (questa
     funzione stessa gira una sola volta per pagina, protetta dal
     `return` iniziale se #quote-form non esiste). */
  trackEvent("quote_form_view", { lang: langProp });

  /* quote_form_start: il primo focus su un campo qualunque del form,
     una sola volta per pagina (`{ once: true }` rimuove il listener
     dopo il primo trigger, nessun flag manuale necessario). */
  form.addEventListener("focusin", function () {
    trackEvent("quote_form_start", { lang: langProp });
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
    trackEvent("quote_form_submit", { lang: langProp });

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
        if (result.httpOk && result.data && result.data.ok) {
          trackEvent("quote_form_success", { lang: langProp });
          showFeedback("success", isEnglish ? i18n.success : (result.data.message || i18n.success));
          form.reset();
          if (tsField) tsField.value = String(Date.now());
        } else {
          trackEvent("quote_form_error", { lang: langProp, error_kind: "server" });
          var errorMessage = isEnglish
            ? i18n.genericError
            : ((result.data && result.data.message) ? result.data.message : i18n.genericError);
          showFeedback("error", errorMessage);
        }
      })
      .catch(function () {
        /* Errore di rete o timeout: il form non viene resettato, i dati
           inseriti restano compilati per un nuovo tentativo. */
        trackEvent("quote_form_error", { lang: langProp, error_kind: "network" });
        showFeedback("error", i18n.genericError);
      })
      .finally(function () {
        if (timeoutId) clearTimeout(timeoutId);
        setSubmitting(false);
      });
  });
}
