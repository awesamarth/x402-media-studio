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

## Guarded URL importer (2026-10-17)

Actual installed yt-dlp 2026.08.19 retrieved the upstream whisper.cpp v1.9.4 JFK WAV through the enforcing CONNECT proxy under a macOS sandbox-exec child egress rule. Extractor duration was absent: local FFprobe verified the bounded downloaded WAV before registering it. Real local Whisper processing succeeded with SRT, VTT and JSON artifacts (transcription step 2285 ms). The initial integration used disposable /tmp storage, cleaned after verification. Repeat with `bun --env-file=.env.local scripts/demo-import.ts`; that command retains its public-fixture artifacts and report under data/import-demo. No payment, cookies or saved provider credentials were used.

Focused importer/HTTP checks: 8 tests, 86 assertions; TypeScript passed. Adapter Node 24.12.0 official starter checks passed with eight tools; bundle 399470 bytes, SHA-256 aba331a4be6744aa695706e87cae6c165f50e03f0abdc56767540b48caa73f57. Linux downloader isolation and live provider/platform compatibility remain unverified; URL import is disabled on Linux.

Retained public-fixture rerun: 31,057 ms total, transcription 3,010 ms. Report: `data/import-demo/report.json`; artifacts: `data/import-demo/jobs/e2f6024ed2fbc5fdba996880f9e811383334922b55ec04be8c4c42f97dd11bd5/0.transcript.{srt,vtt,json}`. The demo asserts the expected “ask not” phrase.

## Small default, local helper and captions-first (2026-10-17)

Commit 707eb6b selects existing multilingual small in service fallback, local .env.local and setup scripts. SHA256 verified as 1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b; no duplicate download or benchmark was run. A no-inference check of localAI('transcribe') selected ggml-small.bin. Pipeline cache dependencies already hash the selected model content. Base remains an explicit override, never an automatic fallback.

Exact own-file helper passed real HTTP clip→normalize→convert→OCR on the generated speech-and-text fixture. Retained outputs: outputs/try-file/2026-10-17T12-27-55-554Z-5ea2cfdf/. The helper also passed actual HTTP import of the public upstream direct JFK WAV followed by normalization: outputs/try-file/2026-10-17T12-27-50-956Z-51d5770c/. Both isolated temporary servers stopped and removed work copies; downloaded artifacts remain.

Captions-first selection and caption-asset workflow tests passed without Whisper: manual preference, automatic fallback, genuine no-language result, unsupported format rejection, timing/overlap preservation, source provenance and owner isolation. A public YouTube page attempt (BaW_jenozKc) through the guarded real helper FAILED during extraction and produced no artifacts; no media fallback was attempted after that error. Therefore no live YouTube caption success is claimed. Direct-file Generic extraction is the only verified external source path.

Linux ARM64 downloader image built with existing Docker. A network-none container failed direct 1.1.1.1:443 connection and the real loopback relay reached an in-container Unix socket. Full native-Linux proxy→public-download integration remains pending; VPS untouched. See linux-import-runner.md. Sixteen focused core/import/caption/HTTP tests passed (138 assertions), TypeScript passed.

## Exact user-requested local runs and YouTube diagnosis

The official direct JFK URL was run through try:file with its default workflow after selecting small. It succeeded with SRT/VTT/JSON at outputs/try-file/2026-10-17T12-35-36-384Z-314eef58/. The JSON records generated Whisper provenance, English, expected JFK text and small model SHA256 1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b.

The user's Desktop alliance.mp4 completed the exact clip0–5→normalize→convert400000→OCR frames0,2 pipeline. Outputs: outputs/try-file/2026-10-17T12-35-41-298Z-a33f70bc/. Probe of 2.mp4: 323845 bytes, 5.013 seconds, H264 1920x1080 video (5.000s) and AAC audio (5.013s). Normalization retained the full 0–5 interval because no qualifying silence was found; an independent loudness analysis measured -16.74 LUFS, peak -1.49 dBTP. Both JPEGs were visually inspected. OCR at 2s recovered the visible caption's name with high confidence but misread the initial I as a vertical bar and included a zero-confidence scene false positive. Frame0 has no visible caption and OCR returned zero-confidence noise. Do not claim perfect OCR. The original input was only read. Both temporary HTTP servers stopped and removed working copies.

YouTube diagnostic: BaW_jenozKc first returned “This video is unavailable” and the app proxy recorded a denied www.google.com tunnel. The exact public host was added to the tunnel allowlist (it is not an accepted submitted frontend). A subsequent real test of https://www.youtube.com/watch?v=UF8uR6Z6KLc returned “Sign in to confirm you're not a bot,” with zero denied proxy hosts. yt-dlp did not expose an HTTP status for that extractor error. This is an upstream authentication/bot check after correcting the observed host-policy gap. No cookies, alternate network proxy, login or workaround was attempted; no caption-absence fallback ran. YouTube page support remains blocked/unverified in this environment. Source-caption fixture tests still pass; direct-file Generic retrieval is the verified external path.

## OCR zero-confidence summary correction

Recognized OCR words/text now require confidence strictly greater than zero. This removes zero-confidence scene junk without discarding any positive-confidence text; raw Tesseract TSV artifacts remain unchanged for diagnosis. Manifests state minimumExclusive:0 and rawTsvPreserved:true. Existing downloaded artifacts are historical and were not rewritten. The pipeline source content is already part of the cache identity, so subsequent runs cannot reuse pre-fix OCR manifests. A focused parser test checks negative/zero exclusion, 0.01 retention and the raw TSV remaining intact. No media pipeline or YouTube request was rerun for this correction.

## Superseding YouTube diagnosis: ordinary direct CLI succeeds

User-supplied plain listing evidence was reproduced using /usr/local/bin/yt-dlp on the same Stanford URL UF8uR6Z6KLc. It downloaded the webpage, used the visionos player API, and listed en/es automatic captions. No proxy environment variables were configured. A minimal list command through the app's enforcing relay instead got HTTP 429 on the webpage and a bot-check error, with no denied hosts; its player client was also visionos. The mismatch is the wrapper network path, not proof of a generally blocked source. No cookies, IP/proxy rotation or alternate client was used. Native DNS offers IPv4 and IPv6 while the relay pins IPv4; this is an observed difference, not proven root cause.

Actual direct normal CLI retrieval of exact en succeeded: source.en.vtt 115107 bytes, 681 cues, info JSON 4435686 bytes. This also exposed the API runner's insufficient 2 MiB metadata stdout bound. An overbroad local en.* retrieval selected unnecessary en-ar and got 429 on that subtitle; it was replaced with selecting exactly one appropriate track from metadata, then using ordinary yt-dlp subtitle flags. Metadata now uses a bounded temporary info file for the local helper.

Final real local helper run succeeded: manual English track en-eEY6OEpapPo, no media download, no Whisper. The existing authenticated caption-asset→quote→job→artifact API produced outputs/try-file/2026-10-17T12-46-29-489Z-e9682022/{transcript.srt,transcript.vtt,transcript.json,run.json}. Inspected JSON: engine source-captions, provenance manual/Youtube/en, 244 segments, 7.47–903.76s, no modelSha256. SRT and VTT timing tables match. Artifact sizes: SRT20563, VTT19703, JSON38069 bytes. Temporary API stopped and work copies removed. No additional automated tests were written or run after the user's instruction; TypeScript checking passed.

The working direct CLI path belongs to the trusted local helper only. Public /imports retains enforced network boundaries and remains an unresolved YouTube integration gate. Existing-caption upload is authenticated and does not fetch remote URLs. All earlier “YouTube blocked in this environment” wording is superseded by this successful direct-CLI evidence.

## Keyless billing correction — actual local HTTP run

No customer signup/API key was used. POST /requests automatically issued a scoped temporary handle. A real upload/quote returned402 at the public quote-specific purchase endpoint with no Authorization or request handle on payment. No job existed before settlement. A local facilitator-response shim simulated verify/settle only (dummy fixture signature and transaction, no chain request). The job executed all seven real operations: clip, normalize, convert, small transcription, en→es translation, subtitle repair and frame OCR. A private JPEG download succeeded; no-handle read401, another handle404. Repeat purchase returned the same job with one verification/settlement total. A separately quoted cached workflow also required402, then all steps hit cache only after its own simulated settlement. Cross-quote nonce replay409. Two distinct purchases resulted in exactly two simulated verifies/settles.

Report: docs/keyless-http-results.json; generated public-fixture JPEG: outputs/keyless-frame.jpg. Both temporary APIs were stopped; no ongoing credential was generated. Current configured test mode remains free, and the same single billing switch gates every service in paid mode. Poll/results/recovery never charge again. The adapter now carries only automatically issued handles on ordinary data calls and uses a public /purchases/<quoteId> URL without a handle/API key in payment proposals.

URL requests now create immutable paid quotes without retrieval; actual acquisition is part of the purchased job. Its local retrieval run reached the guarded downloader only after simulated settlement, but the public GitHub fixture timed out through the relay. This remaining network/runtime issue is not represented as a successful URL download. No bypass or infrastructure/security change was applied. Root and adapter TypeScript checks/build passed; no new automated test suite was run. Historical pre-keyless assertions expecting purchase responses without jobId are superseded by the requested jobId-returning API contract.

The earlier separate service-account, shared-permission and static customer-token deployment plan is withdrawn. Use existing ubuntu/project staging. Nothing was activated publicly or changed in VPS security/access configuration for this correction.
