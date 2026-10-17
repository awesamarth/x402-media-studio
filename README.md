# x402 Media Studio

A Bun + TypeScript media workflow API, local CPU worker, and thin PayBox MCP adapter. **Billing is free by default.** All seven operations now execute locally; no hosted model API or paid provider is used.

## Test your own file through the actual HTTP API

```sh
cd /Users/awesamarth/Desktop/code/x402-media-studio
bun run try:file -- "/absolute/path/to/your-file.mp4"
```

This starts an isolated FREE loopback server on an available 7xxx port, uses temporary in-memory test authentication, uploads the original bytes, creates/submits a transcription workflow, polls and downloads SRT/VTT/JSON. It stops its own server/process group and removes the working upload afterward; existing servers and your input file are untouched. Results remain under `outputs/try-file/<run>/`, with exact paths printed. No token setup or persistent credential is needed. English is the default; add `--language auto` for automatic language detection. Input limit is **100 MiB (104857600 bytes)**, five minutes for transcription, with an audio stream. This runs real HTTP/model processing, not a mock demo.

The upload endpoint accepts raw binary bodies, not multipart/FormData or base64. curl uses `--data-binary @file`; a same-origin browser client passes a File/Blob as fetch body. The filename and supplied MIME are ignored; the server probes content and returns a SHA-256 asset ID. Cross-origin browser CORS is not configured.

## Run on this Mac

The engines and models are installed and non-secret paths are in ignored `.env.local`.

```sh
bun install --frozen-lockfile
bun run demo:ai                 # real speech → Spanish captions, OCR, all seven steps, then cache reuse
bun run test:ai                 # real model and silence/loudness fixtures
bun --env-file=.env.local test  # full suite including local models
bun run typecheck
bun run demo                   # original small FFmpeg-only demo
```

The full demo writes `data/local-ai-demo/report.json`, with exact artifact paths and timings. [Latest measured output](docs/local-ai-results.json) and [setup/provenance](docs/local-runtime.md) describe the fixture and limitations. From a fresh machine, install Bun, uv, FFmpeg/ffprobe and the OS prerequisites, then run `bun run setup:local`. That explicit installer verifies pinned model/source checksums, builds whisper.cpp, installs translation in a project virtualenv, and configures free mode. Runtime jobs never install or download models.

The API binds to `127.0.0.1:8787`. Current testing stays `BILLING_MODE=free` and private; `try:file` automatically creates temporary in-memory test access. Paid customers need **no signup or API key**: `POST /requests` automatically returns a private one-hour request handle. Send it as `X-Request-Handle` on uploads, quotes, polling and downloads. See [keyless API flow](docs/keyless-api.md).

## Operations and actual support

| Operation | Working output | Scope/limits |
| --- | --- | --- |
| `transcribe` | Real whisper.cpp multilingual small recognition, segment JSON, SRT and VTT | English verified; `language: en` or `auto`; five-minute input limit; segment estimates, no forced word alignment |
| `localize` | Offline English→Spanish captions through CTranslate2/SentencePiece and installed Argos model | Direct `en`→`es` only; cue IDs/count/times preserved; 500 cues, 2,000 characters/512 tokens per cue; human quality review still needed |
| `clip` | FFmpeg clip extraction | Start/duration inside media; no content-aware highlight selection |
| `frames` | Selected JPEGs, timestamped JSON manifest, optional real OCR text/boxes/confidence and TSV | `atSeconds` up to 12 samples, default `[0]`; English OCR only; sample times are requested seeks with possible one-frame error; image coordinates reference the scaled output |
| `repair_subtitles` | SRT/VTT parsing, timing/order validation, conversion, reflow and warning artifact | Explicit overlap policies; no speech alignment or semantic rewriting |
| `convert` | Quality-focused MP4 by default; optional target byte budget | CRF20 medium, unchanged dimensions/timing, AAC copied; reports savings or original kept. Explicit infeasible targets can fail |
| `normalize` | Actual silence removal and loudness normalization with synchronized video trimming | -45 dB/0.3s silence detection, 0.05s padding, -16 LUFS target; needs audio; emits kept intervals and measured output duration |

Transcription/repair/localization supply captions to the next caption step automatically when `text` is omitted. Translation consumes the preceding transcript; repair consumes translated captions. Media operations consume the preceding media output. Clip/normalize invalidate earlier captions because the timeline changes; transcribe after them. Convert preserves the timeline. All reported times refer to the media at that step, not automatically the original upload.

Example workflow (replace the returned upload hash):

```json
{"assetId":"UPLOAD_HASH","steps":[{"type":"clip","start":0,"duration":10.8},{"type":"normalize"},{"type":"convert","targetBytes":500000},{"type":"transcribe","language":"en"},{"type":"localize","from":"en","to":"es"},{"type":"repair_subtitles","options":{"format":"vtt","overlap":"trim"}},{"type":"frames","ocr":true,"atSeconds":[0,2,6]}]}
```

Subtitle options: `format: srt|vtt`, `overlap: error|trim|preserve`, `sort: boolean`, `maxChars: 10..100`, `maxLines: 1..5`. Defaults reject overlaps/order errors, output SRT and wrap at 42 characters. Excess lines/long words generate actionable warnings. Known-invalid supplied captions and options fail before quote acceptance.

## API and PayBox

| Request | Purpose |
| --- | --- |
| GET /health | Billing mode and actual installed capability availability |
| POST /assets | Raw media, max 100 MiB/30 minutes; content hash and metadata |
| GET /assets/:id | Metadata, only for an account that uploaded those bytes |
| POST /quotes | Validate immutable `{assetId,steps}` under account ownership |
| GET /quotes/:id | Owned quote/purchase status and eventual job ID; resumes owed settled enqueue |
| POST /workflows | Real authenticated free enqueue, or public x402 purchase in paid mode |
| GET /jobs/:id | Owned status, errors, attempts; artifact filename/MIME/bytes and short-lived browser download URL |
| GET /downloads/:jobId/:name?expires=...&token=... | Short-lived single-artifact download, no custom header; issued by owned job status |
| GET /jobs/:id/artifacts/:name | Owned artifact download; optional `?inline=base64` limited to 48 KiB |

Free mode uses `{quoteId,idempotencyKey}` with account authentication. `purchase_workflow` discovers `mode: free` and starts that real job; it never proposes a zero-amount payment. Use `get_purchase`, then `get_job`, then authenticated downloads or bounded `read_artifact`. The retired `/dev/workflows` route cannot bypass billing.

The nine-tool PayBox adapter is bundled at `adapter/dist/plugin.mjs`. It runs no media processing in the hosted sandbox. Configure an exact HTTPS `MEDIA_API_URL` origin and automatically issued request handles for ordinary data tools. See [adapter setup](adapter/README.md). Local protocol conformance and broker-shim integration do not prove hosted networking or payment compatibility.

## Cache, jobs and limits

Media bytes/metadata are content addressed. Every successful step has a reusable cache keyed by source media bytes, caption text, parameters, step position, processing code, and engine/model fingerprints. Transcription and translation therefore reuse real outputs on repeated workflows; changing OCR sample times invalidates that step. Cache content stays inside the private data store and is exposed only through owned job artifacts. Artifact metadata reports `cacheHit`, key and elapsed time. Partial steps are not published as cache entries. Models live separately under `.runtime` and do not consume the media budget.

One worker processes jobs sequentially. Job state and idempotency survive restart; interrupted exhausted jobs become terminal failures. Local deterministic steps retry once; payment is never retried by the worker. Run **one backend process** with this file store. Multi-process coordination and user cancellation are unsupported.

Controls: one upload/probe at a time; 100 MiB upload; 30-minute media; 4K/8 streams; 8 workflow steps; 8 queued/running jobs; 256 quote/512 job records; 256 MiB logical data admission budget; bounded step outputs; 2 MiB subprocess logs; two-minute hard subprocess timeout. FFmpeg processing uses one codec/filter thread and model inference two CPU threads. Admission is an application budget, not an OS quota: an in-flight bounded operation can temporarily exceed it. Failed files/cache count toward storage. Operator cleanup/retention is still needed. Untrusted media needs OS sandboxing before public production use. URL ingestion is absent; media protocols/formats are restricted to local inputs.

## Free/paid switch and payment recovery

`BILLING_MODE=free|paid` is the only switch; default is **free**. Paid mode requires complete validated `PAYMENT_RECIPIENT`, `PAYMENT_NETWORK=eip155:8453`, exact HTTPS `PAYMENT_FACILITATOR` and `PUBLIC_API_ORIGIN`, and account authentication. Missing paid configuration prevents startup; failures never silently fall back to free. Quotes retain their creation mode. `PAYMENTS_ENABLED` and `ACCOUNT_PAYER` are obsolete and ignored.

Paid flow uses documented x402 v2 challenge/verify/settle with a trusted facilitator. The public body accepts only quote ID and idempotency key. Owner, steps and price come from the persisted quote; dynamically verified payer evidence does not transfer output ownership. Transfer authorization does not sign the workflow body. Leaked unused payment headers are credentials; see the corrected [payment boundary](docs/payment-binding.md). No private keys or arbitrary saved credentials are used.

Nonce/purchase records are persisted before settlement, and settlement before enqueue. Capacity is checked first but races/crashes remain possible. Authenticated `get_purchase` retries only owed enqueue for known-settled purchases, even after quote expiry, reporting `awaiting_capacity`, `queued` or `enqueue_failed`. It never proposes/verifies/settles again. Unknown settlement remains pending for facilitator-specific operator reconciliation. Preserve payment/nonce records.

Live billing uses 0.01 USDC per billable workflow operation, summed into one payment on Base mainnet through the credential-free xPay facilitator. Quotes, status and downloads do not separately charge. PayBox has validated the live unpaid challenge; real signed payments and settlement have previously been verified. See [current pricing and verification](docs/pricing.md).

## Deployment

The existing VPS inspection and isolation plan are in [deployment.md](docs/deployment.md). No deployment, DNS/Caddy change, push or portal submission occurred. Linux ARM64 dependency wheels resolve from pinned hashed locks, but runtime installation/inference and latency on that VPS still need verification. Rebuild whisper.cpp there; do not copy Mac executables/venvs. Public operation also needs retention/quota policy, media isolation and ordinary service hardening. See [morning setup](docs/morning-setup.md) for the remaining actions.

Public URL import: see [setup and limits](docs/url-import.md). Linux uses a network-disabled Docker runner; see the deployment instructions.

One billing switch: keep `BILLING_MODE=free` for private testing; when enabled, `paid` gates **all seven operations**, including cheap/caption-only work and cache hits. Polling/downloading an already purchased job never settles again. Real paid mode also requires the receiving address, Base network and trusted facilitator configuration. No customer API key is required.

Current deployed file lifecycle: [one-hour retention](docs/retention.md), including actual scheduled cleanup and preserved legacy inputs.
