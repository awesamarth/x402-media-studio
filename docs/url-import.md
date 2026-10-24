# Direct media URL imports

**YouTube and other video-platform URL imports are no longer supported.** This applies to `/imports`, `/quotes` source URLs, queued execution, payment for retired source quotes, and the local `try:file` helper. `URL_IMPORTS_ENABLED` cannot re-enable them. Use the private browser upload page or raw file upload instead.

## Supported sources

- HTTPS direct media files on `raw.githubusercontent.com` or `media.w3.org`.
- Extensions: WAV, MP3, M4A, MP4, WebM, FLAC, OGG, AAC, MOV, MKV.
- Port 443 only; no credentials, fragments, redirects, arbitrary hosts, or private-address destinations.
- 100 MiB maximum; five minutes for audio imports or ten minutes for video imports.
- DNS resolves to vetted public IPv4 addresses, the connection pins that address, and TLS verifies the original hostname.

Direct-file retrieval needs neither yt-dlp nor Docker nor a home proxy. The generic isolated fixture runner remains separate and cannot reach YouTube hosts.

## API

Create a request with `POST /requests`, retain its private handle, then submit:

```json
{
  "url": "https://raw.githubusercontent.com/ggml-org/whisper.cpp/v1.9.4/samples/jfk.wav",
  "media": "audio",
  "steps": [{"type":"transcribe","language":"en"}]
}
```

Send `X-Request-Handle` to `POST /imports`. In paid mode this returns a quote, not a running import; no download or payment starts while quoting. The same source can be supplied as `{source:{url,media},steps}` to `/quotes`. Use the normal purchase/status/download flow afterward.

In private free mode the existing import queue uses an `idempotencyKey`; `get_import` still retrieves its status. Existing uploaded captions can still be processed, but the service does not fetch captions from platforms.

## Retired relay deployment

Remove `/etc/systemd/system/x402-media-studio.service.d/youtube-home-proxy.conf`, then reload systemd and restart the service when no job is running. The removed helper scripts and SSH tunnel are not needed. Rootless Docker itself and unrelated services need not be changed.

`/` and `/health` always report `urlImports: {directFiles:true, videoPlatforms:false}`. Existing media-processing features, per-step prices, timeouts, payment receipts, and artifact retention are unchanged.
