import { Api, ApiError } from "../lib/api.js";
import { pickDeviceContact } from "../lib/contactsPicker.js";
import { openSheet } from "../lib/sheet.js";
import { showToast } from "../lib/toast.js";
import { escapeHtml, setLoading, shake } from "../lib/dom.js";

export async function renderContacts(container) {
  container.innerHTML = `
    <div class="contacts-screen">
      <div id="contacts-list" class="contacts-list"></div>
      <button id="add-contact-fab" class="fab" type="button" aria-label="Add emergency contact">+</button>
    </div>
  `;

  const list = container.querySelector("#contacts-list");
  const fab = container.querySelector("#add-contact-fab");

  renderSkeleton(list);
  await loadContacts(list);

  fab.addEventListener("click", () => openAddOptionsSheet(() => loadContacts(list)));
}

function renderSkeleton(list) {
  list.innerHTML = Array.from({ length: 3 })
    .map(() => `<div class="contact-row contact-skeleton"></div>`)
    .join("");
}

async function loadContacts(list) {
  try {
    const contacts = await Api.listContacts();
    renderContactRows(list, contacts);
  } catch (error) {
    list.innerHTML = `<p class="contacts-empty">Couldn't load your contacts. Pull down or reopen this tab to try again.</p>`;
    showToast(error instanceof ApiError ? error.message : "Couldn't load contacts.", "error");
  }
}

function renderContactRows(list, contacts) {
  if (contacts.length === 0) {
    list.innerHTML = `
      <p class="contacts-empty">
        No emergency contacts yet. Tap the + button to add someone who should be notified
        when you trigger a panic alert.
      </p>
    `;
    return;
  }

  list.innerHTML = contacts
    .map(
      (contact, index) => `
      <button class="contact-row" type="button" data-id="${contact.id}" style="animation-delay:${index * 60}ms">
        <span class="contact-avatar">${escapeHtml(contact.name.charAt(0).toUpperCase())}</span>
        <span class="contact-info">
          <span class="contact-name">${escapeHtml(contact.name)}</span>
          <span class="contact-phone">${escapeHtml(contact.phone)}</span>
        </span>
        <span class="badge ${contact.confirmed ? "badge-confirmed" : "badge-pending"}">
          ${contact.confirmed ? "✓ Confirmed" : "Pending"}
        </span>
      </button>
    `
    )
    .join("");

  list.querySelectorAll(".contact-row").forEach((row) => {
    row.addEventListener("click", () => {
      const contact = contacts.find((c) => String(c.id) === row.dataset.id);
      openContactFormSheet({ contact, onSaved: () => loadContacts(list) });
    });
  });
}

function openAddOptionsSheet(onSaved) {
  const body = document.createElement("div");
  body.innerHTML = `
    <h2 class="sheet-title">Add Emergency Contact</h2>
    <div class="sheet-options">
      <button class="btn btn-outline btn-block" type="button" id="pick-device-contact">
        Pick from device contacts
      </button>
      <button class="btn btn-outline btn-block" type="button" id="add-manually">
        Add manually
      </button>
    </div>
  `;

  const { close } = openSheet(body);

  body.querySelector("#add-manually").addEventListener("click", () => {
    close();
    openContactFormSheet({ onSaved });
  });

  body.querySelector("#pick-device-contact").addEventListener("click", async () => {
    close();
    try {
      const prefill = await pickDeviceContact();
      openContactFormSheet({ prefill, onSaved });
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Couldn't access your contacts.",
        "error"
      );
    }
  });
}

function openContactFormSheet({ contact = null, prefill = null, onSaved }) {
  const isEdit = Boolean(contact);
  const initial = contact ?? prefill ?? { name: "", phone: "", email: "" };

  const body = document.createElement("div");
  body.innerHTML = `
    <form class="form sheet-form" novalidate>
      <h2 class="sheet-title">${isEdit ? "Edit Contact" : "Add Emergency Contact"}</h2>
      <label class="field">
        <span>Name</span>
        <input type="text" name="name" required value="${escapeHtml(initial.name ?? "")}" />
      </label>
      <label class="field">
        <span>Phone</span>
        <input type="tel" name="phone" required value="${escapeHtml(initial.phone ?? "")}" />
      </label>
      <label class="field">
        <span>Email (optional)</span>
        <input type="email" name="email" value="${escapeHtml(initial.email ?? "")}" />
      </label>
      ${!isEdit ? `<p class="field-hint">If you add an email, we'll send this contact a confirmation link — only confirmed contacts are notified during a panic alert.</p>` : ""}
      <button type="submit" class="btn btn-primary btn-block">
        <span class="btn-label">${isEdit ? "Save Changes" : "Add Contact"}</span>
        <span class="btn-spinner" hidden></span>
      </button>
    </form>
  `;

  const { close } = openSheet(body);
  const form = body.querySelector("form");
  const button = form.querySelector("button");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    data.email = data.email.trim() || null;

    setLoading(button, true);
    try {
      if (isEdit) {
        const changes = diffFields(contact, data);
        if (Object.keys(changes).length === 0) {
          close();
          return;
        }
        await Api.updateContact(contact.id, changes);
        showToast("Contact updated.", "success");
      } else {
        await Api.createContact(data);
        showToast(
          data.email ? "Contact added — confirmation email sent." : "Contact added.",
          "success"
        );
      }
      close();
      onSaved();
    } catch (error) {
      shake(form);
      showToast(error instanceof ApiError ? error.message : "Something went wrong.", "error");
    } finally {
      setLoading(button, false);
    }
  });
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
