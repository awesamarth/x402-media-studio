# x402 Media Studio

Chain media operations through one API and pay with USDC through x402. Transcribe a video, translate its captions, extract a clip or OCR frame, and download the results from a single asynchronous workflow.

Built with **Bun + TypeScript**, FFmpeg, local inference engines, and a stateless **PayBox MCP plugin**. Media processing runs on the backend; the plugin handles requests, quotes, payment proposals, and job polling.

## What it does

| Operation | Input and output |
| --- | --- |
| `transcribe` | Audio/video → English or auto-detected speech transcript in SRT, VTT, and JSON. Uses whisper.cpp small; timestamps are segment estimates. |
| `localize` | SRT/VTT text or an earlier transcript → Spanish subtitles and a translation report. Currently **English → Spanish only**, using local Argos/CTranslate2. |
| `clip` | Extract a video segment using `start` and `duration` in seconds. |
| `frames` | Extract JPEGs at `atSeconds`, with a manifest and optional English OCR text, boxes, confidence, and TSV. |
| `repair_subtitles` | Validate, reflow, and convert SRT/VTT; report timing/overlap warnings. Does not align subtitles to speech. |
| `convert` | Quality-focused MP4 compression by default; optional `targetBytes` for an explicit size budget. |
| `normalize` | Remove silence and normalize loudness. Video input keeps synchronized video; audio-only input produces an audio-only MP4. Includes a timing report. |

Steps run in order. Each media step consumes the preceding media output; subtitle steps can consume the preceding transcript or translated subtitles. Frame timestamps refer to the media **at that step**. Extract a frame at an original timestamp before clipping. Clip and normalization change timing, so transcribe after them when captions must match the edited result.

Compression defaults to H.264 **CRF 20 / medium**, preserving dimensions and timing. AAC audio is copied; other audio is encoded as AAC at 192 kbps. Lossy encoding cannot guarantee identical quality or a smaller file. If the encode is larger and the source is a recognized MP4, the original is returned with a report stating no reduction. Explicit size targets can fail if full-duration output cannot fit.

## Pricing

**0.01 USDC per billable workflow operation**, combined into one payment on Base mainnet.

- Transcription's SRT, VTT, and JSON files together count as **one** operation.
- A frames step including OCR counts as **one** operation.
- Transcription → translation → frames/OCR → compression costs **0.04 USDC**.
- Clipping counts as one billable operation. YouTube URL imports are not supported.
- Uploads, quotes, status polling, and downloads are free. Cache hits do not change the quoted operation price.

Quotes are authoritative and expire after four minutes. Existing quotes retain their saved amount. Free mode and zero-total workflows do not create payment proposals. Payments and processing have separate states: a failed job does not automatically refund a settled payment. Never repeat a purchase to poll an uncertain payment.

See [pricing](docs/pricing.md) and [payment ownership and idempotency](docs/payment-binding.md).

## Use with PayBox

1. Build and upload `adapter/dist/plugin.mjs` to PayBox. Configure `MEDIA_API_URL` and allow its exact HTTPS hostname in the developer portal.
2. Call `create_request`. Retain its scoped `requestHandle` privately and present `upload.pageUrl` to the user.
3. The user opens the private upload page, selects a file, and returns to chat. Call `get_request_asset` with the same handle to retrieve `assetId`, then `inspect_asset` to inspect it.
4. Call `quote_workflow` with that asset and ordered steps. For a supported public URL, use `import_url` or the quote's `source` field instead.
5. Call `purchase_workflow` with the quote ID and a stable idempotency key. For paid workflows, PayBox obtains approval and submits payment; follow the PayBox request to its terminal result.
6. Call `get_purchase`, then `get_job`. Present the returned artifact `downloadUrl` links to the user. `read_artifact` can retrieve small text outputs.

The adapter exposes **10 tools**. It does not automatically receive ChatGPT attachments; file transfer uses the private browser upload page or an agent capable of uploading raw bytes. The hosted plugin has a ten-second execution budget, so it delegates long-running work to the backend.

[Adapter build and configuration](adapter/README.md) · [Official PayBox guide](https://developer.paybox.sh/requirements.md)

## Local quickstart

Prerequisites:

- **Bun 1.3.14** and FFmpeg/ffprobe.
- For transcription, translation, and OCR: Python 3, `uv`, CMake/C++ tooling, and Tesseract with English language data.
- macOS or Linux. The setup script uses Homebrew for macOS build/OCR dependencies; Linux prerequisites must be installed first.
- **Node.js 24** for the PayBox adapter's official conformance checks.

```sh
git clone https://github.com/awesamarth/x402-media-studio.git
cd x402-media-studio
bun install --frozen-lockfile

# Explicitly download/build the local engines and models.
bun run setup:local

# Run a real, isolated, free upload → transcription → download workflow.
bun run try:file -- /absolute/path/to/video.mp4
```

`try:file` starts its own loopback server with temporary authentication, runs the selected file through the API, and saves results under `outputs/try-file/`. It does not charge, modify the input file, or require a paid model API key. Use `--language auto` for language detection.

For a local API with the bounded free request-handle flow:

```sh
BILLING_MODE=free PUBLIC_FREE_DEMO=1 bun run start
# API: http://127.0.0.1:8787
# Guides: /docs, /llms.txt, /openapi.json
```

Keep the free demo bound to loopback unless intentionally operating a public demo. Check `/health` for capabilities available in the current installation. Runtime jobs do not download models automatically.

Useful project commands:

```sh
bun run typecheck
bun run test
bun run demo       # Synthetic FFmpeg workflow
bun run demo:ai    # Requires the local models
```

To build the adapter:

```sh
cd adapter
bun install --frozen-lockfile
bun run build
bun run test      # Run with Node.js 24 available
```

## API workflow

Start with `POST /requests` and save the returned `requestHandle`. Private API calls use the `X-Request-Handle` header. No customer signup or persistent API key is required in the request-handle flow.

Upload actual file bytes to `POST /assets` with `Content-Type: application/octet-stream`; multipart and base64 uploads are not supported. Alternatively, use the returned private upload page.

Example `POST /quotes` body after upload:

```json
{
  "assetId": "<assetId returned by upload>",
  "steps": [
    { "type": "transcribe", "language": "en" },
    { "type": "localize", "from": "en", "to": "es" },
    { "type": "frames", "atSeconds": [1], "ocr": true },
    { "type": "convert" }
  ]
}
```

For this example, the source must have audio/video and be longer than one second. To request a specific compression budget, supply `targetBytes` on the `convert` step.

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Installed capabilities and billing mode |
| `POST /requests` | Create a scoped upload/workflow session |
| `POST /assets`, `GET /requests/current` | Upload bytes and retrieve the session's uploaded asset |
| `GET /assets/:id` | Inspect an owned asset |
| `POST /imports`, `POST /quotes` | Quote a supported URL or uploaded-asset workflow |
| `POST /purchases/:quoteId` | Quote-bound x402 purchase |
| `POST /workflows` | Authenticated free/zero-total execution |
| `GET /quotes/:id`, `GET /jobs/:id` | Purchase and processing status |
| `GET /jobs/:id/artifacts/:name` | Authenticated artifact access |

Successful jobs also issue short-lived, single-file browser download links. Use returned URLs rather than constructing them. See [API access](docs/keyless-api.md) and [file-upload flow](docs/chatgpt-file-input.md).

## Configuration

Local engine paths are written to ignored `.env.local` by setup. Custom installations can configure `WHISPER_BIN`, `WHISPER_MODEL`, `TRANSLATE_PYTHON`, `TRANSLATE_MODEL_DIR`, `TESSERACT_BIN`, and `TESSDATA_DIR`.

Backend settings include `HOST`, `PORT`, `DATA_DIR`, and `BILLING_MODE`. Paid mode requires `PAYMENT_RECIPIENT`, `PAYMENT_NETWORK=eip155:8453`, an exact HTTPS `PAYMENT_FACILITATOR` origin, and `PUBLIC_API_ORIGIN`. Missing paid configuration fails startup rather than falling back to free. Keep credentials and runtime data out of Git; the receiving wallet and facilitator configuration belong on the backend, not in the plugin bundle.

URL imports accept **direct HTTPS media files on `raw.githubusercontent.com` and `media.w3.org` only**. YouTube and other video-platform URLs are not supported, including by the local CLI. Upload a local file instead. No home proxy, SSH relay, or video-platform feature flag is required. Redirects and arbitrary hosts are rejected. See [URL import configuration](docs/url-import.md).

## Limits and lifecycle

- Uploads: **100 MiB**, up to **30 minutes**, **4K**, and eight streams. Local transcription input is limited to five minutes; clip first for longer sources.
- Workflows: one to eight ordered steps; frame extraction supports up to 12 timestamps. Translation currently supports up to 500 cues, 2,000 characters and 512 model tokens per cue.
- Sessions: one upload and four quote attempts. The upload link expires one hour after request creation; ordinary activity does not reset it.
- Unused uploads expire one hour after upload. Job files expire one hour after completion or final failure. Artifact links last up to 15 minutes, capped by file expiry.
- One backend worker processes jobs sequentially with durable state, bounded retries, and per-step caching. Run one backend process for the file-based store; multi-process coordination and cancellation are not implemented.
- Whisper, translation, clipping, compression, and normalization commands have ten-minute ceilings. Frame extraction/OCR each have separate two-minute per-frame limits. These are execution ceilings, not completion-time promises.
- Admission also bounds queue/storage usage; requests can be rejected when capacity is exhausted. There is no automatic payment refund or user-triggered recovery for a terminal failed job.

Local CPU speech recognition, translation, and OCR can make mistakes; review generated text before publishing it. Transcription is segment-timed rather than forced word alignment. Subtitle translation preserves cue times by default; explicit overlap trimming can change them.

[Retention details](docs/retention.md) · [Translation implementation](docs/translation.md) · [Verification notes](docs/verification.md)
