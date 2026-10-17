# Current distinction: local CLI versus public URL API

The trusted `bun run try:file -- YOUTUBE_URL` command now uses installed official yt-dlp directly for caption-only YouTube workflows, selects one track, then uploads captions into the authenticated API. Real Stanford-video manual-caption retrieval and job output succeeded; see try-file.md. No custom extractor or client override is used.

The server-side POST /imports path still enforces SSRF boundaries through its local relay. That altered path received HTTP 429 on the YouTube webpage in a controlled minimal-listing comparison, whereas normal installed yt-dlp succeeded on the same Mac/video. The exact lower-level network cause remains unresolved; the relay pins public IPv4 while native resolution offers IPv4/IPv6, but address-family causality has not been proved. This is a wrapper-path discrepancy, not evidence of a general YouTube access block. The unguarded operator CLI path is not exposed as a server mode.

# Import a public media URL

Run the API with Bun and `BILLING_MODE=free`, then send an authenticated `POST /imports`:

```json
{"url":"https://raw.githubusercontent.com/ggml-org/whisper.cpp/v1.9.4/samples/jfk.wav","media":"audio","idempotencyKey":"my-public-import-001"}
```

The response is immediate (202). Poll `GET /imports/<id>`. Once `jobId` appears, use the normal `GET /jobs/<jobId>` and authenticated artifact downloads. Audio defaults to English transcription; video defaults to one frame and a manifest. Optional `steps` uses the existing ordered workflow schema. Uploads remain available for local files. The PayBox adapter exposes `import_url` and `get_import`; heavy work stays on the backend.

The same owner and idempotency key returns the same import; changed parameters fail. Import records survive restarts; interrupted downloads fail explicitly rather than refetching silently. A new key can retry a failed download. One downloader runs at a time, with four queued/downloading records and 64 retained import records maximum. The existing processing queue and artifact cache are reused.

## Current support and limits

On macOS the runner uses `sandbox-exec`, installed yt-dlp and FFmpeg on PATH. `YT_DLP_BIN` may override the trusted operator-selected yt-dlp binary. Linux selects the Docker runner described in [Linux setup](linux-import-runner.md); missing Docker/image fails explicitly, with no unguarded fallback. Local uploads and processing do not require this importer. No VPS settings have been changed.

Only HTTPS frontends `raw.githubusercontent.com`, `media.w3.org`, `youtube.com`, `www.youtube.com`, `m.youtube.com` and `youtu.be` are accepted. YouTube support is conditional on public progressive HTTPS formats being available without authentication or remote JS components; it is not a claim that every video works. Playlists, live/upcoming streams, private URLs, cookies, login, DRM, user-supplied downloader flags and restriction bypass are unsupported. Only progressive HTTPS media is selected. Video requests prefer MP4/H264/AAC through yt-dlp's `-t mp4` preset; that preset is not a guarantee of transcoding. Audio extracts a WAV using best audio when offered, falling back to a combined source.

On macOS a child-only OS rule denies direct outbound traffic except the enforcing local proxy. On Linux Docker `--network none` blocks direct networking; a loopback relay connects only to the mounted Unix proxy socket. The proxy permits exact HTTPS tunnel hosts plus Google video delivery subdomains, validates all resolved IPv4 addresses, pins a public IP before connecting, and keeps TLS verification end to end. Redirects and extractor requests must pass this same boundary. IPv6 and IP literals are unsupported. Proxy traffic is capped at 108 MiB and 64 tunnels (8 concurrent), each tunnel has a 30-second deadline. Each metadata/download subprocess has a three-minute deadline and bounded output. Downloaded temporary files are capped at 100 MiB, with a 2 MiB/s downloader limit. Local FFprobe checks the downloaded duration (five minutes audio, ten minutes video) before asset registration or workflow execution, including when extractor duration is missing. Temporary work files are removed on completion/failure.

This path currently requires free mode and makes no payment. Paid URL acquisition needs a separate quoted/purchased design before enabling it. Existing paid workflows remain available for already-uploaded assets when configured.

No saved browser credentials are used. Provider errors are summarized without persisting response bodies or signed media URLs. Import records retain the submitted URL privately; status responses omit it. Use only sources you are permitted to retrieve.

For transcription-only caption workflows the importer now prefers matching manual source captions, then automatic source captions, before media download. Source captions register as explicit caption assets with no fabricated media/audio stream. Workflow outputs preserve provider cue times and provenance. Access/extractor/caption-download failures never establish caption absence and never trigger fallback. Media operations bypass caption reuse and download actual media. See try-file.md for commands and source-provenance fields. [Official yt-dlp subtitle flags](https://github.com/yt-dlp/yt-dlp#subtitle-options).

YouTube extraction may also tunnel to the exact public www.google.com host; it remains excluded from submitted URL frontends. Errors retain bounded diagnostic lines with all HTTP(S) URLs redacted, and list any proxy-denied hostnames. This distinguishes application host-policy failures from the observed upstream bot/authentication block.

Public native-CLI integration plan and exact host authorization gap: [public-api-runner-plan.md](public-api-runner-plan.md). Server metadata now uses a bounded 12 MiB info file and normal CLI defaults; the enforcing relay remains until an alternative destination boundary is verified.

## October 17 runtime verification

The ordinary VPS CLI is yt-dlp 2026.08.19 with Node v24.18.0. An explicit `--js-runtimes node:/usr/local/bin/node` generic-extractor metadata call to the unrestricted upstream JFK WAV succeeded (`extractor=generic ext=wav`). The downloader implementation now passes this runtime selection itself; the prepared Linux image includes official Node 24.18.0 and yt-dlp default/EJS dependencies.

An actual temporary loopback API on the VPS completed URL import -> running job -> succeeded -> downloaded SRT, VTT and JSON using the local small Whisper model. Output: `outputs/try-file/2026-10-17T17-34-36-163Z-ba34705b/`. This verifies the production-machine direct-file backend path, not the disabled Docker platform-extraction path. Production remains paid; the temporary API was free and stopped after completion. No real payment occurred.

Linux platform extraction is still gated on a configured isolated runner. Docker is absent on oracle-vps; no daemon installation, privileged service-account access, namespace/security relaxation or alternate egress was performed. Prior YouTube sign-in/bot-check remains unresolved and was not retried. Installing yt-dlp does not imply YouTube access. Captions-first selection, fallback policy and strict acquisition bounds already exist in src/imports.ts.
