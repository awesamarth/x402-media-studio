# Keyless media API

Keep current testing free. The one execution-mode switch is BILLING_MODE=free or paid. Paid applies to **every one of the seven service operations**, including source-caption reuse, subtitle repair, OCR, translation and cache hits. It is never limited to expensive operations. Status and result downloads for an existing purchased job do not charge again.

## Paid customer flow

1. POST /requests with no Authorization/API key/signup. The response automatically issues requestId, requestHandle and expiresAt. It grants only this request's preparation and result access for one hour. The server stores its hash, never the raw handle.
2. For a file, POST raw bytes to /assets with X-Request-Handle, then POST /quotes with assetId and ordered steps. Alternatively POST /imports with url/media/steps, or POST /quotes with source:{url,media} and steps. URL ingestion returns a quote and performs no retrieval or processing yet.
3. GET or empty POST /purchases/<quoteId> returns HTTP402. The URL identifies the immutable quote, so a PayBox unpaid probe needs no body. The payment retry POST accepts idempotencyKey only and PAYMENT-SIGNATURE. No request handle, API key, or custom auth header belongs in the payment URL/body.
4. Only successful verified settlement enqueues the job. The 202 response supplies jobId. The verified payer is recorded with the purchase. Use the original X-Request-Handle on GET /jobs/<id> and artifact downloads, or GET /quotes/<id> for already-settled recovery. Do not pay again for polling, capacity recovery or unknown settlement outcomes.

All request preparation is bounded: five new requests per client connection address per minute, 64 active handles, one upload and four quotes per handle, 100 MiB per upload and the existing aggregate storage/queue/duration limits. Behind one reverse proxy the admission limit is conservatively shared unless a trusted client-IP policy is added. Expired unpaid requests/quotes/unreferenced uploads are reaped during admission; paid/reconciliation state is preserved. Handles are private per-request capabilities, automatically issued, not developer-issued customer accounts. Keep/download results within the stated handle lifetime.

A URL quote costs 10000 atomic USDC (0.01 USDC) per workflow step in paid mode, with no source-acquisition surcharge. Only direct media files on raw.githubusercontent.com and media.w3.org are supported; YouTube URLs are rejected before quote acceptance/payment. URL retrieval failures are reported as failed jobs; no automatic refund contract is implemented.

## Free testing

BILLING_MODE=free retains private free execution by default. The explicitly enabled PUBLIC_FREE_DEMO=1 option permits keyless demo requests with one job per request and twelve jobs per hour across the service; retries/polling/downloads do not consume another execution. Queue, storage, upload and process limits remain in force. The existing try:file helper supplies temporary process-only authentication automatically, for local files and supported direct media URLs. YouTube caption retrieval is no longer supported. No ongoing customer token or new service account is needed. Existing optional static credentials remain only for private/operator testing compatibility.

## PayBox

The adapter starts with create_request. Carry requestHandle in subsequent ordinary data tool arguments; the adapter sends X-Request-Handle. Payment proposals target the public quote-specific purchase URL and contain only idempotencyKey, never the handle. The sandbox is stateless, so later calls must supply the same scoped handle. No merchant-issued API secret/brokered header is required for the customer payment flow.

## Payment boundary

The workflow, source, amount and request owner are persisted in the quote. Clients cannot override them in the purchase body. Standard x402 exact EVM transfer authorization does not cryptographically bind the workflow body or URL. TLS and protected payment headers remain necessary. The nonce ledger prevents duplicate use; unknown settlement remains pending and is not automatically re-settled. No real payment has been made by local verification.

Current VPS deployment uses the existing ubuntu system service. Check /health for billing mode. Media uploads support all seven operations; caption uploads support caption operations. Direct-file URL imports remain supported. YouTube/video-platform imports are permanently disabled, independent of environment flags.
