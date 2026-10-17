# Test your own file through HTTP

From the repository root:

```sh
bun run try:file -- "/absolute/path/to/your-recording.mp4"
```

No server/token setup is required for this helper. It starts an isolated loopback child on an available port from 7000–7999, creates process-only test authentication, and calls the actual API: raw upload → quote → free workflow → owned purchase/job polling → authenticated artifact download. It runs the installed Whisper model; no canned transcript is substituted. Existing servers are not reused or stopped. Its isolated process group is stopped afterward and its temporary working upload/data/cache are removed; your source file and downloaded results remain.

Results are printed as absolute paths under `outputs/try-file/<run>/`:

- `transcript.srt`
- `transcript.vtt`
- `transcript.json` with segment timestamps and text
- `run.json` with non-secret source/job/output metadata

The output directory is ignored by Git. Temporary auth is never printed, written to the output, or saved as an ongoing credential. The child forcibly uses free mode, regardless of ordinary paid-mode environment settings.

Limits: **100 MiB = 104857600 bytes** per upload; five-minute transcription input; audio stream required. English is the default and verified. Use `--language auto` for language detection; other-language accuracy is not verified. Inputs longer than five minutes must be clipped first. Other media/resource limits are unchanged. Use `bun run try:file -- --help` for usage.

## Upload format

The actual endpoint is POST /assets with an account bearer header and **raw bytes** in the request body. Use curl `--data-binary @file` or a same-origin browser File/Blob as fetch body. Do not use multipart/FormData, base64 or JSON wrapping. Content-Type application/octet-stream is sufficient. The filename and provided MIME are not stored/trusted; FFprobe inspects the content and returns its SHA-256 asset ID. Browser requests from another origin need CORS configuration; curl/the helper already work.

## Verified example

The helper was exercised against the existing public `fixtures/jfk.wav` recording, using a real temporary server and Whisper recognition. The run used port 7376 and successfully downloaded all three artifacts; the port no longer listened afterward. Output folder:

`/Users/awesamarth/Desktop/code/x402-media-studio/outputs/try-file/2026-10-17T12-10-38-108Z-97594e84/`

It created no persistent credentials and made no payment/provider call. The source recording was not changed. yt-dlp source ingestion has not started; it remains separate pending work.

## URLs and ordered operations

All commands below start an isolated temporary free API, use actual HTTP requests and save every artifact under outputs/try-file. No persistent token is needed. The service now selects multilingual Whisper small; no automatic base fallback.

```bash
bun run try:file -- 'https://raw.githubusercontent.com/ggml-org/whisper.cpp/v1.9.4/samples/jfk.wav'
bun run try:file -- '/absolute/path/to/video.mp4' --steps '[{"type":"clip","start":0,"duration":5},{"type":"normalize"},{"type":"convert","targetBytes":400000},{"type":"frames","ocr":true,"atSeconds":[0,2]}]'
bun run try:file -- '/absolute/path/to/video.mp4' --steps '[{"type":"transcribe","language":"en"},{"type":"localize","from":"en","to":"es"}]'
```

The first command produces small-model transcript SRT/VTT/JSON. The second produces numbered intermediate videos, audio metrics, JPEG frames, OCR TSVs and a frame manifest. The third produces the English transcript plus Spanish SRT. Original files stay unchanged. URL selection uses video when steps need frames/clipping/conversion, otherwise audio.

Verified URL source: the upstream direct JFK WAV URL using yt-dlp Generic extractor. YouTube page URLs pass the allowlist validator but have **not** been tested end to end. Their downloader success is conditional; authentication, playlists, live streams, JS challenge workarounds and restriction bypass are unsupported. W3 media URLs are allowlisted but not tested. Do not describe this as general YouTube support.
