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
}

/* Evidenzia nel menu la voce corrispondente alla pagina corrente */
function highlightActiveNavLink() {
  var currentPath = window.location.pathname;
  document.querySelectorAll(".main-nav a").forEach(function (link) {
    var linkHref = link.getAttribute("href");
    if (linkHref && currentPath === linkHref) {
      link.classList.add("active");
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
      if (!field.value.trim()) {
        isValid = false;
        field.style.borderColor = "#c23b3b";
      } else {
        field.style.borderColor = "";
      }
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
