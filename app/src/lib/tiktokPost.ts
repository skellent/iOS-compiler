import { Api } from "./api.js";
import { escapeHtml } from "./dom.js";
import { t } from "./i18n.js";
import { openSheet } from "./sheet.js";
import { showToast } from "./toast.js";
import { Browser } from "@capacitor/browser";

const MUSIC_URL = "https://www.tiktok.com/legal/page/global/music-usage-confirmation/en";
const BRANDED_URL = "https://www.tiktok.com/legal/page/global/bc-policy/en";

export async function openTikTokPost(alertId: number, onPosted?: () => void) {
  let options;
  try { options = await Api.getTikTokOptions(alertId); }
  catch (error) { showToast(error instanceof Error ? error.message : t("errors.generic"), "error"); return; }
  const body = document.createElement("div");
  body.innerHTML = `<form class="form tiktok-form" id="tiktok-post-form">
    <h2>${t("video.tiktokTitle")}</h2>
    <p>${t("video.tiktokAccount", { username: escapeHtml(options.nickname || options.username || "TikTok") })}</p>
    <video class="tiktok-preview" src="${escapeHtml(options.preview_url)}" controls playsinline preload="metadata" aria-label="${t("video.preview")}"></video>
    <label class="field"><span>${t("video.caption")}</span><input name="title" required maxlength="2200" value="${escapeHtml(t("video.defaultCaption"))}" /></label>
    <label class="field"><span>${t("video.privacy")}</span>
      <select name="privacy_level" required>
        <option value="" selected>${t("video.choosePrivacy")}</option>
        ${options.privacy_options.map((privacy) => `<option value="${escapeHtml(privacy)}">${t(`video.privacy.${privacy}`)}</option>`).join("")}
      </select>
    </label>
    <fieldset class="video-settings">
      <legend>${t("video.interactions")}</legend>
      <label><input type="checkbox" name="allow_comment" ${options.comment_disabled ? "disabled" : ""} /> ${t("video.allowComment")}</label>
      <label><input type="checkbox" name="allow_duet" ${options.duet_disabled ? "disabled" : ""} /> ${t("video.allowDuet")}</label>
      <label><input type="checkbox" name="allow_stitch" ${options.stitch_disabled ? "disabled" : ""} /> ${t("video.allowStitch")}</label>
    </fieldset>
    <label class="video-consent"><input type="checkbox" name="commercial" /> ${t("video.commercial")}</label>
    <div id="commercial-options" class="video-settings" hidden>
      <label><input type="checkbox" name="brand_organic" /> ${t("video.ownBrand")}</label>
      <label><input type="checkbox" name="brand_content" /> ${t("video.paidBrand")}</label>
      <small id="commercial-hint"></small>
    </div>
    <label class="video-consent"><input type="checkbox" name="consent" required /> ${t("video.publishConsent")}</label>
    <p class="video-terms">${t("video.musicAgreement")} <a href="${MUSIC_URL}" target="_blank" rel="noopener noreferrer">${t("video.musicTerms")}</a><span id="branded-terms" hidden> ${t("video.and")} <a href="${BRANDED_URL}" target="_blank" rel="noopener noreferrer">${t("video.brandedTerms")}</a></span>.</p>
    <button class="btn btn-primary btn-block" type="submit">${t("video.publish")}</button>
    <small>${t("video.processingHint")}</small>
  </form>`;
  const sheet = openSheet(body);
  const form = body.querySelector("form") as HTMLFormElement;
  const commercial = form.elements.namedItem("commercial") as HTMLInputElement;
  const organic = form.elements.namedItem("brand_organic") as HTMLInputElement;
  const branded = form.elements.namedItem("brand_content") as HTMLInputElement;
  const privacy = form.elements.namedItem("privacy_level") as HTMLSelectElement;
  const group = form.querySelector("#commercial-options") as HTMLElement;
  const hint = form.querySelector("#commercial-hint") as HTMLElement;
  const terms = form.querySelector("#branded-terms") as HTMLElement;
  const button = form.querySelector("button[type=submit]") as HTMLButtonElement;
  form.querySelectorAll(".video-terms a").forEach((link) => link.addEventListener("click", (event) => {
    event.preventDefault();
    Browser.open({ url: (link as HTMLAnchorElement).href });
  }));

  function refresh() {
    group.hidden = !commercial.checked;
    if (!commercial.checked) { organic.checked = false; branded.checked = false; }
    branded.disabled = !["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS"].includes(privacy.value);
    if (branded.disabled) branded.checked = false;
    hint.textContent = branded.disabled ? t("video.privateBrand") :
      branded.checked ? t("video.paidLabel") : organic.checked ? t("video.promotionLabel") : "";
    terms.hidden = !branded.checked;
    button.disabled = commercial.checked && !organic.checked && !branded.checked;
  }
  [commercial, organic, branded, privacy].forEach((control) => control.addEventListener("change", refresh));
  refresh();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    button.disabled = true;
    try {
      await Api.publishTikTok(alertId, {
        title: String(data.get("title") || ""),
        privacy_level: String(data.get("privacy_level") || ""),
        allow_comment: data.get("allow_comment") === "on",
        allow_duet: data.get("allow_duet") === "on",
        allow_stitch: data.get("allow_stitch") === "on",
        brand_organic: data.get("brand_organic") === "on",
        brand_content: data.get("brand_content") === "on",
        consent: data.get("consent") === "on",
      });
      showToast(t("video.sentToTikTok"), "success");
      sheet.close();
      onPosted?.();
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("errors.generic"), "error");
      refresh();
    }
  });
}
