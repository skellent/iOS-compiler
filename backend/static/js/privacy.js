const LANG_KEY = "panicbutton.privacy.lang";
const DEFAULT_LANG = "en";
const SUPPORTED = ["en", "es"];

const TITLES = {
  en: "Privacy Policy — Panic Button",
  es: "Política de Privacidad — Panic Button",
};

function applyLanguage(lang) {
  const code = SUPPORTED.includes(lang) ? lang : DEFAULT_LANG;
  document.documentElement.lang = code;
  document.title = TITLES[code];
  document.querySelectorAll("[data-lang]").forEach((el) => {
    el.hidden = el.dataset.lang !== code;
  });
  const select = document.getElementById("lang-select");
  if (select) select.value = code;
}

function init() {
  const saved = localStorage.getItem(LANG_KEY);
  applyLanguage(SUPPORTED.includes(saved) ? saved : DEFAULT_LANG);

  const select = document.getElementById("lang-select");
  if (select) {
    select.addEventListener("change", (event) => {
      localStorage.setItem(LANG_KEY, event.target.value);
      applyLanguage(event.target.value);
    });
  }
}

init();
