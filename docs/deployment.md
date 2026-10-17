# Proposed VPS deployment — no changes applied

Read-only inspection through the existing `oracle-vps` alias on 2026-10-17:

- ARM64, 2 CPUs, 11 GiB total RAM, roughly 11 GiB available, no swap.
- 45 GiB root disk, 6.7 GiB used, 38 GiB free.
- Caddy running; existing `flappy-bird.awesamarth.dev` serves `/var/www/afterglow`.
- Ports 80/443 served by Caddy; loopback 2019 administration. Bun and FFmpeg not found on PATH.
- `/srv` empty; no application services visible in running service list. This is a point-in-time capacity inspection, not load profiling.

Propose `/srv/x402-media-studio` with its own non-login service identity, Bun ARM64 runtime and FFmpeg, data directory independent of `/var/www/afterglow`, API loopback `127.0.0.1:8787`, one worker and one FFmpeg thread. Set a conservative CPU/memory budget (one CPU, 2 GiB memory), 10 GiB storage quota and retention before running real workloads. Encoding is CPU-bound; two CPUs suit a small demonstration with a queue, not parallel high-resolution encoding.

After explicit deployment/domain approval, add a separate Caddy host block such as `media-api.<user-approved-domain>` reverse-proxying to port 8787. Keep the existing host block and Flappy Bird files unchanged. Domain is only a proposal; no DNS, firewall, TLS, security or server configuration was changed. Configure only the exact API HTTPS hostname in PayBox and MEDIA_API_URL; do not use wildcards. No need for a frontend or public worker port.

Production blockers: payment verification/settlement, receiving wallet, facilitator choice, provider/model choices, authentication and quotas, durable job database, worker isolation, expiration and deletion policy. Resolve these before public access. Pebble was not read or modified.

## After deployment approval

Install FFmpeg through the VPS operating system package manager (the Ubuntu/Debian `ffmpeg` package supplies both `ffmpeg` and `ffprobe`); no manual binary download is needed. Verify both versions and codec support before starting the isolated worker. This package installation has not been performed.

## Local engine implementation now complete

The Mac has verified real whisper.cpp transcription (historical base fixtures; multilingual small is now the selected default), English Tesseract OCR and direct English→Spanish CTranslate2 translation. All seven operations, chaining and caches pass real local fixtures. The later VPS setup is documented in local-runtime.md and automated by `bun run setup:local` after OS prerequisites/Bun/uv are installed. Linux ARM64 Python wheels resolve from a hashed lock, but actual VPS inference/build/latency remains to verify. Keep BILLING_MODE=free. No installation, configuration or service mutation has been performed on oracle-vps.
