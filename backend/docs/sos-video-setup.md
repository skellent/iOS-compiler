# Automatic SOS video upload to Google Drive

## Resulting flow

1. The user connects Google Drive once from **Profile**. Panic Button stores the OAuth tokens encrypted in MariaDB.
2. The user holds the panic button. The alert and live location start first, so a camera or Drive failure never blocks the emergency notification.
3. The phone records for up to `VIDEO_RECORD_SECONDS` (300 seconds by default) while the app remains in the foreground.
4. When recording stops, the phone immediately sends the raw WebM or MP4 body to `POST /alerts/{id}/video`.
5. The backend opens a Google Drive resumable upload and relays the incoming bytes to it. Application code does not create a backend file or buffer the whole recording in memory.
6. Drive receives the file in the user's own account. The backend grants `anyone/reader`, stores only the Drive file ID, public URL, duration, and upload status in MariaDB, and exposes the link in the alert view.
7. After success, the phone deletes its pending IndexedDB copy. If upload fails or Drive is not connected, that copy remains on the phone and the app offers or automatically performs a retry.

The recording limit is 100 MB. Closing or backgrounding the foreground WebView stops the current capture and uploads the portion already recorded. Clearing the app's local data removes any pending clip that has not reached Drive.

## 1. Apply the database migration

For a database that already had the former video schema:

Copy the migration into the container and execute it from an interactive MariaDB session. This lets `-p` request the password from the terminal instead of competing with redirected SQL on standard input:

```bash
cd backend
sudo docker cp queries/migrations/2026-09-drive-only-video.sql mariadb:/tmp/2026-09-drive-only-video.sql
sudo docker exec -it mariadb mariadb -u root -p panic_button
```

At the MariaDB prompt:

```sql
SOURCE /tmp/2026-09-drive-only-video.sql;
SHOW WARNINGS;
DESCRIBE social_connections;
DESCRIBE alert_videos;
EXIT;
```

Then remove the copied migration:

```bash
sudo docker exec mariadb rm /tmp/2026-09-drive-only-video.sql
```

Replace `mariadb`, the database user, and `panic_button` with your container name, MariaDB user, and database name. The migration deletes incomplete legacy video rows, removes obsolete columns, keeps completed Drive links, and restricts provider connections to Google.

For a fresh database, use `queries/tables.sql`; it already contains the Drive-only schema.

## 2. Configure the backend

Generate the encryption key once:

```bash
cd backend
uv run python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Set these values in `backend/.env`:

```dotenv
API_BASE_URL=https://your-public-api-domain.example
GOOGLE_TOKEN_KEY=the-generated-fernet-key
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
VIDEO_RECORD_SECONDS=300
```

`API_BASE_URL` must be the public HTTPS backend origin. The authorized Google redirect URI must be exactly:

```text
https://your-public-api-domain.example/integrations/google/callback
```

The supported recording interval is 15–300 seconds. Changing it requires restarting the backend. Keep `.env` private; `.envexample` contains names and safe examples only.

## 3. Configure Google Cloud and Workspace

Follow [Google Drive enterprise authentication](../../docs/app/google-drive-enterprise-auth.md). The required API is Google Drive API and the OAuth scope is:

```text
https://www.googleapis.com/auth/drive.file
```

This limited scope lets Panic Button create and manage files it created; it does not grant access to unrelated Drive files. A Workspace administrator may need to trust the OAuth client and permit users to share files with `anyone with the link`. Automatic public alert links cannot work when the organization's policy forbids public link sharing.

## 4. Prevent reverse-proxy disk buffering

The FastAPI route streams without local video files, but Nginx normally buffers request bodies and can use temporary disk. Put the upload route before the general proxy location:

```nginx
location ~ ^/alerts/[0-9]+/video$ {
    client_max_body_size 100m;
    proxy_request_buffering off;
    proxy_buffering off;
    proxy_read_timeout 420s;
    proxy_send_timeout 420s;
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Reload Nginx after validating its configuration. If a CDN, ingress, WAF, or another proxy sits in front of Nginx, configure it for streaming request bodies and a 100 MB/420-second limit too. Otherwise that layer may buffer or reject the recording even though this backend does not store it.

## 5. Verification

1. Restart the API and sign in to Panic Button.
2. Open Profile, connect Google Drive, complete Google consent, return to the app, and refresh connections.
3. Trigger a test SOS and allow camera and microphone.
4. Stop the recording early for the first test.
5. Confirm the app reports the Drive upload as ready, the alert view contains the public link, and the file exists in the user's Drive.
6. Confirm the backend has no `data/videos` file and MariaDB contains only metadata in `alert_videos`.

## Cost

Google's standard Drive API use has no additional per-upload fee. Google announced that usage beyond its standard daily thresholds can become billable later in 2026 when a project enables billing for increased quota. The file consumes the user's or organization's Drive quota. The operator pays for backend hosting and for bandwidth relayed through the server; a five-minute video can approach 100 MB inbound plus roughly 100 MB outbound. Google Workspace licensing, extra Drive storage, network egress, and proxy/CDN plans can add cost depending on the deployment.
