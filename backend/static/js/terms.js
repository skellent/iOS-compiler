const LANG_KEY = "panicbutton.terms.lang";

const TITLES = {
  en: "Terms of Service — Panic Button",
  es: "Términos de Servicio — Panic Button",
};

function selectLanguage(value) {
  const language = value === "es" ? "es" : "en";
  document.documentElement.lang = language;
  document.title = TITLES[language];
  document.querySelectorAll("[data-lang]").forEach((article) => {
    article.hidden = article.dataset.lang !== language;
  });
  document.getElementById("lang-select").value = language;
  localStorage.setItem(LANG_KEY, language);
}

const saved = localStorage.getItem(LANG_KEY);
const detected = navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
selectLanguage(saved || detected);

document.getElementById("lang-select").addEventListener("change", (event) => {
  selectLanguage(event.target.value);
});
