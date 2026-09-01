import { Icon } from "../lib/icons.js";
import { t } from "../lib/i18n.js";

export async function renderAbout(container, { navigate }) {
  container.innerHTML = `
    <div class="info-screen">
      <div class="info-header">
        <button class="icon-btn" type="button" id="info-back" aria-label="${t("info.back")}">${Icon.arrowBack()}</button>
        <h1 class="info-title">${t("route.about.title")}</h1>
      </div>

      <img class="about-mark" src="assets/brand-mark.png" alt="" />

      <section class="info-section">
        <p class="info-section-body">${t("about.description")}</p>
      </section>

      <section class="info-section">
        <p class="about-credit">${t("about.developedBy")}</p>
        <p class="about-credit">${t("about.rights")}</p>
        <p class="about-credit about-version">${t("about.version")}</p>
      </section>
    </div>
  `;

  container.querySelector("#info-back").addEventListener("click", () => navigate("profile"));
}
// TypeScript source.
