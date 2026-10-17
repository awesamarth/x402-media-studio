# VPS staging milestone

Staged under /home/ubuntu/x402-media-studio on oracle-vps (Ubuntu ARM64, two CPUs, approximately 11 GiB RAM/38 GiB free disk at inspection). Only tracked source/config and required upstream models were transferred; no local credentials, private recordings, alliance video, data or outputs were uploaded.

Installed ordinary media/build dependencies and project-local Bun1.3.14 (official ARM ZIP verified against upstream SHA256), uv0.10.12 and official yt-dlp CLI2026.08.19 (pinned public PyPI in a project-only environment). Native Whisper1.9.4, multilingual small, Tesseract English and hashed Linux ARM64 translation dependencies/models configured successfully in free mode. No ongoing API token has been created.

Native public JFK fixture: real temporary authenticated loopback HTTP upload/quote/job/artifacts flow passed, small model SHA256 recorded. 12.63s total; peak RSS766112 KiB. Temporary API stopped and token was not persisted. Artifacts are under outputs/try-file/2026-10-17T13-03-25-060Z-c051c73c/ on the VPS.

Complete public JFK/generated-text seven-step pipeline: 16987ms first run; cached repeat103ms, every step hit. Small transcription11955ms. Converted video153758bytes under500000 target. Entire command17.90s; peak RSS766044KiB. Report at /home/ubuntu/x402-media-studio/data/local-ai-demo/report.json; copied public report is docs/vps-public-benchmark.json. This is an actual benchmark/demo, not a new automated test suite. Linux uses the configured DejaVu font; the old demo report's visual description says Arial generically and should not be taken as its actual Linux font.

Caddy remains active for flappy-bird.awesamarth.dev only. Original configuration SHA2567f354799b519152e9a5f13380d97f5ae7e856fdc3f5e0c97bfc3fb8d23f49965; service start time2026-10-10 21:44UTC; existing site HTTP200 after staging. No active Caddy route, DNS, firewall, SSH, service-account, network-filter or ongoing credential changes have been applied. New Caddy/API service/token-installer drafts are staged and unexecuted.

Authoritative DNS: Cloudflare, gordon.ns.cloudflare.com and heather.ns.cloudflare.com. Existing Flappy Bird and SSH target80.225.204.42. User-facing proposed record: A, x402-media-studio, 80.225.204.42, TTL Auto, DNS only. Domain publication still requires DNS and activation approval.

Exact pending approval bundle: [deploy/approval-scope.md](../deploy/approval-scope.md). Public native downloader integration and its actual enforcement/retrieval check remain to implement/verify after permission; the working direct local-caption helper has not been represented as verified public server retrieval.

## Current running app

The existing ubuntu user now runs x402-media-studio.service through the user manager on127.0.0.1:8787. BILLING_MODE remains free; PUBLIC_FREE_DEMO enables automatically issued request handles, one execution per request and twelve executions/hour globally. No API key, new account, customer-token file, global firewall/DNS/SSH change or real payment was introduced. Caddy has not been reloaded or given the new route.

Actual current native HTTP run passed all seven operations in17.9s and returned18 artifacts; missing handle401, another request's handle404, same purchase retry returned the same job. Report: docs/vps-keyless-free-report.json. No private user recording was uploaded.

URL diagnosis: direct public JFK fetch succeeded. Both curl and yt-dlp initially timed out through the enforcing relay; a later verbose curl relay run completed CONNECT, TLS and HTTP200. This indicates intermittent behavior rather than a proven permanent relay block; no network identity was changed. Native user-namespace creation failed writing uid_map with Operation not permitted; no sudo bypass or OS-policy change was attempted. Direct normal installed yt-dlp on the VPS got YouTube's “Sign in to confirm you're not a bot” response. No cookies/retries/workaround followed. Server URL imports return503 before quote/payment while the isolated Linux runner is unconfigured; file/caption uploads and all seven processing operations work.

Minimal next public action: append the already prepared x402-media-studio.awesamarth.dev Caddy block, validate the combined config, reload Caddy once, then verify both hostnames. Existing Flappy Bird block stays byte-for-byte intact. No extra service-account/token/network-hardening bundle is requested.

The temporary user-manager unit was replaced with a single normal system service /etc/systemd/system/x402-media-studio.service, running as the existing ubuntu user and enabled at boot. No new accounts or login/linger policy changes were made. It binds127.0.0.1:8787, uses data/service, and reports freeDemo true, paymentConfigured false, urlImports false. A post-install anonymous request returned201 with an automatic scoped handle (not printed), confirming writable state. Root info and health return200. Caddy active config hash remains unchanged and Flappy Bird remainsHTTP200.
