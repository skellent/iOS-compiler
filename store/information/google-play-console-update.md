# Google Play Console update for live location

> Prepared on 2026-09-11 from the behavior in this repository. Google Play Console
> labels can change. Review the final answers against the production providers and
> every active app bundle before submitting.

## Release blockers inside the app

### Prominent location disclosure

The current app requests location as part of the SOS flow but does not first display a
dedicated prominent-disclosure dialog. Updating the privacy-policy URL and Play Console
answers does not replace this in-app requirement.

Before publishing the live-location bundle, the app must display the text in:

- `prominent-location-disclosure-en.txt`
- `prominent-location-disclosure-es.txt`

The dialog must appear in the normal SOS flow **before** Android's location runtime
permission. After the disclosure, the user can continue to the Android permission or
cancel the alert. The disclosure must not be hidden only in Help, Terms or the privacy
policy.

Google's guidance requires the disclosure to name location, explain that use continues
in the background or when the app is not in use, and identify the feature that needs
it. The current text also discloses the 60-minute limit, storage and sharing.

### Privacy-policy link inside the app

The Capacitor About screen links to both `/privacy` and `/terms`, opening the production
pages in the system browser. Google requires the privacy policy on the store listing
**and inside the app**. Keep these links and the public pages available in every release.

## 1. Deploy the public policy first

Deploy these backend changes so the public, non-editable HTML page at the production
URL reflects live tracking:

```text
https://YOUR-PRODUCTION-DOMAIN/privacy
https://YOUR-PRODUCTION-DOMAIN/terms
```

Confirm that this URL loads without login and displays **Last updated: September 11,
2026**. Do not give Google a local, development, PDF, Google Doc or editable URL.

Repository sources:

- `backend/templates/web/privacy.html.j2` — public English/Spanish policy
- `backend/main.py` — displayed revision date and publisher identity
- `store/information/privacy-policy.md` — Spanish legal-review source

The data controller on the page is `Keycodelogics`. It must exactly match the developer
or company identity shown in the Play listing. Confirm that the production contact
email and `https://keycodelogics.com/` are correct before submission.

## 2. Replace the old store listing

In Play Console, open:

```text
Store presence > Main store listing
```

For the default English listing, replace the old text with:

- `google-play-short-description-en.txt`
- `google-play-full-description-en.txt`

For the Spanish localization, replace or create the translation with:

- `google-play-short-description-es.txt`
- `google-play-full-description-es.txt`

Also check every **custom store listing** and managed translation. Remove every old
sentence equivalent to:

```text
location is captured only at the moment you trigger an alert
Panic Button does not track you in the background
```

The listing must promote live emergency location as a core feature because that is the
reason for the location foreground service.

## 3. Update the privacy-policy URL

Open:

```text
Policy and programs > App content > Privacy policy
```

Replace the old URL if necessary with the production `/privacy` URL deployed in step 1.
The same policy must also remain reachable from inside the product/website.

Also enter the production `/delete-account` URL wherever Play Console asks for the
external account-deletion resource.

## 4. Update Data safety

Open:

```text
Policy and programs > App content > Data safety
```

At minimum, revise the location answers as follows:

| Console question | Answer for current implementation |
|---|---|
| Does the app collect user data? | **Yes** |
| Is data encrypted in transit? | **Yes**, for production HTTPS/WSS traffic |
| Can users request deletion? | **Yes**, in app and at the public `/delete-account` page |
| Approximate location collected? | **Yes**; Android can grant approximate location |
| Precise location collected? | **Yes**; the SOS feature requests high accuracy |
| Processed ephemerally? | **No**; accepted points are stored in MariaDB with alert history |
| Required or optional? | **Required for the core SOS/live-location feature**; location collection starts only when the user activates an alert |
| Collection purpose | **App functionality** |
| Advertising/marketing purpose | **No** |
| Sold | **No** |

For “shared,” Google excludes transfers to service providers acting only on the
developer's behalf and transfers the user deliberately initiates and reasonably expects.
The SOS action deliberately shares the map with contacts selected by the user. If every
production infrastructure/messaging/map provider contract qualifies for one of those
exceptions, the Data safety answer can be **not shared** under Google's definition even
though the privacy policy must still describe those recipients. If any provider uses
the data for its own purposes outside an applicable exception, declare it as shared.

Review the complete Data safety form as well. The existing product also handles:

| Data category | Current use to review in Console |
|---|---|
| Name, email address and phone number | Account management, app functionality and transactional developer communications |
| Contacts | A user can select a name, phone and email from the device contact picker or enter them manually; chosen contact records are stored for app functionality |
| App interactions / alert history | Alerts, routes, channel delivery records and link-view status are stored for app functionality |
| Diagnostics | Server request IDs, timestamps and errors are logged to operate, secure and debug the service |

Do not mark location as ephemeral: the backend stores the full accepted route, not only
the latest point. Do not rely only on the manifest permission list; Google defines Data
safety by actual collection and sharing behavior, including a WebView controlled by the
app.

## 5. Declare the location foreground service

The bundle declares `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_LOCATION`. Open the
foreground-service declaration under **Policy and programs > App content** and select
the **Location** service type.

Use this feature description:

```text
After the user deliberately presses and holds the SOS button, Panic Button starts a
user-visible location foreground service to collect and share the user's live emergency
route with their chosen emergency contacts. Sharing lasts until the user selects Stop
sharing or for a maximum of 60 minutes. A persistent notification tells the user that
live location sharing is active. The service supports the app's core personal-safety
feature while the app is in the background or the screen is off.
```

For “impact if deferred or interrupted,” use:

```text
If the service is deferred or interrupted, emergency contacts receive stale or missing
location updates and cannot follow the user's reported movement during the active alert.
```

Google normally requests a review video. It should show, without editing away the
transitions:

1. Opening Panic Button while signed in.
2. Triggering the prominent location disclosure in the normal SOS flow.
3. Continuing to Android's location permission.
4. Holding SOS and starting the alert.
5. The persistent foreground-service notification.
6. The app moved to the background or the screen locked.
7. A second device/browser receiving movement on the private map.
8. Returning to the app and selecting **Stop sharing**.

Host the video at the visibility level accepted by the Console and paste its URL into
the declaration.

## 6. Check Sensitive permissions / background location

The current manifest does not request `ACCESS_BACKGROUND_LOCATION`; it uses coarse/fine
location through a user-started `location` foreground service. Google can still treat
equivalent minimized/background use as subject to its background-location review.

Open:

```text
Policy and programs > App content > Sensitive permissions and APIs
```

If Play Console presents a location declaration, describe the single core feature as:

```text
User-initiated live emergency location sharing with the user's chosen emergency
contacts for up to 60 minutes after the user activates an SOS alert.
```

Never answer that location is used only while the activity is visible: the intended
feature continues through a foreground service while minimized or screen-locked.

## 7. Update App access for review

Because reviewers must sign in to reach SOS, open:

```text
Policy and programs > App content > App access
```

Provide a stable confirmed review account and exact steps to reach the SOS button. The
account needs at least one safe test contact/channel so the alert guard does not block
the reviewer. Do not store those credentials in this repository.

## 8. Check old bundles and every track

Open:

```text
Test and release > App bundle explorer
```

Then inspect Production, Open testing, Closed testing and Internal testing. Google can
evaluate permissions present in active older APKs/AABs as well as the new release.
Supersede or deactivate releases whose permissions and visible behavior contradict the
new declarations. Store listing, Data safety and privacy-policy URL are app-level
settings, so update them even if an older bundle remains available to some devices.

## 9. Upcoming contact-permission review

The current `@capacitor-community/contacts` plugin declares both `READ_CONTACTS` and
`WRITE_CONTACTS`, while Panic Button only lets the user choose one contact at a time and
does not write to the address book. Google Play's updated Contacts Permissions policy is
scheduled to take effect on **October 28, 2026** and says apps that do not need broad
access must use the Android Contact Picker.

Before that deadline, review **Policy and programs > App content > Sensitive permissions
and APIs** and plan a native/plugin change that removes unnecessary broad contact
permissions. A Data safety declaration does not by itself make unnecessary permissions
acceptable.

## 10. Policy-specific repository files to publish

| File | Destination |
|---|---|
| `backend/templates/web/privacy.html.j2` | Deploy with backend; rendered at `/privacy` |
| `backend/main.py` | Deploy with backend for the new policy date |
| `google-play-full-description-en.txt` | Default Main store listing, full description |
| `google-play-short-description-en.txt` | Default Main store listing, short description |
| `google-play-full-description-es.txt` | Spanish store listing, full description |
| `google-play-short-description-es.txt` | Spanish store listing, short description |
| `prominent-location-disclosure-en.txt` | Implement as an in-app dialog before location permission |
| `prominent-location-disclosure-es.txt` | Spanish version of the same in-app dialog |

## Official references

- [Google Play background-location requirements](https://support.google.com/googleplay/android-developer/answer/9799150)
- [Google Play permissions and sensitive APIs policy](https://support.google.com/googleplay/android-developer/answer/16558241)
- [Google Play foreground-service policy](https://support.google.com/googleplay/android-developer/answer/16559646)
- [Google Play Data safety instructions](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Prominent disclosure and consent guidance](https://support.google.com/googleplay/android-developer/answer/11150561)
