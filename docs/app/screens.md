# Screens, routing, and animated feedback

See `architecture.md` for the overall project layout; this document covers how `src/main.js` wires the five screens together and the reasoning behind the app's visual/interaction design — deliberately matching the tone of the confirmation/alert emails and the `GET /contacts/confirm/{token}` result page (see `docs/backend/mail.md`, `pages.md`) rather than inventing a second, unrelated look for the same product.

## Routing: a hash router in `main.js`, not a router module

```js
const ROUTES = {
  login:    { render: renderLogin,    title: "Log In",             public: true },
  register: { render: renderRegister, title: "Create Account",     public: true },
  home:     { render: renderHome,     title: "PanicSwitch",        public: false },
  contacts: { render: renderContacts, title: "Emergency Contacts", public: false },
  profile:  { render: renderProfile,  title: "My Profile",         public: false },
};
```

`main.js` listens to `window.location.hash` and swaps the contents of `#view` accordingly — no History API, no separate router library. Each entry's `render(container, ctx)` function is called fresh on every navigation; `ctx` (`{ navigate, logout, getUser, refreshUser }`) is passed down instead of having view modules import from `main.js` directly, which would create a circular import (`main.js` imports the views to register their routes, and the views would import back from `main.js` for navigation). Passing a small context object down is plain dependency injection, and it keeps every view module a leaf: they depend on `lib/*.js`, never on each other or on `main.js`.

`public: true/false` on each route drives two guards that run on every hash change: a logged-in user is bounced away from `#/login`/`#/register` back to `#/home`, and an anonymous visitor is bounced from any protected route back to `#/login`. `App boot` (`boot()` in `main.js`) reads the stored token (`lib/session.js`, backed by `@capacitor/preferences`) once at startup and calls `GET /users/me` to confirm it still works before deciding which screen to land on — a token that's expired or been revoked clears itself out and the user lands on `#/login` instead of a broken protected screen.

## Design language shared with the emails

`www/css/styles.css` reuses the exact palette from `backend/templates/mail/*.j2` and `templates/web/confirmation_result.html.j2` (see `docs/backend/mail.md`'s color table): `--red-600: #dc2626` for primary actions, `--red-800/900` for headers and stronger accents, `--red-50` for tinted backgrounds, neutral grays for body text and surfaces. The app bar (`#app-bar`) uses the same solid dark red as the emails' header band; the panic button borrows the same radial-red treatment; the confirmed-contact badge and the emails' call-to-action button share the same red. No logo exists yet on either side (see `mail.md`), so both lean on this palette plus the 🆘 glyph as the only "mark" — a real logo, when it exists, only needs to slot into the app bar and the emails' header cell, not a redesign of either.

## Screen by screen

### Login / Register (`views/login.js`, `views/register.js`)

Plain forms (`Api.login`/`Api.register`, see `api.md`), styled as a centered card with the 🆘 mark and app name at the top. Feedback on failure is a `shake` animation on the whole form (a short horizontal oscillation, `@keyframes shake` in `styles.css`) plus a toast with the API's actual error message (`ApiError.message`, itself derived from the backend's `detail` field — see `api.md`) rather than a generic "something went wrong" that would hide, for example, the deliberately generic "Incorrect email or password" the backend already uses to avoid user enumeration (see `docs/backend/routers.md`, `POST /auth/login`). Register additionally checks password-confirmation match client-side before ever calling the API, and — on success — logs the new account in immediately (`Api.register` then `Api.login`) so a new user lands straight on the panic button instead of being asked to log in a second time right after registering.

### Home (`views/home.js`) — the panic button

This is the screen the whole app exists for, so it gets the most deliberate interaction design:

```
idle (pulsing ring) → holding (ring fills over 1.4s) → busy (getting location, sending)
                                                       → success (checkmark draw-in) or error (shake)
                                                       → back to idle after ~2.6s
```

- **Idle state**: the button has a continuous soft pulse (`@keyframes idle-pulse`, a `box-shadow` ring expanding and fading every 2.4s) — an "always-animated" resting state, so the screen never looks static even before the user touches anything, reinforcing that this is a live, ready control and not a static icon.
- **Press-and-hold instead of a single tap**: `pointerdown` starts a 1.4-second hold tracked with `requestAnimationFrame`, drawn as a circular progress ring (an SVG `<circle>` animated via `stroke-dashoffset`, the same drawing technique `confirmation_result.html.j2`'s checkmark icon uses — see `docs/backend/pages.md`) filling clockwise around the button. Releasing early (`pointerup`/`pointerleave`/`pointercancel`) cancels and resets the ring to empty. This is deliberate, not just decoration: the single most consequence-laden action in the whole app (notifying every confirmed emergency contact that something is wrong) shouldn't fire from an accidental tap in a pocket, and the fill animation itself is the confirmation gesture — there's no separate "are you sure?" dialog to dismiss under stress, just keep holding.
- **Busy state**: once the hold completes, the button stops pulsing on its own and switches to a faster pulse (`.panic-btn-busy`) while `status` text updates in place ("Getting your location...", then "Sending alert...") as `getCurrentCoordinates()` (`lib/geolocation.js`) and `Api.createAlert(...)` (`api.md`) run in sequence.
- **Success**: the 🆘 icon is swapped for a checkmark `<svg>` that draws itself in (`stroke-dashoffset` animating to `0`, ~0.4s), the button's gradient shifts toward the near-black end of the palette instead of pure red (visually distinct from both the idle and the error state), and a toast confirms the alert went out. Both the button and a toast report success — the toast because it's the only feedback that persists briefly after the button resets back to idle a couple of seconds later.
- **Error**: `getCurrentCoordinates()` rejects if location access is denied or unavailable; `Api.createAlert` rejects the same way any other API call does (`ApiError`, see `api.md`) on a network or server problem. Either case shakes the button and shows the specific message (not a generic one) in both the status line and a toast, then resets back to idle — nothing about the failure is silently swallowed, unlike the backend's own known gap around background email failures (see `TASK.md`'s "Correo / Confirmación de Contactos" section) — here, the person holding the phone is right there to see it happen.

### Contacts (`views/contacts.js`)

- **Loading**: three skeleton rows with a shimmering gradient sweep (`@keyframes shimmer`) while `Api.listContacts()` is in flight, replaced by the real rows once it resolves — never a blank screen while waiting.
- **List**: each confirmed/pending contact renders with a `confirmed` badge styled after the same distinction the backend enforces server-side (`GET /contacts`, see `docs/backend/routers.md`): confirmed contacts get a solid red pill ("✓ Confirmed"), pending ones a neutral outlined pill ("Pending") — a visual reminder that adding someone doesn't put them on the alert list until they've clicked the confirmation link in their email (see `docs/backend/mail.md`). Rows fade/slide in with a small per-row delay (`animation-delay: index * 60ms`) so the list feels populated rather than snapping in all at once.
- **Adding a contact — two paths from one FAB**: tapping the floating `+` button opens a small options sheet (`lib/sheet.js`) with "Pick from device contacts" and "Add manually." Picking from the device calls `pickDeviceContact()` (`lib/contactsPicker.js`, wrapping `@capacitor-community/contacts`' `pickContact`), which hands the OS's own native contact-picker UI a `Projection` requesting name, phones, and emails — the app never gets bulk access to the address book, only whatever single contact was tapped in that native picker. The returned name/first phone/first email pre-fill the same add-contact form used by the manual path, so either way the user reviews and can edit the data before it's actually sent to `POST /contacts`.
- **Why there's no loading state around the native picker**: opening it hands the whole screen over to a native OS activity outside the WebView's control; there's nothing meaningful to animate while it's up, and if the user cancels it, the underlying plugin call on Android simply never resolves (a known quirk of `@capacitor-community/contacts`' Android implementation, confirmed by reading its `ContactsPlugin.java` — the `@ActivityCallback` only calls `call.resolve(...)` when the result code is `RESULT_OK`, doing nothing at all otherwise). The button that triggered the pick is deliberately left enabled the whole time rather than disabled-with-a-spinner, so a canceled pick never leaves the screen looking stuck — nothing was disabled to begin with.
- **Editing a contact**: tapping a row opens the same form pre-filled from that contact's current data; only fields the user actually changed are sent to `PUT /contacts/{id}` (`diffFields`, mirroring the backend's own partial-update convention on `PUT /users/me`/`PUT /contacts/{id}`, see `docs/backend/routers.md`).
- **Feedback**: every successful add/edit closes the sheet (slide-down) and shows a toast — the add-contact toast specifically mentions a confirmation email was sent when an email was provided, since that's the detail most likely to matter to whoever just added someone (see `docs/backend/mail.md`'s confirmation flow).

### Profile (`views/profile.js`)

A single form pre-filled from `GET /users/me`, submitting only changed fields to `PUT /users/me` — same partial-update pattern as contacts. The password field is always shown blank with a "leave blank to keep current password" placeholder and is only included in the request if the user actually typed something, matching the backend's `exclude_none` semantics on `UserUpdate` (see `docs/backend/types.md`). Logging out clears the stored token (`lib/session.js`) and returns to `#/login`.

## Shared feedback primitives (`lib/toast.js`, `lib/sheet.js`, `lib/dom.js`)

- **Toasts** (`showToast(message, type)`): a floating pill sliding up from the bottom, auto-dismissing after ~3.4s. `type` picks the color — `error` (red) or the default dark treatment used for both neutral and success messages — deliberately never green, keeping every piece of UI feedback inside the same red/near-black palette the rest of the product uses, rather than introducing a color that appears nowhere else in the app or the emails.
- **Bottom sheets** (`openSheet(bodyElement)`): a backdrop fade-in plus a panel that slides up from the bottom edge (`cubic-bezier` easing for a slight overshoot-free deceleration), closing either via an explicit action or a tap on the backdrop.
- **`dom.js`**: `escapeHtml` (used anywhere a contact's or user's name is interpolated into a template string, the same defensive habit `mail.py`'s Jinja `autoescape` follows server-side — see `docs/backend/mail.md`), plus `setLoading`/`shake` shared by every form's submit button across all five screens.
