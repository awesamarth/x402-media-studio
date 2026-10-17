# Verified PayBox demo

Use only the existing PayBox connection. Media Studio is an HTTPS API and uploaded PayBox plugin; no separate Media Studio connector is required or offered.

## Existing evidence to show without charging again

- Actual Base settlement is saved for quote e621b4dd-9c85-482c-8abf-3394be98e75c; job 73edfaba0eda9c584a6bcd00182a75c655649e05b67bc1ae1fd7e33c5937d011 succeeded with five artifacts. This is a completed prior payment, not a new payment request. Saved transaction: 0xc8797c9b2b8f2ee811b6dae5538482457791ee0e6a6229d3021d78fd711f27c9. Artifact availability expires after one hour; do not imply retained metadata guarantees downloadable files forever.
- New isolated VPS seven-operation demo: docs/readiness-all-seven.json. Real clip, normalize, convert, Whisper transcription, en-to-es translation, subtitle repair and three OCR frames succeeded in 17.003 seconds; repeated workflow reused all seven cache entries in 104 ms. Converted output 153758 bytes against 500000 target. No payment.
- Alliance real local API upload -> Whisper -> artifact download passed. Outputs: outputs/try-file/2026-10-17T17-52-06-252Z-c0fc6aaf/. Original video unchanged. No payment.

## Fresh demo flow

1. Read https://x402-media-studio.awesamarth.dev/llms.txt; inspect current live capabilities with inspect_asset without an asset ID. The plugin now reports live billing configuration rather than a stale disabled-payment message.
2. create_request; retain requestHandle internally. For an existing accessible public fixture, import_url with URL https://raw.githubusercontent.com/ggml-org/whisper.cpp/v1.9.4/samples/jfk.wav, media audio, an original stable idempotencyKey and steps [{"type":"transcribe","language":"en"},{"type":"localize","from":"en","to":"es"}]. The returned id is a quote ID, not a download/import job.
3. Alternatively, when the agent actually possesses attachment/file bytes AND an outbound upload tool, POST raw bytes to /assets with X-Request-Handle, retain response.id internally and quote_workflow with assetId. No manual user asset-ID copying is intrinsically necessary in a capable agent environment. PayBox JSON tool calls alone do not establish file-byte access or attachment forwarding. Never invent URLs from sandbox paths or attachment IDs.
4. Check authoritative amountAtomic and expiresAt. Current total is 10000 atomic USDC per workflow (0.01 USDC), Base. Quotes expire in four minutes. purchase_workflow produces the unsigned proposal; portal Validate transaction previews it without paying. In a connected agent use the actual discovered use_plugin contract. Direct PayBox use_service with quote-specific POST purchase URL and {idempotencyKey} tests backend payment independently of the adapter.
5. User approves the real PayBox payment if a new run is desired. Poll get_request using its returned request_id to terminal. Never repeat a write to poll. This runbook does not authorize signing or approving on the user's behalf.
6. get_purchase with original quoteId/requestHandle returns paymentStatus, current fulfillmentStatus, settlementReceipt and jobId. get_job until terminal, then read_artifact for owned SRT/VTT/JSON (base64 <=48 KiB). Large media uses authenticated downloadPath. Do not publish handles or signed URLs.

## Honest boundaries

Only raw.githubusercontent.com and media.w3.org direct HTTPS media URLs are enabled on the VPS, with extension/size/time/TLS/public-address bounds. Ordinary yt-dlp CLI is installed and captions-first acquisition is implemented; supported Node runtime is wired explicitly. The prepared isolated Linux image builds, but its production runner is not provisioned: Docker is absent, and user namespaces were previously denied. The previous Oracle YouTube attempt returned an explicit sign-in/bot-check. No cookie, alternate-client, proxy-egress or IP bypass is used. Do not demo YouTube as working.

Current PayBox skill, requirements, starter and exposed use_plugin schema do not document native ChatGPT attachment forwarding. The wrapper accepts JSON input; this is not evidence that opaque attachment references become downloadable files. A usable, genuinely accessible allowlisted URL is supported today. This transport limitation remains unresolved within the current PayBox-only contract; no second connector or upload page has been substituted.

Record a short working-plugin demo and show actual outputs. Any 60–90 second target is our recommendation, not an official duration rule. Official chapter requires a short video posted to X and a working plugin. Developer portal checks/proposal previews do not themselves submit or pay. Do not submit, accept terms, post to X, or publish from this runbook without the user's separate authorization.
