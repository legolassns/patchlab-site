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

/* Form richiesta preventivo: validazione base e messaggio di conferma.
   Il sito è statico: qui si prepara il payload, l'invio reale andrà
   collegato a un servizio (es. form-to-email, CRM, backend interno). */
function initQuoteForm() {
  var form = document.getElementById("quote-form");
  if (!form) return;

  var successBox = document.getElementById("form-success");

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var requiredFields = form.querySelectorAll("[required]");
    var isValid = true;

    requiredFields.forEach(function (field) {
      /* Lo stato di errore vive nel CSS (.field-error, token --color-danger),
         non in uno stile inline */
      field.classList.toggle("field-error", !field.value.trim());
      if (!field.value.trim()) isValid = false;
    });

    if (!isValid) {
      if (successBox) successBox.classList.remove("visible");
      return;
    }

    if (successBox) {
      successBox.classList.add("visible");
      successBox.setAttribute("tabindex", "-1");
      successBox.focus();
    }

    form.reset();
  });
}
