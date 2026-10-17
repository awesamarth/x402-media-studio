# Morning setup choices

1. Receiving wallet: provide a public Base receiving address and choose a facilitator. No private key is needed. The x402 v2 challenge, facilitator verification/settlement, durable pending ledger and replay protection are implemented and fixture-tested. Provide the account public payer wallet too; verify the selected facilitator and real setup before enabling.
2. Speech/translation/OCR: choose legitimate local models or providers and explicitly authorize any paid usage. No saved credentials were searched or used. Until configured, transcription and localization are unavailable; OCR reports unconfigured.
3. Hostname: choose an API subdomain. The proposed hostname has not been registered or configured.
4. Deployment approval: approve an isolated service on oracle-vps after production controls and payment are ready. Existing Flappy Bird and Pebble remain untouched.
5. PayBox portal: after deployment, set MEDIA_API_URL, allow its exact HTTPS hostname, upload adapter/dist/plugin.mjs, run hosted checks and submit before the deadline. No portal upload or submission occurred. Local protocol checks do not establish hosted networking or successful payment.

No separate frontend is needed. The local demo and core tests can be run now without any of these choices.

## Optional local dependency path

Candidate integrations to evaluate after launch language/model choices: [whisper.cpp CLI](https://github.com/ggml-org/whisper.cpp) for local transcription, [Tesseract CLI](https://tesseract-ocr.github.io/tessdoc/Command-Line-Usage.html) for OCR, and [Argos Translate](https://github.com/argosopentech/argos-translate) for explicitly installed language pairs. whisper.cpp and Tesseract external-process adapters are implemented, but binaries/models are not installed and actual recognition/OCR remains unverified. Argos localization remains unimplemented. Verify installed CLI flags, model licenses and representative output before advertising support. No model downloads are required from the user now.

Payment/auth design decision: backend data calls now require a single-owner bearer token (host-scoped PayBox brokered header). PayBox x402 purchase requests cannot carry custom credential headers. A production paid enqueue must authenticate through verified settlement and bind the receipt to an immutable quote and idempotency key; never expose the development enqueue endpoint as a payment bypass. Challenge/settlement and receipt replay protection are now implemented against the documented x402 v2 protocol with a mock facilitator; live verification remains outstanding. Current tests cover unpaid, invalid, successful fixture settlement, replay and ambiguous/failure outcomes; they do not verify real signatures or live receipts.

Implementation update: configure public ACCOUNT_PAYER for the single owner account as well as PAYMENT_RECIPIENT. Production configuration is disabled by default. Unknown settlement outcomes require manual facilitator-specific reconciliation; no automatic retry, transaction query or admin reconciliation endpoint is implemented. Do not delete nonce/payment records. Run one backend process only.
