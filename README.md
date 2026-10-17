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
| POST /workflows | Reserved paid enqueue; currently returns 503 because payment is unconfigured |
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
- `frames`: one first-frame JPEG and manifest. OCR is explicitly unconfigured; this is a bounded preview, not full video indexing.
- `repair_subtitles`: fixes decimal separators in supplied SRT timestamps. It does not align speech, repair semantics, or validate overlap.
- `transcribe` and `localize`: rejected with dependency explanation. No speech model, translation provider, transcript cache or OCR engine is configured yet.

## Payment and PayBox

See `adapter/README.md`. PayBox can consume x402 APIs directly; the bundle serves the documented hackathon upload route and a compact workflow interface. The adapter proposes payment and ends before approval. The agent must poll PayBox's request status, extract the paid response's job ID, and then call `get_job`.

Payment is deliberately disabled. A real receiver address, supported facilitator integration, challenge/verification/settlement logic, atomic enqueue binding and receipt replay protection are still required. The backend does not accept a PAYMENT-SIGNATURE as proof or pretend a fixture is live payment. Do not deploy this prototype as a paid public service yet.

The current file store is for one local process. Before public deployment add tenant authorization, bounded storage/retention, request quotas, media process isolation, quote ownership, opaque artifact access, and durable database coordination. Treat media uploads as untrusted. Workers have a two-minute subprocess timeout and one FFmpeg thread, but these limits alone are not a production security boundary.
