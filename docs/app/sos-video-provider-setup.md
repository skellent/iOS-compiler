# Google Drive requirements for SOS video

Panic Button uses Google Drive as the only external destination for SOS recordings. After an alert, the phone records up to five minutes and automatically uploads the completed clip. The backend relays the body directly into the user's Drive and stores only metadata; it does not retain a local video file.

## Accounts and infrastructure

- A Google Cloud project owned by the person or organization responsible for Panic Button.
- Google Drive API enabled in that project.
- An OAuth consent screen configured for the intended audience.
- An OAuth 2.0 **Web application** client, because the callback is handled by the public backend.
- A public HTTPS backend domain with the exact redirect URI `https://YOUR_DOMAIN/integrations/google/callback`.
- A valid Fernet key in `GOOGLE_TOKEN_KEY` for encrypting access and refresh tokens in MariaDB.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `VIDEO_RECORD_SECONDS=300` in `backend/.env`.
- A reverse proxy and any upstream CDN configured to stream a body of up to 100 MB without temporary disk buffering.

Use only the `https://www.googleapis.com/auth/drive.file` scope. Each user connects their own Google account from Profile. Panic Button can then manage files it created in that account but cannot browse unrelated Drive content.

## Google Workspace enterprise accounts

For an internal company deployment, set the OAuth audience to **Internal** when the Cloud project belongs to the same Workspace organization. Users from outside that organization cannot authorize an internal app.

If the app serves users outside the Workspace organization, use **External**. While the consent screen is in Testing, add test users and expect test-user and token-lifetime restrictions. Production use can require Google verification depending on the scopes, branding, and audience.

The Workspace administrator should review **Admin console → Security → Access and data control → API controls** and trust or allow the OAuth client if third-party app restrictions block it. The administrator must also allow link sharing outside the organization. Panic Button creates an `anyone with the link` reader permission so emergency contacts can watch without signing into the owner's Google account. If that sharing policy is forbidden, the upload can reach Drive but public alert sharing will fail.

Detailed console steps and enterprise options are in [Google Drive enterprise authentication](google-drive-enterprise-auth.md). Backend migration, Nginx configuration, verification, and costs are in [the operational setup guide](../../backend/docs/sos-video-setup.md).

## Data and failure behavior

- Alert delivery and live GPS begin before recording and do not depend on Drive.
- A successful video is deleted from the phone's pending IndexedDB storage after Drive confirms it.
- A failed video remains pending only on that phone for retry. Clearing app data loses that pending video.
- Drive owns the final file and applies the account's storage quota and retention rules.
- Disconnecting Drive removes the stored Panic Button authorization; it does not delete files already in Drive.
- Deleting the Panic Button account removes database metadata and OAuth tokens; Drive files remain under the user's control.

## Costs

Standard Drive API use has no additional per-upload fee. Google announced that usage beyond its standard daily thresholds can become billable later in 2026 when a project enables billing for increased quota. Costs can also come from Google Workspace licenses or extra Drive capacity, the Panic Button server, inbound/outbound traffic, logs, backups of database metadata, and a CDN or reverse proxy plan. The backend relays every upload, so a 100 MB recording produces about 100 MB inbound and 100 MB outbound traffic even though it consumes no backend video storage.
