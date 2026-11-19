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

Never put the service-role key or Telegram bot token in any browser JavaScript file or commit them to Git.

## Telegram setup
1. Run `supabase/cloudflare-telegram.sql` in the Supabase SQL Editor after reviewing it.
2. Add all five variables/secrets listed above to Cloudflare Pages (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET). Keep the service-role key and bot token marked Secret.
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
The Control Center supports three least-privilege staff roles: `sub_admin` (catalogue and requests), `content_editor` (catalogue publishing only), and `moderator` (request moderation only). Staff provisioning runs through the Cloudflare Pages Function `/api/admin/subadmins`; the Supabase service-role key is used server-side only and must never be exposed in browser code. Temporary passwords must be at least 12 characters and should be delivered securely.

For an existing Supabase database that already has the Vision Hub base schema, run `supabase/private-media-migration.sql` if it has not been run yet, then run `supabase/sub-admin-role-migration.sql` as project owner before using staff provisioning. Fresh installations should use the updated `supabase/setup.sql`. The primary `admin` role remains the only role allowed to read login activity, manage users/staff, configure site settings, or view administrative analytics.
