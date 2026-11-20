# VISION HUB — Master feature matrix

This is the working completion ledger. “Implemented” means code/schema is present; it does not mean a live provider credential, database migration or final browser test has already succeeded.

| Area | Current state | Remaining dependency / final check |
|---|---|---|
| Movies catalogue | Existing; extended with year/language/genre/sort filters | Final catalog and filter tests |
| TV Shows / Web Series | Existing; renamed in navigation | Final detail/player tests |
| Seasons & Episodes | Episode admin form, series grouping, episode playback and cleanup implemented | Run feature SQL bundle; final upload/play/delete tests |
| Last Entries | Sorts by real created_at timestamps | Final newest-first check |
| Popular Content | Existing 30-day detail-view RPC and homepage rail; counts and Most viewed sort surfaced | Run feature SQL bundle; confirm event data |
| Genres | Existing; series genre filters retained | Final filter tests |
| Search | Existing | Final cross-catalog search tests |
| Player | Existing private-media player, quality selection, subtitle metadata and watch progress | Final B2/R2/Supabase playback and mobile tests |
| Downloads | Real video assets only; signed attachment downloads for B2/R2/Supabase | Final download test per provider |
| Shorts | Existing upload and catalog; B2 selector support retained | Final short upload/play/delete test |
| Watchlist / Profile | Existing auth, watchlist, password and progress features | Final account/RLS tests |
| User requests | Existing request workflow; authenticated request Telegram alert added | Final guest and signed-in request tests |
| Admin / Staff | Existing dashboard, content, storage, users, roles, requests, reports and settings; episode and community tabs added | Final role-permission tests |
| Backblaze B2 | Upload, signed playback and deletion code; default selector and SQL constraints updated | Run feature SQL bundle; confirm Cloudflare B2 secrets/CORS |
| Cloudflare R2 | Existing S3-compatible upload/access/delete path retained | Confirm R2 secrets if using R2 |
| Supabase Storage | Retained for auth/database and legacy private media | Final legacy asset tests |
| Other storage choices | URL/link-based until an official server connector is configured | Provider-specific API/OAuth approval and credentials |
| Google Drive Import | Existing API-key-based public shared-video import | Set restricted GOOGLE_DRIVE_API_KEY; final public-file test |
| HyperOS / ColorOS themes | Four persistent themes: HyperOS Aurora, ColorOS Ocean, AMOLED Black, Light Glass | Final desktop/mobile visual check |
| Donations | UPI intent, optional QR, UTR submission, user history, admin manual verification | Run SQL bundle; configure public UPI ID and QR URL |
| AdSense placements | Configurable homepage/footer units; ads.txt route | AdSense approval, publisher ID, slot IDs and Cloudflare publisher variable |
| AdSense earnings | Server-side OAuth report endpoint; 7/30 days and current/previous month | OAuth client, read-only refresh token and account resource |
| Telegram bot | Webhook, commands, request alerts, publish announcements and admin setup control | Bot token, webhook secret, admin chat ID; channel chat ID for announcements |
| Community | Suggestions/bugs/complaints, moderated public roadmap and one-vote-per-user RPC | Run SQL bundle; final RLS and voting tests |
| Legal / Compliance | Privacy, Terms and Copyright information pages added | Site owner must review the notices and publish a designated legal contact; configure a certified CMP where required |
| SEO / Performance | Metadata, WebSite JSON-LD, robots, sitemap, CDN preconnect and lazy poster images | Final Lighthouse/performance and crawl checks |
| Security | Server-side provider secrets, role-checked APIs, RLS, signed private media, signed HttpOnly staff session cookie, IP-based Admin lockout and guest/login activity in Cloudflare D1 | Final deploy and live negative/positive authorization, cookie expiry and lockout tests |

## Main-admin security and login activity

The Control Center activity panel now uses a separate Cloudflare D1 security store (Production binding `VH_SECURITY_DB`, database `vision-hub-security`) instead of relying on the legacy `vh_login_activity` SQL table. It records guest visits, authenticated visits, successful/failed user sign-ins, signup, logout, Admin sign-in outcomes, temporary blocks and unauthorised Control Center/API access. IP is read on the server from Cloudflare's `CF-Connecting-IP` header, never from a browser-supplied IP field.

Admin and staff log in through the separate Secure Admin panel. A successful login receives a 1-hour HMAC-signed HttpOnly cookie scoped to `/api`; protected staff APIs require both the current Supabase staff role and this cookie. Five failed or unauthorised attempts within 30 minutes block that IP for 30 minutes. Raw IP and user-agent audit rows are retained up to 90 days. The activity read API and panel are restricted to the Main Admin role (`profiles.role = 'admin'`); sub-admin, content-editor and moderator roles cannot read this history. Passwords, OTP values and auth tokens are not stored in the activity log.

The D1 database, schema and Production binding are provisioned, and the signing secret is configured as a Cloudflare Pages secret. The implementation still needs its matching production deployment and live browser verification before it can be marked Verified. The older `supabase/vision-hub-login-activity.sql` remains a legacy migration and is not needed by the new D1 activity panel.

## Final-stage verification gate

Do not mark the platform complete until the following have been run against the deployed Production site:
- End-to-end flows for every upload provider that has credentials
- Playback, subtitles, watch progress, quality switching and downloads
- Movie, series, season and episode CRUD
- User registration/login, watchlist, request, feedback and voting
- Admin, sub-admin, editor and moderator permission boundaries
- Donation submission and manual verification
- Telegram webhook, commands and notification delivery
- AdSense placements, ads.txt and report API (after account approval)
- Desktop/mobile responsive, accessibility, performance and SEO checks
- Security checks for RLS, private media, API authorization, input validation and secret exposure

Provider features that still require external approvals or credentials must be reported separately rather than labelled “working”.


## Review portfolio

See [VISION HUB Feature Portfolio & Completion Chart](VISION-HUB-FEATURE-PORTFOLIO.md) for implemented vs verified vs blocked work, remaining dependencies and the priority backlog.
