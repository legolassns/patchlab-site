/* Euroricami — script di base, JavaScript vanilla, nessuna dipendenza */

document.addEventListener("DOMContentLoaded", function () {
  initMobileNav();
  highlightActiveNavLink();
  initQuoteForm();
});

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

/* Form richiesta preventivo: validazione lato client + invio reale via
   fetch all'endpoint PHP (api/invia-preventivo.php). Il form non si
   considera mai "inviato" finché il server non conferma con { ok: true }. */
function initQuoteForm() {
  var form = document.getElementById("quote-form");
  if (!form) return;

  var feedbackBox = document.getElementById("form-feedback");
  var submitButton = document.getElementById("quote-form-submit");
  var tsField = document.getElementById("ts-apertura");
  var emailField = document.getElementById("email");

  var submitButtonDefaultText = submitButton ? submitButton.textContent : "";
  var isSubmitting = false;

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
    submitButton.textContent = submitting ? "Invio in corso…" : submitButtonDefaultText;
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
          showFeedback("success", result.data.message || "Grazie, abbiamo ricevuto la tua richiesta. Ti risponderemo dopo aver valutato il progetto.");
          form.reset();
          if (tsField) tsField.value = String(Date.now());
        } else {
          var errorMessage = (result.data && result.data.message)
            ? result.data.message
            : "Non siamo riusciti a inviare la richiesta. Puoi riprovare oppure scrivere a info@patchlab.net.";
          showFeedback("error", errorMessage);
        }
      })
      .catch(function () {
        /* Errore di rete o timeout: il form non viene resettato, i dati
           inseriti restano compilati per un nuovo tentativo. */
        showFeedback("error", "Non siamo riusciti a inviare la richiesta. Puoi riprovare oppure scrivere a info@patchlab.net.");
      })
      .finally(function () {
        if (timeoutId) clearTimeout(timeoutId);
        setSubmitting(false);
      });
  });
}
