import { Browser } from "@capacitor/browser";
import { Icon } from "../lib/icons.js";
import { t } from "../lib/i18n.js";

const BASE_URL = import.meta.env.API_BASE_URL.replace(/\/+$/, "");

export async function renderAbout(container, { navigate }) {
  container.innerHTML = `
    <div class="info-screen">
      <div class="info-header">
        <button class="icon-btn" type="button" id="info-back" aria-label="${t("info.back")}">${Icon.arrowBack()}</button>
        <h1 class="info-title">${t("route.about.title")}</h1>
      </div>

      <center>
        <img class="brand-mark" src="assets/icon.png" alt="" />
        <img class="auth-title" src="assets/title.png" alt"" />
      </center>

      <section class="info-section">
        <p class="info-section-body">${t("about.description")}</p>
      </section>

      <section class="info-section">
        <h2 class="info-section-title">${t("about.legalTitle")}</h2>
        <button id="privacy-btn" class="btn btn-outline btn-block" type="button">${t("about.privacy")}</button>
        <button id="terms-btn" class="btn btn-outline btn-block" type="button">${t("about.terms")}</button>
        <button id="delete-account-btn" class="btn btn-outline btn-block" type="button">${t("about.deleteAccount")}</button>
      </section>

      <section class="info-section">
        <p class="about-credit">${t("about.developedBy")}</p>
        <p class="about-credit">${t("about.rights")}</p>
        <p class="about-credit about-version">${t("about.version")}</p>
      </section>
    </div>
  `;

  container.querySelector("#info-back").addEventListener("click", () => navigate("profile"));
  container.querySelector("#privacy-btn").addEventListener("click", () => Browser.open({ url: `${BASE_URL}/privacy` }));
  container.querySelector("#terms-btn").addEventListener("click", () => Browser.open({ url: `${BASE_URL}/terms` }));
  container.querySelector("#delete-account-btn").addEventListener("click", () => Browser.open({ url: `${BASE_URL}/delete-account` }));
}
// TypeScript source.
