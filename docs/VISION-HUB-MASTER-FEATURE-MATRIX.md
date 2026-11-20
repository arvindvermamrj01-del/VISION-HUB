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
| Security | Server-side provider secrets, role-checked APIs, RLS and signed private media | Final security review and authorization tests |

## Main-admin login activity

The web interface records successful user and staff sign-ins in `vh_login_activity`. It stores only the account UUID and timestamp. Apply `supabase/vision-hub-login-activity.sql` in Supabase SQL Editor before expecting rows to appear. Row-level security allows each signed-in user to insert only their own event and permits only the main administrator role to read events. The feature remains unavailable until that migration is applied and its policies are verified in the target Supabase project.

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
