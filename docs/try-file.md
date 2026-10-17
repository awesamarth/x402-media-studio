# Current local YouTube caption command

```bash
cd /Users/awesamarth/Desktop/code/x402-media-studio
bun run try:file -- 'https://www.youtube.com/watch?v=UF8uR6Z6KLc'
```

Verified with real retrieval: installed official yt-dlp fetched manual English track en-eEY6OEpapPo. The helper uploaded explicit captions into the authenticated local API and produced 244 timed segments, SRT/VTT/JSON, without downloading video or running Whisper. Outputs: outputs/try-file/2026-10-17T12-46-29-489Z-e9682022/. JSON identifies source-captions/manual/Youtube/en; SRT and VTT timing matches, from 7.47 through 903.76 seconds.

The trusted interactive helper invokes yt-dlp directly using argument arrays and ordinary skip-download/write-info-json/subtitle flags, selecting exactly one matching manual or automatic track. It uses a clean temporary HOME and no cookies, extractor client overrides, special proxy, remote-component setup or identity changes. Metadata is written to a bounded temporary info file instead of forcing multi-megabyte metadata through the API runner's stdout limit. Metadata and unused temporary files are removed; only final artifacts remain. Limits: 120 seconds per CLI invocation, 16 MiB total temporary files, 12 MiB info JSON, 2 MiB selected captions, 30-minute caption timeline. The helper's supported caption language remains English. Whisper small is used for actual media transcription; existing source captions take priority for caption-only workflows.

This local helper is a trusted operator command. Its direct-network CLI path is not callable through the public /imports endpoint. That endpoint retains its SSRF-enforcing relay and still needs native/public deployment integration work. Local captions enter the backend through authenticated POST /assets/captions; processing uses the same quote/job/artifact API. No general public YouTube API success is claimed from this local result.

The historical diagnostics below describe earlier failures and have been superseded for the local helper by the successful direct-CLI result above. No general YouTube block should be inferred from those failures.

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

## Captions first

URL workflows beginning with transcription and containing only transcription, translation or subtitle repair now inspect source captions first. Matching manual captions win over automatic captions. They are retrieved with yt-dlp skip-download plus the chosen subtitle flag; no media download or Whisper run is needed. When successful extraction shows no matching captions, media download and small-model transcription remain the fallback. Media-changing operations (clip/normalize/convert/frames) still require media download so captions cannot be reused with incorrect timing.

`transcript.json` identifies `engine: source-captions` with manual/automatic provenance, language, extractor and source page, or `engine: whisper.cpp` with generated provenance and model SHA256. Provider overlaps and cue timing are preserved. Unsupported matching subtitle formats, access denial and caption download errors fail explicitly rather than being treated as no captions. The same allowlisted proxy and resource bounds apply to caption requests and redirects.

Example (YouTube live compatibility is not guaranteed):

```bash
bun run try:file -- 'https://www.youtube.com/watch?v=BaW_jenozKc'
```

Caption selection/output has passed synthetic workflow tests without Whisper. See verification.md for actual external retrieval results; do not interpret a passing fixture as proof of YouTube availability.

Latest YouTube diagnosis: after allowing the observed exact www.google.com tunnel needed during extraction, the public Stanford video UF8uR6Z6KLc returned an upstream “Sign in to confirm you're not a bot” error with no denied proxy hosts. No HTTP status was reported by yt-dlp. Do not use the YouTube command as a promised successful demo in this environment; captions-first is implemented/tested with fixtures, while live YouTube retrieval is currently blocked. No cookie workaround is included.
