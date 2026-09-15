# SOS video setup: TikTok first, Google Drive later

The SOS alert and live GPS notification are sent before video recording starts. The Android app records a camera clip for up to `VIDEO_RECORD_SECONDS` (300 seconds by default), saves the clip in the backend's `data/videos/` directory, and offers a separate, user-confirmed **Post to TikTok** action. TikTok does not depend on Google Drive. When a connected Google account exists, Drive upload begins only **after** TikTok accepts the post request; users can also choose **Share through Drive** later. The alert view shows a Drive watch link when that optional public upload finishes.

Camera recording runs in the foreground WebView. If the user backgrounds or locks the app, the current clip stops and the captured portion is saved. Live GPS sharing still has its existing 60-minute duration. If the connected TikTok account reports a shorter maximum video duration, the app records for that shorter duration.

## 1. Apply the MariaDB migration

The file [2026-09-alert-videos.sql](../queries/migrations/2026-09-alert-videos.sql) creates `social_connections` for encrypted user OAuth tokens and `alert_videos` for video storage and provider status. Existing tables and rows are unchanged. Apply it once to the database that the backend's `DATABASE` variable names.

From the repository root, replace the uppercase placeholders:

```bash
sudo docker ps --format '{{.Names}}'
sudo docker cp backend/queries/migrations/2026-09-alert-videos.sql YOUR_MARIADB_CONTAINER:/tmp/2026-09-alert-videos.sql
sudo docker exec -it YOUR_MARIADB_CONTAINER mariadb --abort-source-on-error -u root -p YOUR_DATABASE
```

Enter the database password at the prompt. Then run these lines **inside the MariaDB client**:

```sql
source /tmp/2026-09-alert-videos.sql
SHOW TABLES LIKE 'social_connections';
SHOW TABLES LIKE 'alert_videos';
DESCRIBE alert_videos;
```

If the container uses `mysql` rather than `mariadb` as its client name, substitute `mysql` in the third shell command. The migration has not been run by the code changes alone.

If you applied an earlier copy of the migration and `DESCRIBE alert_videos` does not list `drive_started_at`, apply the follow-up migration. It only adds the nullable Drive retry timestamp and is safe to run again:

```bash
sudo docker cp backend/queries/migrations/2026-09-alert-videos-followup.sql YOUR_MARIADB_CONTAINER:/tmp/2026-09-alert-videos-followup.sql
sudo docker exec -it YOUR_MARIADB_CONTAINER mariadb --abort-source-on-error -u root -p YOUR_DATABASE
```

Inside MariaDB:

```sql
source /tmp/2026-09-alert-videos-followup.sql
SHOW COLUMNS FROM alert_videos LIKE 'drive_started_at';
```

## 2. Set backend environment variables

The backend reads `backend/.env`; [`.envexample`](../.envexample) lists every new variable. Keep all client secrets in this server file, not in the phone app or repository. Create a separate `SOCIAL_TOKEN_KEY` for each deployed environment and keep it stable so existing users' encrypted connections remain readable:

```bash
cd backend
uv sync
uv run python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Copy that output into `SOCIAL_TOKEN_KEY`. Set `VIDEO_RECORD_SECONDS=300` for the five-minute default; the supported range is 15–300 seconds. `API_BASE_URL` must be the public HTTPS origin of the backend for the OAuth callbacks and TikTok video pull URL.

For TikTok first, set `TIKTOK_CLIENT_KEY` and `TIKTOK_CLIENT_SECRET`. Leave `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` blank until you are ready to enable Drive. The app's `/integrations` endpoint marks each provider unavailable until its required values are set.

The upload cap is 100 MB per SOS clip. The server keeps the clip for TikTok retries and a later Drive upload until the Panic Button account is deleted. Ensure the backend's `data/videos/` directory has enough persistent disk space and is writable by the API process. The directory is gitignored. Installing `ffprobe` on the backend host enables independent duration checks; without it, the backend uses the duration measured by the phone.

## 3. Configure the TikTok developer app

1. Register Panic Button in [TikTok for Developers](https://developers.tiktok.com/docs/en/login-kit-web) and obtain its client key and secret.
2. Add **Login Kit** and register exactly `https://YOUR_API_DOMAIN/integrations/tiktok/callback` as an HTTPS web redirect URI.
3. Add **Content Posting API**, enable **Direct Post**, and request approval for `video.publish`. The user then grants `user.info.basic,video.publish` when connecting TikTok in their profile.
4. Verify ownership of the URL prefix `https://YOUR_API_DOMAIN/videos/tiktok/` in the TikTok developer portal. TikTok's [content sharing guidelines](https://developers.tiktok.com/docs/en/content-sharing-guidelines) say server-hosted videos should use `PULL_FROM_URL`; this backend supplies a signed, 24-hour video URL under that prefix. The URL has no Panic Button session cookie requirement so TikTok can fetch it.
5. Test with an eligible private TikTok account. TikTok says an **unaudited** Direct Post client is limited to private accounts, `SELF_ONLY` visibility, and up to five posting users in 24 hours. Submit the app for audit before expecting ordinary public-account posting. TikTok also enforces creator-specific duration and posting caps. [Direct Post prerequisites](https://developers.tiktok.com/docs/en/content-posting-api-get-started), [sharing guidelines](https://developers.tiktok.com/docs/en/content-sharing-guidelines).

The publish screen queries TikTok for current account and privacy options, previews the recording, lets the user set a caption, interactions and commercial-content disclosures, and requires explicit consent. TikTok processes the post asynchronously; the app polls its status.

## 4. Add Google Drive later

Create a Google Cloud project, enable the Drive API, create an **external** OAuth consent screen, and create a **web application** OAuth client. Register `https://YOUR_API_DOMAIN/integrations/google/callback` as an authorized redirect URI. The app requests the limited `drive.file` scope, uploads files into each consenting user's Drive, and grants `anyone`/`reader` access to the uploaded file so alert viewers can open its link. Some Google accounts or Workspace policies can prohibit public sharing; in that case the Drive upload is shown as failed. [Google OAuth setup](https://developers.google.com/identity/protocols/oauth2/web-server), [Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [Drive sharing](https://developers.google.com/workspace/drive/api/guides/manage-sharing).

The Google connection and public sharing need user-facing review before release: anyone who receives or forwards the Drive link can watch the recording. Disconnecting Google in Panic Button removes its stored connection tokens but does not delete already uploaded files from the user's Drive.

## Costs and deployment notes

TikTok's developer documentation describes approval, audit and usage limits but does not publish a per-post API fee. Do not assume a fee or a guarantee of free access until the developer portal confirms your app's terms. Google says **standard Drive API use has no additional API charge**; quota-related billing changes are planned later in 2026, and each user's Drive storage allowance still applies. [Google Drive limits and pricing](https://developers.google.com/workspace/drive/api/guides/limits).

The likely costs in this flow are your own backend disk, bandwidth and hosting. A five-minute clip can approach 100 MB: the phone uploads it to your backend, TikTok pulls it, and an optional Drive upload sends it again. Android users also spend mobile data unless on Wi-Fi.

After setting production `API_BASE_URL`, rebuild and sync the Android app so camera/microphone permissions and the external-browser OAuth plugin are in its APK. The backend must serve the app over HTTPS; Google OAuth cannot run inside an embedded WebView. [Google OAuth browser policy](https://developers.google.com/identity/protocols/oauth2/policies).

## Install the Android debug APK on a phone

Enable Developer options and USB debugging on the Android phone, connect it over USB, and accept the phone's debugging authorization prompt. From the repository root:

```bash
adb devices
adb install -r app/android/app/build/outputs/apk/debug/app-debug.apk
```

`adb devices` must show the phone with status `device`. If it shows `unauthorized`, unlock the phone and accept the prompt. `-r` replaces an installed debug build while keeping its app data. The current app build uses the `API_BASE_URL` from `app/.env`; this URL must reach a backend running the matching SOS-video code and migration. The camera works in the Android app's secure local WebView origin; TikTok account linking and posting additionally need the backend's public HTTPS `API_BASE_URL` and TikTok credentials.
