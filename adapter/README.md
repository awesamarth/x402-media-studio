# PayBox adapter

This stateless MCP adapter delegates media work to the separate API. It never runs FFmpeg in the hosted sandbox. Upload `dist/plugin.mjs` through the PayBox developer portal only after the API is deployed and configured.

## Build and verify

Use Bun 1.3.14 to install pinned dependencies: `bun install --frozen-lockfile`. Use Node.js 24 for the official checks: `bun run test`. Run the payment construction fixtures with `bun test tests`.

This project started from the official PayBox starter 1.0.2. Dependencies, proposal helpers, schemas, and conformance tools retain that release. The package manager is Bun by user preference; `scripts/test.mjs` invokes `bun run` instead of `pnpm run`. The build uses esbuild's portable Node 24 ESM target and contains no Bun-only runtime APIs. The retained pnpm lockfile is the upstream reference; `bun.lock` is the install lockfile used here.

The local conformance sample calls `inspect_asset` without arguments. This checks startup, discovery, schemas, and the local setup response. It does **not** prove that a deployed backend, hosted network access, payment, or a media job works.

## Hosted setup

Set `MEDIA_API_URL` to the deployed HTTPS origin, such as `https://media.example.com`. Replace this illustrative hostname with the actual chosen domain. The value must have no path, credentials, fragment, query, or nonstandard port. Add that exact hostname to the portal network allowlist. No wildcard domains are used. Configure a host-scoped brokered Authorization bearer header for backend data routes; the plugin never reads its secret value. The receiving wallet and facilitator belong in backend configuration; they are not bundled here.

There is no deployed origin yet, so there is no real hostname to allowlist. Payments remain unavailable until the backend is configured and its facilitator integration is verified against a real deployment. The adapter refuses a quote whose `paymentConfigured` is false.

## Workflow

1. Upload raw media directly to `POST /assets` on the API; keep its returned asset ID.
2. Call `inspect_asset` with that asset ID.
3. Call `quote_workflow` with `assetId` and ordered `steps`. The seven planned step types are `transcribe`, `localize`, `clip`, `frames`, `repair_subtitles`, `convert`, and `normalize`. Backend validation reports unavailable operations and accepted parameters.
4. Call `purchase_workflow` with the quote ID and a stable idempotency key. It fetches the existing quote through `GET /quotes/:id` and returns an unsigned x402 proposal. No payment occurs in this plugin call.
5. Approve through PayBox, then poll the PayBox request until terminal. Inspect both payment status and the service response. The service response supplies the job ID. Do not make another purchase when the payment outcome is uncertain.
6. Call `get_job` with the job ID. Download returned artifact URLs separately; large media must not pass through the plugin's response.

API calls reject redirects, time out after 6.5 seconds, and reject JSON responses larger than 1 MiB. The hosted sandbox has a 10-second total limit including startup, so long-running work stays in the backend worker. Each call starts fresh; job and quote state live on the backend.
