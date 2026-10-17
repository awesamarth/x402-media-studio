# VPS staging milestone

Staged under /home/ubuntu/x402-media-studio on oracle-vps (Ubuntu ARM64, two CPUs, approximately 11 GiB RAM/38 GiB free disk at inspection). Only tracked source/config and required upstream models were transferred; no local credentials, private recordings, alliance video, data or outputs were uploaded.

Installed ordinary media/build dependencies and project-local Bun1.3.14 (official ARM ZIP verified against upstream SHA256), uv0.10.12 and official yt-dlp CLI2026.08.19 (pinned public PyPI in a project-only environment). Native Whisper1.9.4, multilingual small, Tesseract English and hashed Linux ARM64 translation dependencies/models configured successfully in free mode. No ongoing API token has been created.

Native public JFK fixture: real temporary authenticated loopback HTTP upload/quote/job/artifacts flow passed, small model SHA256 recorded. 12.63s total; peak RSS766112 KiB. Temporary API stopped and token was not persisted. Artifacts are under outputs/try-file/2026-10-17T13-03-25-060Z-c051c73c/ on the VPS.

Complete public JFK/generated-text seven-step pipeline: 16987ms first run; cached repeat103ms, every step hit. Small transcription11955ms. Converted video153758bytes under500000 target. Entire command17.90s; peak RSS766044KiB. Report at /home/ubuntu/x402-media-studio/data/local-ai-demo/report.json; copied public report is docs/vps-public-benchmark.json. This is an actual benchmark/demo, not a new automated test suite. Linux uses the configured DejaVu font; the old demo report's visual description says Arial generically and should not be taken as its actual Linux font.

Caddy remains active for flappy-bird.awesamarth.dev only. Original configuration SHA2567f354799b519152e9a5f13380d97f5ae7e856fdc3f5e0c97bfc3fb8d23f49965; service start time2026-10-10 21:44UTC; existing site HTTP200 after staging. No active Caddy route, DNS, firewall, SSH, service-account, network-filter or ongoing credential changes have been applied. New Caddy/API service/token-installer drafts are staged and unexecuted.

Authoritative DNS: Cloudflare, gordon.ns.cloudflare.com and heather.ns.cloudflare.com. Existing Flappy Bird and SSH target80.225.204.42. User-facing proposed record: A, x402-media-studio, 80.225.204.42, TTL Auto, DNS only. Domain publication still requires DNS and activation approval.

Exact pending approval bundle: [deploy/approval-scope.md](../deploy/approval-scope.md). Public native downloader integration and its actual enforcement/retrieval check remain to implement/verify after permission; the working direct local-caption helper has not been represented as verified public server retrieval.
