# x402 Media Studio

A Bun + TypeScript media workflow API with a separate PayBox MCP bundle. Real media work runs on the backend; hosted plugin calls stay short and stateless.

## Run locally

Requires Bun 1.3+, FFmpeg and ffprobe on PATH. No provider credentials are read.

```sh
bun install --frozen-lockfile
bun test
bun run typecheck
bun run demo
LOCAL_DEV_TOKEN=choose-a-local-test-token bun start
```

The server binds to 127.0.0.1:8787. `bun run demo` generates synthetic media and a completed workflow under `data/jobs/`, including MP4 clips, JPEG, JSON manifest and SRT. This command calls the core directly and performs no payment.

## API

| Request | Purpose |
| --- | --- |
| GET /health | Honest capabilities and payment configuration |
| POST /assets | Raw media bytes, maximum 50 MiB / 30 minutes; returns content hash |
| GET /assets/:id | Cached media metadata |
| POST /quotes | Validate and price `{assetId, steps}` |
| GET /quotes/:id | Retrieve persisted quote |
| POST /workflows | x402 paid enqueue; returns 503 by default until explicit validated configuration |
| POST /dev/workflows | Explicit local test enqueue `{quoteId,idempotencyKey}`; requires Bearer LOCAL_DEV_TOKEN |
| GET /jobs/:id | Status, attempts, errors and artifact names |
| GET /jobs/:id/artifacts/:name | Download successful outputs |

Example quote body:

```json
{"assetId":"UPLOAD_HASH","steps":[{"type":"clip","start":1,"duration":3},{"type":"normalize"},{"type":"convert","targetBytes":500000},{"type":"frames"}]}
```

Jobs are persisted before processing. One worker executes sequential steps, retries a failed job once, and recovers interrupted running jobs on restart. Idempotency keys map to one persisted job; reuse with another quote is rejected. Asset bytes and metadata are content-addressed. Quotes expire after four minutes and use an illustrative fixed 0.01 USDC per step; these are local estimates, not live payment challenges.

## Capability status

- `clip`: real FFmpeg clip extraction.
- `normalize`: real audio silence removal and loudness normalization. Requires an audio stream.
- `convert`: H.264/AAC conversion with a requested size budget; very low budgets are rejected. Quality is not guaranteed.
- `frames`: one first-frame JPEG and manifest. Optional OCR uses configured Tesseract TSV output; it remains unavailable here. This is a bounded preview, not full video indexing.
- `repair_subtitles`: parses SRT/VTT, validates timing, reflows text and applies explicit overlap policies. It does not align speech or repair semantics.
- `transcribe`: gated whisper.cpp adapter; requires an explicitly configured executable and model. `localize` remains unavailable. Optional frame OCR requires an explicitly configured Tesseract executable. Neither adapter has been exercised with a real installed model/engine in this environment.

## Payment and PayBox

See `adapter/README.md`. PayBox can consume x402 APIs directly; the bundle serves the documented hackathon upload route and a compact workflow interface. The adapter proposes payment and ends before approval. The agent must poll PayBox's request status, extract the paid response's job ID, and then call `get_job`.

Payment is deliberately disabled. Real receiver, payer wallet, trusted facilitator and public origin configuration are still required. The x402 protocol integration now implements challenge, verification, durable settlement reservation, replay gating and settled enqueue; only local mock-facilitator fixtures have been tested. The backend does not accept a PAYMENT-SIGNATURE as proof or pretend a fixture is live payment. Do not deploy this prototype as a paid public service yet.

The current file store is for one local process. Before public deployment add tenant authorization, bounded storage/retention, request quotas, media process isolation, quote ownership, opaque artifact access, and durable database coordination. Treat media uploads as untrusted. Workers have a two-minute subprocess timeout and one FFmpeg thread, but these limits alone are not a production security boundary.

## Current operation matrix

| Planned operation | Current executable behavior | Remaining dependency or limit |
| --- | --- | --- |
| Transcription/captions | Configurable whisper.cpp CLI adapter emits SRT/VTT/JSON | Binary/model absent; actual recognition unverified; no reusable transcript cache yet |
| Subtitle localization | Rejected with setup explanation | Translation provider and semantic QA not implemented |
| Clip extraction | FFmpeg start/duration extraction | No content-aware highlight selection |
| AI frames/OCR/manifests | First-frame JPEG, JSON manifest, optional Tesseract TSV adapter | Engine absent; actual OCR unverified; no full sampling/indexing |
| Subtitle repair | SRT/VTT parsing, timestamp validation, conversion, reflow, ordering/overlap options, warnings | No speech alignment or semantic rewrite |
| Target filesize/codec | Size-budgeted H.264/AAC MP4 | Fixed codec; no arbitrary codec selection |
| Silence/audio | Silence removal and loudness normalization | Audio stream required; timing changes are not propagated to existing subtitles |

Subtitle steps accept `options: {format: "srt" | "vtt", overlap: "error" | "trim" | "preserve", sort: boolean, maxChars: 10..100, maxLines: 1..5}`. Defaults reject overlaps and ordering problems, output SRT, and wrap at 42 characters. Long words and excessive line counts produce actionable warnings rather than silently dropping text. Each subtitle step also writes a warnings JSON artifact.

All routes except `/health` and the disabled `/workflows` endpoint require `Authorization: Bearer <LOCAL_DEV_TOKEN>`. With no token configured, data routes fail closed. This is a single-owner local prototype, not multi-tenant authorization. Configure a host-scoped brokered Authorization header for the API in PayBox before hosted data calls; never place this token in source, tool arguments or URLs. The future x402 payment request cannot use custom credential headers and will need a separately designed paid authorization boundary.

The API accepts raw uploads only, never arbitrary URLs. FFmpeg/ffprobe allow only local file/pipe protocols and a small media-format list, rejecting playlist/network ingestion. Invalid media is removed. Limits include 50 MiB input, 30-minute duration, 4K pixels, 8 streams, 8 workflow steps, one worker, one FFmpeg codec thread, 2 MiB subprocess output and a two-minute hard kill per subprocess. These are resource controls, not complete media sandboxing. User cancellation is currently unsupported. Retries only rerun local deterministic media processing in the same job directory; payments are never retried by the worker. Converted media may change timing or quality and should be checked before use.

## x402 protocol implementation (disabled by default)

The backend implements the [official x402 v2 protocol](https://github.com/coinbase/x402/blob/main/specs/x402-specification-v2.md), using a trusted facilitator's `/verify` and `/settle` endpoints. It does not implement cryptographic verification itself. `PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE` and `PAYMENT-RESPONSE` are protocol headers, added/consumed by the x402 client; they are distinct from unsupported custom headers in a PayBox proposal.

No production settings are present. Explicit configuration requires `PAYMENTS_ENABLED=true`, `PAYMENT_NETWORK=eip155:8453`, a public `PAYMENT_RECIPIENT`, the single account's public `ACCOUNT_PAYER`, exact HTTPS `PAYMENT_FACILITATOR` and `PUBLIC_API_ORIGIN` origins, and `LOCAL_DEV_TOKEN`. USDC on Base is the only implemented asset/network. No private keys are needed. The facilitator must implement unauthenticated x402 v2 verify/settle endpoints; providers requiring a different authorization contract need an explicit integration. The application does not discover providers or search saved credentials.

Authenticated quote creation records the account owner. The paid POST body contains only quote ID and idempotency key; quote identifiers are not access credentials. It accepts payment only from configured ACCOUNT_PAYER and checks facilitator verification and settlement payer evidence. This intentionally supports one configured account, not a public multi-user storefront. Ordinary data calls use the bearer token via PayBox's brokered header. Changing the token changes account ownership; plan migration before rotating production credentials.

A quote is bound once to a stable purchase key. Before calling settlement, a nonce reservation and pending purchase are durably written. Successful settlement is persisted before enqueue. Repeating that purchase returns the same job without another verify/settle. Nonces are reserved across quotes. A timeout, failed/unknown settlement, crash during settlement, or malformed settlement response stays pending and requires operator reconciliation; the server never automatically initiates another charge. An authenticated quote read exposes payment status. There is deliberately no automatic reconciliation endpoint until a facilitator-specific transaction lookup is selected. Durable records must not be deleted while authorizations can be replayed. Only one backend process may use this file store; multi-process coordination remains unsupported.

Tests use a loopback-only mock facilitator with fake authorization data. They prove application protocol/state handling, not signature correctness, on-chain finality, PayBox hosted compatibility, or live economic safety. Live payment remains untested and disabled.

## Local speech/OCR adapter setup

`WHISPER_BIN` and `WHISPER_MODEL` must be absolute paths to a deliberately installed whisper.cpp CLI and readable model. A transcription step creates mono 16 kHz PCM audio and requests JSON, SRT and VTT; returned files are parsed before publication. It uses automatic language detection, two threads and the same two-minute subprocess timeout. No word-alignment claim is made. Actual installed version flags and recognition quality must be checked after setup.

`TESSERACT_BIN` must be an absolute executable path. Add `ocr: true` to a `frames` step to request English TSV containing text/confidence/boxes. The engine and English trained data must already exist. No automatic installation, model downloads or paid calls occur. These are real external-process adapters with honest availability errors; only the missing-dependency path is verified here.

## Review fixes and present production boundary

Production settlement is now refused regardless of payment environment configuration: standard exact authorization does not bind our equal-priced quote bodies. `paymentConfigured` stays false. See [payment binding analysis](docs/payment-binding.md) for the demonstrated substitution threat, compatible options and why the temporary single-wallet constraint is not the completed customer design. The state-machine tests use an explicit fixture-only constructor allowance.

Job reads include authenticated `downloadPath` values. Join these relative paths to the API origin and provide the bearer header; never add the token to the URL. PayBox `read_artifact` can return owned artifacts up to 48 KiB as base64 through the brokered header; larger artifacts use direct authenticated downloads. Other owners and non-artifact filenames are refused.

Uploads/probes are admitted one at a time (concurrent HTTP uploads get 429). Each body is at most 50 MiB. Logical stored bytes are checked before uploads, quotes, enqueue and job execution and after steps; admission stops at 256 MiB. One admitted operation can temporarily exceed that threshold by its bounded output, so this is an application budget rather than an OS filesystem quota. Clip/normalize output is capped at 50 MiB; conversion accepts at most 100 MB; one worker and at most eight queued/running jobs bound processing. A maximum 256 quote records and 512 job records require explicit operator cleanup; automatic retention is not implemented. Failed intermediate files count toward the budget. Exhausted interrupted jobs recover to terminal failure rather than requeueing forever.

Known-invalid subtitle text/options are parsed during quote creation before any payment path. `bun run demo` remains the one-command synthetic core demonstration. See [verification evidence](docs/verification.md) for the exact Node24 path, Node22 limitation, local broker simulation and socket permission requirement.
