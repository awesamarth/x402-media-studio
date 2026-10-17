# Exact existing local outputs

The authoritative current seven-step report is `/Users/awesamarth/Desktop/code/x402-media-studio/data/local-ai-demo/report.json`; its committed snapshot is `docs/local-ai-results.json`.

Seven-operation job folder:
`/Users/awesamarth/Desktop/code/x402-media-studio/data/local-ai-demo/jobs/788014b906d2b2e695471ef50734069a0e840538cf9f73f4e31d051543626b32/`

- `2.mp4`: clipped, silence-processed, normalized, converted video.
- `3.transcript.json`, `3.transcript.srt`, `3.transcript.vtt`: actual English speech recognition and segment timestamps.
- `4.srt`: real English→Spanish translation with preserved timings.
- `5.vtt`, `5.warnings.json`: repaired/reflowed Spanish WebVTT and warnings.
- `6.manifest.json`: three timestamped frames with OCR text, boxes and confidence.
- `6.frame-000.jpg`, `6.frame-001.jpg`, `6.frame-002.jpg`: actual extracted images.
- `6.ocr-000.tsv`, `6.ocr-001.tsv`, `6.ocr-002.tsv`: raw Tesseract word data.
- `1.audio.json`: silence intervals and output timing report.

Its fully cached repeat is under `data/local-ai-demo/jobs/46b72a08ab907e6f4fb159da44b2297538c15dfdc7dd196101f6c986df123f82/`.

The original small FFmpeg-only demo has also been preserved and rerun. Latest report: `/Users/awesamarth/Desktop/code/x402-media-studio/data/core-demo-report.json`; job directory:
`/Users/awesamarth/Desktop/code/x402-media-studio/data/jobs/f4eca30c7af8e723a10121b2cabd9055c3b8f3c8a5aa7d6fb98cef7c5cf206fa/`

Its converted video is `2.mp4`, frame `3.jpg`, manifest `3.manifest.json`, subtitles `4.srt`, and warning file `4.warnings.json`. Earlier reported demo job directories are still present; no existing demo media was removed. Running either demo again generates a new job ID and updates that command's report rather than deleting old jobs.
