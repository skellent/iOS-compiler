# Screens, routing, and animated feedback

See `architecture.md` for the overall project layout; this document covers how `src/main.js` wires the five screens together and the reasoning behind the app's visual/interaction design — deliberately matching the tone of the confirmation/alert emails and the `GET /contacts/confirm/{token}`/`GET /auth/confirm/{token}` result pages (see `docs/backend/mail.md`, `pages.md`) rather than inventing a second, unrelated look for the same product.

## Routing: a hash router in `main.js`, not a router module

```js
const ROUTES = {
  login:    { render: renderLogin,    title: "Log In",             public: true },
  register: { render: renderRegister, title: "Create Account",     public: true },
  home:     { render: renderHome,     title: "Panic Switch",       public: false },
  contacts: { render: renderContacts, title: "Emergency Contacts", public: false },
  profile:  { render: renderProfile,  title: "My Profile",         public: false },
};
```

`main.js` listens to `window.location.hash` and swaps the contents of `#view` accordingly — no History API, no separate router library. Each entry's `render(container, ctx)` function is called fresh on every navigation; `ctx` (`{ navigate, logout, getUser, refreshUser, getLanguage, changeLanguage, getAccentColor, setAccentColor }`) is passed down instead of having view modules import from `main.js` directly, which would create a circular import (`main.js` imports the views to register their routes, and the views would import back from `main.js` for navigation). Passing a small context object down is plain dependency injection, and it keeps every view module a leaf: they depend on `lib/*.js`, never on each other or on `main.js`. Route titles now come from `t(titleKey)` (see `lib/i18n.js`) rather than a fixed English string, except `home`, whose app-bar title is the brand name itself and stays untranslated on purpose.

`public: true/false` on each route drives two guards that run on every hash change: a logged-in user is bounced away from `#/login`/`#/register` back to `#/home`, and an anonymous visitor is bounced from any protected route back to `#/login`. `boot()` in `main.js` reads the stored token (`lib/session.js`, backed by `@capacitor/preferences`) once at startup and calls `GET /users/me` to confirm it still works before deciding which screen to land on — a token that's expired or been revoked clears itself out and the user lands on `#/login` instead of a broken protected screen.

## Design language shared with the backend

`www/css/styles.css` and the backend's confirmation emails/pages (see `docs/backend/mail.md`'s color table) both derive from the same anchor color, `#EA2052` (`theme.js`'s `DEFAULT_ACCENT`) — the exact color of the app's own icon (`www/assets/brand-mark.png`, `www/assets/favicon.png`), not a value chosen independently for the web templates or the app. `--primary-500` is that color itself, used for the app bar, primary buttons, the FAB, focus rings, and the confirmed-contact badge; `--primary-700`/`--primary-800`/`--primary-900` are darker derivatives reserved for places that specifically need it — small text sitting directly on a background of the opposite tone, or a deliberately different "this is destructive" tone (the delete-contact button, see below) — never used to soften or replace the brand color on a surface that's meant to read as the app's own.

The whole scale is no longer a fixed palette: `:root` holds a dark-themed default, overridden wholesale under `@media (prefers-color-scheme: light)` (same custom property names, different values) so the app follows the system/browser theme instead of always rendering dark. On top of that, `lib/theme.js` can override every `--primary-*` shade again at runtime, computed from whatever accent color the user picks in Profile (see below) — light/dark still wins for background/surface/text tokens, only the brand hue itself is user-customizable.

Icons are inline SVGs (`src/lib/icons.js`, see `architecture.md`), not emoji or an icon font — the nav tabs (home, contacts, profile-as-gear), the `+` FAB, the delete/trash icon, and the confirmed-contact checkmark are all drawn from the same small module, sized via `font-size` on their container (each `.icon` is `1em` square) so they scale consistently with whatever text they sit next to. The one deliberate exception is the panic button itself, which shows the bold wordmark "SOS" rather than an icon — see below for why that one element gets different treatment.

## Screen by screen

### Login / Register (`views/login.js`, `views/register.js`)

Plain forms (`Api.login`/`Api.register`, see `api.md`), styled as a centered card with the app's real icon image (`assets/brand-mark.png`, rendered at 72×72 with rounded corners and a drop shadow) and the app name at the top. Feedback on failure is a `shake` animation on the whole form (a short horizontal oscillation, `@keyframes shake` in `styles.css`) plus a toast with the API's actual error message (`ApiError.message`, itself derived from the backend's `detail` field — see `api.md`) rather than a generic "something went wrong" that would hide, for example, the deliberately generic "Incorrect email or password" the backend uses to avoid user enumeration, or the specific "Please confirm your email before logging in" an unconfirmed account gets back (see `docs/backend/routers.md`, `POST /auth/login`).

Register additionally checks password-confirmation match client-side before ever calling the API. On success, it does **not** attempt to log the new account in — the backend refuses to issue a session token until the account is confirmed (see `docs/backend/routers.md`), so trying would just trade a clear signup success for a confusing failure. Instead, the same container swaps to a "check your email" state:

```
register form → Api.register() succeeds → confirm-email screen (same view, same container)
```

The confirm-email screen shows a circular mail icon, the address the confirmation link was sent to, and a "Back to Log In" button — it's rendered by `renderRegister`'s own submit handler directly into the container the form was just occupying, not a separate route: there's nothing meaningful to navigate back *to* on this screen (the account already exists), and keeping it inside `register.js` means the "what happens right after successful signup" logic lives in one place instead of being split across a view and a route table.

### Home (`views/home.js`) — the panic button

This is the screen the whole app exists for, so it gets the most deliberate interaction design:

```
idle (pulsing ring) → holding (ring fills over 1.4s) → busy (getting location, sending)
                                                       → success (checkmark draw-in) or error (shake)
                                                       → back to idle after ~2.6s
```

- **Idle state**: the button has a continuous soft pulse (`@keyframes idle-pulse`, a `box-shadow` ring expanding and fading every 2.4s) — an "always-animated" resting state, so the screen never looks static even before the user touches anything, reinforcing that this is a live, ready control and not a static icon.
- **The "SOS" wordmark, not an icon**: every other interactive element in the app uses an inline SVG from `lib/icons.js`, but the panic button's center shows bold text, "SOS," instead — matching the app's own icon image (a solid brand-color square with the same wordmark) rather than a generic emergency/alert glyph. This is the one place the design deliberately breaks its own icon-only pattern, because this button is the app's whole identity, not just another action.
- **Press-and-hold instead of a single tap**: `pointerdown` starts a 1.4-second hold tracked with `requestAnimationFrame`, drawn as a circular progress ring (an SVG `<circle>` animated via `stroke-dashoffset`, the same drawing technique the confirmation pages' checkmark icon uses — see `docs/backend/pages.md`) filling clockwise around the button. Releasing early (`pointerup`/`pointerleave`/`pointercancel`) cancels and resets the ring to empty. This is deliberate, not just decoration: the single most consequence-laden action in the whole app (notifying every confirmed emergency contact that something is wrong) shouldn't fire from an accidental tap in a pocket, and the fill animation itself is the confirmation gesture — there's no separate "are you sure?" dialog to dismiss under stress, just keep holding.
- **Busy state**: once the hold completes, the button stops pulsing on its own and switches to a faster pulse (`.panic-btn-busy`) while `status` text updates in place ("Getting your location...", then "Sending alert...") as `getCurrentCoordinates()` (`lib/geolocation.js`) and `Api.createAlert(...)` (`api.md`) run in sequence.
- **Success**: the "SOS" wordmark is swapped for a checkmark `<svg>` that draws itself in (`stroke-dashoffset` animating to `0`, ~0.4s), the button's gradient shifts toward the near-black end of the palette instead of the brand color (visually distinct from both the idle and the error state), and a toast confirms the alert went out.
- **Error**: `getCurrentCoordinates()` rejects if location access is denied or unavailable; `Api.createAlert` rejects the same way any other API call does (`ApiError`, see `api.md`) on a network or server problem. Either case shakes the button and shows the specific message (not a generic one) in both the status line and a toast, then resets back to idle.

### Contacts (`views/contacts.js`)

- **Loading**: three skeleton rows with a shimmering gradient sweep (`@keyframes shimmer`) while `Api.listContacts()` is in flight, replaced by the real rows once it resolves — never a blank screen while waiting.
- **List**: each confirmed/pending contact renders with a badge styled after the same distinction the backend enforces server-side (`GET /contacts`, see `docs/backend/routers.md`): confirmed contacts get a solid brand-color pill with a small checkmark icon and "Confirmed," pending ones a neutral outlined pill reading "Pending" — a visual reminder that adding someone doesn't put them on the alert list until they've clicked the confirmation link in their email (see `docs/backend/mail.md`). Rows fade/slide in with a small per-row delay (`animation-delay: index * 60ms`) so the list feels populated rather than snapping in all at once.
- **Adding a contact — two paths from one FAB**: tapping the floating `+` button (an inline SVG icon, not the plain text character) opens a small options sheet (`lib/sheet.js`) with "Pick from device contacts" and "Add manually." Picking from the device calls `pickDeviceContact()` (`lib/contactsPicker.js`, wrapping `@capacitor-community/contacts`' `pickContact`), which hands the OS's own native contact-picker UI a `Projection` requesting name, phones, and emails — the app never gets bulk access to the address book, only whatever single contact was tapped in that native picker. The returned name/first phone/first email pre-fill the same add-contact form used by the manual path, so either way the user reviews and can edit the data before it's actually sent to `POST /contacts`.
- **Why there's no loading state around the native picker**: opening it hands the whole screen over to a native OS activity outside the WebView's control; there's nothing meaningful to animate while it's up, and if the user cancels it, the underlying plugin call on Android simply never resolves (a known quirk of `@capacitor-community/contacts`' Android implementation — its `@ActivityCallback` only calls `call.resolve(...)` when the result code is `RESULT_OK`, doing nothing at all otherwise). The button that triggered the pick is deliberately left enabled the whole time rather than disabled-with-a-spinner, so a canceled pick never leaves the screen looking stuck.
- **Editing a contact**: tapping a row opens the same form pre-filled from that contact's current data; only fields the user actually changed are sent to `PUT /contacts/{id}` (`diffFields`, mirroring the backend's own partial-update convention on `PUT /users/me`/`PUT /contacts/{id}`, see `docs/backend/routers.md`).
- **Deleting a contact**: the edit sheet — the same one editing opens — has a "Delete Contact" button below "Save Changes," styled as a bordered, brand-dark-red outline button (distinct from every other button's brand-pink treatment, signaling "this one is destructive" on sight) with a trash icon. Tapping it asks for a native `confirm()` before calling `Api.deleteContact(id)`; on success, the sheet closes and the list reloads. Delete deliberately lives inside the edit sheet rather than as a swipe gesture or a second icon directly on each row: it keeps the list itself uncluttered and every row a single, unambiguous tap target ("tap to edit"), and reaching delete always takes the same two taps (open the sheet, then delete) regardless of which contact — no separate gesture to discover.
- **Feedback**: every successful add/edit/delete closes the sheet (slide-down) and shows a toast — the add-contact toast specifically mentions a confirmation email was sent when an email was provided, since that's the detail most likely to matter to whoever just added someone (see `docs/backend/mail.md`'s confirmation flow).
- **Telegram, alongside email**: a linked contact gets a small blue Telegram badge next to the confirmed/pending pill in the list (`badge-telegram`, deliberately using Telegram's own brand blue rather than the app's red — a third-party mark, not the app's own identity). The edit sheet has a "Connect Telegram"/"Disconnect Telegram" button (`Api.enableContactTelegram`/`disableContactTelegram`, see `api.md`, `docs/backend/telegram.md`): connecting either emails the contact a `t.me` deep link (when they have an email on file) or hands the link back in the response, which the app copies to the clipboard and tells the user to share manually (when they don't) — the only case a contact without an email can still be reached at all.

### Profile (`views/profile.js`)

A single form pre-filled from `GET /users/me`, submitting only changed fields to `PUT /users/me` — same partial-update pattern as contacts. The password field is always shown blank with a "leave blank to keep current password" placeholder and is only included in the request if the user actually typed something, matching the backend's `exclude_none` semantics on `UserUpdate` (see `docs/backend/types.md`). The avatar circle (the user's initial) and the "Log Out" button both use the shared palette — the avatar in solid brand color, "Log Out" as an outline button. Logging out clears the stored token (`lib/session.js`) and returns to `#/login`.

Below the form, two more settings live outside the `PUT /users/me` form entirely, since neither is account data — both are purely local, device-side preferences:

- **Language**: an EN/ES segmented control (`getLanguage`/`changeLanguage` from `ctx`, see `lib/i18n.js`). Switching re-renders the nav labels and the current screen immediately, without a page reload.
- **App color**: a row of preset swatches plus a native `<input type="color">` for anything else (`getAccentColor`/`setAccentColor`, see `lib/theme.js` and `architecture.md`). Picking one recomputes the app's whole `--primary-*` scale live, on every screen — this is a device-local preference, not something sent to the backend, so two people sharing the same account on different phones can each pick their own color.

## Shared feedback primitives (`lib/toast.js`, `lib/sheet.js`, `lib/dom.js`)

- **Toasts** (`showToast(message, type)`): a floating pill sliding up from the bottom, auto-dismissing after ~3.4s. `type` picks the color — `error` uses the brand color, everything else (neutral and success) uses a near-black treatment — deliberately never green, keeping every piece of UI feedback inside the same palette the rest of the product uses, rather than introducing a color that appears nowhere else in the app or the emails.
- **Bottom sheets** (`openSheet(bodyElement)`): a backdrop fade-in plus a panel that slides up from the bottom edge (`cubic-bezier` easing for a slight overshoot-free deceleration), closing either via an explicit action or a tap on the backdrop.
- **`dom.js`**: `escapeHtml` (used anywhere a contact's or user's name is interpolated into a template string, the same defensive habit `mail.py`'s Jinja `autoescape` follows server-side — see `docs/backend/mail.md`), plus `setLoading`/`shake` shared by every form's submit button across every screen.
