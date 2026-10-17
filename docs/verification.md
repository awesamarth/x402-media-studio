# Local verification evidence

Environment: macOS ARM64, Bun 1.3.14. Default `node` is `/usr/local/bin/node`, v22.17.0. Running `node scripts/conformance.mjs` inside `adapter/` fails as expected with `environment_invalid`; Node 22 is not an official conformance pass.

The existing Node 24 installation is `/Users/awesamarth/.nvm/versions/node/v24.12.0/bin/node`. Exact official-check command from `adapter/`:

```sh
PATH="/Users/awesamarth/.nvm/versions/node/v24.12.0/bin:$PATH" bun run test
```

This passes TypeScript, byte-identical double build and official starter 1.0.2 MCP conformance. The new bundle has six tools. See `adapter/conformance-report.json` for runtime, size and SHA256. The default sample remains setup-only inspect_asset; it is not evidence of backend connectivity.

Real bundled adapter/backend integration from project root:

```sh
NODE24_BIN=/Users/awesamarth/.nvm/versions/node/v24.12.0/bin/node bun scripts/adapter-integration.ts
```

This launches the actual bundled Node24 MCP process and actual loopback Bun API. A test-only fetch shim simulates the host broker by forwarding the configured illustrative HTTPS origin to loopback and injecting a fixed fixture bearer token. It successfully calls inspect_asset with real uploaded media, quote_workflow, free purchase_workflow, get_purchase, get_job and read_artifact; the artifact contents are checked. This is not HTTPS certificate, PayBox hosted, secret-broker, or payment validation. No public network request occurs.

`bun test` and the integration command require loopback socket access. This environment's default sandbox denied sockets; these checks passed after explicit tool sandbox escalation for local tests. A sandbox-denied run is not a failed implementation test or a passing verification. Other execution environments may need equivalent loopback permission. `bun run typecheck` does not require socket access.

All payment tests use a loopback mock facilitator and fabricated signatures, with no wallet or chain calls. The same verifier contract is used in the configurable server and mock-facilitator fixtures; BILLING_MODE defaults to free and paid configuration remains absent. Real signatures, facilitator authentication, settlement finality and production customer binding remain unverified.

The recovery fixture fills the queue while mock settlement returns, persists settled/awaiting_capacity, expires the quote, releases capacity and performs concurrent owner recovery calls. It verifies one job, one verification and one settlement. A queue full before settlement reports not_attempted. Adapter integration also checks a fixture-settled expired quote recovers without another proposal; these are artificial records, not live receipts.

## Installed real local models checkpoint

The latest complete run used `bun --env-file=.env.local test` (explicit local model paths) and passed **20 tests, 155 assertions**. `bun run test:ai` passed the two real-model and measured audio tests. A plain `bun test` without local test env can intentionally skip the installed-model fixture; that is not the real-model verification command.

whisper.cpp1.9.4 and its 147,951,465-byte base model performed actual JFK recording transcription; Tesseract5.5.3 recognized generated text pixels; the installed CTranslate2/SentencePiece model produced actual Spanish. The fixture preserves translation cue timings and checks OCR boxes/confidence. Repeated workflows hit all seven caches; changed OCR sample times miss only that step while transcript reuse remains intact. A separate silence fixture verifies duration reduction, audio/video synchronization and measured loudness.

`bun run setup:local` completed an idempotent local installation check. Linux ARM64 pinned binary-wheel resolution succeeded without a Linux runtime or VPS execution. The final six-tool adapter still passes official Node24.12.0 conformance, and the real backend/broker-shim integration passes free execution plus expired-settled recovery. Live paid/hosted checks remain unperformed. See local-runtime.md, translation.md and local-ai-results.json for source hashes, model sizes, exact commands and timings. No model files or venv are bundled in Git or the plugin.

Own-file HTTP usability checkpoint: `bun run try:file -- fixtures/jfk.wav` passed actual raw upload, transcription quote/free enqueue, polling and SRT/VTT/JSON download. Its temporary 7xxx server/process group and working data were removed after completion; no ongoing credential was saved. Upload admission is centralized at 104857600 bytes; focused tests accept exactly 100 MiB (and above the former 50 MiB limit), reject 100 MiB + 1 byte, and reject empty input. Duration/resource controls were not increased.
