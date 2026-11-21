/* ==========================================================
   ASBORION — Scripts du site
   1. Apparition douce des blocs au défilement
   2. Année automatique dans le pied de page
   3. Formulaire de contact (Netlify Forms, sinon messagerie pré-remplie)
   4. Formulaire d'avis
   5. Affichage des avis validés (fichier avis.json)
   ========================================================== */

// Adresse qui reçoit les demandes de devis
const CONTACT_EMAIL = "contact@asborion.com";

/* ---------- Langue de la page (fr ou en) ---------- */
const LANG = document.documentElement.lang.startsWith("en") ? "en" : "fr";
const MESSAGES = {
  fr: {
    missing: "Merci de remplir votre nom, un email valide et votre message.",
    mailOpen: "Votre messagerie s'ouvre avec la demande pré-remplie.",
    sent: "Merci ! Votre demande est bien envoyée. Je vous réponds sous 48h.",
    needComment: "Merci de saisir votre commentaire.",
    photoSize: "La photo doit faire 5 Mo maximum.",
    anon: "Client anonyme",
    unspecified: "Non précisé",
    reviewMail: "Votre messagerie s’ouvre avec un brouillon. Envoyez l’e-mail pour transmettre votre avis.",
    reviewThanks: "Merci pour votre avis ! Il sera publié après relecture.",
    reviewToast: "Merci pour votre avis !",
  },
  en: {
    missing: "Please enter your name, a valid email and your message.",
    mailOpen: "Your email app is opening with your request pre-filled.",
    sent: "Thank you! Your request has been sent. I'll reply within 48 hours.",
    needComment: "Please enter your comment.",
    photoSize: "The photo must be 5 MB or less.",
    anon: "Anonymous client",
    unspecified: "Not specified",
    reviewMail: "Your email app is opening with a draft. Send the email to submit your review.",
    reviewThanks: "Thank you for your review! It will be published after approval.",
    reviewToast: "Thank you for your review!",
  },
};
const t = (key) => MESSAGES[LANG][key];

document.addEventListener("DOMContentLoaded", () => {
  setupReveal();
  setupYear();
  setupContactForm();
  setupReviewsList();
});

/* ---------- 1. Apparition au défilement ---------- */
function setupReveal() {
  const items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  items.forEach((el) => observer.observe(el));
}

/* ---------- 2. Année ---------- */
function setupYear() {
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });
}

/* ---------- Notification ---------- */
let toastTimer;
function showToast(message, type = "success") {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.toggle("toast--error", type === "error");
  requestAnimationFrame(() => toast.classList.add("is-visible"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 4000);
}

/* ---------- 3. Formulaire de contact ---------- */
function setupContactForm() {
  const form = document.querySelector("#contact-form");
  if (!form) return;

  // Choix du type de projet
  const chips = form.querySelectorAll(".chip");
  const typeInput = form.querySelector("#project-type");
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((c) => c.setAttribute("aria-pressed", "false"));
      chip.setAttribute("aria-pressed", "true");
      typeInput.value = chip.dataset.value;
    });
  });

  // Retire l'erreur dès que l'on retape
  form.querySelectorAll(".input").forEach((input) => {
    input.addEventListener("input", () => input.removeAttribute("aria-invalid"));
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim();
    const message = String(data.get("message") || "").trim();
    const budget = String(data.get("budget") || "").trim();
    const projectType = String(data.get("projectType") || "").trim();

    const missing = [];
    if (!name) missing.push("name");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) missing.push("email");
    if (!message) missing.push("message");

    if (missing.length) {
      missing.forEach((id) => form.querySelector("#" + id).setAttribute("aria-invalid", "true"));
      form.querySelector("#" + missing[0]).focus();
      showToast(t("missing"), "error");
      return;
    }

    const subject = `Demande de devis — ${projectType}`;
    const body =
      `Nom : ${name}\nEmail : ${email}\nType de projet : ${projectType}\n` +
      `Budget : ${budget || t("unspecified")}\n\n${message}`;
    const openMail = () => {
      window.location.href =
        `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      showToast(t("mailOpen"));
    };

    // Envoi via Netlify Forms ; si le site n'est pas sur Netlify, on ouvre la messagerie.
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(data).toString(),
    })
      .then((response) => {
        if (!response.ok) throw new Error("Envoi impossible");
        form.reset();
        chips.forEach((c, i) => c.setAttribute("aria-pressed", i === 0 ? "true" : "false"));
        typeInput.value = chips[0].dataset.value;
        showToast(t("sent"));
      })
      .catch(openMail)
      .finally(() => { button.disabled = false; });
  });
}

/* ---------- 4. Avis clients ----------
   Envoi via Netlify Forms (avec photo facultative).
   Sinon, la messagerie s'ouvre avec un brouillon.
   Aucun avis n'est publié automatiquement : tu les ajoutes toi-même après relecture. */
document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#review-form");
  if (!form) return;
  const status = form.querySelector("#review-status");
  const comment = form.querySelector("#review-comment");
  const photo = form.querySelector("#review-photo");
  const MAX_PHOTO = 5 * 1024 * 1024;

  comment.addEventListener("input", () => comment.setCustomValidity(""));
  photo.addEventListener("change", () => photo.setCustomValidity(""));

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    comment.setCustomValidity(String(comment.value).trim() ? "" : t("needComment"));
    const file = photo.files[0];
    photo.setCustomValidity(file && file.size > MAX_PHOTO ? t("photoSize") : "");
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const name = String(data.get("displayName") || "").trim() || t("anon");
    const company = String(data.get("company") || "").trim() || t("unspecified");

    const openMail = () => {
      const body = [
        "Nom affiché : " + name,
        "Entreprise / projet : " + company,
        "Note : " + data.get("rating") + "/5",
        "", String(comment.value).trim(), "",
        LANG === "en" ? "I allow the publication of this review and the information I share, after approval." : "J’autorise la publication de cet avis et des informations que je transmets, après validation.",
        file ? (LANG === "en" ? "Photo: please attach it to this email before sending." : "Photo : merci de la joindre à cet e-mail avant l’envoi.") : "",
      ].join("\n");
      window.location.href = "mailto:" + CONTACT_EMAIL + "?subject=" +
        encodeURIComponent("Avis client — ASBORION") + "&body=" + encodeURIComponent(body);
      status.textContent = t("reviewMail");
    };

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    fetch("/", { method: "POST", body: data })
      .then((response) => {
        if (!response.ok) throw new Error("Envoi impossible");
        form.reset();
        status.textContent = t("reviewThanks");
        showToast(t("reviewToast"));
      })
      .catch(openMail)
      .finally(() => { button.disabled = false; });
  });
});

/* ---------- 5. Avis validés ----------
   Les avis affichés viennent du fichier avis.json (à la racine du site).
   Pour publier un avis reçu dans Netlify > Forms : copie-le dans avis.json, puis republie le site.
   Tant que avis.json est vide ([]), la liste reste cachée. */
function setupReviewsList() {
  const list = document.querySelector("#reviews-list");
  if (!list) return;
  fetch(list.dataset.src)
    .then((response) => (response.ok ? response.json() : []))
    .then((reviews) => {
      if (!Array.isArray(reviews) || !reviews.length) return;
      reviews.forEach((review) => {
        const card = document.createElement("figure");
        card.className = "tile review";
        const rating = Math.max(1, Math.min(5, Number(review.note) || 5));
        const stars = document.createElement("p");
        stars.className = "review__stars";
        stars.textContent = "★".repeat(rating) + "☆".repeat(5 - rating);
        stars.setAttribute("aria-label", LANG === "en" ? `${rating} out of 5` : `${rating} sur 5`);
        const comment = document.createElement("blockquote");
        comment.className = "review__comment";
        comment.textContent = review.commentaire || "";
        const author = document.createElement("figcaption");
        author.className = "review__author";
        author.textContent = review.nom || t("anon");
        if (review.entreprise) {
          const company = document.createElement("span");
          company.textContent = " · " + review.entreprise;
          author.appendChild(company);
        }
        card.append(stars, comment, author);
        list.appendChild(card);
      });
      list.hidden = false;
    })
    .catch(() => {});
}
