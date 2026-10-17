# Morning setup

The application is FREE by default. Start with a deliberately configured local bearer token and `bun start`; no receiving wallet, facilitator or paid provider is needed for FFmpeg/subtitle workflows. `bun run demo` runs the free synthetic core pipeline. The actual bundled adapter integration also executes a free FFmpeg clip plus subtitle workflow and reads the resulting artifact.

Use BILLING_MODE=free|paid as the only billing switch. Free mode uses authenticated POST /workflows and never calls a facilitator. Paid mode requires complete valid settings and fails startup if incomplete; it never falls back to free on an error. PAYMENTS_ENABLED and ACCOUNT_PAYER are obsolete and ignored.

## Needed for morning testing

1. Choose the account credential configuration through your normal secret process. LOCAL_DEV_TOKEN supplies a single local-owner development principal; API_ACCOUNTS_JSON supplies distinct static account principals for customer isolation. No real credentials were created, selected or searched. In PayBox, broker the account bearer header to the exact API host.
2. Choose hostname and approve isolated deployment when ready. No DNS, server, Caddy, firewall or deployment changes were made. The VPS still needs OS-package FFmpeg/ffprobe and Bun setup; no manual binary download is needed from you. See deployment.md.
3. For speech/OCR, choose whether to install local whisper.cpp/model and Tesseract/English trained data. Adapters are implemented but actual recognition/OCR is unverified. No models were downloaded. Localization remains unimplemented; choose launch languages/provider later. No paid usage was authorized.

## Only when switching to paid

Provide a public receiving address and choose a trusted facilitator with the documented x402 v2 verify/settle API. Configure PAYMENT_NETWORK=eip155:8453, PAYMENT_RECIPIENT, PAYMENT_FACILITATOR and PUBLIC_API_ORIGIN, along with account authentication, then explicitly choose BILLING_MODE=paid. Check real facilitator compatibility and PayBox hosted validation before public paid use. No private key is required.

The exact EVM authorization signs transfer fields, not the workflow body. A payer funding another own equal-price quote is order interchangeability. Cross-account abuse additionally assumes authorization theft or deceptive approval. Account ownership does not move with payment; only the quote owner can read outputs. See payment-binding.md for the corrected boundary. No custom signing or wallet onboarding is required by this implementation.

Ambiguous settlement remains pending without another charge. Facilitator-specific reconciliation is manual; no automatic transaction-query/admin recovery API exists. Preserve payment/nonce records and run one backend process only. Self-service account onboarding and multi-process database coordination are future work.

## Evidence

`bun test`: 17 passing tests at the latest checkpoint; focused fixtures include two-account isolation, concurrent payment reuse, invalid/failed/unknown settlement, free-default/paid-fail-closed modes and real media outputs. No real wallet or facilitator call occurred.

Default Node22 fails official conformance as expected. Existing Node24.12.0 passes the exact command documented in verification.md. Loopback tests and adapter/backend integration required sandbox escalation. Adapter integration uses an explicit broker fetch shim, so it does not prove hosted TLS or real secret-broker behavior. Upload/submission and paid validation remain undone.
