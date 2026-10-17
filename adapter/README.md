# PayBox adapter

This stateless MCP adapter delegates media work to the separate API. It never runs FFmpeg in the hosted sandbox. Upload `dist/plugin.mjs` through the PayBox developer portal only after the API is deployed and configured.

## Build and verify

Use Bun 1.3.14 to install pinned dependencies: `bun install --frozen-lockfile`. Use Node.js 24 for the official checks: `bun run test`. Run the payment construction fixtures with `bun test tests`.

This project started from the official PayBox starter 1.0.2. Dependencies, proposal helpers, schemas, and conformance tools retain that release. The package manager is Bun by user preference; `scripts/test.mjs` invokes `bun run` instead of `pnpm run`. The build uses esbuild's portable Node 24 ESM target and contains no Bun-only runtime APIs. The retained pnpm lockfile is the upstream reference; `bun.lock` is the install lockfile used here.

The local conformance sample calls `inspect_asset` without arguments. This checks startup, discovery, schemas, and the local setup response. It does **not** prove that a deployed backend, hosted network access, payment, or a media job works.

## Hosted setup

Set `MEDIA_API_URL` to the deployed HTTPS origin, such as `https://media.example.com`. Replace this illustrative hostname with the actual chosen domain. The value must have no path, credentials, fragment, query, or nonstandard port. Add that exact hostname to the portal network allowlist. No wildcard domains are used. Paid customers need no API key or brokered Authorization secret. Call create_request and pass its automatically issued requestHandle to ordinary data tools; payment proposals never include that handle. The receiving wallet and facilitator belong in backend configuration; they are not bundled here.

There is no deployed origin yet, so there is no real hostname to allowlist. Payments remain unavailable until the backend is configured and its facilitator integration is verified against a real deployment. The adapter refuses a quote whose `paymentConfigured` is false.

## Workflow

1. Call create_request, then upload raw media to POST /assets using X-Request-Handle. Keep the returned asset ID and requestHandle. For URL inputs, import_url returns a quote without executing services in paid mode.
2. Call `inspect_asset` with that asset ID.
3. Call `quote_workflow` with `assetId` and ordered `steps`. The seven planned step types are `transcribe`, `localize`, `clip`, `frames`, `repair_subtitles`, `convert`, and `normalize`. Backend validation reports unavailable operations and accepted parameters.
4. Call `purchase_workflow` with the quote ID and a stable idempotency key. It fetches the existing quote through `GET /quotes/:id` and discovers the quote mode. Free mode starts a real authenticated job with paymentStatus not_required; paid mode returns an unsigned x402 proposal. No payment occurs inside this plugin call.
5. In paid mode, approve through PayBox, then poll the PayBox request until terminal. Inspect both payment status and the service response. The service response supplies a purchase acknowledgment. Call get_purchase with the quote ID using the scoped request handle to obtain the eventual job ID. Do not make another purchase when the payment outcome is uncertain.
6. Call `get_job` with the job ID. Download returned artifact URLs separately; large media must not pass through the plugin's response.

API calls reject redirects, time out after 6.5 seconds, and reject JSON responses larger than 1 MiB. The hosted sandbox has a 10-second total limit including startup, so long-running work stays in the backend worker. Each call starts fresh; job and quote state live on the backend.

`get_job` returns private relative downloadPath values. `read_artifact` returns artifacts up to 48 KiB as base64 through the scoped request handle; larger media requires the direct authenticated download route. No bearer secret appears in URLs or tool text. Payment enablement remains off pending real facilitator/deployment verification; see ../docs/payment-binding.md for the ownership and transfer-authorization boundary.

## Already-settled purchase recovery

Authenticated `get_purchase` (GET /quotes/:id) safely reconciles job creation for a known-settled purchase. It does not verify or settle payment again and ignores quote expiry for this recovery only. It reports fulfillmentStatus `awaiting_capacity`, `queued`, or `enqueue_failed` separately from paymentStatus `settled`. Release queue/storage capacity and poll the same owned purchase again; never buy another quote to recover a known settlement. The deterministic job key and enqueue lock preserve one job under concurrent polling and after interrupted persistence. Unknown settlement remains a separate operator reconciliation case and is never automatically treated as settled.

Capacity is checked before settlement, but this is not a durable slot reservation. A race, crash or storage change can still leave a settled purchase awaiting enqueue; the authenticated recovery path handles that condition. The adapter's purchase_workflow also recognizes an already-settled purchase before expiry/proposal logic and returns its recovery status without another proposal. get_purchase is therefore idempotent but may create the owed job, and its tool metadata marks that side effect.

All seven operations require purchase in paid mode, including source captions and cache hits. Existing free mode remains private. See ../docs/keyless-api.md. The historical conformance report predates these keyless changes; the updated bundle has been type-checked/built, without another automated test run per user instruction.
