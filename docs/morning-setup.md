# Morning checkpoint

The local implementation now executes all seven operations, including installed real speech recognition, English→Spanish translation, English OCR, chained outputs and reusable step/transcript caches. Billing remains FREE. No model/provider choice is required to test the existing English→Spanish path.

Run:

```sh
bun run demo:ai
bun run test:ai
bun --env-file=.env.local test
```

Model paths are already configured in ignored `.env.local`. No account credentials were created or selected. For API/PayBox testing, supply an account bearer secret through your normal process; `LOCAL_DEV_TOKEN` is the development account, while `API_ACCOUNTS_JSON` supplies distinct stable principals. [Exact existing demo artifacts](demo-outputs.md) are ready to inspect.

Remaining work is deployment/configuration rather than installing more local engines: approve the isolated VPS service/hostname, install/rebuild there using [the setup guide](local-runtime.md), configure account secret and data/retention/resource policy, run Linux ARM64 inference and benchmark, then configure exact PayBox HTTPS host/brokered header and hosted checks. The original VPS website, Caddy/DNS and Pebble remain untouched. No push, upload or submission occurred.

Keep BILLING_MODE=free for testing. Only when deliberately enabling paid mode, configure receiving address, compatible facilitator, Base network/public origin and verify live compatibility. No wallet/private key is needed for local free tests. All settlement tests use fabricated signatures and a mock facilitator. Known-settled enqueue recovery works after expiry without another charge; ambiguous settlement still requires operator reconciliation.

Actual supported languages: English speech verified (Whisper `auto` is available but other languages unverified); English→Spanish translation only; English OCR. Adding other launch languages is optional future scope. Models are kept out of Git/plugin bundles; the Argos translation archive's absent explicit weight license is documented for any redistribution decision. No license for weights was invented from the code's license.
