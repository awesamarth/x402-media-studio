# Installed local runtime and reproducible setup

All seven operations were exercised together on the connected ARM64 Mac. No hosted API, paid request, fabricated recognition result or credentials were used. Models and Python dependencies live under ignored `.runtime/`; the existing FFmpeg/ffprobe were reused. CMake 4.4.3 and Tesseract 5.5.3 plus their Homebrew dependencies were installed through Homebrew's official package registry. whisper.cpp was built from its official pinned source, rather than installing another unrelated runtime.

## Installed versions and model sizes

| Component | Installed/tested version | Data size/source |
| --- | --- | --- |
| whisper.cpp CPU CLI | 1.9.4, two inference threads, Metal disabled | Project-local build from checksum-verified official v1.9.4 archive; MIT code |
| Whisper small, multilingual weights (default) | ggml-small.bin | 487,601,967 bytes, official upstream-linked ggerganov/whisper.cpp model repository; SHA256 `1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b` |
| Tesseract | 5.5.3, English only in this pipeline | Homebrew executable; project-local official tessdata_fast eng.traineddata, 4,113,088 bytes; SHA256 `7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2` |
| Offline translation | CTranslate2 4.8.3, SentencePiece 0.2.2, Python 3.12.13 | Installed direct Argos English→Spanish 1.0 package; 87,503,191-byte download; model.bin 94,392,546 bytes; entire extracted directory 96,243,434 bytes (91.8 MiB) |

Translation uses an approximately 31 MiB project virtualenv containing only required inference packages (CTranslate2, SentencePiece, NumPy, PyYAML). Heavy unused Argos/Torch/Stanza/Spacy packages were removed after inspection. The complete `.runtime` folder is about 434 MiB including build artifacts, source and downloaded archives; model files are not committed or bundled in the plugin. Exact installed hashes/paths are in `.runtime/install-manifest.json` and translation manifests. [Translation provenance and licensing](translation.md) records that the translation archive has corpus attribution but no explicit weight license; no code-license inference or bundled redistribution is made.

## Commands on this Mac

```sh
bun run demo:ai
bun run test:ai
bun --env-file=.env.local test
bun run typecheck
```

`demo:ai` creates a text-bearing video with the actual upstream JFK speech fixture, executes every step, then repeats the same workflow to prove cache reuse. Recognition is real native model inference. OCR is real Tesseract recognition of rendered pixels. Spanish translation is real CTranslate2 inference. [Fixture provenance](../fixtures/README.md) and [recorded output/timings](local-ai-results.json) are retained.

The recorded final application-cache-miss pipeline took **3.253 s**, with transcription **1.059 s**, translation **0.288 s**, and three-frame extraction/OCR **0.616 s**. Earlier uncached runs varied up to 5.921 s. The repeated workflow took **0.104 s**, with all seven steps reporting cache hits. Standalone raw JFK transcription initially measured 1.58 s. These are small-input wall times on this Mac with normal OS caches, not controlled benchmarks or VPS predictions.

The produced MP4 was **154,394 bytes** under the 500,000-byte limit. OCR read “HELLO WORLD Media Studio OCR 2026” at 0, 2 and 6 seconds; every recognized word had a pixel box and confidence, with the minimum around 96 on this deliberately clean fixture. Requested seek times can differ by one source frame. The real-model test checks English recognition, Spanish text, preserved cue timings, OCR text/boxes/confidence, complete cache reuse and parameter-driven cache invalidation. A separate known-silence fixture verifies actual duration reduction, audio/video duration agreement within 0.15 s, and measured loudness near -16 LUFS.

## Fresh machine / later Linux ARM64 VPS

Do not copy a Mac binary or Python venv to Linux. Rebuild/resolve on the target architecture. Nothing below has been run on the VPS.

1. Install system prerequisites through the OS package manager. On Ubuntu/Debian: `build-essential cmake curl python3 ffmpeg tesseract-ocr tesseract-ocr-eng fonts-dejavu-core`. Install Bun and uv from their official distributions; no Pi CLI is involved.
2. Copy the repository without `.runtime`, `node_modules`, credentials or private media. Run `bun install --frozen-lockfile`.
3. Run `bun run setup:local`. On Mac it uses Homebrew for CMake/Tesseract. On Linux it checks the preinstalled OS tools. It verifies pinned source/model checksums before building/extracting; creates the Python 3.12 venv via uv; installs dependencies from the appropriate hashed Mac/Linux ARM64 lock; and writes non-secret engine paths to `.env.local`, preserving account settings. It explicitly sets billing to free.
4. Run `bun run demo:ai`, `bun run test:ai`, then `bun --env-file=.env.local test`. The default Linux demo font is DejaVu Sans; `DEMO_FONT` can point at another installed font.
5. Configure the isolated service's working directory, account secret, data ownership/retention and resource limits, then validate through Caddy only after deployment approval. Linux binary-wheel dependency resolution succeeded for Python 3.12/aarch64 with `--only-binary :all:`; actual Linux import/inference and two-CPU latency remain untested. Keep the worker serialized and benchmark before accepting longer input.

Bun jobs use explicit configured absolute executable/model paths. No models are fetched during startup/health checks or tool execution. Missing dependencies fail capability checks and quote acceptance. English speech is verified; `auto` detection is exposed but other-language recognition quality is not tested. Translation supports only direct en→es. OCR is English. Speech recognition is limited to five minutes per input (clip first), with the shared two-minute hard subprocess timeout. Low-quality/noisy media and long cues still need human review; this is not forced word alignment, arbitrary language support or scene understanding.

Whisper multilingual small is the service/setup default by explicit user choice. Base remains an optional explicit WHISPER_MODEL override; there is no automatic downgrade. Cache identities include the model content hash, preventing base output reuse after selecting small. Historical base benchmark records remain labeled as base.
