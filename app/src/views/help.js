import { Icon } from "../lib/icons.js";
import { t } from "../lib/i18n.js";

const SECTIONS = ["account", "panic", "contacts", "channels", "profile"];

export async function renderHelp(container, { navigate }) {
  container.innerHTML = `
    <div class="info-screen">
      <div class="info-header">
        <button class="icon-btn" type="button" id="info-back" aria-label="${t("info.back")}">${Icon.arrowBack()}</button>
        <h1 class="info-title">${t("route.help.title")}</h1>
      </div>
      <p class="info-intro">${t("help.intro")}</p>
      ${SECTIONS.map(
        (key) => `
        <section class="info-section">
          <h2 class="info-section-title">${t(`help.section.${key}.title`)}</h2>
          <p class="info-section-body">${t(`help.section.${key}.body`)}</p>
        </section>
      `
      ).join("")}
    </div>
  `;

  container.querySelector("#info-back").addEventListener("click", () => navigate("profile"));
}
