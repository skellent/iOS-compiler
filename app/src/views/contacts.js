import { Api, ApiError } from "../lib/api.js";
import { getFeatures } from "../lib/features.js";
import { pickDeviceContact } from "../lib/contactsPicker.js";
import { openSheet } from "../lib/sheet.js";
import { showToast } from "../lib/toast.js";
import { escapeHtml, setLoading, shake } from "../lib/dom.js";
import { Icon } from "../lib/icons.js";
import { t } from "../lib/i18n.js";
import { attachPhoneSanitizer, buildCountryCodeOptions, combinePhone, splitPhone } from "../lib/phone.js";
import { shareLink } from "../lib/share.js";

const EMAIL_DOMAINS = ["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com"];
const MAX_CONTACTS = 4;

function insertEmailDomain(input, domain) {
  const at = input.value.indexOf("@");
  const local = at >= 0 ? input.value.slice(0, at) : input.value;
  input.value = `${local}@${domain}`;
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}

export async function renderContacts(container) {
  container.innerHTML = `
    <div class="contacts-screen">
      <div id="contacts-list" class="contacts-list"></div>
      <button id="add-contact-fab" class="fab" type="button" aria-label="${t("contacts.addTitle")}">${Icon.add()}</button>
    </div>
  `;

  const list = container.querySelector("#contacts-list");
  const fab = container.querySelector("#add-contact-fab");

  renderSkeleton(list);
  const features = await getFeatures();
  await loadContacts(list, fab, features);

  fab.addEventListener("click", () => {
    if (fab.dataset.atLimit === "true") {
      showToast(t("contacts.limitReached", { max: MAX_CONTACTS }), "info");
      return;
    }
    openAddOptionsSheet(() => loadContacts(list, fab, features), features);
  });
}

function updateFabState(fab, count) {
  const atLimit = count >= MAX_CONTACTS;
  fab.dataset.atLimit = String(atLimit);
  fab.classList.toggle("fab-disabled", atLimit);
  fab.setAttribute("aria-disabled", String(atLimit));
}

function renderSkeleton(list) {
  list.innerHTML = Array.from({ length: 3 })
    .map(() => `<div class="contact-row contact-skeleton"></div>`)
    .join("");
}

async function loadContacts(list, fab, features) {
  try {
    const contacts = await Api.listContacts();
    renderContactRows(list, fab, contacts, features);
    updateFabState(fab, contacts.length);
  } catch (error) {
    list.innerHTML = `<p class="contacts-empty">${t("contacts.loadError")}</p>`;
    showToast(error instanceof ApiError ? error.message : t("contacts.loadErrorToast"), "error");
  }
}

function renderContactRows(list, fab, contacts, features) {
  if (contacts.length === 0) {
    list.innerHTML = `<p class="contacts-empty">${t("contacts.empty")}</p>`;
    return;
  }

  const limitHint =
    contacts.length >= MAX_CONTACTS
      ? `<p class="contacts-limit-hint">${t("contacts.limitReached", { max: MAX_CONTACTS })}</p>`
      : "";

  list.innerHTML =
    limitHint +
    contacts
      .map(
        (contact, index) => `
      <button class="contact-row" type="button" data-id="${contact.id}" style="animation-delay:${index * 60}ms">
        <span class="contact-avatar">${escapeHtml(contact.name.charAt(0).toUpperCase())}</span>
        <span class="contact-info">
          <span class="contact-name">${escapeHtml(contact.name)}</span>
          <span class="contact-phone">${Icon.phone()} ${escapeHtml(contact.phone)}</span>
          ${contact.email ? `<span class="contact-email">${Icon.mail()} ${escapeHtml(contact.email)}</span>` : ""}
        </span>
        <span class="contact-channels">
          <span class="channel-icon ${contact.confirmed ? "channel-active" : "channel-inactive"}"
                title="${contact.confirmed ? t("contacts.confirmed") : t("contacts.pending")}"
                aria-label="${contact.confirmed ? t("contacts.confirmed") : t("contacts.pending")}">${Icon.mail()}</span>
          ${
            features.telegram
              ? `<span class="channel-icon channel-telegram ${contact.telegram_linked ? "channel-active" : "channel-inactive"}"
                       title="${contact.telegram_linked ? t("contacts.telegramLinked") : t("contacts.telegramNotLinked")}"
                       aria-label="${contact.telegram_linked ? t("contacts.telegramLinked") : t("contacts.telegramNotLinked")}">${Icon.telegram()}</span>`
              : ""
          }
          ${
            features.whatsapp
              ? `<span class="channel-icon channel-whatsapp ${contact.whatsapp_enabled && contact.whatsapp_confirmed ? "channel-active" : "channel-inactive"}"
                       title="${contact.whatsapp_enabled && contact.whatsapp_confirmed ? t("contacts.whatsappLinked") : t("contacts.whatsappNotLinked")}"
                       aria-label="${contact.whatsapp_enabled && contact.whatsapp_confirmed ? t("contacts.whatsappLinked") : t("contacts.whatsappNotLinked")}">${Icon.whatsapp()}</span>`
              : ""
          }
          ${
            features.sms
              ? `<span class="channel-icon channel-sms ${contact.sms_enabled ? "channel-active" : "channel-inactive"}"
                       title="${contact.sms_enabled ? t("contacts.smsEnabled") : t("contacts.smsDisabled")}"
                       aria-label="${contact.sms_enabled ? t("contacts.smsEnabled") : t("contacts.smsDisabled")}">${Icon.sms()}</span>`
              : ""
          }
        </span>
      </button>
    `
    )
    .join("");

  list.querySelectorAll(".contact-row").forEach((row) => {
    row.addEventListener("click", () => {
      const contact = contacts.find((c) => String(c.id) === row.dataset.id);
      openContactFormSheet({ contact, features, onSaved: () => loadContacts(list, fab, features) });
    });
  });
}

function openAddOptionsSheet(onSaved, features) {
  const body = document.createElement("div");
  body.innerHTML = `
    <h2 class="sheet-title">${t("contacts.addTitle")}</h2>
    <div class="sheet-options">
      <button class="btn btn-outline btn-block" type="button" id="pick-device-contact">
        ${Icon.contacts()}
        <span class="btn-label">${t("contacts.pickDevice")}</span>
      </button>
      <button class="btn btn-outline btn-block" type="button" id="add-manually">
        ${Icon.personAdd()}
        <span class="btn-label">${t("contacts.addManually")}</span>
      </button>
    </div>
  `;

  const { close } = openSheet(body);

  body.querySelector("#add-manually").addEventListener("click", () => {
    close();
    openContactFormSheet({ onSaved, features });
  });

  body.querySelector("#pick-device-contact").addEventListener("click", async () => {
    close();
    try {
      const prefill = await pickDeviceContact();
      openContactFormSheet({ prefill, onSaved, features });
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("contacts.pickError"), "error");
    }
  });
}

function openContactFormSheet({ contact = null, prefill = null, features, onSaved }) {
  const isEdit = Boolean(contact);
  const initial = contact ?? prefill ?? { name: "", phone: "", email: "" };
  const { countryCode, number } = splitPhone(initial.phone);

  const body = document.createElement("div");
  body.innerHTML = `
    <form class="form sheet-form" novalidate>
      <h2 class="sheet-title">${isEdit ? t("contacts.editTitle") : t("contacts.addTitle")}</h2>
      <label class="field">
        <span>${t("contacts.name")}</span>
        <input type="text" name="name" required value="${escapeHtml(initial.name ?? "")}" />
      </label>
      <label class="field">
        <span>${t("contacts.phone")}</span>
        <div class="phone-field">
          <select name="phone_country" class="phone-country">${buildCountryCodeOptions(countryCode)}</select>
          <input type="tel" name="phone_number" inputmode="numeric" required value="${escapeHtml(number)}" />
        </div>
      </label>
      <label class="field">
        <span>${t("contacts.email")}</span>
        <input type="email" name="email" required value="${escapeHtml(initial.email ?? "")}" />
        <div class="email-domain-chips">
          ${EMAIL_DOMAINS.map((domain) => `<button type="button" class="email-domain-chip" data-domain="${domain}">@${domain}</button>`).join("")}
        </div>
      </label>
      ${!isEdit ? `<p class="field-hint">${t("contacts.emailHint")}</p>` : ""}
      <button type="submit" class="btn btn-primary btn-block">
        <span class="btn-label">${isEdit ? t("contacts.save") : t("contacts.add")}</span>
        <span class="btn-spinner" hidden></span>
      </button>
      ${
        isEdit && contact.email && !contact.confirmed
          ? `<button type="button" class="btn btn-outline btn-block" id="resend-confirmation">
              ${Icon.mail()}
              <span class="btn-label">${t("contacts.resendConfirmation")}</span>
              <span class="btn-spinner" hidden></span>
            </button>`
          : ""
      }
      ${
        isEdit && features.telegram
          ? `<button type="button" class="btn btn-outline btn-block" id="telegram-toggle">
              ${Icon.telegram()}
              <span class="btn-label">${contact.telegram_linked ? t("contacts.telegramDisconnect") : t("contacts.telegramConnect")}</span>
              <span class="btn-spinner" hidden></span>
            </button>`
          : ""
      }
      ${
        isEdit && features.whatsapp
          ? `<button type="button" class="btn btn-outline btn-block" id="whatsapp-toggle">
              ${Icon.whatsapp()}
              <span class="btn-label">${contact.whatsapp_enabled ? t("contacts.whatsappDisconnect") : t("contacts.whatsappConnect")}</span>
              <span class="btn-spinner" hidden></span>
            </button>`
          : ""
      }
      ${
        isEdit && features.sms
          ? `<button type="button" class="btn btn-outline btn-block" id="sms-toggle">
              ${Icon.sms()}
              <span class="btn-label">${contact.sms_enabled ? t("contacts.smsDisable") : t("contacts.smsEnable")}</span>
              <span class="btn-spinner" hidden></span>
            </button>`
          : ""
      }
      ${
        isEdit
          ? `<button type="button" class="btn btn-danger-outline btn-block" id="delete-contact">
              ${Icon.delete()}
              <span class="btn-label">${t("contacts.delete")}</span>
              <span class="btn-spinner" hidden></span>
            </button>`
          : ""
      }
    </form>
  `;

  const { close } = openSheet(body);
  const form = body.querySelector("form");
  const button = form.querySelector('button[type="submit"]');

  attachPhoneSanitizer(form.querySelector('input[name="phone_number"]'));
  const emailInput = form.querySelector('input[name="email"]');
  form.querySelectorAll(".email-domain-chip").forEach((chip) => {
    chip.addEventListener("click", () => insertEmailDomain(emailInput, chip.dataset.domain));
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = Object.fromEntries(new FormData(form));
    const data = {
      name: formData.name,
      phone: combinePhone(formData.phone_country, formData.phone_number),
      email: formData.email.trim(),
    };

    if (!data.email) {
      shake(form);
      showToast(t("contacts.emailRequired"), "error");
      return;
    }

    setLoading(button, true);
    try {
      if (isEdit) {
        const changes = diffFields(contact, data);
        if (Object.keys(changes).length === 0) {
          close();
          return;
        }
        await Api.updateContact(contact.id, changes);
        showToast(t("contacts.updated"), "success");
      } else {
        await Api.createContact(data);
        showToast(t("contacts.addedWithEmail"), "success");
      }
      close();
      onSaved();
    } catch (error) {
      shake(form);
      showToast(error instanceof ApiError ? error.message : t("errors.generic"), "error");
    } finally {
      setLoading(button, false);
    }
  });

  if (isEdit) {
    const resendButton = body.querySelector("#resend-confirmation");
    resendButton?.addEventListener("click", async () => {
      setLoading(resendButton, true);
      try {
        await Api.resendContactConfirmation(contact.id);
        showToast(t("contacts.resendConfirmationSent"), "success");
        close();
      } catch (error) {
        showToast(error instanceof ApiError ? error.message : t("errors.generic"), "error");
      } finally {
        setLoading(resendButton, false);
      }
    });

    const telegramButton = body.querySelector("#telegram-toggle");
    telegramButton?.addEventListener("click", async () => {
      setLoading(telegramButton, true);
      try {
        if (contact.telegram_linked) {
          await Api.disableContactTelegram(contact.id);
          showToast(t("contacts.telegramDisconnected"), "success");
        } else {
          const result = await Api.enableContactTelegram(contact.id);
          if (result.telegram_link_url) {
            await shareLink({
              url: result.telegram_link_url,
              title: "Panic Button",
              text: t("contacts.telegramShareText"),
            });
            showToast(t("contacts.telegramLinkReady"), "success");
          } else {
            showToast(t("contacts.telegramEmailSent"), "success");
          }
        }
        close();
        onSaved();
      } catch (error) {
        const fallbackKey = contact.telegram_linked ? "contacts.telegramDisableError" : "contacts.telegramEnableError";
        showToast(error instanceof ApiError ? error.message : t(fallbackKey), "error");
      } finally {
        setLoading(telegramButton, false);
      }
    });

    const whatsappButton = body.querySelector("#whatsapp-toggle");
    whatsappButton?.addEventListener("click", async () => {
      setLoading(whatsappButton, true);
      try {
        if (contact.whatsapp_enabled) {
          await Api.disableContactWhatsapp(contact.id);
          showToast(t("contacts.whatsappDisconnected"), "success");
        } else {
          const result = await Api.enableContactWhatsapp(contact.id);
          if (result.join_url) {
            await shareLink({
              url: result.join_url,
              title: "Panic Button",
              text: t("contacts.whatsappShareText"),
            });
            showToast(t("contacts.whatsappLinkReady"), "success");
          } else {
            showToast(t("contacts.whatsappEnabled"), "success");
          }
        }
        close();
        onSaved();
      } catch (error) {
        const fallbackKey = contact.whatsapp_enabled ? "contacts.whatsappDisableError" : "contacts.whatsappEnableError";
        showToast(error instanceof ApiError ? error.message : t(fallbackKey), "error");
      } finally {
        setLoading(whatsappButton, false);
      }
    });

    const smsButton = body.querySelector("#sms-toggle");
    smsButton?.addEventListener("click", async () => {
      setLoading(smsButton, true);
      try {
        if (contact.sms_enabled) {
          await Api.disableContactSms(contact.id);
          showToast(t("contacts.smsDisabledToast"), "success");
        } else {
          await Api.enableContactSms(contact.id);
          showToast(t("contacts.smsEnabledToast"), "success");
        }
        close();
        onSaved();
      } catch (error) {
        const fallbackKey = contact.sms_enabled ? "contacts.smsDisableError" : "contacts.smsEnableError";
        showToast(error instanceof ApiError ? error.message : t(fallbackKey), "error");
      } finally {
        setLoading(smsButton, false);
      }
    });

    const deleteButton = body.querySelector("#delete-contact");
    deleteButton.addEventListener("click", async () => {
      if (!confirm(t("contacts.removeConfirm", { name: contact.name }))) return;

      setLoading(deleteButton, true);
      try {
        await Api.deleteContact(contact.id);
        showToast(t("contacts.removed"), "success");
        close();
        onSaved();
      } catch (error) {
        showToast(error instanceof ApiError ? error.message : t("contacts.removeError"), "error");
      } finally {
        setLoading(deleteButton, false);
      }
    });
  }
}

function diffFields(original, updated) {
  const changes = {};
  for (const key of ["name", "phone", "email"]) {
    if ((original[key] ?? null) !== (updated[key] ?? null)) {
      changes[key] = updated[key];
    }
  }
  return changes;
}
