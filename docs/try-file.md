# Try a local file or supported direct media URL

```sh
bun run try:file -- /absolute/path/to/video.mp4
bun run try:file -- /absolute/path/to/video.mp4 --language auto
bun run try:file -- 'https://raw.githubusercontent.com/ggml-org/whisper.cpp/v1.9.4/samples/jfk.wav'
```

**YouTube URLs are no longer supported.** The old local yt-dlp caption helper has been removed. Supply a local media file or a supported direct URL; see [URL imports](url-import.md).

The helper starts an isolated free loopback API on an available 7xxx port using temporary in-memory authentication. It uploads/imports the input, creates a quote, starts a free workflow, polls, and downloads artifacts. It never initiates payment or modifies the original input.

English transcription is the default. Input must contain audio and be within the five-minute transcription limit; uploads are capped at 100 MiB. Use `--steps` to provide an ordered workflow, for example:

```sh
bun run try:file -- /absolute/path/to/video.mp4 --steps '[{"type":"clip","start":0,"duration":5},{"type":"transcribe","language":"en"}]'
```

Outputs and `run.json` remain in `outputs/try-file/<run>/`. The helper stops its own API process and removes its temporary data afterward. Existing servers and downloaded outputs are untouched. Local Whisper/model configuration is required for transcription. The helper's polling deadline is separate from backend subprocess ceilings; use a short fixture for a quick check.
