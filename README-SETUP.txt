VISION HUB — DEPLOYMENT & INTEGRATION GUIDE
===============================================

WHAT IS IN THIS REPOSITORY
--------------------------
Vision Hub is a static frontend served by Cloudflare Pages, with Supabase Auth,
Postgres, Row Level Security and private Supabase Storage. Cloudflare Pages
Functions provide server-side endpoints for staff management and secure media
signing. When the R2 environment variables are configured, direct video uploads
can use Cloudflare R2.

The site must only publish media, trailers, music and artwork that you own or
are authorised to distribute.

DEPLOYMENT
----------
1. Connect this repository to the Cloudflare Pages project.
2. Framework preset: None.
3. Build command: leave blank.
4. Build output directory: / (repository root).
5. Keep the Functions directory at the repository root. Cloudflare Pages
   automatically deploys functions under /functions as /api/* endpoints.
6. Deploy the main branch. A new GitHub commit should trigger a Pages build if
   the GitHub integration is enabled.

SUPABASE CONFIGURATION
----------------------
The browser uses the publishable/anon key in js/supabase-config.js. That key is
intended to be public. NEVER put a Supabase service-role key in JavaScript,
HTML, GitHub source, or any browser-visible environment variable.

In Cloudflare Pages > Settings > Variables and Secrets, add these server-side
variables (mark secrets as encrypted):

  SUPABASE_URL
  SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY

SUPABASE_SERVICE_ROLE_KEY is highly privileged. Limit access to the Cloudflare
project and rotate it immediately if it is exposed.

For Supabase Auth:
- Enable Email provider.
- Configure the site's production URL and password-reset redirect URL in
  Authentication > URL Configuration.
- Set the desired email-confirmation policy and configure SMTP if reliable
  production email delivery is needed.
- Keep the owner account's profiles.role equal to admin.

DATABASE MIGRATIONS
-------------------
Run SQL in Supabase Dashboard > SQL Editor, in this general order. Do not
recreate an existing production database or overwrite the existing catalog.
The scripts marked additive are intended to upgrade existing tables.

Initial project setup (only if not already applied):
  supabase/vision-hub-master-setup.sql

Existing catalog / media metadata:
  supabase/vision-hub-movie-details-phase1.sql
  supabase/vision-hub-media-assets-extension.sql
  supabase/vision-hub-resolution-constraint-fix.sql

Existing account and request features:
  supabase/vision-hub-request-workflow-upgrade.sql
  supabase/vision-hub-user-watchlist.sql
  supabase/vision-hub-watch-progress.sql

Storage and final platform upgrade:
  supabase/vision-hub-storage-manager.sql
  supabase/add-cloud-storage-providers.sql
  supabase/vision-hub-platform-upgrade.sql

The latest platform upgrade is additive and creates the private
vh-private-media bucket required by the direct-upload code. It also adds the
staff roles, Cloudflare R2 provider, subtitle metadata and staff RLS policies.
After applying it, confirm that the private vh-private-media bucket exists and
that its Public setting is OFF.

CLOUDFLARE R2 DIRECT UPLOAD
---------------------------
Create an R2 bucket in Cloudflare and an R2 API token scoped to that bucket.
Add these encrypted Pages environment variables:

  R2_ACCOUNT_ID
  R2_BUCKET_NAME
  R2_ACCESS_KEY_ID
  R2_SECRET_ACCESS_KEY

Configure the R2 bucket CORS policy to allow your exact Pages origin, for
example https://vision-hub-bat.pages.dev, and methods GET, HEAD and PUT.
Allow the Content-Type request header. Add any separate production custom
domain you actually use; do not use a wildcard origin in production.

The current R2 upload endpoint uses a short-lived signed single PUT request and
accepts video files up to 5 GB. Multipart uploads for larger objects are not
implemented yet. The browser uploads directly to R2; file bytes do not pass
through the Pages Function. Signed playback URLs are short-lived and are issued
only after the server verifies that the media asset belongs to published
content.

For private Supabase uploads, the platform upgrade must first create the
vh-private-media bucket. The bucket must remain private.

WHAT IS CONNECTED AND WHAT STILL NEEDS PROVIDER SETUP
-----------------------------------------------------
Connected in source:
- Supabase email/password sign-in, sign-up, password reset request and logout.
- User profile name and password management.
- Cross-device watchlist and saved playback progress (after their SQL migrations).
- Movie/series/short publishing and edit metadata.
- Private Supabase Storage upload and secure signed playback.
- Cloudflare R2 signed upload and playback routes (after R2 secrets and CORS).
- Staff account creation/revocation through the server-side Supabase Auth Admin API.
- Role-specific admin tabs and database permissions.
- Video quality selection, playback speed and WebVTT subtitle track controls.

Not an API integration yet:
- TeraBox, MEGA, Degoo, Google Drive, MediaFire and the other listed providers
  can be selected for metadata or used as authorised external links. Their
  direct account upload APIs are not connected by this code.
- Google Drive OAuth/Picker import is not connected yet; it needs a Google
  Cloud OAuth client, consent configuration and a server-side connector.
- R2 multipart/resumable upload for files larger than 5 GB is not connected.

SECURITY NOTES
--------------
- Never paste or commit service-role keys, R2 secrets, provider passwords or
  OAuth client secrets into repository files or chat.
- Keep all server secrets in Cloudflare Pages encrypted environment variables.
- Give staff the least privilege: sub_admin, content_editor or moderator.
- Only the root admin should create staff accounts or change owner permissions.
- Keep media buckets private unless you deliberately choose to publish a
  separate public image bucket.
- Use valid HTTPS media URLs. Subtitle tracks must be WebVTT (.vtt) files and
  the subtitle host must permit browser cross-origin requests.
- Browser-side localStorage is only a guest/device convenience; it is not a
  secure account database or a replacement for Supabase RLS.

FINAL VERIFICATION
------------------
After all database migrations, Cloudflare variables, R2 CORS rules, email
settings and the production deployment are complete, run the full final
end-to-end test pass. Verify guest browsing, sign-up and sign-in, profile
updates, role separation, movie create/edit/delete, request submission and
moderation, cross-device watchlist/progress, Supabase/R2 upload and playback,
subtitle tracks, speed changes, responsive layout, SEO and security policies.
Do this final test pass only after the remaining integrations are configured.
