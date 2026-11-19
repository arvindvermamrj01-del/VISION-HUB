# Vision Hub — Cloudflare Pages deployment

## Build settings
- Framework preset: None
- Build command: leave blank
- Build output directory: `/` (repository root)
- Root directory: leave blank
- Production branch: choose the branch you intend to publish after review/merge.

Cloudflare Pages automatically deploys the `functions/` directory as Pages Functions.

## Required Pages secrets / variables
Add these in Cloudflare Dashboard → Workers & Pages → your Pages project → Settings → Variables and Secrets:

- `SUPABASE_URL` — same project URL used by the website.
- `SUPABASE_ANON_KEY` — Supabase publishable/anon key (not service role).
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service-role key; mark as Secret. Server-side only.
- `TELEGRAM_BOT_TOKEN` — token from BotFather; mark as Secret.
- `TELEGRAM_WEBHOOK_SECRET` — a long random secret (letters/numbers/underscore/hyphen); mark as Secret.
- `TERABOX_CLIENT_ID` — approved TeraBox Open Platform AppKey; mark as Secret/variable.
- `TERABOX_CLIENT_SECRET` — TeraBox Open Platform SecretKey; mark as Secret.
- `TERABOX_PRIVATE_SECRET` — TeraBox Open Platform signing secret; mark as Secret.
- `TERABOX_APP_FOLDER` — exact app folder path assigned by TeraBox, for example `/From: Other Applications/Vision Hub-<assigned-app-id>/`; configure as a variable.
- `PROVIDER_TOKEN_ENCRYPTION_KEY` — 32 random bytes as 64 hex characters or Base64; mark as Secret.
- `GOOGLE_CLIENT_ID` — OAuth 2.0 Client ID from Google Cloud Console.
- `GOOGLE_CLIENT_SECRET` — OAuth 2.0 Client Secret; mark as Secret.
- `GOOGLE_REDIRECT_URI` — exact deployed callback URL, e.g. `https://YOUR-DOMAIN/api/storage/google-drive/callback`.
- `GOOGLE_OAUTH_STATE_SECRET` — at least 32 random characters; mark as Secret.
- `GOOGLE_DRIVE_FOLDER_ID` — optional Drive folder ID where Vision Hub uploads should be stored.

Never put the service-role key or Telegram bot token in any browser JavaScript file or commit them to Git.

## Telegram setup
1. Run `supabase/cloudflare-telegram.sql` in the Supabase SQL Editor after reviewing it.
2. Add the variables/secrets required by the features you enable to Cloudflare Pages. Telegram needs SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET. TeraBox additionally needs TERABOX_CLIENT_ID, TERABOX_CLIENT_SECRET, TERABOX_PRIVATE_SECRET, TERABOX_APP_FOLDER and PROVIDER_TOKEN_ENCRYPTION_KEY. Google Drive additionally needs GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI and GOOGLE_OAUTH_STATE_SECRET; GOOGLE_DRIVE_FOLDER_ID is optional. Keep the service-role key and bot token marked Secret.
3. Deploy the Pages project so `/api/telegram/webhook` exists.
4. Register the webhook with Telegram's setWebhook API, using the deployed URL `https://YOUR-DOMAIN/api/telegram/webhook` and the exact TELEGRAM_WEBHOOK_SECRET as `secret_token`.
5. Open the bot in Telegram and send `/start` to opt in. Send `/stop` to opt out.

The webhook stores only Telegram chat identifiers and optional public usernames/names needed to deliver opted-in announcements. Keep the bot token and Supabase service-role key private.

## Current status
This repository has no Cloudflare account credentials, Supabase SQL execution access, or BotFather token. The code can be prepared here, but production deployment and end-to-end verification require those account-side steps.


## Private media storage migration
New direct uploads use the private Supabase Storage bucket `vh-private-media`. The player creates six-hour signed URLs for published content and tracks. The existing public `vh-media` bucket is intentionally retained for backwards compatibility with old URLs; files already in that bucket remain publicly accessible until they are migrated and re-uploaded.

Before deploying the new upload/player code to an existing Supabase project, run `supabase/private-media-migration.sql` in the Supabase SQL Editor as project owner. The full `supabase/setup.sql` also includes these objects for a fresh setup. Do not make the legacy bucket private until its existing media has been migrated and verified.


## Primary-admin-managed staff accounts
The Control Center supports three least-privilege staff roles: `sub_admin` (catalogue and requests), `content_editor` (Movie-only publishing), and `moderator` (request moderation only). Staff provisioning runs through the Cloudflare Pages Function `/api/admin/subadmins`; the Supabase service-role key is used server-side only and must never be exposed in browser code. Temporary passwords must be at least 12 characters and should be delivered securely.

For an existing Supabase database that already has the Vision Hub base schema, run `supabase/private-media-migration.sql` if it has not been run yet, then run `supabase/sub-admin-role-migration.sql` as project owner before using staff provisioning. Fresh installations should use the updated `supabase/setup.sql`. The primary `admin` role remains the only role allowed to read login activity, manage users/staff, configure site settings, or view administrative analytics.


## TeraBox Open Platform connection
The Control Center includes a primary-admin-only TeraBox device-code connection and quota check. It requires an approved TeraBox Open Platform app. Configure these Cloudflare Pages secrets: `TERABOX_CLIENT_ID`, `TERABOX_CLIENT_SECRET`, `TERABOX_PRIVATE_SECRET`, and `PROVIDER_TOKEN_ENCRYPTION_KEY` (32 random bytes, supplied as 64 hex characters or Base64). The encryption key protects stored OAuth access/refresh tokens. Never put these values in frontend JavaScript or chat.

Run `supabase/provider-connections.sql` in Supabase before connecting. The API stores encrypted tokens in a server-only table and refreshes the rotating refresh token server-side. TeraBox developer approval is separate from a normal consumer account; its device authorization flow may require the TeraBox app and VPN access according to its official integration documentation.

TeraBox now has a chunked upload client, server-side upload proxy, provider-aware catalogue records, published-content HLS endpoint and 480p/720p/1080p player selector. This code still requires an approved app, exact app-folder configuration and live account testing; cross-origin HLS segment playback must be verified. The documented streaming types stop at 1080p, so TeraBox must not be presented as a 2K/4K/8K source.


TeraBox credentials are issued only after applying for an Open Platform application. The current code supports secure device-code connection, quota display, chunked uploads and HLS player integration; live account testing is still required. The official API's documented streaming types are M3U8_AUTO_480, M3U8_AUTO_720 and M3U8_AUTO_1080, so do not promise 2K/4K/8K through this provider.


## Google Drive setup
1. In Google Cloud Console, create/select a project and enable the Google Drive API.
2. Configure the OAuth consent screen and create an OAuth 2.0 Web application client.
3. Add the exact Cloudflare callback URL as an authorized redirect URI: `https://YOUR-DOMAIN/api/storage/google-drive/callback`.
4. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI and GOOGLE_OAUTH_STATE_SECRET to Cloudflare Pages. Use a random state secret of at least 32 characters.
5. Optionally set GOOGLE_DRIVE_FOLDER_ID to a folder owned by the connected account.
6. Connect Google Drive from the Control Center as the primary Admin. The app requests the drive.file scope and stores access/refresh tokens encrypted in vh_provider_connections.
7. Google Drive uploads are made readable by anyone with the link so published videos can play in the website iframe. Only upload media that Vision Hub is authorized to distribute. Google Workspace policies may block public sharing.

Google Drive uploads use the official resumable upload API through bounded chunks. They play using Google's preview iframe; this is not an adaptive-bitrate HLS transcoder and should not be advertised as true 2K/4K/8K processing.
