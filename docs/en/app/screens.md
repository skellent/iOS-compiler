# App screens

Three main tabs — Home, Contacts, Profile — plus login and registration.

## Login & register

Email + password. Registration verifies the email domain server-side and sends a confirmation link; login is blocked (`403`) until the account is confirmed. The submit button targets the form's submit control explicitly and shows a loading state.

## Home — the panic button

A single hold-to-alert button. Holding it for a couple of seconds captures the device GPS location and calls `POST /alerts`, which fans the alert out to every confirmed channel of every contact.

**Guard.** Before sending, the app checks that at least one contact is reachable — it counts contacts that are `confirmed` (email) **or** Telegram-linked **or** WhatsApp-confirmed **or** SMS-enabled. If none are, it shows a toast instead of firing a useless alert. The count fails open (if the check itself errors, the button still works) so nothing blocks a real emergency.

## Contacts

Add up to `max_contacts` (served by `/features`) contacts, by hand or from the device address book. Each contact row shows a channel-status strip, and editing a contact opens a sheet with a toggle per channel that the deployment has configured:

| Channel | How the contact becomes reachable |
|---|---|
| **Email** | Confirms via the emailed link. A "resend confirmation" button appears while unconfirmed. |
| **Telegram** | "Connect Telegram" hands over a `t.me` link (copied or emailed); the contact opens it and sends `/start`. |
| **WhatsApp** | "Connect WhatsApp" enables it and copies a `wa.me` link to share; the contact sends the message to opt in. |
| **SMS** | A simple enable/disable toggle — no opt-in. |

Channel icons are only shown for channels the deployment has enabled (from `/features`); a status dot indicates linked/active vs. pending.

Editing a contact's email re-triggers confirmation (the contact goes unconfirmed until the new address is verified). Deleting a contact keeps past alerts' history on the dashboard.

## Profile

View and edit the account (name, phone, email, password). Changing the **email or password** requires the **current password** in the same form (re-authentication); name/phone don't. A security notice is emailed to the old address when a sensitive field changes.

## Settings

Theme (auto/light/dark), accent colour, and language. The app ships many locales; strings fall back to English for any key a locale is missing.
