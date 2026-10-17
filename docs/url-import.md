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
